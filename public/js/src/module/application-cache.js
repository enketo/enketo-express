/**
 * Deals with storing the app in the applicationCache.
 */

import $ from 'jquery';

function init() {
    if ( window.applicationCache ) {
        const status = window.applicationCache.status;

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
    } catch ( e ) {
        console.error( 'Error swapping cache', e );
    }
}

function _reportOfflineLaunchCapable( event ) {
    console.log( 'Application cache event:', event );
    $( document ).trigger( 'offlinelaunchcapable' );
}

function _reportOfflineLaunchIncapable( event ) {
    console.log( 'Application cache event:', event );
    $( document ).trigger( 'offlinelaunchincapable' );
}

export default {
    init
};
