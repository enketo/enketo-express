/**
 * @module offline-resources-model
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
const debug = require( 'debug' )( 'offline-resources-model' );

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
 * @return {Promise} Promise that resolves with manifest
 */

function get( html1, html2 ) {
    const resourcesKey = 'off:resources';
    const versionKey = 'off:version';

    return new Promise( ( resolve, reject ) => {
        // There is only one list of resources for all forms and all languages
        client.get( resourcesKey, ( error, obj ) => {
            if ( error ) {
                reject( error );
            } else if ( obj && obj !== 'null' ) {
                debug( 'getting offline resource list from cache' );
                resolve( JSON.parse( obj ) );
            } else {
                debug( 'building offline resource list from scratch' );
                const doc1 = libxml.parseHtml( html1 );
                const doc2 = libxml.parseHtml( html2 );
                const themesSupported = config[ 'themes supported' ] || [];
                let resources = [];

                // href attributes of link elements
                resources = resources.concat( _getLinkHrefs( doc1 ) );
                resources = resources.concat( _getLinkHrefs( doc2 ) );

                // additional themes
                resources = resources.concat( _getAdditionalThemes( resources, themesSupported ) );

                // default language (TODO: configurable default?)
                resources = resources.concat( [ `${config[ 'base path' ]}/x/locales/build/en/translation-combined.json` ] );

                // any resources inside css files
                resources = resources.concat( _getResourcesFromCss( resources ) );

                // src attributes
                resources = resources.concat( _getSrcAttributes( doc1 ) );
                resources = resources.concat( _getSrcAttributes( doc2 ) );

                // remove empties, duplicates and non-http urls
                resources = resources
                    .filter( _removeEmpties )
                    .filter( _removeNonHttpResources );

                // convert relative urls to absolute urls
                resources = resources.map( _toAbsolute )
                    // remove duplicates after converting URL to local URLs
                    .filter( _removeDuplicates );

                // remove non-existing files,
                resources = resources
                    .filter( _removeNonExisting );

                // calculate the hash to serve as the version number
                const hash = _calculateHash( html1, html2, resources );

                // add explicit entries in case user never lands on URL without querystring
                // otherwise they may never get added as a Master entry
                resources = resources.concat( [
                    `${config[ 'base path' ]}/x/`
                ] );

                const fallback = `${config[ 'base path' ]}/x/offline/`;

                // determine version
                _getVersionObj( versionKey )
                    .then( obj => {
                        let version = obj.version;
                        if ( obj.hash !== hash ) {
                            // create a new version
                            const date = new Date().toISOString().replace( 'T', '_' ).replace( ':', '-' );
                            version = `${date.substring( 0, date.length - 8 )}`;
                            // update stored version, don't wait for result
                            _updateVersionObj( versionKey, hash, version );
                        }
                        // cache for an hour, don't wait for result
                        client.set( resourcesKey, JSON.stringify( { version, resources, fallback } ), 'EX', 1 * 60 * 60, () => {} );
                        resolve( { version, resources, fallback } );
                    } );
            }
        } );
    } );

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
                let url = matches[ 1 ];
                if ( url.startsWith( '../' ) ) {
                    // change context one step down from public/css to public/
                    url = url.substring( 3 );
                }
                urls.push( url );
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
    const rel = ( resource.indexOf( `${config[ 'base path' ]}${config['offline path']}/locales/` ) === 0 ) ? '../../' : '../../public';
    const resourceWithoutBase = resource.substring( config[ 'base path' ].length );
    const op = config[ 'offline path' ];
    const resourceWithoutOfflinePath = op ? ( resourceWithoutBase.startsWith( op ) ? resourceWithoutBase.substring( op.length ) : resourceWithoutBase ) : resourceWithoutBase;
    const localResourcePath = path.join( __dirname, rel, url.parse( resourceWithoutOfflinePath ).pathname );

    return localResourcePath;
}

/**
 * Very crude convertor only from path/to/resource to /x/path/to/resource
 * @param {*} resource 
 */
function _toAbsolute( resource ) {
    return !resource.startsWith( '/' ) ? `${config['offline path']}/${resource}` : resource;
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

module.exports = { get };
