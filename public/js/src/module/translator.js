'use strict';

var settings = require( './settings' );
var i18next = require( 'i18next' );
var XHR = require( 'i18next-xhr-backend' );
var LanguageDetector = require( 'i18next-browser-languagedetector' );
var $ = require( 'jquery' );
var init;
var t;
var htmlParagraphsPostProcessor;

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
    return new Promise( function( resolve, reject ) {
        i18next
            .use( XHR )
            .use( LanguageDetector )
            .use( htmlParagraphsPostProcessor )
            .init( {
                whitelist: settings.languagesSupported,
                fallbackLng: 'en',
                backend: {
                    loadPath: '/locales/__lng__/translation.json',
                },
                detection: {
                    order: [ 'querystring', 'navigator' ],
                    lookupQuerystring: 'lang',
                    caches: []
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
                    resolve( something );
                }
            } );
    } );
};

t = function( key, options ) {
    return i18next.t( key, options );
};

module.exports = {
    init: init,
    t: t
};

/**
 * add keys from XSL stylesheets manually
 *
 * t('constraint.invalid');
 * t('constraint.required');
 */
