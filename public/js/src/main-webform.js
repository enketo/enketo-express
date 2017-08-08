'use strict';

require( './module/promise-by-Q' );
require( './module/Array-from' );
require( './module/Array-includes' );

var $ = require( 'jquery' );
var gui = require( './module/gui' );
var controller = require( './module/controller-webform' );
var settings = require( './module/settings' );
var connection = require( './module/connection' );
var FormModel = require( 'enketo-core/src/js/Form-model' );
var translator = require( './module/translator' );
var t = translator.t;
var store = require( './module/store' );
var utils = require( './module/utils' );
var formCache = require( './module/form-cache' );
var appCache = require( './module/application-cache' );

var $loader = $( '.form__loader' );
var $buttons = $( '.form-header__button--print, button#validate-form, button#submit-form' );
var survey = {
    enketoId: settings.enketoId,
    serverUrl: settings.serverUrl,
    xformId: settings.xformId,
    xformUrl: settings.xformUrl,
    defaults: settings.defaults,
    noHashes: !settings.offline
};

_setEmergencyHandlers();

if ( settings.offline ) {
    console.log( 'App in offline-capable mode.' );
    delete survey.serverUrl;
    delete survey.xformId;
    delete survey.xformUrl;
    translator.init( survey )
        .then( formCache.init )
        .then( _addBranding )
        .then( _swapTheme )
        .then( _init )
        .then( formCache.updateMaxSubmissionSize )
        .then( formCache.updateMedia )
        .then( function( s ) {
            _updateMaxSizeSetting( s.maxSize );
            _setFormCacheEventHandlers();
            _setAppCacheEventHandlers();
            appCache.init();
        } )
        .catch( _showErrorOrAuthenticate );
} else {
    console.log( 'App in online-only mode.' );
    translator.init( survey )
        .then( connection.getFormParts )
        .then( translator.init )
        .then( _addBranding )
        .then( _swapTheme )
        .then( _init )
        .then( connection.getMaximumSubmissionSize )
        .then( _updateMaxSizeSetting )
        .catch( _showErrorOrAuthenticate );
}

function _updateMaxSizeSetting( maxSize ) {
    if ( maxSize ) {
        // overwrite default max size
        settings.maxSize = maxSize;
    }
}

function _showErrorOrAuthenticate( error ) {
    error = ( typeof error === 'string' ) ? new Error( error ) : error;
    console.error( error, error.stack );
    $loader.addClass( 'fail' );
    if ( error.status === 401 ) {
        window.location.href = settings.loginUrl + '?return_url=' + encodeURIComponent( window.location.href );
    } else {
        gui.alert( error.message, t( 'alert.loaderror.heading' ) );
    }
}

function _setAppCacheEventHandlers() {
    $( document )
        .on( 'offlinelaunchcapable', function() {
            console.log( 'This form is fully offline-capable!' );
            gui.updateStatus.offlineCapable( true );
            connection.getManifestVersion( $( 'html' ).attr( 'manifest' ) )
                .then( gui.updateStatus.applicationVersion );
        } )
        .on( 'offlinelaunchincapable', function() {
            console.error( 'This form cannot (or can no longer) launch offline.' );
            gui.updateStatus.offlineCapable( false );
        } )
        .on( 'applicationupdated', function() {
            gui.feedback( t( 'alert.appupdated.msg' ), 20, t( 'alert.appupdated.heading' ) );
        } );
}

function _setFormCacheEventHandlers() {
    $( document ).on( 'formupdated', function() {
        gui.feedback( t( 'alert.formupdated.msg' ), 20, t( 'alert.formupdated.heading' ) );
    } );
}

/**
 * Advanced/emergency handlers that should always be activated even if form loading fails.
 */
function _setEmergencyHandlers() {
    $( '.side-slider__advanced__button.flush-db' ).on( 'click', function() {
        gui.confirm( {
            msg: t( 'confirm.deleteall.msg' ),
            heading: t( 'confirm.deleteall.heading' )
        }, {
            posButton: t( 'confirm.deleteall.posButton' ),
            posAction: function() {
                store.flush().then( function() {
                    location.reload();
                } );
            }
        } );
    } );
}

/**
 * Adds/replaces branding if necessary, and unhides branding.
 * 
 * @param {[type]} survey [description]
 */
function _addBranding( survey ) {
    var $brandImg = $( '.form-header__branding img' );
    var attribute = ( settings.offline ) ? 'data-offline-src' : 'src';

    if ( survey.branding && survey.branding.source && $brandImg.attr( 'src' ) !== survey.branding.source ) {
        $brandImg.attr( 'src', '' );
        $brandImg.attr( attribute, survey.branding.source );
    }
    $brandImg.removeClass( 'hide' );

    return survey;
}

/**
 * Swaps the theme if necessary.
 * 
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function _swapTheme( survey ) {
    return new Promise( function( resolve, reject ) {
        if ( survey.form && survey.model ) {
            gui.swapTheme( survey.theme || utils.getThemeFromFormStr( survey.form ) )
                .then( function() {
                    resolve( survey );
                } );
        } else {
            reject( new Error( 'Received form incomplete' ) );
        }
    } );
}

function _prepareInstance( modelStr, defaults ) {
    var model;
    var init;
    var existingInstance = null;

    for ( var path in defaults ) {
        if ( defaults.hasOwnProperty( path ) ) {
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
    }
    return existingInstance;
}

function _init( formParts ) {
    var error;

    return new Promise( function( resolve, reject ) {
        if ( formParts && formParts.form && formParts.model ) {
            $loader.replaceWith( formParts.form );
            translator.localize( document.querySelector( 'form.or' ) );
            $( document ).ready( function() {
                // TODO pass $form as first parameter?
                // controller.init is asynchronous
                controller.init( 'form.or:eq(0)', {
                    modelStr: formParts.model,
                    instanceStr: _prepareInstance( formParts.model, settings.defaults ),
                    external: formParts.externalData
                } ).then( function( form ) {
                    form.view.$.add( $buttons ).removeClass( 'hide' );
                    $( 'head>title' ).text( utils.getTitleFromFormStr( formParts.form ) );
                    formParts.$form = form.view.$;
                    resolve( formParts );
                } );
            } );
        } else if ( formParts ) {
            error = new Error( 'Form not complete.' );
            error.status = 400;
            reject( error );
        } else {
            error = new Error( 'Form not found' );
            error.status = 404;
            reject( error );
        }
    } );
}
