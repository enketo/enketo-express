"use strict";

module.exports = function( client ) {
    var Q = require( 'q' ),
        debug = require( 'debug' )( 'instance-model' ),
        config = require( '../config' );

    // ability to pass a different (test db) client
    if ( !client ) {
        // TODO: would be better to use app.get('redis').cache but for some reason require('../app')
        // only works after express server has started
        debug( 'creating default production db client on port %s', config.redis.main.port );
        client = require( 'redis' ).createClient( config.redis.main.port, config.redis.main.host );
    } else {
        //console.log( 'using (test) db passed as instance-model require parameter' );
    }

    function _cacheInstance( survey ) {
        var error, key,
            deferred = Q.defer();

        if ( !survey || !survey.openRosaId || !survey.instanceId || !survey.returnUrl || !survey.instance ) {
            error = new Error( 'Bad request. Survey information not complete or invalid' );
            error.status = 400;
            deferred.reject( error );
        } else {
            key = 'in:' + survey.instanceId;
            // first check if record exists (i.e. if it is being edited)
            client.hgetall( 'in:' + survey.instanceId, function( err, obj ) {
                if ( err ) {
                    deferred.reject( err );
                } else if ( obj ) {
                    error = new Error( 'Not allowed. Record is already being edited' );
                    error.status = 405;
                    deferred.reject( error );
                } else {
                    client.hmset( key, {
                        returnUrl: survey.returnUrl,
                        instance: survey.instance
                    }, function( error, id ) {
                        if ( error ) {
                            deferred.reject( error );
                        } else {
                            // expire, no need to wait for result
                            client.expire( key, 30 );
                            deferred.resolve( survey );
                        }
                    } );
                }
            } );
        }
        return deferred.promise;
    }

    function _getInstance( survey ) {
        var error,
            deferred = Q.defer();

        if ( !survey || !survey.instanceId ) {
            error = new Error( 'Bad Request. Survey information not complete or invalid' );
            error.status = 400;
            deferred.reject( error );
        } else {
            client.hgetall( 'in:' + survey.instanceId, function( err, obj ) {
                if ( err ) {
                    deferred.reject( err );
                } else if ( !obj ) {
                    error = new Error( 'Record not present. Page may have expired.' );
                    error.status = 404;
                    deferred.reject( error );
                } else {
                    survey.instance = obj.instance;
                    survey.returnUrl = obj.returnUrl;
                    deferred.resolve( survey );
                }
            } );
        }

        return deferred.promise;
    }

    function _removeInstance( survey ) {
        var error,
            deferred = Q.defer();

        if ( !survey || !survey.instanceId ) {
            error = new Error( 'Bad request. Survey information not complete or invalid' );
            error.status = 400;
            deferred.reject( error );
        } else {
            client.del( 'in:' + survey.instanceId, function( err, obj ) {
                if ( err ) {
                    deferred.reject( err );
                } else {
                    deferred.resolve( survey.instanceId );
                }
            } );
        }

        return deferred.promise;
    }

    // public methods
    return {
        get: _getInstance,
        set: _cacheInstance,
        remove: _removeInstance
    };
};
