import $ from 'jquery';
import gui from './module/gui';
import controller from './module/controller-webform';
import settings from './module/settings';
import connection from './module/connection';
import { init as initTranslator, t, localize } from './module/translator';

const $loader = $( '.main-loader' );
const $formheader = $( '.main > .paper > .form-header' );
const survey = {
    enketoId: settings.enketoId,
    instanceId: settings.instanceId
};

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
    $loader.addClass( 'fail' );
    if ( error.status === 401 ) {
        window.location.href = `${settings.loginUrl}?return_url=${encodeURIComponent( window.location.href )}`;
    } else {
        gui.alert( error.message, t( 'alert.loaderror.heading' ) );
    }
}

function _convertToReadonly( formParts ) {
    formParts.form = $( formParts.form );
    // mark form controls as read only
    // Note: Enketo made a syntax error by adding the readonly attribute on a <select>
    // Hence, we cannot use .prop('readonly', true). We'll continue the syntax error.
    formParts.form.find( 'input:not([readonly]), textarea:not([readonly]), select:not(#form-languages):not([readonly])' )
        .attr( 'readonly', 'readonly' )
        .addClass( 'readonly-forced' );
    // Properly make native selects readonly (for touchscreens)
    formParts.form.find( 'select:not(#form-languages) option' ).prop( 'disabled', true );
    // prevent adding an Add/Remove UI on repeats
    formParts.form.find( '.or-repeat-info' ).attr( 'data-repeat-fixed', 'fixed' );
    return formParts;
}

function _init( formParts ) {
    $formheader.after( formParts.form );
    localize( document.querySelector( 'form.or' ) );
    $( document ).ready( () => {
        controller.init( 'form.or:eq(0)', {
            modelStr: formParts.model,
            instanceStr: formParts.instance,
            external: formParts.externalData,
            instanceAttachments: formParts.instanceAttachments,
        } ).then( () => {
            $( 'head>title' ).text( $( '#form-title' ).text() );
            if ( settings.print ) {
                gui.applyPrintStyle();
            }
        } );
    } );
}
