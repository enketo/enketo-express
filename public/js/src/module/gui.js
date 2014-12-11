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

define( [ 'Modernizr', 'settings', 'print', 'jquery', 'plugin', 'foundation.reveal' ], function( Modernizr, settings, printForm, $ ) {
    "use strict";

    var nav, pages, updateStatus, feedbackBar,
        supportLink = '<a href="mailto:' + settings[ 'supportEmail' ] + '">' + settings[ 'supportEmail' ] + '</a>';

    /**
     * Initializes a GUI object.
     */
    function init() {
        nav.setup();
        pages.init();
        setEventHandlers();
        $( 'footer' ).detach().appendTo( '#container' ); //WTF?
        positionPageAndBar();
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
    }

    /**
     * Sets the default (common) UI eventhandlers (extended in each class for custom handlers)
     */
    function setEventHandlers() {

        $( document ).on( 'click', '#feedback-bar .close', function( event ) {
            feedbackBar.hide();
            return false;
        } );

        $( document ).on( 'click', '.touch #feedback-bar', function( event ) {
            feedbackBar.hide();
        } );

        $( document ).on( 'click', '#page .close', function( event ) {
            pages.close();
            return false;
        } );

        $( document ).on( 'click', '.side-slider .close', function( event ) {
            $( 'body' ).removeClass( 'show-side-slider' );
        } );

        $( 'button.print' ).on( 'click', function() {
            printForm();
        } );

        $( '.side-slider-toggle' ).on( 'click', function() {
            var $body = $( 'body' );
            window.scrollTo( 0, 0 );
            $body.toggleClass( 'show-side-slider' );
        } );

        $( '.offline-enabled-icon' ).on( 'click', function() {
            var msg = "<p>This form can now be loaded and used without an Internet connection on this device. " +
                "Bookmark it for easy offline access." +
                "<p>Records are automatically stored and queued on your computer until an Internet connection is available. " +
                "When the app is online, records will be automatically submitted - one by one.</p>" +
                "<p>Only after a record has been succesfully submitted, it will be removed from the queue. " +
                "You can safely close down your browser and computer with items in the queue. " +
                "They will still be there next time you load the form.</p>";
            alert( msg, 'Form works offline!', 'normal' );
        } );

        // capture all internal links to navigation menu items (except the links in the navigation menu itself)
        $( document ).on( 'click', 'a[href^="#"]:not([href="#"]):not(nav ul li a)', function( event ) {
            var href = $( this ).attr( 'href' );
            console.log( 'captured click to nav page, href=' + href );
            //if href is not just an empty anchor it is an internal link and will trigger a navigation menu click
            if ( href !== '#' ) {
                event.preventDefault();
                $( 'nav li a[href="' + href + '"]' ).click();
            }
        } );

        // event handlers for navigation menu
        $( 'nav ul li a[href^="#"]' )
            .click( function( event ) {
                event.preventDefault();
                var targetPage = $( this ).attr( 'href' ).substr( 1 );
                pages.open( targetPage );
                $( this ).closest( 'li' ).addClass( 'active' ).siblings().removeClass( 'active' );
            } );

        // handlers for status icons in header
        $( window ).on( 'onlinestatuschange', function( e, online ) {
            updateStatus.connection( online );
        } );

        $( document ).on( 'edit', 'form.jr', function( event, status ) {
            //console.log('gui updating edit status icon');
            updateStatus.edit( status );
        } );

        $( document ).on( 'browsersupport', function( e, supported ) {
            updateStatus.support( supported );
        } );

        $( '#page, #feedback-bar' ).on( 'changepagebar', function() {
            positionPageAndBar();
        } );

        $( document ).on( 'xpatherror', function( ev, error ) {
            var email = settings[ 'supportEmail' ];
            alert( 'A formula evaluation error occurred. Please contact ' +
                '<a href="mailto:' + email + '?subject=xpath errors for: ' + location.href + '&body=' + error + '" target="_blank" >' + email + '</a>' +
                ' with this error:<ul class="error-list"><li>' + error + '</li></ul>', 'Formula Error' );
        } );

        $( '.ad .close' ).on( 'click', function() {
            $( this ).closest( '.ad' ).remove();
        } );
    }

    nav = {
        setup: function() {
            $( 'article.page' ).each( function() {
                var display, title = '',
                    id, link;
                id = $( this ).attr( 'id' );
                if ( $( this ).attr( 'data-display-icon' ) ) {
                    display = '<span class="glyphicon glyphicon-' + $( this ).attr( 'data-display-icon' ) + '" > </span>';
                } else if ( $( this ).attr( 'data-display' ) ) {
                    display = $( this ).attr( 'data-display' );
                } else display = id;
                if ( $( this ).attr( 'data-title' ) ) {
                    title = $( this ).attr( 'data-title' );
                } else title = id;
                if ( $( this ).attr( 'data-ext-link' ) ) {
                    link = $( this ).attr( 'data-ext-link' );
                } else link = '#' + id;

                $( '<li class=""><a href="' + link + '" title="' + title + '" >' + display + '</a></li>' )
                    .appendTo( $( '.navbar-right' ) );

            } );
        },
        reset: function() {

            $( 'nav ul li' ).removeClass( 'active' );
        }
    };

    pages = {
        /**
         * initializes the pages
         */
        init: function() {
            // placeholder 'parent' element for the articles (pages)
            this.$pages = $( '<pages></pages>' );
            // detaching pages from DOM and storing them in the pages variable
            $( 'article.page' ).detach().appendTo( this.$pages );
        },

        /**
         * Obtains a particular pages from the pages variable
         * @param  {string} name id of page
         * @return {jQuery}
         */
        get: function( name ) {
            var $page = this.$pages.find( 'article[id="' + name + '"]' );
            $page = ( $page.length > 0 ) ? $page : $( 'article[id="' + name + '"]' );
            return $page;
        },

        /**
         * Confirms whether a page with a particular id or any page is currently showing
         * @param  {string=}  name id of page
         * @return {boolean}       returns true or false
         */
        isShowing: function( name ) {
            var idSelector = ( typeof name !== 'undefined' ) ? '[id="' + name + '"]' : '';
            return ( $( '#page article.page' + idSelector ).length > 0 );
        },

        /**
         * Opens a page with a particular id
         * @param  {string} pg id of page
         */
        open: function( pg ) {
            var $page,
                $header = $( 'header' ),
                that = this;
            if ( this.isShowing( pg ) ) {
                return;
            }

            $page = this.get( pg );

            if ( $page.length !== 1 ) {
                console.error( 'page not found' );
                return;
            }

            if ( this.isShowing() ) {
                this.close();
            }

            $( '#page .content' ).prepend( $page.show() ).trigger( 'changepagebar' );
            $( '#page' ).show();
            //$('.overlay').show();
            $( '.main' ).css( 'opacity', '0.3' );

            $( window ).on( 'resize.pageEvents', function() {
                $( '#page' ).trigger( 'changepagebar' );
            } );
            setTimeout( function() {
                $( window ).on( 'click.pageEvents', function( event ) {
                    if ( $( event.target ).parents( '#page' ).length === 0 ) {
                        that.close();
                    }
                    return true;
                } );
            }, 1000 );
        },

        /**
         * Closes the currently shown page
         */
        close: function() {
            var $page = $( '#page .page' );
            if ( $page.length > 0 ) {
                this.$pages.append( $page.detach() );
                $( '#page' ).trigger( 'changepagebar' );
                $( '.navbar-right li' ).removeClass( 'active' );
                //$('#overlay').hide();
                $( window ).off( '.pageEvents' );
            }
            //$('.overlay').hide();
            $( '.main' ).css( 'opacity', '1' );
        }
    };

    feedbackBar = {
        /**
         * Shows an unobtrusive feedback bar to the user.
         *
         * @param {string} message
         * @param {number=} duration duration in seconds for the message to show
         */
        show: function( message, duration ) {

            var $msg,
                that = this;

            duration = ( duration ) ? duration * 1000 : 10 * 1000;

            // max 2 messages displayed
            $( '#feedback-bar p' ).eq( 1 ).remove();

            // if an already shown message isn't exactly the same
            if ( $( '#feedback-bar p' ).html() !== message ) {
                $msg = $( '<p></p>' );
                $msg.append( message );
                $( '#feedback-bar' ).prepend( $msg );
            }
            $( '#feedback-bar' ).show().trigger( 'changepagebar' );

            // automatically remove feedback after a period
            setTimeout( function() {
                if ( typeof $msg !== 'undefined' ) {
                    $msg.remove();
                }
                $( '#feedback-bar' ).trigger( 'changepagebar' );
            }, duration );
        },
        hide: function() {
            $( '#feedback-bar p' ).remove();
            $( '#feedback-bar' ).trigger( 'changepagebar' );
        }
    };

    /**
     * Select what type of unobtrusive feedback message to show to the user.
     *
     * @param {string}  message
     * @param {number=} duration duration in seconds for the message to show
     * @param {string=} heading  heading to show - defaults to information, ignored in feedback bar
     * @param {Object=} choices  choices to show - defaults to simple Close button, ignored in feedback bar for now
     */
    function feedback( message, duration, heading, choices ) {
        heading = heading || 'Information';
        //if ($('header').css('position') === 'fixed'){
        if ( !Modernizr.touch ) {
            feedbackBar.show( message, duration );
        }
        //a more obtrusive message is shown
        else if ( choices ) {
            confirm( {
                msg: message,
                heading: heading
            }, choices, null, duration );
        } else {
            alert( message, heading, 'info', duration );
        }
    }

    /**
     * Shows a modal alert box with a message.
     *
     * @param {string} message
     * @param {string=} heading
     * @param {string=} level css class or normal (no styling) ('alert', 'info', 'warning', 'error', 'success')
     * @param {number=} duration duration in secondsafter which dialog should self-destruct
     */
    function alert( message, heading, level, duration ) {
        var cls, timer, timeout, open,
            $alert = $( '#dialog-alert' );

        heading = heading || 'Alert';
        level = level || 'error';
        cls = ( level === 'normal' ) ? '' : 'alert-box ' + level;
        open = $alert.hasClass( 'open' );

        // write content into alert dialog
        $alert.find( '.modal__header h3' ).text( heading );
        $alert.find( '.modal__body p' ).removeClass().addClass( cls ).html( message ).capitalizeStart();
        $alert.find( '.self-destruct-timer' ).text( '' );

        // close handler for close button
        $alert.find( '.close' ).one( 'click', function() {
            $alert.foundation( 'reveal', 'close' );
        } );

        // cleanup after close
        $alert.one( 'close', function() {
            $alert.find( '.modal__header h3, .modal__body p' ).html( '' );
            clearInterval( timer );
            clearTimeout( timeout );
        } );

        // add countdown timer
        if ( typeof duration === 'number' ) {
            var left = duration;
            $alert.find( '.self-destruct-timer' ).text( left );
            timer = setInterval( function() {
                left--;
                $alert.find( '.self-destruct-timer' ).text( left );
            }, 1000 );
            timeout = setTimeout( function() {
                clearInterval( timer );
                $alert.foundation( 'reveal', 'close' );
            }, duration * 1000 );
        }

        // instantiate modal
        $alert.foundation( 'reveal', 'open' );

        // the .css('top', '') is a hack to fix an issue that occurs sometimes when gui.alert is called when it is already open
        if ( open ) {
            $alert.css( 'top', '' );
        }

        /* sample test code (for console):

        gui.alert('What did you just do???', 'Obtrusive alert dialog');

         */
    }

    /**
     * Function: confirm
     *
     * description
     *
     *   @param {?(Object.<string, (string|boolean)>|string)=} texts - In its simplest form this is just a string but it can
     *                                                         also an object with parameters msg, heading and errorMsg.
     *   @param {Object=} choices - [type/description]
     *   @param {number=} duration duration in seconds after which dialog should self-destruct
     */
    function confirm( texts, choices, values, duration ) {
        var msg, heading, errorMsg, closeFn, dialogName, $dialog, timer, timeout;

        if ( typeof texts === 'string' ) {
            msg = texts;
        } else if ( typeof texts.msg === 'string' ) {
            msg = texts.msg;
        }

        msg = msg || 'Please confirm action';
        heading = texts.heading || 'Are you sure?';
        errorMsg = texts.errorMsg || '';
        dialogName = texts.dialog || 'confirm';
        values = values || {};
        choices = choices || {};
        choices.posButton = choices.posButton || 'Confirm';
        choices.negButton = choices.negButton || 'Cancel';
        choices.posAction = choices.posAction || function() {};
        choices.negAction = choices.negAction || function() {};
        choices.beforeAction = choices.beforeAction || function() {};

        $dialog = $( '#dialog-' + dialogName );

        //write content into confirmation dialog
        $dialog.find( '.modal__header h3' ).text( heading );
        $dialog.find( '.modal__body .msg' ).html( msg ).capitalizeStart();
        $dialog.find( '.modal__body .error' ).html( errorMsg ).show();
        if ( !errorMsg ) {
            $dialog.find( '.modal__body .error' ).hide();
        }
        $dialog.find( 'input, select, textarea' ).each( function() {
            var name = $( this ).attr( 'name' );
            $( this ).val( values[ name ] || '' );
        } );

        // before handler
        $dialog.one( 'open', function() {
            choices.beforeAction.call();
        } );

        // close handler for close button
        $dialog.find( '.close' ).one( 'click', function() {
            $dialog.foundation( 'reveal', 'close' );
        } );

        // cleanup after close
        $dialog.one( 'close', function() {
            $dialog.find( '.modal__header h3, .modal__body .msg, .modal__body .error, .modal__footer .btn' ).text( '' );
            clearInterval( timer );
            clearTimeout( timeout );
        } );

        $dialog.find( 'button.positive' ).one( 'click', function() {
            var values = {};
            $( this ).closest( '.modal' ).find( 'input, select, textarea' ).each( function() {
                if ( $( this ).attr( 'name' ) ) {
                    values[ $( this ).attr( 'name' ) ] = $( this ).val().trim();
                }
            } );
            $dialog.foundation( 'reveal', 'close' );
            choices.posAction.call( undefined, values );
        } ).text( choices.posButton );

        $dialog.find( 'button.negative' ).one( 'click', function() {
            $dialog.foundation( 'reveal', 'close' );
            choices.negAction.call();
        } ).text( choices.negButton );

        // add countdown timer
        if ( typeof duration === 'number' ) {
            var left = duration;
            $dialog.find( '.self-destruct-timer' ).text( left );
            timer = setInterval( function() {
                left--;
                $dialog.find( '.self-destruct-timer' ).text( left );
            }, 1000 );
            timeout = setTimeout( function() {
                clearInterval( timer );
                $dialog.foundation( 'reveal', 'close' );
            }, duration * 1000 );
        }

        // instantiate dialog
        $dialog.foundation( 'reveal', 'open' );

        /* sample test code (for console):

        gui.confirm( {
            msg: 'This is an obtrusive confirmation dialog asking you to make a decision',
            heading: 'Please confirm this action',
            errorMsg: 'Oh man, you messed up big time!'
        }, {
            posButton: 'Confirmeer',
            negButton: 'Annuleer',
            posAction: function() {
                console.log( 'you just did something positive!' )
            },
            negAction: function() {
                console.log( 'you did something negative' )
            },
            beforeAction: function() {
                console.log( 'doing some preparatory work' )
            }
        }, null, 100 );

		gui.confirm('confirm this please');

	   */
    }



    /**
     * Shows modal asking for confirmation to redirect to login screen
     * @param  {string=} msg       message to show
     * @param  {string=} serverURL serverURL for which authentication is required
     */
    function confirmLogin( msg, serverURL ) {
        msg = msg || '<p>In order to submit your queued data, you need to login. If you want to do this now, you will be redirected,' +
            ' and loose unsaved information.</p><p>Would you like to login now or later?</p>';
        serverURL = serverURL || settings.serverURL;

        confirm( {
            msg: msg,
            heading: 'Login Required'
        }, {
            posButton: 'Log in now',
            negButton: 'Later',
            posAction: function() {
                var search = '?server=' + encodeURIComponent( serverURL ) + '&return=' + encodeURIComponent( location.href );
                search += ( settings.formId ) ? '&id=' + settings.formId : '';
                search += ( settings.touch ) ? '&touch=' + settings.touch : '';
                search += ( settings.debug ) ? '&debug=' + settings.debug : '';
                location.href = location.protocol + '//' + location.host + '/authenticate' + search;
            },
            negAction: function() {
                console.log( 'login cancelled' );
            },
            beforeAction: function() {}
        } );
    }

    /**
     * Shows modal with load errors
     * @param  {Array.<string>} loadErrors  load error messagesg
     * @param  {string=}        advice  a string with advice
     */
    function showLoadErrors( loadErrors, advice ) {
        var errorStringHTML = '<ul class="error-list"><li>' + loadErrors.join( '</li><li>' ) + '</li></ul',
            errorStringEmail = '* ' + loadErrors.join( '* ' ),
            s = ( loadErrors.length > 1 ) ? 's' : '',
            email = settings[ 'supportEmail' ];
        advice = advice || '';
        alert( '<p>Error' + s + ' occured during the loading of this form. ' + advice + '</p><br/><p>' +
            'Please contact <a href="mailto:' + email +
            '?subject=loading errors for: ' + location.href + '&body=' + errorStringEmail + '" target="_blank" >' + email + '</a>' +
            ' with the link to this page and the error message' + s + ' below:</p>' + errorStringHTML, 'Loading Error' + s );
    }

    function showCacheUnsupported() {
        var message = 'Offline application launch is not supported by your browser. ' +
            'You can use the form without this feature or see options for resolving this',
            choices = {
                posButton: 'Show options',
                negButton: 'Use it',
                posAction: function() {
                    window.location = settings[ 'modernBrowsersURL' ];
                }
            };
        confirm( {
            msg: message,
            heading: 'Application cannot launch offline'
        }, choices );
    }

    /**
     * Updates various statuses in the GUI (connection, form-edited, browsersupport)
     *
     * @type {Object}
     */
    updateStatus = {
        connection: function( online ) {

            /*console.log('updating online status in menu bar to:', online);
		if (online === true) {
			$('header #status-connection').removeClass().addClass('ui-icon ui-icon-signal-diag')
				.attr('title', 'It appears there is currently an Internet connection available.');
			$('.drawer #status').removeClass('offline waiting').text('');
		}
		else if (online === false) {
			$('header #status-connection').removeClass().addClass('ui-icon ui-icon-cancel')
				.attr('title', 'It appears there is currently no Internet connection');
			$('.drawer #status').removeClass('waiting').addClass('offline').text('Offline. ');
		}
		else{
			$('.drawer #status').removeClass('offline').addClass('waiting').text('Waiting. ');
		}*/
        },
        edit: function( editing ) {

            if ( editing ) {
                $( 'header #status-editing' ).removeClass().addClass( 'ui-icon ui-icon-pencil' )
                    .attr( 'title', 'Form is being edited.' );
            } else {
                $( 'header #status-editing' ).removeClass().attr( 'title', '' );
            }
        },
        support: function( supported ) {},
        offlineLaunch: function( offlineCapable ) {
            if ( offlineCapable ) {
                $( '.offline-enabled-icon.not-enabled' ).removeClass( 'not-enabled' );
            } else {
                $( '.offline-enabled-icon' ).addClass( 'not-enabled' );
            }
            //$( '.drawer #status-offline-launch' ).text( status );
        }
    };

    /**
     * Returns the height in pixels that it would take for this element to stretch down to the bottom of the window
     * For now it's a dumb function that only takes into consideration a header above the element.
     * @param  {jQuery} $elem [description]
     * @return {number}       [description]
     */
    function fillHeight( $elem ) {
        var bottom = $( window ).height(),
            above = $( 'header' ).outerHeight( true ),
            fluff = $elem.outerHeight() - $elem.height();
        return bottom - above - fluff;
    }

    /**
     * Makes sure sliders that reveal the feedback bar and page have the correct css 'top' property when the header is fixed
     */
    function positionPageAndBar() {
        var fTop, pTop,
            $header = $( 'header.navbar' ),
            hHeight = $header.outerHeight() || 0,
            $feedback = $( '#feedback-bar' ),
            fShowing = ( $feedback.find( 'p' ).length > 0 ) ? true : false,
            fHeight = $feedback.outerHeight(),
            $page = $( '#page' ),
            pShowing = pages.isShowing(),
            pHeight = $page.outerHeight() || 0;

        //to go with the responsive flow, copy the css position type of the header
        $page.css( {
            'position': $header.css( 'position' )
        } );

        if ( $header.length > 0 && $header.css( 'position' ) !== 'fixed' ) {
            if ( !fShowing ) {
                $feedback.hide();
            }
            if ( !pShowing ) {
                $page.hide();
            }
            return false;
        }

        fTop = ( !fShowing ) ? 0 - fHeight : hHeight;
        pTop = ( !pShowing ) ? 0 - pHeight : ( ( fShowing ) ? fTop + fHeight : hHeight );

        // the timeout works around an issue in Chrome where setting the css top property has no impact. 
        // https://github.com/MartijnR/enketo/issues/245
        // It is nice from a UX perspective as well to have a slight delay
        setTimeout( function() {
            $feedback.css( 'top', fTop + 'px' );
            $page.css( 'top', pTop + 'px' );
        }, 100 );
    }

    /**
     * Parses a list of forms
     * @param  {?Array.<{title: string, url: string, server: string, name: string}>} list array of object with form information
     * @param { jQuery } $target jQuery-wrapped target node with a <ul> element as child to append formlist to
     * @param { boolean=} reset if list provided is empty and reset is true, no error message is shown
     */
    function parseFormlist( list, $target, reset ) {
        var i,
            listHTML = '';
        console.log( 'list: ', list );
        if ( !$.isEmptyObject( list ) ) {
            for ( i = 0; i < list.length; i++ ) {
                listHTML += '<li><a class="btn btn-block btn-info" id="' + list[ i ].form_id + '" title="' + list[ i ].title + '" ' +
                    'href="' + list[ i ].url + '" data-server="' + list[ i ].server_url + '" >' + list[ i ].name + '</a></li>';
            }
            $target.removeClass( 'empty' );
        } else {
            $target.addClass( 'empty' );
            if ( !reset ) {
                listHTML = '<p class="alert alert-danger">Error occurred during creation of form list or no forms found</p>';
            }
        }
        $target.find( 'ul' ).empty().append( listHTML );
    }

    init();

    return {
        alert: alert,
        confirm: confirm,
        feedback: feedback,
        updateStatus: updateStatus,
        pages: pages,
        fillHeight: fillHeight,
        confirmLogin: confirmLogin,
        showLoadErrors: showLoadErrors,
        showCacheUnsupported: showCacheUnsupported,
        parseFormlist: parseFormlist
    };
} );
