import $ from 'jquery';
import gui from './module/gui';
import controller from './module/controller-webform';
import settings from './module/settings';
import connection from './module/connection';
import { FormModel } from 'enketo-core/src/js/form-model';
import { init as initTranslator, t, localize } from './module/translator';
import store from './module/store';
import utils from './module/utils';
import formCache from './module/form-cache';
import appCache from './module/application-cache';

const $loader = $( '.main-loader' );
const $formheader = $( '.main > .paper > .form-header' );
const survey = {
    enketoId: settings.enketoId,
    serverUrl: settings.serverUrl,
    xformId: settings.xformId,
    xformUrl: settings.xformUrl,
    defaults: settings.defaults
};

_setEmergencyHandlers();

if ( settings.offline ) {
    console.log( 'App in offline-capable mode.' );
    delete survey.serverUrl;
    delete survey.xformId;
    delete survey.xformUrl;
    initTranslator( survey )
        .then( formCache.init )
        .then( _addBranding )
        .then( _swapTheme )
        .then( _init )
        .then( formCache.updateMaxSubmissionSize )
        .then( formCache.updateMedia )
        .then( s => {
            _updateMaxSizeSetting( s.maxSize );
            _setFormCacheEventHandlers();
            _setAppCacheEventHandlers();
            appCache.init();
        } )
        .catch( _showErrorOrAuthenticate );
} else {
    console.log( 'App in online-only mode.' );
    initTranslator( survey )
        .then( connection.getFormParts )
        .then( _swapTheme )
        .then( _addBranding )
        .then( _init )
        .then( connection.getMaximumSubmissionSize )
        .then( _updateMaxSizeSetting )
        .catch( _showErrorOrAuthenticate );
}

function _updateMaxSizeSetting( maxSize ) {
    if ( maxSize ) {
        // overwrite default max size
        settings.maxSize = maxSize;
        $( 'form.or' ).trigger( 'updateMaxSize' );
    }
}

function _showErrorOrAuthenticate( error ) {
    error = ( typeof error === 'string' ) ? new Error( error ) : error;
    console.error( error, error.stack );
    $loader.addClass( 'fail' );
    if ( error.status === 401 ) {
        window.location.href = `${settings.loginUrl}?return_url=${encodeURIComponent( window.location.href )}`;
    } else {
        gui.alert( error.message, t( 'alert.loaderror.heading' ) );
    }
}

function _setAppCacheEventHandlers() {
    $( document )
        .on( 'offlinelaunchcapable', () => {
            console.log( 'This form is fully offline-capable!' );
            gui.updateStatus.offlineCapable( true );
            connection.getManifestVersion( $( 'html' ).attr( 'manifest' ) )
                .then( gui.updateStatus.applicationVersion );
        } )
        .on( 'offlinelaunchincapable', () => {
            console.error( 'This form cannot (or can no longer) launch offline.' );
            gui.updateStatus.offlineCapable( false );
        } )
        .on( 'applicationupdated', () => {
            gui.feedback( t( 'alert.appupdated.msg' ), 20, t( 'alert.appupdated.heading' ) );
        } );
}

function _setFormCacheEventHandlers() {
    $( document ).on( 'formupdated', () => {
        gui.feedback( t( 'alert.formupdated.msg' ), 20, t( 'alert.formupdated.heading' ) );
    } );
}

/**
 * Advanced/emergency handlers that should always be activated even if form loading fails.
 */
function _setEmergencyHandlers() {
    $( '.side-slider__advanced__button.flush-db' ).on( 'click', () => {
        gui.confirm( {
                msg: t( 'confirm.deleteall.msg' ),
                heading: t( 'confirm.deleteall.heading' )
            }, {
                posButton: t( 'confirm.deleteall.posButton' ),
            } )
            .then( confirmed => {
                if ( !confirmed ) {
                    throw new Error( 'Cancelled by user' );
                }
                return store.flush();
            } )
            .then( () => {
                location.reload();
            } )
            .catch( () => {} );
    } );
}

/**
 * Adds/replaces branding if necessary, and unhides branding.
 * 
 * @param {[type]} survey [description]
 */
function _addBranding( survey ) {
    const $brandImg = $( '.form-header__branding img' );
    const attribute = ( settings.offline ) ? 'data-offline-src' : 'src';

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
    if ( survey.form && survey.model ) {
        return gui.swapTheme( survey );
    } else {
        return Promise.reject( new Error( 'Received form incomplete' ) );
    }
}

function _prepareInstance( modelStr, defaults ) {
    let model;
    let init;
    let existingInstance = null;

    for ( const path in defaults ) {
        if ( defaults.hasOwnProperty( path ) ) {
            model = model || new FormModel( modelStr, {
                full: false
            } );
            init = init || model.init();
            if ( defaults.hasOwnProperty( path ) ) {
                // if this fails, the FormModel will output a console error and ignore the instruction
                model.node( path ).setVal( defaults[ path ] );
            }
            // TODO would be good to not include nodes that weren't in the defaults parameter
            // HOWEVER, that would also set number of repeats to 0, which may be undesired
            // TODO would be good to just pass model along instead of converting to string first
            existingInstance = model.getStr();
        }
    }
    return existingInstance;
}

function _init( formParts ) {
    let error;

    return new Promise( ( resolve, reject ) => {
        if ( formParts && formParts.form && formParts.model ) {
            $formheader.after( formParts.form );
            localize( document.querySelector( 'form.or' ) );
            $( document ).ready( () => {
                // TODO pass $form as first parameter?
                // controller.init is asynchronous
                controller.init( 'form.or:eq(0)', {
                    modelStr: formParts.model,
                    instanceStr: _prepareInstance( formParts.model, settings.defaults ),
                    external: formParts.externalData,
                } ).then( form => {
                    $( 'head>title' ).text( utils.getTitleFromFormStr( formParts.form ) );
                    formParts.$form = form.view.$;
                    if ( settings.print ) {
                        gui.applyPrintStyle();
                    }
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
