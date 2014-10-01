require( [ 'require-config' ], function( rc ) {
    "use strict";
    console.time( 'client loading time' );
    require( [ 'gui', 'controller-webform', 'settings', 'connection', 'jquery' ],
        function( gui, controller, settings, connection, $ ) {
            var $loader = $( '.form__loader' ),
                $form = $( 'form.or' ),
                $buttons = $( 'button.print, button#validate-form, button#submit-form' ),
                survey = {
                    enketoId: settings.enketoId,
                    serverUrl: settings.serverUrl,
                    xformId: settings.xformId,
                    xformUrl: settings.xformUrl
                };

            connection.getFormParts( survey )
                .then( function( result ) {
                    if ( result.form && result.model ) {
                        _init( result.form, result.model );
                    } else {
                        throw new Error( 'Form not complete.' );
                    }
                } )
                .catch( _showError );

            function _showError( error ) {
                $loader.addClass( 'fail' );
                gui.alert( error.message, 'Something went wrong' );
            }

            function _init( formStr, modelStr ) {
                $loader[ 0 ].outerHTML = formStr;
                $( document ).ready( function() {
                    controller.init( 'form.or:eq(0)', modelStr, null );
                    $form.add( $buttons ).removeClass( 'hide' );
                    console.timeEnd( 'client loading time' );
                } );
            }
        } );
} );
