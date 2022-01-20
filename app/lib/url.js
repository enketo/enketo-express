const config = require( '../models/config-model' ).server;
const transformer = require( 'enketo-transformer' );

const markupEntities = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
};

/**
 * Escapes HTML and XML special characters, ensuring URLs are safe to insert into
 * a Survey's HTML form and XML model. Note: this is technically incorrect (as is
 * the MDN documentation for reserved HTML entities), as it does not include
 * single-quote characters. But this matches the current behavior in enketo-transformer
 * (which is the default behavior of libxmljs). This is probably safe, as transformer
 * will not serialize attribute values to single quotes.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Glossary/Entity}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/XML/XML_introduction#entities}
 * @param {string} value
 * @return {string}
 */
const escapeMarkupEntities = ( value ) => (
    value.replace( /[&<>"]/g, character => markupEntities[character] )
);

const escapeMarkupURLPath = ( value ) => {
    return escapeMarkupEntities(
        transformer.escapeURLPath( value )
    );
};

/**
 * Converts a url to a local (proxied) url.
 *
 * @static
 * @param { string } url - The url to convert
 * @return { string } The converted url
 */
function toLocalMediaUrl( url ) {
    const localUrl = `${config[ 'base path' ]}/media/get/${url.replace( /(https?):\/\//, '$1/' )}`;

    return escapeMarkupURLPath( localUrl );
}

/**
 * @typedef ManifestItem
 * @property {string} filename
 * @property {string} hash
 * @property {string} downloadUrl
 */

/**
 * @param {ManifestItem[]} manifest
 * @return {Record<string, string>}
 */
const toMediaMap = ( manifest ) => Object.fromEntries(
    manifest.map( ( { filename, downloadUrl } ) => (
        [ escapeMarkupURLPath( filename ), toLocalMediaUrl( downloadUrl ) ]
    ) )
);

/**
 * @typedef {import('../models/survey-model').SurveyObject} Survey
 */

/**
 * @param {Survey} survey
 * @return {Survey}
 */
const replaceMediaSources = ( survey ) => {
    const media = toMediaMap( survey.manifest );

    let { form, model } = survey;

    if ( media ) {
        const JR_URL = /"jr:\/\/[\w-]+\/([^"]+)"/g;
        const replacer = ( match, filename ) => {
            if ( media[ filename ] ) {

                return `"${media[ filename ]}"`;
            }

            return match;
        };

        form = form.replace( JR_URL, replacer );
        model = model.replace( JR_URL, replacer );

        if ( media[ 'form_logo.png' ] ) {
            form = form.replace(
                /(class="form-logo"\s*>)/,
                `$1<img src="${media['form_logo.png']}" alt="form logo">`
            );
        }
    }

    const manifest = survey.manifest.map( item => {
        return {
            ...item,
            filename: escapeMarkupURLPath( item.filename ),
            downloadUrl: escapeMarkupURLPath( item.downloadUrl )
        };
    } );


    return {
        ...survey,
        form,
        manifest,
        model,
    };
};

module.exports = {
    replaceMediaSources,
    toLocalMediaUrl,
    toMediaMap,
};
