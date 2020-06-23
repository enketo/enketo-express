import gui from './module/gui';
import controller from './module/controller-webform';
import settings from './module/settings';
import connection from './module/connection';
import { FormModel } from 'enketo-core/src/js/form-model';
import { init as initTranslator, t, localize, loadTranslation } from './module/translator';
import store from './module/store';
import utils from './module/utils';
import events from './module/event';
import formCache from './module/form-cache';
import applicationCache from './module/application-cache';

const loader = document.querySelector( '.main-loader' );
const formheader = document.querySelector( '.main > .paper > .form-header' );
const survey = {
    enketoId: settings.enketoId,
    serverUrl: settings.serverUrl,
    xformId: settings.xformId,
    xformUrl: settings.xformUrl,
    defaults: settings.defaults
};
const range = document.createRange();

_setEmergencyHandlers();

if ( settings.offline ) {
    console.log( 'App in offline-capable mode.' );
    delete survey.serverUrl;
    delete survey.xformId;
    delete survey.xformUrl;
    _setAppCacheEventHandlers();
    applicationCache.init( survey )
        .then( initTranslator )
        .then( formCache.init )
        .then( _addBranding )
        .then( _swapTheme )
        .then( _init )
        .then( formParts => {
            formParts.languages.forEach( loadTranslation );

            return formParts;
        } )
        .then( formCache.updateMaxSubmissionSize )
        .then( formCache.updateMedia )
        .then( s => {
            _updateMaxSizeSetting( s.maxSize );
            _setFormCacheEventHandlers();
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
    }
}

function _countChars( ) {
    var texts = document.getElementsByTagName("textarea");
    for(var i = 0; i < texts.length; i++){
    (function () {
      var text = texts[i];
      var wrapper = document.createElement('div');
      var c_wrap  = document.createElement('div');
      var max = text.maxLength;

      wrapper.style.position = 'relative';
      c_wrap.style.position = 'absolute';
      c_wrap.style.bottom = '8px';
      c_wrap.style.color = '#ccc';
      c_wrap.innerHTML = 'Character limit: ' + max + ' | Remaining: ' + max ;
      text.style.color = "#ccc";
      //text.style.resize = "none";
      text.style.height = "auto";
      text.rows = "3";
      text.parentNode.appendChild(wrapper);
      wrapper.appendChild(text);
      wrapper.appendChild(c_wrap);
      text.addEventListener('input', function() { _setMax(c_wrap, text, max); }, false);
      
    }());
    }

    function _setMax(c_wrap, text, max) {
        var remaining = max - text.value.length;
	    c_wrap.innerHTML = 'Character limit: ' + max + ' | Remaining: ' + remaining;
    }
}

function _showErrorOrAuthenticate( error ) {
    error = ( typeof error === 'string' ) ? new Error( error ) : error;
    console.error( error, error.stack );
    loader.classList.add( 'fail' );
    if ( error.status === 401 ) {
        window.location.href = `${settings.loginUrl}?return_url=${encodeURIComponent( window.location.href )}`;
    } else {
        gui.alert( error.message, t( 'alert.loaderror.heading' ) );
    }
}

function _setAppCacheEventHandlers() {

    document.addEventListener( events.OfflineLaunchCapable().type, event => {
        const capable = event.detail.capable;
        gui.updateStatus.offlineCapable( capable );

        const scriptUrl = applicationCache.serviceWorkerScriptUrl;
        if ( scriptUrl ) {
            connection.getServiceWorkerVersion( scriptUrl )
                .then( gui.updateStatus.applicationVersion );
        }

    } );

    document.addEventListener( events.ApplicationUpdated().type, () => {
        gui.feedback( t( 'alert.appupdated.msg' ), 20, t( 'alert.appupdated.heading' ) );
    } );
}

function _setFormCacheEventHandlers() {
    document.addEventListener( events.FormUpdated().type, () => {
        gui.feedback( t( 'alert.formupdated.msg' ), 20, t( 'alert.formupdated.heading' ) );
    } );
}

/**
 * Advanced/emergency handlers that should always be activated even if form loading fails.
 */
function _setEmergencyHandlers() {
    const flushBtn = document.querySelector( '.side-slider__advanced__button.flush-db' );

    if ( flushBtn ) {
        flushBtn.addEventListener( 'click', () => {
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
}

/**
 * Adds/replaces branding if necessary, and unhides branding.
 *
 * @param {*} survey - [description]
 */
function _addBranding( survey ) {
    const brandImg = document.querySelector( '.form-header__branding img' );
    const attribute = ( settings.offline ) ? 'data-offline-src' : 'src';

    if ( brandImg && survey.branding && survey.branding.source && brandImg.src !== survey.branding.source ) {
        brandImg.src = '';
        brandImg.setAttribute( attribute, survey.branding.source );
    }
    brandImg.classList.remove( 'hide' );

    return survey;
}

/**
 * Swaps the theme if necessary.
 *
 * @param  {*} survey - [description]
 * @return {*}        [description]
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
        if ( Object.prototype.hasOwnProperty.call( defaults, path ) ) {
            model = model || new FormModel( modelStr, {
                full: false
            } );
            init = init || model.init();
            if ( Object.prototype.hasOwnProperty.call( defaults, path ) ) {
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
            const formFragment = range.createContextualFragment( formParts.form );
            formheader.after( formFragment );
            const formEl = document.querySelector( 'form.or' );

            controller.init( formEl, {
                modelStr: formParts.model,
                instanceStr: _prepareInstance( formParts.model, settings.defaults ),
                external: formParts.externalData,
            } ).then( form => {
                formParts.languages = form.languages;
                formParts.htmlView = formEl;
                document.querySelector( 'head>title' ).textContent = utils.getTitleFromFormStr( formParts.form );
                if ( settings.print ) {
                    gui.applyPrintStyle();
                }
                // after widgets have been initialized, localize all data-i18n elements
                localize( formEl );
                resolve( formParts );
                _countChars();
            } );
            //} );
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
