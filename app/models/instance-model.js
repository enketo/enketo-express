"use strict";

var Q = require( 'q' ),
    config = require( '../../config/config' ),
    client = require( 'redis' ).createClient( config.redis.main.port, config.redis.main.host, {
        auth_pass: config.redis.main.password
    } ),
    debug = require( 'debug' )( 'instance-model' );

// in test environment, switch to different db
if ( process.env.NODE_ENV === 'test' ) {
    client.select( 15 );
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

module.exports = {
    get: _getInstance,
    set: _cacheInstance,
    remove: _removeInstance
};
