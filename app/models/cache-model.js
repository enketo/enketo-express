"use strict";

module.exports = function( client ) {
    var Q = require( 'q' ),
        utils = require( '../lib/utils' ),
        debug = require( 'debug' )( 'cache-model' ),
        transformer = require( '../lib/transformer' ),
        prefix = 'ca:',
        expiry = 30 * 24 * 60 * 60,
        config = require( '../../config/config' );

    // ability to pass a different (test db) client
    if ( !client ) {
        // TODO: would be better to use app.get('redis').cache but for some reason require('../app')
        // only works after express server has started
        debug( 'creating production db client for redis cache on port %s', config.redis.cache.port );
        client = require( 'redis' ).createClient( config.redis.cache.port, config.redis.cache.host, {
            auth_pass: config.redis.cache.password
        } );
    } else {
        //console.log( 'using (test) db passed as survey-model require parameter' );
    }

    /** 
     * Gets an item from the cache
     * @param  {{openRosaServer: string, openRosaId: string, info: {hash: string}}} survey [description]
     * @return {[type]}        [description]
     */
    function _getSurvey( survey ) {
        var key, error,
            deferred = Q.defer();

        if ( !survey || !survey.openRosaServer || !survey.openRosaId || !survey.info.hash ) {
            error = new Error( 'Bad Request. Survey information to perform cache lookup is not complete.' );
            error.status = 400;
            deferred.reject( error );
        } else {
            key = _getKey( survey );

            client.hgetall( key, function( error, cacheObj ) {
                if ( error ) {
                    deferred.reject( error );
                } else if ( !cacheObj ) {
                    error = new Error( 'Not Found. Cache no dey.' );
                    error.status = 404;
                    deferred.reject( error );
                } else {
                    // Adding the hashes to the refernced survey object can be efficient, since this object 
                    // is passed around. The hashes may therefore already have been calculated 
                    // when setting the cache later on.
                    // mediaHash can be "null" in Redis and null in reality so it is cast to a string
                    _addHashes( survey );
                    if ( cacheObj.formHash !== survey.formHash || cacheObj.mediaHash !== String( survey.mediaHash ) || cacheObj.xslHash !== survey.xslHash ) {
                        debug( survey.mediaHash, cacheObj.mediaHash );
                        error = new Error( 'Obsolete.' );
                        error.status = 410;
                        deferred.reject( error );
                    } else {
                        // form is 'actively used' so we're resetting the cache expiry
                        client.expire( key, expiry );
                        survey.form = cacheObj.form;
                        survey.model = cacheObj.model;
                        deferred.resolve( survey );
                    }
                }
            } );
        }

        return deferred.promise;
    }

    /**
     * Adds an item to the cache
     * @param {[type]} survey [description]
     */
    function _setSurvey( survey ) {
        var obj, key, error,
            deferred = Q.defer();

        if ( !survey || !survey.openRosaServer || !survey.openRosaId || !survey.info.hash || !survey.form || !survey.model ) {
            error = new Error( 'Bad Request. Survey information to cache is not complete.' );
            error.status = 400;
            deferred.reject( error );
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
                    deferred.reject( error );
                } else {
                    // expire in 30 days
                    client.expire( key, expiry );
                    deferred.resolve( survey );
                }
            } );
        }

        return deferred.promise;
    }

    /**
     * Completely empties the cache
     * @return {[type]} [description]
     */
    function _flushCache() {
        var deferred = Q.defer();

        client.keys( prefix + '*', function( error, keys ) {
            if ( error ) {
                deferred.reject( error );
            }
            keys.forEach( function( key ) {
                client.del( key );
            } );

            deferred.resolve( true );
        } );

        return deferred.promise;
    }

    /**
     * Gets the key used for the cache item
     * @param  {{openRosaServer: string, openRosaId: string}} survey [description]
     * @return {string}        [description]
     */
    function _getKey( survey ) {
        var openRosaKey = utils.getOpenRosaKey( survey, prefix );
        return ( openRosaKey ) ? openRosaKey : null;
    }

    /**
     * Adds the 3 relevant hashes to the survey object if they haven't been added already.
     * @param {[type]} survey [description]
     */
    function _addHashes( survey ) {
        survey.formHash = survey.formHash || survey.info.hash;
        survey.mediaHash = survey.mediaHash || ( ( survey.manifest && survey.manifest.length > 0 ) ? utils.md5( JSON.stringify( survey.manifest ) ) : null );
        survey.xslHash = survey.xslHash || transformer.version;
    }

    return {
        get: _getSurvey,
        set: _setSurvey,
        flush: _flushCache
    };
};
