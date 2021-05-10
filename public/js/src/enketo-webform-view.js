import gui from './module/gui';
import controller from './module/controller-webform';
import settings from './module/settings';
import connection from './module/connection';
import { init as initTranslator, t, localize } from './module/translator';

const loader = document.querySelector( '.main-loader' );
const formheader = document.querySelector( '.main > .paper > .form-header' );
const survey = {
    enketoId: settings.enketoId,
    instanceId: settings.instanceId
};
const range = document.createRange();

// Completely disable calculations in Enketo Core
import calcModule from 'enketo-core/src/js/calculate';
calcModule.update = () => {
    console.log( 'Calculations disabled.' );
};
// Completely disable instanceID and deprecatedID population in Enketo Core
import { FormModel } from 'enketo-core/src/js/form-model';
FormModel.prototype.setInstanceIdAndDeprecatedId = () => {
    console.log( 'InstanceID and deprecatedID population disabled.' );
};
// Completely disable preload items
import preloadModule from 'enketo-core/src/js/preload';
preloadModule.init = () => {
    console.log( 'Preloaders disabled.' );
};

initTranslator( survey )
    .then( survey => connection.getFormParts( survey ) )
    .then( formParts => {
        if ( survey.instanceId ) {
            return connection.getExistingInstance( survey )
                .then( response => {
                    formParts.instance = response.instance;
                    formParts.instanceAttachments = response.instanceAttachments;

                    return formParts;
                } );
        }

        return formParts;
    } )
    .then( formParts => {
        if ( formParts.form && formParts.model ) {
            return gui.swapTheme( formParts );
        } else {
            throw new Error( t( 'error.unknown' ) );
        }
    } )
    .then( _convertToReadonly )
    .then( _init )
    .catch( _showErrorOrAuthenticate );

function _showErrorOrAuthenticate( error ) {
    loader.classList.add( 'fail' );
    if ( error.status === 401 ) {
        window.location.href = `${settings.loginUrl}?return_url=${encodeURIComponent( window.location.href )}`;
    } else {
        if ( !Array.isArray( error ) ) {
            error = [ error.message  || t( 'error.unknown' ) ];
        }

        gui.alertLoadErrors( error );
    }
}

function _convertToReadonly( formParts ) {
    formParts.formFragment = range.createContextualFragment( formParts.form );
    // mark form controls as read only
    // Note: Enketo made a syntax error by adding the readonly attribute on a <select>
    // Hence, we cannot use .prop('readonly', true). We'll continue the syntax error.
    [ ...formParts.formFragment.querySelectorAll( '.question input:not([readonly]), .question textarea:not([readonly]), .question select:not([readonly])' ) ]
        .forEach( el => {
            el.setAttribute( 'readonly', 'readonly' );
            el.classList.add( 'readonly-forced' );
        } );
    // Properly make native selects readonly (for touchscreens)
    formParts.formFragment.querySelectorAll( 'select:not(#form-languages) option' )
        .forEach( el => el.disabled = true );
    // prevent adding an Add/Remove UI on repeats
    formParts.formFragment.querySelectorAll( '.or-repeat-info' )
        .forEach( el => el.setAttribute( 'data-repeat-fixed', 'fixed' ) );

    return formParts;
}

function _init( formParts ) {
    formheader.after( formParts.formFragment );
    const formEl = document.querySelector( 'form.or' );

    return controller.init( formEl, {
        modelStr: formParts.model,
        instanceStr: formParts.instance,
        external: formParts.externalData,
        instanceAttachments: formParts.instanceAttachments,
    } )
        .then( form => {
            formParts.languages = form.languages;
            document.querySelector( 'head>title' ).textContent = document.querySelector( '#form-title' ).textContent;
            if ( settings.print ) {
                gui.applyPrintStyle();
            }
            // after widgets have been initialized, localize all data-i18n elements
            localize( formEl );
        } );
}
