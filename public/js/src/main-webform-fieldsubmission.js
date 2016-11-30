'use strict';

require( './module/jquery-global' );
require( './module/promise-by-Q' );
require( './module/Array-from' );
require( './module/Array-includes' );

var $ = require( 'jquery' );
var gui = require( './module/gui' );
var controller = require( './module/controller-webform-fieldsubmission' );
var settings = require( './module/settings' );
var connection = require( './module/connection' );
var translator = require( './module/translator' );
var t = translator.t;
var utils = require( './module/utils' );
var $loader = $( '.form__loader' );
var $form = $( 'form.or' );
var $buttons = $( '.form-header__button--print, button#close-form, button#finish-form' );
var survey = {
    enketoId: settings.enketoId,
    serverUrl: settings.serverUrl,
    xformId: settings.xformId,
    xformUrl: settings.xformUrl,
    instanceId: settings.instanceId,
    noHashes: !settings.offline
};

translator.init( survey )
    .then( connection.getFormParts )
    .then( function( formParts ) {
        if ( location.pathname.indexOf( '/edit/' ) > -1 ) {
            if ( survey.instanceId ) {
                return connection.getExistingInstance( survey )
                    .then( function( response ) {
                        formParts.instance = response.instance;
                        // TODO: this will fail massively if instanceID is not populated (will use POST instead of PUT). Maybe do a check?
                        return formParts;
                    } );
            } else {
                throw new Error( 'This URL is invalid' );
            }
        } else {
            return formParts;
        }

    } )
    .then( function( formParts ) {
        if ( formParts.form && formParts.model ) {
            gui.swapTheme( formParts.theme || utils.getThemeFromFormStr( formParts.form ) )
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
        window.location.href = '/login?return_url=' + encodeURIComponent( window.location.href );
    } else {
        gui.alert( error.message, t( 'alert.loaderror.heading' ) );
    }
}

function _init( formParts ) {
    $loader.replaceWith( formParts.form );
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
