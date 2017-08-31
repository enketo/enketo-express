'use strict';

var settings = require( './settings' );
var i18next = require( 'i18next' );
var XHR = require( 'i18next-xhr-backend' );
var LanguageDetector = require( 'i18next-browser-languagedetector' );
var init;
var t;
var localize;
var htmlParagraphsPostProcessor;
var initialize;


// The postProcessor assumes that array values with line breaks should be divided into HTML paragraphs.
htmlParagraphsPostProcessor = {
    type: 'postProcessor',
    name: 'htmlParagraphsPostProcessor',
    process: function( value, key ) {
        var paragraphs = value.split( '\n' );
        return ( paragraphs.length > 1 ) ? '<p>' + paragraphs.join( '</p><p>' ) + '</p>' : value;
    }
};

/**
 * Initializes translator and resolves **when translations have been loaded**.
 * 
 * @param  {=*?} something can be anything
 * @return {Promise}       promise resolving the original something argument
 */
init = function( something ) {
    return initialize
        .then( function() {
            return something;
        } );
};

initialize = new Promise( function( resolve, reject ) {
    i18next
        .use( XHR )
        .use( LanguageDetector )
        .use( htmlParagraphsPostProcessor )
        .init( {
            whitelist: settings.languagesSupported,
            fallbackLng: 'en',
            joinArrays: '\n',
            backend: {
                loadPath: settings.basePath + '/locales/__lng__/translation-combined.json',
            },
            detection: {
                order: [ 'querystring', 'navigator' ],
                lookupQuerystring: 'lang',
                caches: false
            },
            interpolation: {
                prefix: '__',
                suffix: '__'
            },
            postProcess: [ 'htmlParagraphsPostProcessor' ]
        }, function( error ) {
            if ( error ) {
                reject( error );
            } else {
                resolve();
            }
        } );
} );

t = function( key, options ) {
    return i18next.t( key, options );
};

/**
 * Localizes the descendents of an element based on the data-i18n attribute.
 * Performance-optimized in Chrome (used bench6 form).
 * 
 * @param  {Element} Element [description]
 */
localize = function( element ) {
    var i;
    var cache = {};
    var list = element.querySelectorAll( '[data-i18n]' );

    for ( i = 0; i < list.length; i++ ) {
        var el = list[ i ];
        var key = el.dataset.i18n;
        if ( key ) {
            if ( !cache[ key ] ) {
                cache[ key ] = t( key );
            }
            el.textContent = cache[ key ];
        }
    }
};

module.exports = {
    init: init,
    t: t,
    localize: localize
};

/**
 * add keys from XSL stylesheets manually
 *
 * t('constraint.invalid');
 * t('constraint.required');
 * t('form.required');
 */
