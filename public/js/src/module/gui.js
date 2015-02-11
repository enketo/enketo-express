/**
 * @preserve Copyright 2014 Martijn van de Rijdt
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
 * Deals with the main GUI elements (but not the survey form)
 */

define( [ 'Modernizr', 'q', 'settings', 'print', 'translator', 'vex.dialog.custom', 'jquery', 'plugin', ], function( Modernizr, Q, settings, printForm, t, dialog, $ ) {
    "use strict";

    var nav, pages, updateStatus, feedbackBar,
        supportLink = '<a href="mailto:' + settings[ 'supportEmail' ] + '">' + settings[ 'supportEmail' ] + '</a>';

    /**
     * Initializes a GUI object.
     */
    function init() {
        setEventHandlers();
        //$( 'footer' ).detach().appendTo( '#container' ); //WTF?

        // avoid windows console errors
        if ( typeof console == "undefined" ) {
            console = {
                log: function() {}
            };
        }
        if ( typeof window.console.debug == "undefined" ) {
            console.debug = console.log;
        }

        if ( !settings.debug ) {
            window.console.log = function() {};
            window.console.debug = function() {};
        }
        //override Modernizr's detection (for development purposes)
        if ( settings.touch ) {
            Modernizr.touch = true;
            $( 'html' ).addClass( 'touch' );
        } else if ( settings.touch === false ) {
            Modernizr.touch = false;
            $( 'html' ).removeClass( 'touch' );
        }

        //customize vex.dialog.custom.js options
        dialog.defaultOptions.className = 'vex-theme-plain';
    }

    /**
     * Sets the default (common) UI eventhandlers (extended in each class for custom handlers)
     */
    function setEventHandlers() {

        $( document ).on( 'click', '#feedback-bar .close, .touch #feedback-bar', function( event ) {
            feedbackBar.hide();
            return false;
        } );

        $( document ).on( 'click', '.side-slider .close, .slider-overlay', function( event ) {
            $( 'body' ).removeClass( 'show-side-slider' );
        } );

        $( '.form-header__button--print' ).on( 'click', function() {
            printForm( promptPrintSettings );
        } );

        $( '.side-slider__toggle, .offline-enabled__queue-length' ).on( 'click', function() {
            var $body = $( 'body' );
            window.scrollTo( 0, 0 );
            $body.toggleClass( 'show-side-slider' );
        } );

        $( '.offline-enabled__icon' ).on( 'click', function() {
            var msg = t( 'alert.offlinesupported.msg' );
            alert( msg, t( 'alert.offlinesupported.heading' ), 'normal' );
        } );

        $( document ).on( 'xpatherror', function( ev, error ) {
            var email = settings[ 'supportEmail' ],
                link = '<a href="mailto:' + email + '?subject=xpath errors for: ' + location.href + '&body=' + error + '" target="_blank" >' + email + '</a>';

            alert( t( 'alert.xpatherror.msg', {
                emailLink: link
            } ) + '<ul class="error-list"><li>' + error + '</li></ul>', t( 'alert.xpatherror.heading' ) );
        } );
    }

    function swapTheme( theme ) {
        var deferred = Q.defer();
        if ( !theme ) {
            console.log( 'No theme defined in form or database. Keeping default theme.' );
            deferred.resolve();
        } else if ( settings.themesSupported.some( function( supportedTheme ) {
                return theme === supportedTheme;
            } ) ) {
            var $currentStyleSheet = $( 'link[rel=stylesheet][media=all][href*=theme-]' ),
                $currentPrintStyleSheet = $( 'link[rel=stylesheet][media=print][href*=theme-]' ),
                $newStyleSheet = $( '<link rel="stylesheet" media="all" href="/css/theme-' + theme + '.css"/>' ),
                $newPrintStyleSheet = '<link rel="stylesheet" media="print" href="/css/theme-' + theme + '.print.css"/>';

            $newStyleSheet.on( 'load', function() {
                deferred.resolve();
            } );
            $currentStyleSheet.replaceWith( $newStyleSheet );
            $currentPrintStyleSheet.replaceWith( $newPrintStyleSheet );
        } else {
            console.log( 'Theme "' + theme + '" is not supported. Keeping default theme.' );
            deferred.resolve();
        }
        return deferred.promise;
    }

    feedbackBar = {
        /**
         * Shows an unobtrusive feedback bar to the user.
         *
         * @param {string} message
         * @param {number=} duration duration in seconds for the message to show
         */
        show: function( message, duration ) {
            var $msg;

            duration = ( duration ) ? duration * 1000 : 10 * 1000;

            // max 2 messages displayed
            $( '#feedback-bar' ).addClass( 'feedback-bar--show' )
                .find( 'p' ).eq( 1 ).remove();

            // if an already shown message isn't exactly the same
            if ( $( '#feedback-bar p' ).html() !== message ) {
                $msg = $( '<p></p>' ).append( message );
                $( '#feedback-bar' ).prepend( $msg );
            }

            // automatically remove feedback after a period
            setTimeout( function() {
                var siblings;
                if ( typeof $msg !== 'undefined' ) {
                    siblings = $msg.siblings( 'p' ).length;
                    $msg.remove();
                    if ( siblings === 0 ) {
                        feedbackBar.hide();
                    }
                }
            }, duration );
        },
        hide: function() {
            $( '#feedback-bar' ).removeClass( 'feedback-bar--show' )
                .find( 'p' ).remove();
        }
    };

    /**
     * Select what type of unobtrusive feedback message to show to the user.
     *
     * @param {string}  message
     * @param {number=} duration duration in seconds for the message to show
     */
    function feedback( message, duration ) {
        if ( !Modernizr.touch ) {
            feedbackBar.show( message, duration );
        } else {
            alert( message, t( 'feedback.header' ), 'info', duration );
        }
    }

    /**
     * Shows a modal alert dialog.
     *
     * @param {string} message
     * @param {string=} heading
     * @param {string=} level css class or normal (no styling) ('alert', 'info', 'warning', 'error', 'success')
     * @param {number=} duration duration in secondsafter which dialog should self-destruct
     */
    function alert( message, heading, level, duration ) {
        level = level || 'error';

        dialog.alert( {
            message: message,
            title: heading || t( 'alert.default.heading' ),
            messageClassName: ( level === 'normal' ) ? '' : 'alert-box ' + level,
            buttons: {
                YES: {
                    text: t( 'alert.default.button' ),
                    type: 'submit',
                    className: 'btn btn-primary small'
                }
            },
            autoClose: duration,
            showCloseButton: true
        } );
    }

    /**
     * Shows a confirmation dialog
     *
     * @param {?(Object.<string, (string|boolean)>|string)=} content - In its simplest form this is just a string but it can
     *                                                         also an object with parameters msg, heading and errorMsg.
     * @param {Object=} choices - [type/description]
     */
    function confirm( content, choices ) {
        var errorMsg = '',
            message = ( typeof content === 'string' ) ? content : content.msg;

        if ( content.errorMsg ) {
            errorMsg = '<p class="alert-box error">' + content.errorMsg + '</p>';
        }

        choices = choices || {};

        dialog.confirm( {
            message: errorMsg + ( message || t( 'confirm.default.msg' ) ),
            title: content.heading || t( 'confirm.default.heading' ),
            buttons: [ {
                text: choices.posButton || t( 'confirm.default.posButton' ),
                type: 'submit',
                className: 'btn btn-primary small'
            }, {
                text: choices.negButton || t( 'confirm.default.negButton' ),
                type: 'button',
                className: 'btn btn-default small'
            } ],
            callback: function( value ) {
                console.log( 'closing dialog with value:', value );
                if ( value && typeof choices.posAction !== 'undefined' ) {
                    choices.posAction.call( value );
                } else if ( typeof choices.negAction !== 'undefined' ) {
                    choices.negAction.call( value );
                }
            },
            showCloseButton: true
        } );
    }

    function prompt( content, choices, inputs ) {
        var errorMsg = '',
            message = ( typeof content === 'string' ) ? content : content.msg;

        if ( content.errorMsg ) {
            errorMsg = '<p class="alert-box error">' + content.errorMsg + '</p>';
        }

        choices = choices || {};
        dialog.prompt( {
            message: errorMsg + ( message || '' ),
            title: content.heading || t( 'prompt.default.heading' ),
            buttons: [ {
                text: choices.posButton || t( 'confirm.default.posButton' ),
                type: 'submit',
                className: 'btn btn-primary small'
            }, {
                text: choices.negButton || t( 'confirm.default.negButton' ),
                type: 'button',
                className: 'btn btn-default small'
            } ],
            input: inputs,
            callback: function( value ) {
                console.log( 'closing dialog with value:', value );
                if ( value && typeof choices.posAction !== 'undefined' ) {
                    choices.posAction.call( null, value );
                } else if ( typeof choices.negAction !== 'undefined' ) {
                    choices.negAction.call( null, value );
                }
                if ( typeof choices.afterAction !== 'undefined' ) {
                    choices.afterAction.call( null, value );
                }
            },
            showCloseButton: true
        } );
    }

    /**
     * Shows modal asking for confirmation to redirect to login screen
     * @param  {string=} msg       message to show
     * @param  {string=} serverURL serverURL for which authentication is required
     */
    function confirmLogin( msg, serverURL ) {
        msg = msg || t( 'confirm.login.msg' );
        serverURL = serverURL || settings.serverURL;

        confirm( {
            msg: msg,
            heading: t( 'confirm.login.heading' )
        }, {
            posButton: t( 'confirm.login.posButton' ),
            negButton: t( 'confirm.login.negButton' ),
            posAction: function() {
                var search = '?return_url=' + encodeURIComponent( location.href );
                search += ( settings.touch ) ? '&touch=' + settings.touch : '';
                search += ( settings.debug ) ? '&debug=' + settings.debug : '';
                location.href = location.protocol + '//' + location.host + '/login' + search;
            }
        } );
    }

    /**
     * Shows modal with load errors
     * @param  {Array.<string>} loadErrors  load error messagesg
     * @param  {string=}        advice  a string with advice
     */
    function alertLoadErrors( loadErrors, advice ) {
        var errorStringHTML = '<ul class="error-list"><li>' + loadErrors.join( '</li><li>' ) + '</li></ul>',
            errorStringEmail = '* ' + loadErrors.join( '* ' ),
            email = settings[ 'supportEmail' ],
            link = '<a href="mailto:' + email + '?subject=loading errors for: ' + location.href + '&body=' + errorStringEmail + '" target="_blank" >' + email + '</a>',
            params = {
                emailLink: link,
                count: loadErrors.length
            };

        advice = advice || '';

        alert(
            '<p>' +
            t( 'alert.loaderror.msg1', params ) + ' ' + advice + '</p><p>' +
            t( 'alert.loaderror.msg2', params ) +
            '</p>' + errorStringHTML, t( 'alert.loaderror.heading', params )
        );
    }

    /**
     * Prompts for print settings
     *
     * @param  {*} ignore This is here for historic reasons but is ignored
     * @param  {{posAction: Function, negAction: Function, afterAction: Function}} actions Object with actions
     */
    function promptPrintSettings( ignore, actions ) {
        var texts = {
                heading: t( 'confirm.print.heading' ),
                msg: t( 'confirm.print.msg' )
            },
            options = {
                posButton: t( 'confirm.print.posButton' ), //Prepare',
                posAction: actions.posAction,
                negButton: t( 'alert.default.button' ),
                negAction: actions.negAction,
                afterAction: actions.afterAction
            },
            inputs = '<fieldset><legend>' + t( 'confirm.print.psize' ) + '</legend>' +
            '<label><input name="format" type="radio" value="A4" required checked/><span>' + t( 'confirm.print.a4' ) + '</span></label>' +
            '<label><input name="format" type="radio" value="letter" required/><span>' + t( 'confirm.print.letter' ) + '</span></label>' +
            '</fieldset>' +
            '<fieldset><legend>' + t( 'confirm.print.orientation' ) + '</legend>' +
            '<label><input name="orientation" type="radio" value="portrait" required checked/><span>' + t( 'confirm.print.portrait' ) + '</span></label>' +
            '<label><input name="orientation" type="radio" value="landscape" required/><span>' + t( 'confirm.print.landscape' ) + '</span></label>' +
            '</fieldset>' +
            '<p class="alert-box info" >' + t( 'confirm.print.reminder' ) + '</p>';

        prompt( texts, options, inputs );
    }

    function alertCacheUnsupported() {
        var message = t( 'alert.offlineunsupported.msg' ),
            choices = {
                posButton: t( 'alert.offlineunsupported.posButton' ),
                negButton: t( 'alert.offlineunsupported.negButton' ),
                posAction: function() {
                    window.location = settings[ 'modernBrowsersURL' ];
                }
            };
        confirm( {
            msg: message,
            heading: t( 'alert.offlineunsupported.heading' )
        }, choices );
    }

    /**
     * Updates various statuses in the GUI (connection, form-edited, browsersupport)
     *
     * @type {Object}
     */
    updateStatus = {
        offlineCapable: function( offlineCapable ) {
            if ( offlineCapable ) {
                $( '.offline-enabled__icon.not-enabled' ).removeClass( 'not-enabled' );
            } else {
                $( '.offline-enabled__icon' ).addClass( 'not-enabled' );
            }
        },
        applicationVersion: function( version ) {
            $( '.side-slider__app-version__value' ).text( version );
        }
    };

    function getErrorResponseMsg( statusCode ) {
        var msg,
            supportEmailObj = {
                supportEmail: settings.supportEmail
            },
            contactSupport = t( 'contact.support', supportEmailObj ),
            contactAdmin = t( 'contact.admin' ),
            statusMap = {
                '0': t( 'submission.http0' ),
                '200': t( 'submission.http2xx' ) + '<br/>' + contactSupport,
                '2xx': t( 'submission.http2xx' ) + '<br/>' + contactSupport,
                '400': t( 'submission.http400' ) + '<br/>' + contactAdmin,
                '403': t( 'submission.http403' ) + '<br/>' + contactAdmin,
                '404': t( 'submission.http404' ),
                '4xx': t( 'submission.http4xx' ),
                '413': t( 'submission.http413' ) + '<br/>' + contactSupport,
                '500': t( 'submission.http500', supportEmailObj ),
                '503': t( 'submission.http500', supportEmailObj ),
                '5xx': t( 'submission.http500', supportEmailObj )
            };

        console.debug( 'getting msg belonging to ', statusCode );

        statusCode = ( typeof statusCode !== 'undefined' ) ? statusCode.toString() : 'undefined';

        if ( statusMap[ statusCode ] ) {
            msg = statusMap[ statusCode ];
        } else if ( statusMap[ statusCode.replace( statusCode.substring( 1 ), 'xx' ) ] ) {
            msg = statusMap[ statusCode.replace( statusCode.substring( 1 ), 'xx' ) ];
        } else {
            msg = t( 'error.unknown' );
        }

        return msg;
    }

    $( document ).ready( function() {
        init();
    } );

    return {
        alert: alert,
        confirm: confirm,
        prompt: prompt,
        feedback: feedback,
        updateStatus: updateStatus,
        pages: pages,
        swapTheme: swapTheme,
        confirmLogin: confirmLogin,
        alertLoadErrors: alertLoadErrors,
        alertCacheUnsupported: alertCacheUnsupported,
        getErrorResponseMsg: getErrorResponseMsg
    };
} );
