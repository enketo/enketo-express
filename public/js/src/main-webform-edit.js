'use strict';

require( './module/jquery-global' );
require( './module/promise-by-Q' );

var $ = require( 'jquery' );
var gui = require( './module/gui' );
var controller = require( './module/controller-webform' );
var settings = require( './module/settings' );
var connection = require( './module/connection' );
var t = require( './module/translator' );
var utils = require( './module/utils' );

var $loader = $( '.form__loader' );
var $form = $( 'form.or' );
var $buttons = $( '.form-header__button--print, button#submit-form' );
var survey = {
    enketoId: settings.enketoId,
    serverUrl: settings.serverUrl,
    xformId: settings.xformId,
    xformUrl: settings.xformUrl,
    instanceId: settings.instanceId
};

Promise.all( [
    connection.getFormParts( survey ),
    connection.getExistingInstance( survey )
] ).then( function( responses ) {
    var formParts = responses[ 0 ];
    formParts.instance = responses[ 1 ].instance;

    if ( formParts.form && formParts.model && formParts.instance ) {
        gui.swapTheme( responses[ 0 ].theme || utils.getThemeFromFormStr( responses[ 0 ].form ) )
            .then( function() {

                _init( formParts );
            } )
            .then( connection.getMaximumSubmissionSize )
            .then( function( maxSize ) {
                settings.maxSize = maxSize;
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

function _init( formParts ) {
    $loader[ 0 ].outerHTML = formParts.form;
    $( document ).ready( function() {
        controller.init( 'form.or:eq(0)', {
            modelStr: formParts.model,
            instanceStr: formParts.instance,
            external: formParts.externalData
        } ).then( function() {
            $form.add( $buttons ).removeClass( 'hide' );
            $( 'head>title' ).text( utils.getTitleFromFormStr( formParts.form ) );
        } );
    } );
}
