require( [ 'require-config' ], function( rc ) {
    "use strict";
    if ( console.time ) console.time( 'client loading time' );
    require( [ 'gui', 'controller-webform', 'settings', 'connection', 'q', 'translator', 'jquery' ],
        function( gui, controller, settings, connection, Q, t, $ ) {
            var $loader = $( '.form__loader' ),
                $form = $( 'form.or' ),
                $buttons = $( '.form-header__button--print, button#submit-form' ),
                survey = {
                    enketoId: settings.enketoId,
                    serverUrl: settings.serverUrl,
                    xformId: settings.xformId,
                    xformUrl: settings.xformUrl,
                    instanceId: settings.instanceId
                };

            Q.all( [
                connection.getFormParts( survey ),
                connection.getExistingInstance( survey )
            ] ).then( function( responses ) {
                if ( responses[ 0 ].form && responses[ 0 ].model && responses[ 1 ].instance ) {
                    gui.swapTheme( responses[ 0 ].theme || _getThemeFromFormStr( responses[ 0 ].form ) )
                        .then( function() {
                            _init( responses[ 0 ].form, responses[ 0 ].model, responses[ 1 ].instance );
                        } );
                } else {
                    throw new Error( t( 'error.unknown' ) );
                }
            } ).catch( _showErrorOrAuthenticate );

            function _showErrorOrAuthenticate( error ) {
                $loader.addClass( 'fail' );
                if ( error.status === 401 ) {
                    window.location.href = '/login?return_url=' + encodeURIComponent( window.location.href );
                } else {
                    gui.alert( error.message, t( 'alert.loaderror.heading' ) );
                }
            }

            // TODO: move to utils.js after merging offline features
            function _getThemeFromFormStr( formStr ) {
                var matches = formStr.match( /<\s?form .*theme-([A-z]+)/ );
                return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
            }

            // TODO: move to utils.js after merging offline features
            function _getTitleFromFormStr( formStr ) {
                var matches = formStr.match( /<\s?h3 id="form-title">([^<]+)</ );
                return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
            }

            function _init( formStr, modelStr, instanceStr ) {
                $loader[ 0 ].outerHTML = formStr;
                $( document ).ready( function() {
                    controller.init( 'form.or:eq(0)', modelStr, instanceStr );
                    $form.add( $buttons ).removeClass( 'hide' );
                    $( 'head>title' ).text( _getTitleFromFormStr( formStr ) );
                    if ( console.timeEnd ) console.timeEnd( 'client loading time' );
                } );
            }
        } );
} );
