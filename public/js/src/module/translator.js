'use strict';

var settings = require( './settings' );
var i18next = require( 'i18next-client' );
var $ = require( 'jquery' );

var options;

// The postProcessor assumes that array values with line breaks should be divided into HTML paragraphs.
i18next.addPostProcessor( 'htmlParagraphs', function( value, key ) {
    var paragraphs = value.split( '\n' );
    return ( paragraphs.length > 1 ) ? '<p>' + paragraphs.join( '</p><p>' ) + '</p>' : value;
} );

options = {
    // path where language files are available
    // resGetPath: '/locales/__lng__/translation.json',
    // load a fallback language
    fallbackLng: 'en',
    // allow language override with 'lang' query parameter
    detectLngQS: 'lang',
    // only load unspecific languages (i.e. without country code - may need to be changed at some stage)
    load: 'unspecific',
    // avoid uselessly attempting to obtain unsupported languages
    lngWhitelist: settings.languagesSupported,
    // always use htmlLineParagrahs post processor
    postProcess: 'htmlParagraphs',
    // don't use cookies, always detect
    useCookie: false,
    // use custom loader to avoid query string timestamp (messes up applicationCache)
    customLoad: function( lng, ns, options, loadComplete ) {
        // load the file for given language and namespace
        $.ajax( {
                url: '/locales/__lng__/translation.json'.replace( '__lng__', lng ),
                async: false
            } )
            .done( function( data ) {
                loadComplete( null, data );
            } )
            .fail( function( error ) {
                loadComplete( error );
            } );
    }
};

i18next.init( options );

module.exports = i18next.t;


/**
 * add keys from XSL stylesheets manually
 *
 * t('constraint.invalid');
 * t('constraint.required');
 */
