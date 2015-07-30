/**
 * @preserve Copyright 2014 Martijn van de Rijdt & Harvard Humanitarian Initiative
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Deals with storing the app in the applicationCache.
 */

define( [ 'jquery' ], function( $ ) {
    "use strict";

    function init() {
        if ( window.applicationCache ) {
            var status = window.applicationCache.status;

            console.log( 'Initializing applicationCache, current status', status );

            if ( status === window.applicationCache.IDLE ) {
                _reportOfflineLaunchCapable();
            } else if ( status === window.applicationCache.UPDATEREADY ) {
                _reportOfflineLaunchCapable();
                _swapCache();
            }

            $( window.applicationCache )
                .on( 'cached noupdate updateready', _reportOfflineLaunchCapable )
                .on( 'updateready', _swapCache )
                .on( 'obsolete', _reportOfflineLaunchIncapable );

        } else {
            console.error( 'applicationCache not supported on this browser, this form cannot launch online' );
        }
    }

    function _swapCache() {
        console.log( 'Swapping application cache' );
        // firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=769171
        try {
            window.applicationCache.swapCache();
            $( document ).trigger( 'applicationupdated' );
        } catch ( e ) {}
    }

    function _updateCache() {
        console.log( 'Checking for application cache update' );
        window.applicationCache.update();
    }

    function _reportOfflineLaunchCapable( event ) {
        console.log( 'Application cache event:', event );
        $( document ).trigger( 'offlinelaunchcapable' );
    }

    function _reportOfflineLaunchIncapable( event ) {
        console.log( 'Application cache event:', event );
        $( document ).trigger( 'offlinelaunchincapable' );
    }

    return {
        init: init
    };

} );
