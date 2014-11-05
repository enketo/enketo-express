/**
 * @preserve Copyright 2014 Martijn van de Rijdt
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

define( [ 'settings', 'i18next' ], function( settings, i18next ) {
    "use strict";
    var options;

    // The postProcessor assumes that array values with line breaks should be divided into HTML paragraphs.
    i18next.addPostProcessor( "htmlParagraphs", function( value, key, options ) {
        var paragraphs = value.split( '\n' );
        return ( paragraphs.length > 1 ) ? '<p>' + paragraphs.join( '</p><p>' ) + '</p>' : value;
    } );

    options = {
        // path where language files are available
        resGetPath: '/locales/__lng__/translation.json',
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
        useCookie: false
    };

    i18next.init( options );

    return i18next.t;
} );
