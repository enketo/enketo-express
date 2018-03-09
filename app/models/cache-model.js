const utils = require( '../lib/utils' );
const transformer = require( 'enketo-transformer' );
const prefix = 'ca:';
const expiry = 30 * 24 * 60 * 60;
const config = require( './config-model' ).server;
const client = require( 'redis' ).createClient( config.redis.cache.port, config.redis.cache.host, {
    auth_pass: config.redis.cache.password
} );
const debug = require( 'debug' )( 'cache-model' );

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
    return new Promise( ( resolve, reject ) => {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId ) {
            const error = new Error( 'Bad Request. Survey information to perform cache lookup is not complete.' );
            error.status = 400;
            reject( error );
        } else {
            const key = _getKey( survey );

            client.hgetall( key, ( error, cacheObj ) => {
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
    return new Promise( ( resolve, reject ) => {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId ) {
            const error = new Error( 'Bad Request. Survey information to perform cache lookup is not complete.' );
            error.status = 400;
            reject( error );
        } else {
            const key = _getKey( survey );

            client.hmget( key, [ 'formHash', 'xslHash' ], ( error, hashArr ) => {
                console.log( 'hashArr', key, hashArr );
                if ( error ) {
                    reject( error );
                } else if ( !hashArr || !hashArr[ 0 ] || !hashArr[ 1 ] ) {
                    resolve( survey );
                } else {
                    survey.formHash = hashArr[ 0 ];
                    survey.xslHash = hashArr[ 1 ];
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
    return new Promise( ( resolve, reject ) => {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId || !survey.info.hash ) {
            const error = new Error( 'Bad Request. Survey information to perform cache check is not complete.' );
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

            const key = _getKey( survey );

            client.hgetall( key, ( error, cacheObj ) => {
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
                    if ( cacheObj.formHash !== survey.formHash || cacheObj.xslHash !== survey.xslHash || cacheObj.mediaUrlHash ) {
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
    return new Promise( ( resolve, reject ) => {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId || !survey.info.hash || !survey.form || !survey.model ) {
            const error = new Error( 'Bad Request. Survey information to cache is not complete.' );
            error.status = 400;
            reject( error );
        } else {
            _addHashes( survey );
            const obj = {
                formHash: survey.formHash,
                xslHash: survey.xslHash,
                form: survey.form,
                model: survey.model,
                // The mediaUrlHash property is an artefact and no longer used.
                // When hmset updates the database it would keep it in place, so we explicitly set it to empty.s
                mediaUrlHash: '',
                languageMap: JSON.stringify( survey.languageMap || {} )
            };

            const key = _getKey( survey );

            client.hmset( key, obj, error => {
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
    return new Promise( ( resolve, reject ) => {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId ) {
            const error = new Error( 'Bad Request. Survey information to cache is not complete.' );
            error.status = 400;
            reject( error );
        } else {
            const key = _getKey( survey );

            client.hgetall( key, ( error, cacheObj ) => {
                if ( error ) {
                    reject( error );
                } else if ( !cacheObj ) {
                    error = new Error( 'Survey cache not found.' );
                    error.status = 404;
                    reject( error );
                } else {
                    client.del( key, error => {
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
    return new Promise( ( resolve, reject ) => {
        client.keys( `${prefix}*`, ( error, keys ) => {
            if ( error ) {
                reject( error );
            }
            keys.forEach( key => {
                client.del( key, error => {
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
    const openRosaKey = utils.getOpenRosaKey( survey, prefix );
    return ( openRosaKey ) ? openRosaKey : null;
}

/**
 * Adds the 3 relevant hashes to the survey object if they haven't been added already.
 * 
 * @param {[type]} survey [description]
 */
function _addHashes( survey ) {
    survey.formHash = survey.formHash || survey.info.hash;
    survey.xslHash = survey.xslHash || transformer.version;
}

module.exports = {
    get: getSurvey,
    getHashes: getSurveyHashes,
    set: setSurvey,
    check: isCacheUpToDate,
    flush: flushSurvey,
    flushAll
};
