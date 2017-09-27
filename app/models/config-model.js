'use strict';

var localConfig;
var config = require( '../../config/default-config' );
var pkg = require( '../../package' );
var mergeWith = require( 'lodash/mergeWith' );
var path = require( 'path' );
var fs = require( 'fs' );
var url = require( 'url' );
var themePath = path.join( __dirname, '../../public/css' );
var languagePath = path.join( __dirname, '../../locales' );
// var debug = require( 'debug' )( 'config-model' );

// Merge default and local config files if a local config.json file exists
try {
    localConfig = require( '../../config/config' );
    mergeWith( config, localConfig, function( objValue, srcValue ) {
        if ( Array.isArray( srcValue ) ) {
            // Overwrite completely if value in localConfig is an array (do not merge arrays)
            return srcValue;
        }
    } );
}
// Override default config with environment variables if a local config.json does not exist
catch ( err ) {
    console.log( 'No local config.json found. Will check environment variables instead.' );
    _updateConfigFromEnv( config );
    _setRedisConfigFromEnv();
}

/**
 * Updates all configuration items for which an environment variable was set.
 * 
 * @param  {*} config configuration object
 */
function _updateConfigFromEnv() {
    var envVarNames = [];

    for ( var envVarName in process.env ) {
        if ( process.env.hasOwnProperty( envVarName ) && envVarName.indexOf( 'ENKETO_' ) === 0 ) {
            envVarNames.push( envVarName );
        }
    }

    envVarNames.sort().forEach( _updateConfigItemFromEnv );
}

/**
 * Updates a configuration item that corresponds to the provided environment variable name.
 * 
 * @param  {string} envVarName [description]
 */
function _updateConfigItemFromEnv( envVarName ) {
    var parts = envVarName.split( '_' ).slice( 1 ).map( _convertNumbers );
    var nextNumberIndex = _findNumberIndex( parts );
    var proceed = true;
    var part;
    var settingArr;
    var setting;
    var propName;

    while ( proceed ) {
        proceed = false;
        part = parts.slice( 0, nextNumberIndex ).join( '_' );
        settingArr = _findSetting( config, part );
        if ( settingArr ) {
            setting = settingArr[ 0 ];
            propName = settingArr[ 1 ];
            if ( !Array.isArray( setting[ propName ] ) ) {
                setting[ propName ] = _convertType( process.env[ envVarName ] );
            } else {
                if ( nextNumberIndex === parts.length - 1 ) {
                    // simple populate array item (simple value)
                    setting[ propName ][ parts[ nextNumberIndex ] ] = process.env[ envVarName ];
                } else if ( typeof setting[ propName ][ parts[ nextNumberIndex ] ] !== 'undefined' ) {
                    // this array item (object) already exists
                    nextNumberIndex = _findNumberIndex( parts, nextNumberIndex + 1 );
                    proceed = true;
                } else {
                    // clone previous array item (object) and empty all property values
                    setting[ propName ][ parts[ nextNumberIndex ] ] = _getEmptyClone( setting[ propName ][ parts[ nextNumberIndex ] - 1 ] );
                    proceed = true;
                }
            }
        }
    }
}

/**
 * Converts some string values to booleans or null.
 * 
 * @param  {string} str [description]
 * @return {?(string|boolean)}     [description]
 */
function _convertType( str ) {
    switch ( str ) {
        case 'true':
            return true;
        case 'false':
            return false;
        case 'null':
            return null;
        default:
            return str;
    }
}

/**
 * Searches the configuration object to find a match for an environment variable, or the first part of such a variable.
 * 
 * @param  {*}          obj      configuration object
 * @param  {string}     envName  environment variable name or the first part of one
 * @param  {string}     prefix   prefix to use (for nested objects)
 * @return {[*,string]?}         2-item array of object and property name
 */
function _findSetting( obj, envName, prefix ) {
    var found;
    prefix = prefix || '';

    for ( var prop in obj ) {
        if ( obj.hasOwnProperty( prop ) ) {
            var propEnvStyle = prefix + prop.replace( / /g, '_' ).toUpperCase();
            if ( propEnvStyle === envName ) {
                return [ obj, prop ];
            } else if ( typeof obj[ prop ] === 'object' && obj[ prop ] !== null ) {
                found = _findSetting( obj[ prop ], envName, propEnvStyle + '_' );
                if ( found ) {
                    return found;
                }
            }
        }
    }
}

/**
 * Convert a non-empty string number to a number.
 * 
 * @param  {str} str a string.
 * @return {(Number|String)}     [description]
 */
function _convertNumbers( str ) {
    var converted;
    if ( !str ) {
        return str;
    }
    converted = Number( str );
    return !isNaN( converted ) ? converted : str;
}

/**
 * Finds the index of the first array item that is a number.
 * 
 * @param  {<(String|Number)>} arr   array of strings and numbers
 * @param  {Number?} start start index
 * @return {boolean?}      the index or undefined
 */
function _findNumberIndex( arr, start ) {
    var i;
    start = start || 0;
    arr.some( function( val, index ) {
        if ( typeof val === 'number' && index >= start ) {
            i = index;
            return true;
        }
    } );
    return i;
}

/**
 * returns an empty clone of the provided simple object
 * 
 * @param  {*} obj simple object
 * @return {*}     empty clone of argument
 */
function _getEmptyClone( obj ) {
    var clone = JSON.parse( JSON.stringify( obj ) );
    _emptyObjectProperties( clone );

    return clone;
}

/**
 * Replaces all non-null and non-object property values with empty string.
 * 
 * @param  {*} obj simple object
 * @return {*}     emptied version of argument
 */
function _emptyObjectProperties( obj ) {
    for ( var prop in obj ) {
        // if a simple array of string values
        if ( Array.isArray( obj[ prop ] ) && typeof obj[ prop ][ 0 ] === 'string' ) {
            obj[ prop ] = [];
        } else if ( typeof obj[ prop ] === 'object' && obj[ prop ] !== null ) {
            _emptyObjectProperties( obj[ prop ] );
        } else if ( obj[ prop ] ) {
            obj[ prop ] = ''; // let's hope this has no side-effects
        }
    }
}

/**
 * Overrides any redis settings if a special enviroment URL variable is set.
 */
function _setRedisConfigFromEnv() {
    var redisMainUrl = process.env.ENKETO_REDIS_MAIN_URL;
    var redisCacheUrl = process.env.ENKETO_REDIS_CACHE_URL;

    if ( redisMainUrl ) {
        config.redis.main = _extractRedisConfigFromUrl( redisMainUrl );
    }
    if ( redisCacheUrl ) {
        config.redis.cache = _extractRedisConfigFromUrl( redisCacheUrl );
    }
}

/**
 * Parses a redis URL and returns an object with host, port and password properties.
 * 
 * @param  {string} redisUrl a compliant redis url
 * @return {{host: String, port: String, password:?String}}
 */
function _extractRedisConfigFromUrl( redisUrl ) {
    var parsedUrl = url.parse( redisUrl );
    var password = parsedUrl.auth && parsedUrl.auth.split( ':' )[ 1 ] ? parsedUrl.auth.split( ':' )[ 1 ] : null;

    return {
        host: parsedUrl.hostname,
        port: parsedUrl.port,
        password: password
    };
}

/**
 * Returns a list of supported themes,
 * in case a list is provided only the ones that exists are returned.
 * 
 * @param {Array} themeList - a list of themes e.g ['formhub', 'grid']
 * @return {Array}
 */
function getThemesSupported( themeList ) {
    var themes = [];

    if ( fs.existsSync( themePath ) ) {
        fs.readdirSync( themePath ).forEach( function( file ) {
            var matches = file.match( /^theme-([A-z\-]+)\.css$/ );
            if ( matches && matches.length > 1 ) {
                if ( themeList !== undefined && themeList.length ) {
                    if ( themeList.indexOf( matches[ 1 ] ) !== -1 ) {
                        themes.push( matches[ 1 ] );
                    }
                } else {
                    themes.push( matches[ 1 ] );
                }
            }
        } );
    }

    return themes;
}

config[ 'version' ] = pkg.version;

// detect supported themes
config[ 'themes supported' ] = getThemesSupported( config[ 'themes supported' ] );

// detect supported languages
config[ 'languages supported' ] = fs.readdirSync( languagePath ).filter( function( file ) {
    return file.indexOf( '.' ) !== 0 && fs.statSync( path.join( languagePath, file ) ).isDirectory();
} );

// if necessary, correct the base path to use for all routing
if ( config[ 'base path' ] && config[ 'base path' ].indexOf( '/' ) !== 0 ) {
    config[ 'base path' ] = '/' + config[ 'base path' ];
}
if ( config[ 'base path' ] && config[ 'base path' ].lastIndexOf( '/' ) === config[ 'base path' ].length - 1 ) {
    config[ 'base path' ] = config[ 'base path' ].substring( 0, config[ 'base path' ].length - 1 );
}

module.exports = {
    server: config,
    client: {
        googleApiKey: config.google[ 'api key' ],
        maps: config.maps,
        modernBrowsersURL: 'modern-browsers',
        supportEmail: config.support.email,
        themesSupported: config[ 'themes supported' ],
        languagesSupported: config[ 'languages supported' ],
        timeout: config[ 'timeout' ],
        submissionParameter: {
            name: config[ 'query parameter to pass to submission' ]
        },
        basePath: config[ 'base path' ],
        repeatOrdinals: config[ 'repeat ordinals' ],
        validateContinuously: config[ 'validate continuously' ],
        validatePage: config[ 'validate page' ]
    },
    getThemesSupported: getThemesSupported
};
