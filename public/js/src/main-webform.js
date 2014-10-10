require( [ 'require-config' ], function( rc ) {
    "use strict";
    console.time( 'client loading time' );
    require( [ 'gui', 'controller-webform', 'settings', 'connection', 'enketo-js/FormModel', 'jquery' ],
        function( gui, controller, settings, connection, FormModel, $ ) {
            var $loader = $( '.form__loader' ),
                $form = $( 'form.or' ),
                $buttons = $( 'button.print, button#validate-form, button#submit-form' ),
                survey = {
                    enketoId: settings.enketoId,
                    serverUrl: settings.serverUrl,
                    xformId: settings.xformId,
                    xformUrl: settings.xformUrl,
                    defaults: settings.defaults
                };

            connection.getFormParts( survey )
                .then( function( result ) {
                    if ( result.form && result.model ) {
                        _init( result.form, result.model, _prepareInstance( result.model, settings.defaults ) );
                    } else {
                        throw new Error( 'Form not complete.' );
                    }
                } )
                .catch( _showError );

            function _showError( error ) {
                $loader.addClass( 'fail' );
                gui.alert( error.message, 'Something went wrong' );
            }

            function _prepareInstance( modelStr, defaults ) {
                var model, init,
                    existingInstance = null;

                for ( var path in defaults ) {
                    // TODO full:false support still needs to be added to FormModel.js
                    model = model || new FormModel( modelStr, {
                        full: false
                    } );
                    init = init || model.init();
                    if ( defaults.hasOwnProperty( path ) ) {
                        // if this fails, the FormModel will output a console error and ignore the instruction
                        model.node( path ).setVal( defaults[ path ] );
                    }
                    // TODO would be good to not include nodes that weren't in the defaults parameter
                    // TODO would be good to just pass model along instead of converting to string first
                    existingInstance = model.getStr();
                }
                return existingInstance;
            }

            function _init( formStr, modelStr, instanceStr ) {
                $loader[ 0 ].outerHTML = formStr;
                $( document ).ready( function() {
                    controller.init( 'form.or:eq(0)', modelStr, instanceStr );
                    $form.add( $buttons ).removeClass( 'hide' );
                    console.timeEnd( 'client loading time' );
                } );
            }
        } );
} );
