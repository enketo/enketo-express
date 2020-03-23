import settings from './settings';
import i18next from 'i18next';
import XHR from 'i18next-xhr-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
let init;
let t;
let localize;
let htmlParagraphsPostProcessor;
let initialize;


// The postProcessor assumes that array values with line breaks should be divided into HTML paragraphs.
htmlParagraphsPostProcessor = {
    type: 'postProcessor',
    name: 'htmlParagraphsPostProcessor',
    process( value ) {
        const paragraphs = value.split( '\n' );
        return ( paragraphs.length > 1 ) ? `<p>${paragraphs.join( '</p><p>' )}</p>` : value;
    }
};

/**
 * Initializes translator and resolves **when translations have been loaded**.
 * 
 * @param  {=*?} something can be anything
 * @return {Promise}       promise resolving the original something argument
 */
init = something => initialize
    .then( () => something );

initialize = new Promise( ( resolve, reject ) => {
    i18next
        .use( XHR )
        .use( LanguageDetector )
        .use( htmlParagraphsPostProcessor )
        .init( {
            whitelist: settings.languagesSupported,
            fallbackLng: 'en',
            joinArrays: '\n',
            backend: {
                loadPath: `${settings.basePath}${settings.offlinePath}/locales/build/__lng__/translation-combined.json`,
            },
            load: 'languageOnly',
            lowerCaseLng: true,
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
        }, error => {
            if ( error ) {
                reject( error );
            } else {
                resolve();
            }
        } );
} );

t = ( key, options ) => i18next.t( key, options );

/**
 * Localizes the descendents of an element based on the data-i18n attribute.
 * Performance-optimized in Chrome (used bench6 form).
 * 
 * @param  {Element} Element [description]
 */
localize = element => {
    let i;
    const cache = {};
    const list = element.querySelectorAll( '[data-i18n]' );

    for ( i = 0; i < list.length; i++ ) {
        const el = list[ i ];
        const key = el.dataset.i18n;
        if ( key ) {
            if ( !cache[ key ] ) {
                cache[ key ] = t( key );
            }
            el.textContent = cache[ key ];
        }
    }
};

export { init, t, localize };

/**
 * add keys from XSL stylesheets manually
 *
 * t('constraint.invalid');
 * t('constraint.required');
 * t('form.required');
 * 
 * and from custom widgets
 * 
 * t('literacywidget.start');
 * t('literacywidget.finish');
 */
