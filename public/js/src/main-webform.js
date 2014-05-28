require( [ 'require-config' ], function( rc ) {
    "use strict";

    //TODO: REFACTOR THIS TO MAKE CLEARER AND LESS UGLY

    require( [ 'controller-webform', 'jquery', 'settings', 'gui', 'connection' ],
        function( controller, $, settings, gui, connection ) {
            var instanceToEdit = window.instanceStrToEdit || undefined;
            var model = window.modelStr || undefined;
            $( document ).ready( function() {
                var $loading = $( 'progress' );
                if ( model ) {
                    // normal launched webform view
                    controller.init( 'form.or:eq(0)', model, instanceToEdit );
                } else if ( ( !settings.serverURL || !settings.formId ) && !settings.formURL ) {
                    console.log( 'settings', settings )
                    showError( 'No server url and/or id provided or no form url provided.' );
                    return;
                } else {
                    console.log( 'settings2', settings )
                    // view where serverURL and formID are passed as querystring
                    var response, bgColor,
                        i = 0,
                        $ads = $( '.ad' ),
                        $formFooter = $( '.form-footer' ),
                        $validateButton = $formFooter.find( '#validate-form' ).attr( 'disabled', 'disabled' );

                    connection.getTransForm( settings.serverURL, settings.formId, null, settings.formURL, {
                        success: function( response ) {
                            var loadErrors, formStr, modelStr,
                                $response = $( response );

                            if ( $response.find( ':first>form' ).length > 0 && $response.find( ':first>model' ).length > 0 ) {
                                formStr = new XMLSerializer().serializeToString( $response.find( ':first>form' )[ 0 ] );
                                modelStr = new XMLSerializer().serializeToString( $response.find( ':first>model' )[ 0 ] );
                                $formFooter.before( formStr );

                                controller.init( 'form.or:eq(0)', modelStr, null );

                                $validateButton.removeAttr( 'disabled' );
                            } else {
                                showError( 'An error occurred trying to obtain or transform the form.' );
                            }
                        },
                        error: function( jqXHR, status, errorThrown ) {
                            if ( jqXHR && jqXHR.status === 401 ) {
                                gui.confirmLogin( '<p>Form is protected and requires authentication.</p><p>Would you like to log in now?</p>' );
                            } else {
                                showError( 'An error occurred trying to obtain or transform the form (' + errorThrown + ')' );
                            }
                            $loading.remove();
                        },
                        complete: function() {
                            $loading.remove();
                        }
                    } );


                }

                function showError( msg ) {
                    $loading.remove();
                    $( '#validate-form' ).prev( '.alert' ).remove();
                    $( '#validate-form' ).before( '<p class="load-error alert alert-error alert-block">' + msg + '</p>' );
                }
            } );
        } );
} );
