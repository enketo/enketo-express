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
var $buttons = $( '.form-header__button--print, button#close-form' );
var survey = {
    enketoId: settings.enketoId,
    instanceId: settings.instanceId,
    noHashes: true
};

// Completely disable calculations in Enketo Core
require( 'enketo-core/src/js/calculation' ).update = function() {
    console.log( 'Calculations disabled.' );
};
// Completely disable instanceID and deprecatedID population in Enketo Core
require( 'enketo-core/src/js/Form-model' ).prototype.setInstanceIdAndDeprecatedId = function() {
    console.log( 'InstanceID and deprecatedID population disabled.' );
};
// Completely disable preload items
require( 'enketo-core/src/js/preload' ).init = function() {
    console.log( 'Preloaders disabled.' );
};


translator.init( survey )
    .then( function( survey ) {
        return connection.getFormParts( survey );
    } )
    .then( function( formParts ) {
        if ( survey.instanceId ) {
            return connection.getExistingInstance( survey )
                .then( function( response ) {
                    formParts.instance = response.instance;
                    formParts.instanceAttachments = response.instanceAttachments;
                    return formParts;
                } );
        }
        return formParts;
    } )
    .then( function( formParts ) {
        if ( formParts.form && formParts.model ) {
            return gui.swapTheme( formParts.theme || utils.getThemeFromFormStr( formParts.form ) )
                .then( function() {
                    return formParts;
                } );
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
        window.location.href = settings.loginUrl + '?return_url=' + encodeURIComponent( window.location.href );
    } else {
        gui.alert( error.message, t( 'alert.loaderror.heading' ) );
    }
}

function _convertToReadonly( formParts ) {
    formParts.form = $( formParts.form );
    // mark form controls as read only
    // Note: Enketo made a syntax error by adding the readonly attribute on a <select>
    // Hence, we cannot use .prop('readonly', true). We'll continue the syntax error.
    formParts.form.find( 'input, textarea, select' ).attr( 'readonly', 'readonly' );
    // Properly make native selects readonly (for touchscreens)
    formParts.form.find( 'option' ).prop( 'disabled', true );
    // prevent adding an Add/Remove UI on repeats
    formParts.form.find( '.or-repeat-info' ).attr( 'data-repeat-fixed', 'fixed' );
    return formParts;
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
            $( 'head>title' ).text( $( '#form-title' ).text() );
        } );
    } );
}
