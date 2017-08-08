'use strict';

require( './module/promise-by-Q' );
require( './module/Array-from' );
require( './module/Array-includes' );

var $ = require( 'jquery' );
var gui = require( './module/gui' );
var controller = require( './module/controller-webform' );
var settings = require( './module/settings' );
var connection = require( './module/connection' );
var translator = require( './module/translator' );
var t = translator.t;
var utils = require( './module/utils' );
var $loader = $( '.form__loader' );
var $form = $( 'form.or' );
var $buttons = $( '.form-header__button--print, button#submit-form' );
var survey = {
    enketoId: settings.enketoId,
    instanceId: settings.instanceId,
    noHashes: !settings.offline
};

translator.init( survey )
    .then( function( survey ) {
        return Promise.all( [
            connection.getFormParts( survey ),
            connection.getExistingInstance( survey )
        ] );
    } )
    .then( function( responses ) {
        var formParts = responses[ 0 ];
        formParts.instance = responses[ 1 ].instance;
        formParts.instanceAttachments = responses[ 1 ].instanceAttachments;

        if ( formParts.form && formParts.model && formParts.instance ) {
            gui.swapTheme( responses[ 0 ].theme || utils.getThemeFromFormStr( responses[ 0 ].form ) )
                .then( function() {

                    _init( formParts );
                } )
                .then( connection.getMaximumSubmissionSize )
                .then( _updateMaxSizeSetting );
        } else {
            throw new Error( t( 'error.unknown' ) );
        }
    } ).catch( _showErrorOrAuthenticate );

function _updateMaxSizeSetting( maxSize ) {
    if ( maxSize ) {
        // overwrite default max size
        settings.maxSize = maxSize;
    }
}

function _showErrorOrAuthenticate( error ) {
    $loader.addClass( 'fail' );
    if ( error.status === 401 ) {
        window.location.href = settings.loginUrl + '?return_url=' + encodeURIComponent( window.location.href );
    } else {
        gui.alert( error.message, t( 'alert.loaderror.heading' ) );
    }
}

function _init( formParts ) {
    $loader.replaceWith( formParts.form );
    translator.localize( document.querySelector( 'form.or' ) );
    $( document ).ready( function() {
        controller.init( 'form.or:eq(0)', {
            modelStr: formParts.model,
            instanceStr: formParts.instance,
            external: formParts.externalData,
            instanceAttachments: formParts.instanceAttachments
        } ).then( function( form ) {
            form.view.$.add( $buttons ).removeClass( 'hide' );
            $( 'head>title' ).text( utils.getTitleFromFormStr( formParts.form ) );
        } );
    } );
}
