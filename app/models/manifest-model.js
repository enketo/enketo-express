/**
 * @module manifest-model
 */

const libxml = require( 'libxslt' ).libxmljs;
const url = require( 'url' );
const path = require( 'path' );
const fs = require( 'fs' );
const config = require( './config-model' ).server;
const client = require( 'redis' ).createClient( config.redis.cache.port, config.redis.cache.host, {
    auth_pass: config.redis.cache.password
} );
const utils = require( '../lib/utils' );
const debug = require( 'debug' )( 'manifest-model' );

// in test environment, switch to different db
if ( process.env.NODE_ENV === 'test' ) {
    client.select( 15 );
}

/**
 * @static
 * @name get
 * @function
 * @param {string} html1
 * @param {string} html2
 * @param {string} lang
 * @return {Promise} Promise that resolves with manifest
 */
function getManifest( html1, html2, lang ) {
    const manifestKey = `ma:${lang}_manifest`;
    const versionKey = `ma:${lang}_version`;

    return new Promise( ( resolve, reject ) => {
        // each language gets its own manifest
        client.get( manifestKey, ( error, manifest ) => {
            if ( error ) {
                reject( error );
            } else if ( manifest && manifest !== 'null' ) {
                debug( 'getting manifest from cache' );
                resolve( manifest );
            } else {
                debug( 'building manifest from scratch' );
                const doc1 = libxml.parseHtml( html1 );
                const doc2 = libxml.parseHtml( html2 );
                const themesSupported = config[ 'themes supported' ] || [];
                let resources = [];

                // href attributes of link elements
                resources = resources.concat( _getLinkHrefs( doc1 ) );
                resources = resources.concat( _getLinkHrefs( doc2 ) );

                // additional themes
                resources = resources.concat( _getAdditionalThemes( resources, themesSupported ) );

                // translations
                resources = resources.concat( _getTranslations( lang ) );

                // any resources inside css files
                resources = resources.concat( _getResourcesFromCss( resources ) );

                // src attributes
                resources = resources.concat( _getSrcAttributes( doc1 ) );
                resources = resources.concat( _getSrcAttributes( doc2 ) );

                // explicitly add the IE11 bundle, until we can drop IE11 support completely
                resources = resources.concat( `/js/build/enketo-webform-ie11-bundle${process.env.NODE_ENV === 'production' || !process.env.NODE_ENV ? '.min' : ''}.js` );

                // remove non-existing files, empties, duplicates and non-http urls
                resources = resources
                    .filter( _removeEmpties )
                    .filter( _removeDuplicates )
                    .filter( _removeNonHttpResources )
                    .filter( _removeNonExisting );

                // calculate the hash to serve as the manifest version number
                const hash = _calculateHash( html1, html2, resources );

                // add explicit entries in case user never lands on URL without querystring
                // otherwise they may never get added as a Master entry
                resources = resources.concat( [
                    `${config[ 'base path' ]}/x/`
                ] );

                // determine version
                _getVersionObj( versionKey )
                    .then( obj => {
                        let version = obj.version;
                        if ( obj.hash !== hash ) {
                            // create a new version
                            const date = new Date().toISOString().replace( 'T', '|' );
                            version = `${date.substring( 0, date.length - 8 )}|${lang}`;
                            // update stored version, don't wait for result
                            _updateVersionObj( versionKey, hash, version );
                        }
                        manifest = _getManifestString( version, resources );
                        // cache manifest for an hour, don't wait for result
                        client.set( manifestKey, manifest, 'EX', 1 * 60 * 60, () => {} );
                        resolve( manifest );
                    } );
            }
        } );
    } );

}

/**
 * @param {string} version
 * @param {Array} resources
 * @return {string} Manifest string
 */
function _getManifestString( version, resources ) {
    return `CACHE MANIFEST\n# version: ${version}\n\nCACHE:\n${resources.join( '\n' )}\n\nFALLBACK:\n/x ${config[ 'base path' ]}/offline\n/_ ${config[ 'base path' ]}/offline\n\nNETWORK:\n*\n`;
}

/**
 * @param {string} versionKey
 * @return {Promise<Error|object>}
 */
function _getVersionObj( versionKey ) {
    return new Promise( ( resolve, reject ) => {
        client.hgetall( versionKey, ( error, obj ) => {
            debug( 'result', obj );
            if ( error ) {
                reject( error );
            } else if ( obj && obj.hash && obj.version ) {
                resolve( obj );
            } else {
                resolve( {} );
            }
        } );
    } );
}

/**
 * @param {string} versionKey
 * @param {string} hash
 * @param {object} version - Version object.
 */
function _updateVersionObj( versionKey, hash, version ) {
    client.hmset( versionKey, {
        hash,
        version
    } );
}

/**
 * @param {object} doc
 * @return {Array<string>} A list of `href`s
 */
function _getLinkHrefs( doc ) {
    return doc.find( '//link[@href]' ).map( element => element.attr( 'href' ).value() );
}

/**
 * @param {object} doc
 * @return {Array<string>} A list of `src`s
 */
function _getSrcAttributes( doc ) {
    return doc.find( '//*[@src]' ).map( element => element.attr( 'src' ).value() );
}

/**
 * @param {Array<string>} resources
 * @param {Array<string>} themes
 * @return {Array<string>} A list of theme urls
 */
function _getAdditionalThemes( resources, themes ) {
    const urls = [];

    resources.forEach( resource => {
        const themeStyleSheet = /theme-([A-z]+)(\.print)?\.css$/;
        if ( themeStyleSheet.test( resource ) ) {
            const foundTheme = resource.match( themeStyleSheet )[ 1 ];
            themes.forEach( theme => {
                const themeUrl = resource.replace( foundTheme, theme );
                urls.push( themeUrl );
            } );
        }
    } );

    return urls;
}

/**
 * @param {string} lang
 * @return {Array<string>} List of translations paths
 */
function _getTranslations( lang ) {
    const langs = [];

    // fallback language
    langs.push( `${config[ 'base path' ]}/locales/build/en/translation-combined.json` );

    if ( lang && lang !== 'en' ) {
        langs.push( `${config[ 'base path' ]}/locales/build/${lang}/translation-combined.json` );
    }

    return langs;
}

/**
 * @param {Array<string>} resources
 * @return {Array<string>} A list of urls
 */
function _getResourcesFromCss( resources ) {
    const urlReg = /url\(['|"]?([^)'"]+)['|"]?\)/g;
    const cssReg = /^.+\.css$/;
    const urls = [];

    resources.forEach( resource => {
        if ( cssReg.test( resource ) ) {
            const content = _getResourceContent( resource );
            let matches;
            while ( ( matches = urlReg.exec( content ) ) !== null ) {
                urls.push( matches[ 1 ] );
            }
        }
    } );

    return urls;
}

/**
 * @param {string} resource
 * @return {string} Resource file content
 */
function _getResourceContent( resource ) {
    // in try catch in case css file is missing
    try {
        const localResourcePath = _getLocalPath( resource );
        return fs.readFileSync( localResourcePath, 'utf8' );
    } catch ( e ) {
        return '';
    }
}

/**
 * @param {string} resource
 * @return {boolean} Whether a resource exists
 */
function _removeNonExisting( resource ) {
    const localResourcePath = _getLocalPath( resource );
    // TODO: in later versions of node.js, this should be replaced by: fs.accessSync(resourcePath, fs.R_OK)
    const exists = fs.existsSync( localResourcePath );

    if ( !exists ) {
        debug( 'cannot find', localResourcePath );
    }
    return exists;
}

/**
 * @param {string} resource
 * @return {string} Local resource path
 */
function _getLocalPath( resource ) {
    const rel = ( resource.indexOf( `${config[ 'base path' ]}/locales/` ) === 0 ) ? '../../' : '../../public';
    const resourceWithoutBase = resource.substring( config[ 'base path' ].length );
    const localResourcePath = path.join( __dirname, rel, url.parse( resourceWithoutBase ).pathname );
    return localResourcePath;
}

/**
 * @param {string} resource
 * @return {boolean} Whether a resource isn't empty
 */
function _removeEmpties( resource ) {
    return !!resource;
}

/**
 * @param {string} resource
 * @param {number} position
 * @param {Array} array
 * @return {boolean} Whether resource is under given position (index) in given array
 */
function _removeDuplicates( resource, position, array ) {
    return array.indexOf( resource ) === position;
}

/**
 * @param {string} resourceUrl
 * @return {boolean} Whether resource URL protocol isn't `'data:'`
 */
function _removeNonHttpResources( resourceUrl ) {
    const parsedUrl = url.parse( resourceUrl );
    return parsedUrl.path && parsedUrl.protocol !== 'data:';
}

/**
 * @param {string} html1
 * @param {string} html2
 * @param {Array<string>} resources
 * @return {string} A calculated hash of all input values
 */
function _calculateHash( html1, html2, resources ) {
    let hash = utils.md5( html1 ) + utils.md5( html2 );

    resources.forEach( resource => {
        try {
            const content = _getResourceContent( resource );
            hash += utils.md5( content );
        } catch ( e ) {
            console.error( e );
        }
    } );

    // shorten hash
    return utils.md5( hash );
}

module.exports = {
    get: getManifest
};
