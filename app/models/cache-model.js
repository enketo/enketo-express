'use strict';

var Promise = require( 'lie' );
var utils = require( '../lib/utils' );
var transformer = require( 'enketo-transformer' );
var prefix = 'ca:';
var expiry = 30 * 24 * 60 * 60;
var config = require( './config-model' ).server;
var client = require( 'redis' ).createClient( config.redis.cache.port, config.redis.cache.host, {
    auth_pass: config.redis.cache.password
} );
var debug = require( 'debug' )( 'cache-model' );

// in test environment, switch to different db
if ( process.env.NODE_ENV === 'test' ) {
    client.select( 15 );
}

/** 
 * Gets an item from the cache.
 *
 * @param  {{openRosaServer: string, openRosaId: string }} survey [description]
 * @return {[type]}        [description]
 */
function getSurvey( survey ) {
    var key;
    var error;

    return new Promise( function( resolve, reject ) {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId ) {
            error = new Error( 'Bad Request. Survey information to perform cache lookup is not complete.' );
            error.status = 400;
            reject( error );
        } else {
            key = _getKey( survey );

            client.hgetall( key, function( error, cacheObj ) {
                if ( error ) {
                    reject( error );
                } else if ( !cacheObj ) {
                    resolve( null );
                } else {
                    // form is 'actively used' so we're resetting the cache expiry
                    debug( 'cache is up to date and used, resetting expiry' );
                    client.expire( key, expiry );
                    survey.form = cacheObj.form;
                    survey.model = cacheObj.model;
                    survey.formHash = cacheObj.formHash;
                    survey.mediaUrlHash = cacheObj.mediaUrlHash;
                    survey.xslHash = cacheObj.xslHash;
                    survey.languageMap = JSON.parse( cacheObj.languageMap || '{}' );
                    resolve( survey );
                }
            } );
        }
    } );
}

/** 
 * Gets the hashes of an item from the cache.
 *
 * @param  {{openRosaServer: string, openRosaId: string, theme: string}} survey [description]
 * @return {[type]}        [description]
 */
function getSurveyHashes( survey ) {
    var key;
    var error;

    return new Promise( function( resolve, reject ) {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId ) {
            error = new Error( 'Bad Request. Survey information to perform cache lookup is not complete.' );
            error.status = 400;
            reject( error );
        } else {
            key = _getKey( survey );

            client.hmget( key, [ 'formHash', 'mediaUrlHash', 'xslHash' ], function( error, hashArr ) {
                if ( error ) {
                    reject( error );
                } else if ( !hashArr || !hashArr[ 0 ] || !hashArr[ 2 ] ) {
                    resolve( survey );
                } else {
                    survey.formHash = hashArr[ 0 ];
                    survey.mediaUrlHash = hashArr[ 1 ];
                    survey.xslHash = hashArr[ 2 ];
                    resolve( survey );
                }
            } );
        }
    } );
}

/**
 * Checks if cache is present and up to date
 *
 * @param  {{openRosaServer: string, openRosaId: string, info: {hash: string }}} survey [description]
 * @return {Boolean}        [description]
 */
function isCacheUpToDate( survey ) {
    var key;
    var error;

    return new Promise( function( resolve, reject ) {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId || !survey.info.hash ) {
            error = new Error( 'Bad Request. Survey information to perform cache check is not complete.' );
            error.status = 400;
            reject( error );
        } else {
            // clean up the survey object to make sure no artefacts of cached survey are present
            survey = {
                openRosaServer: survey.openRosaServer,
                openRosaId: survey.openRosaId,
                info: {
                    hash: survey.info.hash
                },
                manifest: survey.manifest
            };

            key = _getKey( survey );

            client.hgetall( key, function( error, cacheObj ) {
                if ( error ) {
                    reject( error );
                } else if ( !cacheObj ) {
                    debug( 'cache is missing' );
                    resolve( null );
                } else {
                    // Adding the hashes to the referenced survey object can be efficient, since this object 
                    // is passed around. The hashes may therefore already have been calculated 
                    // when setting the cache later on.
                    // Note that this server cache only cares about media URLs, not media content.
                    // This allows the same cache to be used for a form for the OpenRosa server serves different media content,
                    // e.g. based on the user credentials.
                    _addHashes( survey );
                    if ( cacheObj.formHash !== survey.formHash || cacheObj.mediaUrlHash !== String( survey.mediaUrlHash ) || cacheObj.xslHash !== survey.xslHash ) {
                        debug( 'cache is obsolete' );
                        resolve( false );
                    } else {
                        debug( 'cache is up to date' );
                        resolve( true );
                    }
                }
            } );
        }
    } );
}

/**
 * Adds an item to the cache
 *
 * @param {[type]} survey [description]
 */
function setSurvey( survey ) {
    var obj;
    var key;
    var error;

    return new Promise( function( resolve, reject ) {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId || !survey.info.hash || !survey.form || !survey.model ) {
            error = new Error( 'Bad Request. Survey information to cache is not complete.' );
            error.status = 400;
            reject( error );
        } else {
            _addHashes( survey );
            obj = {
                formHash: survey.formHash,
                mediaUrlHash: survey.mediaUrlHash,
                xslHash: survey.xslHash,
                form: survey.form,
                model: survey.model,
                languageMap: JSON.stringify( survey.languageMap || {} )
            };

            key = _getKey( survey );

            client.hmset( key, obj, function( error ) {
                if ( error ) {
                    reject( error );
                } else {
                    debug( 'cache has been updated' );
                    // expire in 30 days
                    client.expire( key, expiry );
                    resolve( survey );
                }
            } );
        }
    } );
}

/**
 * Flushes the cache of a single survey
 *
 * @param {[type]} survey [description]
 */
function flushSurvey( survey ) {
    var key;
    var error;

    return new Promise( function( resolve, reject ) {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId ) {
            error = new Error( 'Bad Request. Survey information to cache is not complete.' );
            error.status = 400;
            reject( error );
        } else {
            key = _getKey( survey );

            client.hgetall( key, function( error, cacheObj ) {
                if ( error ) {
                    reject( error );
                } else if ( !cacheObj ) {
                    error = new Error( 'Survey cache not found.' );
                    error.status = 404;
                    reject( error );
                } else {
                    client.del( key, function( error ) {
                        if ( error ) {
                            reject( error );
                        } else {
                            delete survey.form;
                            delete survey.model;
                            delete survey.formHash;
                            delete survey.xslHash;
                            delete survey.mediaHash;
                            delete survey.mediaUrlHash;
                            delete survey.languageMap;
                            resolve( survey );
                        }
                    } );
                }
            } );
        }
    } );
}

/**
 * Completely empties the cache
 * 
 * @return {[type]} [description]
 */
function flushAll() {

    return new Promise( function( resolve, reject ) {
        client.keys( prefix + '*', function( error, keys ) {
            if ( error ) {
                reject( error );
            }
            keys.forEach( function( key ) {
                client.del( key, function( error ) {
                    if ( error ) {
                        console.error( error );
                    }
                } );
            } );
            // TODO: use Promise.All to resolve when all deletes have completed.
            resolve( true );
        } );
    } );
}

/**
 * Gets the key used for the cache item
 * 
 * @param  {{openRosaServer: string, openRosaId: string}} survey [description]
 * @return {string}        [description]
 */
function _getKey( survey ) {
    var openRosaKey = utils.getOpenRosaKey( survey, prefix );
    return ( openRosaKey ) ? openRosaKey : null;
}

/**
 * Adds the 3 relevant hashes to the survey object if they haven't been added already.
 * 
 * @param {[type]} survey [description]
 */
function _addHashes( survey ) {
    survey.formHash = survey.formHash || survey.info.hash;
    // The mediaUrlHash is generated from the downloadUrls in the manifest. This is used for the server cache
    // which only needs updating if URLs change. It should never update when only the media content changes. 
    // This allows using dynamic externa data with user-specific content.
    survey.mediaUrlHash = survey.mediaUrlHash || utils.getXformsManifestHash( survey.manifest, 'downloadUrl' );
    survey.xslHash = survey.xslHash || transformer.version;
}

module.exports = {
    get: getSurvey,
    getHashes: getSurveyHashes,
    set: setSurvey,
    check: isCacheUpToDate,
    flush: flushSurvey,
    flushAll: flushAll
};
