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
                    survey.mediaHash = cacheObj.mediaHash;
                    survey.xslHash = cacheObj.xslHash;
                    resolve( survey );
                }
            } );
        }
    } );
}

/** 
 * Gets the hashes of an item from the cache.
 *
 * @param  {{openRosaServer: string, openRosaId: string }} survey [description]
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

            client.hmget( key, [ 'formHash', 'mediaHash', 'xslHash' ], function( error, hashArr ) {
                if ( error ) {
                    reject( error );
                } else if ( !hashArr ) {
                    resolve( null );
                } else {
                    resolve( {
                        formHash: hashArr[ 0 ],
                        mediaHash: hashArr[ 1 ],
                        xslHash: hashArr[ 2 ]
                    } );
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
                    // mediaHash can be "null" in Redis and null in reality so it is cast to a string
                    _addHashes( survey );
                    if ( cacheObj.formHash !== survey.formHash || cacheObj.mediaHash !== String( survey.mediaHash ) || cacheObj.xslHash !== survey.xslHash ) {
                        debug( 'cache is obsolete' );
                        resolve( false );
                    } else {
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
                mediaHash: survey.mediaHash,
                xslHash: survey.xslHash,
                form: survey.form,
                model: survey.model
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
            client.del( key, function( error ) {
                if ( error ) {
                    reject( error );
                } else {
                    delete survey.form;
                    delete survey.model;
                    delete survey.formHash;
                    delete survey.xlsHash;
                    delete survey.mediaHash;
                    resolve( survey );
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
    survey.mediaHash = survey.mediaHash || ( ( survey.manifest && survey.manifest.length > 0 ) ? utils.md5( JSON.stringify( survey.manifest ) ) : null );
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
