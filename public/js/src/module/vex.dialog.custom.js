// last updated with mothership at https://github.com/HubSpot/vex v2.3.0

( function() {
    "use strict";
    var vexDialogFactory;

    vexDialogFactory = function( $, vex ) {
        var $formToObject, dialog, timer, timerInterval;
        if ( vex === null ) {
            return $.error( 'Vex is required to use vex.dialog' );
        }
        $formToObject = function( $form ) {
            var object;
            object = {};
            $.each( $form.serializeArray(), function() {
                if ( object[ this.name ] ) {
                    if ( !object[ this.name ].push ) {
                        object[ this.name ] = [ object[ this.name ] ];
                    }
                    return object[ this.name ].push( this.value || '' );
                } else {
                    object[ this.name ] = this.value || '';
                    return object[ this.name ];
                }
            } );
            return object;
        };
        dialog = {};
        dialog.buttons = {
            YES: {
                text: 'OK',
                type: 'submit',
                className: 'vex-dialog-button-primary'
            },
            NO: {
                text: 'Cancel',
                type: 'button',
                className: 'vex-dialog-button-secondary',
                click: function( $vexContent, event ) {
                    $vexContent.data().vex.value = false;
                    return vex.close( $vexContent.data().vex.id );
                }
            }
        };
        dialog.defaultOptions = {
            callback: function( value ) {},
            afterOpen: function() {},
            message: 'Message',
            input: "<input name=\"vex\" type=\"hidden\" value=\"_vex-empty-value\" />",
            value: false,
            buttons: [ dialog.buttons.YES, dialog.buttons.NO ],
            showCloseButton: false,
            messageClassName: '',
            onSubmit: function( event ) {
                var $form, $vexContent;
                $form = $( this );
                $vexContent = $form.parent();
                event.preventDefault();
                event.stopPropagation();
                $vexContent.data().vex.value = dialog.getFormValueOnSubmit( $formToObject( $form ) );
                return vex.close( $vexContent.data().vex.id );
            },
            focusFirstInput: true
        };
        dialog.defaultAlertOptions = {
            message: 'Alert',
            buttons: [ dialog.buttons.YES ]
        };
        dialog.defaultConfirmOptions = {
            message: 'Confirm'
        };
        dialog.open = function( options ) {
            var $vexContent;
            vex.close();
            options = $.extend( true, {}, vex.defaultOptions, dialog.defaultOptions, options );
            options.content = dialog.buildDialogForm( options );
            options.beforeClose = function( $vexContent ) {
                clearInterval( timerInterval );
                clearTimeout( timer );
                return options.callback( $vexContent.data().vex.value );
            };
            $vexContent = vex.open( options );
            dialog.addAutoCloseTimer( $vexContent, options );
            if ( options.focusFirstInput ) {
                $vexContent.find( 'button[type="submit"], button[type="button"], input[type="submit"], input[type="button"], textarea, input[type="date"], input[type="datetime"], input[type="datetime-local"], input[type="email"], input[type="month"], input[type="number"], input[type="password"], input[type="search"], input[type="tel"], input[type="text"], input[type="time"], input[type="url"], input[type="week"]' ).first().focus();
            }
            return $vexContent;
        };
        dialog.alert = function( options ) {
            if ( typeof options === 'string' ) {
                options = {
                    message: options
                };
            }
            options = $.extend( {}, dialog.defaultAlertOptions, options );
            return dialog.open( options );
        };
        dialog.confirm = function( options ) {
            if ( typeof options === 'string' ) {
                return $.error( 'dialog.confirm(options) requires options.callback.' );
            }
            options = $.extend( {}, dialog.defaultConfirmOptions, options );
            return dialog.open( options );
        };
        dialog.prompt = function( options ) {
            var defaultPromptOptions;
            if ( typeof options === 'string' ) {
                return $.error( 'dialog.prompt(options) requires options.callback.' );
            }
            defaultPromptOptions = {
                message: "<label for=\"vex\">" + ( options.label || 'Prompt:' ) + "</label>",
                input: "<input name=\"vex\" type=\"text\" class=\"vex-dialog-prompt-input\" placeholder=\"" + ( options.placeholder || '' ) + "\"  value=\"" + ( options.value || '' ) + "\" />"
            };
            options = $.extend( {}, defaultPromptOptions, options );
            return dialog.open( options );
        };
        dialog.buildDialogForm = function( options ) {
            var $title, $form, $input, $message, $timer;
            $title = $( '<h3 class="vex-dialog-title"/>' );
            $form = $( '<form class="vex-dialog-form" />' );
            $message = $( '<div class="vex-dialog-message" />' );
            $input = $( '<div class="vex-dialog-input" />' );
            $timer = $( '<div class="vex-auto-close-timer"/>' );
            $form.append( $title.append( options.title ) ).append( $message.append( options.message ).addClass( options.messageClassName ) ).append( $input.append( options.input ) ).append( $timer ).append( dialog.buttonsToDOM( options.buttons ) ).bind( 'submit.vex', options.onSubmit );
            return $form;
        };
        dialog.getFormValueOnSubmit = function( formData ) {
            if ( formData.vex || formData.vex === '' ) {
                if ( formData.vex === '_vex-empty-value' ) {
                    return true;
                }
                return formData.vex;
            } else {
                return formData;
            }
        };
        dialog.buttonsToDOM = function( buttons ) {
            var $buttons;
            $buttons = $( '<div class="vex-dialog-buttons" />' );
            $.each( buttons, function( index, button ) {
                var $button;
                $button = $( "<button type=\"" + button.type + "\"></button>" ).text( button.text ).addClass( button.className + ' vex-dialog-button ' + ( index === 0 ? 'vex-first ' : '' ) + ( index === buttons.length - 1 ? 'vex-last ' : '' ) ).bind( 'click.vex', function( e ) {
                    if ( button.click ) {
                        return button.click( $( this ).parents( vex.getSelectorFromBaseClass( vex.baseClassNames.content ) ), e );
                    }
                } );
                return $button.appendTo( $buttons );
            } );
            return $buttons;
        };
        dialog.addAutoCloseTimer = function( $vexContent, options ) {
            if ( options.autoClose && typeof options.autoClose === 'number' ) {
                var timeLeft = options.autoClose,
                    $timer = $vexContent.find( '.vex-auto-close-timer' ).text( timeLeft );
                timerInterval = window.setInterval( function() {
                    timeLeft--;
                    $timer.text( timeLeft );
                }, 1000 );
                timer = window.setTimeout( function() {
                    vex.close( $vexContent.data().vex.id );
                }, options.autoClose * 1000 );
            }
        };
        return dialog;
    };

    if ( typeof define === 'function' && define.amd ) {
        define( [ 'jquery', 'vex' ], vexDialogFactory );
    } else if ( typeof exports === 'object' ) {
        module.exports = vexDialogFactory( require( 'jquery' ), require( './vex.js' ) );
    } else {
        window.vex.dialog = vexDialogFactory( window.jQuery, window.vex );
    }

} ).call( this );
