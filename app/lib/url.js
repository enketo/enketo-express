const config = require( '../models/config-model' ).server;
const transformer = require( 'enketo-transformer' );

/**
 * Converts a url to a local (proxied) url.
 *
 * @static
 * @param { string } url - The url to convert
 * @return { string } The converted url
 */
function toLocalMediaUrl( url ) {
    const localUrl = `${config[ 'base path' ]}/media/get/${url.replace( /(https?):\/\//, '$1/' )}`;

    return transformer.escapeURLPath( localUrl );
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
        [ filename, toLocalMediaUrl( downloadUrl ) ]
    ) )
);

module.exports = {
    toLocalMediaUrl,
    toMediaMap,
};
