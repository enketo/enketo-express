/**
 * @preserve Copyright 2012 Martijn van de Rijdt & Modi Labs
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

define( [ 'jquery', 'enketo-js/Widget' ], function( $, Widget ) {
    "use strict";

    var pluginName = 'onlineFilepicker';

    /**
     * File picker meant for online-only form views
     *
     * @constructor
     * @param {Element} element [description]
     * @param {(boolean|{touch: boolean, maxlength:number})} options options
     * @param {*=} e     event
     */

    function OnlineFilepicker( element, options, e ) {
        if ( e ) {
            e.stopPropagation();
            e.preventDefault();
        }
        this.namespace = pluginName;
        Widget.call( this, element, options );
        this._init();
    }

    //copy the prototype functions from the Widget super class
    OnlineFilepicker.prototype = Object.create( Widget.prototype );

    //ensure the constructor is the new one
    OnlineFilepicker.prototype.constructor = OnlineFilepicker;

    /**
     * initialize
     *
     */
    OnlineFilepicker.prototype._init = function() {
        var feedbackClass, feedbackMsg,
            $input = $( this.element );

        if ( typeof fileManager == "undefined" || !fileManager ) {
            feedbackClass = "warning";
            feedbackMsg = "File uploads not supported (yet)."; //" in previews and iframed views.";
        }

        $input
            .prop( 'disabled', true )
            .addClass( 'ignore force-disabled' )
            .after( '<div class="file-feedback text-' + feedbackClass + '">' + feedbackMsg + '</div>' );


    };

    /**
     *
     */
    $.fn[ pluginName ] = function( options, event ) {

        options = options || {};

        return this.each( function() {
            var $this = $( this ),
                data = $this.data( pluginName );

            //only instantiate if options is an object (i.e. not a string) and if it doesn't exist already
            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, ( data = new OnlineFilepicker( this, options, event ) ) );
            }
            //only call method if widget was instantiated before
            else if ( data && typeof options == 'string' ) {
                //pass the element as a parameter as this is used in fix()
                data[ options ]( this );
            }
        } );
    };

} );
