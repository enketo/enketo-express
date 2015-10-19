'use strict';

var hardcodedAccount;
var Q = require( "q" );
var config = require( './config-model' ).server;
var utils = require( '../lib/utils' );
var pending = {};
var client = require( 'redis' ).createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );
var debug = require( 'debug' )( "account-model" );

// in test environment, switch to different db
if ( process.env.NODE_ENV === 'test' ) {
    client.select( 15 );
}

/**
 * Obtain account
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function _get( survey ) {
    var error,
        hardcodedAccount = _getHardcodedAccount(),
        server = _getServer( survey ),
        app = app || require( '../../config/express' ),
        deferred = Q.defer();

    if ( !server ) {
        error = new Error( 'Bad Request. Server URL missing' );
        error.status = 400;
        deferred.reject( error );
    } else if ( !utils.isValidUrl( server ) ) {
        error = new Error( 'Bad Request. Server URL is not a valid URL.' );
        error.status = 400;
        deferred.reject( error );
    } else {
        if ( hardcodedAccount && _isAllowed( hardcodedAccount, server ) ) {
            deferred.resolve( {
                openRosaServer: server,
                key: hardcodedAccount.key
            } );
        } else if ( /https?:\/\/testserver.com\/bob/.test( server ) ) {
            deferred.resolve( {
                openRosaServer: server,
                key: 'abc'
            } );
        } else if ( /https?:\/\/testserver.com\/noquota/.test( server ) ) {
            error = new Error( 'Forbidden. No quota left' );
            error.status = 403;
            deferred.reject( error );
        } else if ( /https?:\/\/testserver.com\/noapi/.test( server ) ) {
            error = new Error( 'Forbidden. No API access granted' );
            error.status = 405;
            deferred.reject( error );
        } else if ( /https?:\/\/testserver.com\/noquotanoapi/.test( server ) ) {
            error = new Error( 'Forbidden. No API access granted' );
            error.status = 405;
            deferred.reject( error );
        } else if ( /https?:\/\/testserver.com\/notpaid/.test( server ) ) {
            error = new Error( 'Forbidden. The account is not active.' );
            error.status = 403;
            deferred.reject( error );
        } else {
            client.hgetall( 'ac:' + utils.cleanUrl( server ), function( error, obj ) {
                if ( error ) {
                    deferred.reject( error );
                }
                if ( !obj ) {
                    error = new Error( 'Forbidden. This server is not linked with Enketo' );
                    error.status = 403;
                    deferred.reject( error );
                } else {
                    deferred.resolve( obj );
                }
            } );
        }
    }

    return deferred.promise;
}

/**
 * Create an account
 * @param  {{openRosaServer: string, key: string}} account [description]
 * @return {[type]}        [description]
 */
function _set( account ) {
    var error, dbKey,
        deferred = Q.defer();

    if ( !account.openRosaServer || !account.key ) {
        error = new Error( 'Bad Request. Server URL and/or API key missing' );
        error.status = 400;
        deferred.reject( error );
    } else if ( !utils.isValidUrl( account.openRosaServer ) ) {
        error = new Error( 'Bad Request. Server URL is not a valid URL.' );
        error.status = 400;
        deferred.reject( error );
    } else if ( !account.key || typeof account.key !== 'string' || account.key.length === 0 ) {
        error = new Error( 'Bad Request. Account API key malformed or missing.' );
        error.status = 400;
        deferred.reject( error );
    } else {
        dbKey = 'ac:' + utils.cleanUrl( account.openRosaServer );
        if ( pending[ dbKey ] ) {
            error = new Error( 'Conflict. Busy handling pending request for same account' );
            error.status = 409;
            deferred.reject( error );
        }
        if ( hardcodedAccount && _isAllowed( hardcodedAccount, account.openRosaServer ) ) {
            debug( 'harcoded account!' );
            deferred.resolve( account );
        } else {

            // to avoid issues with fast subsequent requests
            pending[ dbKey ] = true;

            client.hgetall( dbKey, function( error, obj ) {
                debug( 'response', error, obj );
                if ( error ) {
                    delete pending[ dbKey ];
                    deferred.reject( error );
                } else if ( !obj ) {
                    debug( 'no account exists for ' + account.openRosaServer + ', going to create one ' );
                    client.hmset( dbKey, account, function( error ) {
                        delete pending[ dbKey ];
                        if ( error ) {
                            deferred.reject( error );
                        }
                        account.status = 201;
                        deferred.resolve( account );
                    } );
                } else if ( !obj.openRosaServer || !obj.key ) {
                    delete pending[ dbKey ];
                    error = new Error( 'Account information is incomplete.' );
                    error.status = 406;
                    deferred.reject( error );
                } else {
                    delete pending[ dbKey ];
                    debug( 'account already present in db', obj );
                    obj.status = 200;
                    deferred.resolve( obj );
                }
            } );
        }
    }
    return deferred.promise;
}

/**
 * Update an account
 * @param  {{openRosaServer: string, key: string}} account [description]
 * @return {[type]}        [description]
 */
function _update( account ) {
    var error, dbKey,
        deferred = Q.defer();

    if ( !account.openRosaServer ) {
        error = new Error( 'Bad Request. Server URL missing' );
        error.status = 400;
        deferred.reject( error );
    } else if ( !utils.isValidUrl( account.openRosaServer ) ) {
        error = new Error( 'Bad Request. Server URL is not a valid URL.' );
        error.status = 400;
        deferred.reject( error );
    } else if ( !account.key || typeof account.key !== 'string' || account.key.length === 0 ) {
        error = new Error( 'Bad Request. Account API key malformed or missing.' );
        error.status = 400;
        deferred.reject( error );
    } else {
        if ( hardcodedAccount && _isAllowed( hardcodedAccount, account.openRosaServer ) ) {
            debug( 'harcoded account!' );
            deferred.resolve( account );
        } else {
            dbKey = 'ac:' + utils.cleanUrl( account.openRosaServer );
            client.hgetall( dbKey, function( error, obj ) {
                if ( error ) {
                    deferred.reject( error );
                } else if ( !obj ) {
                    error = new Error( 'Account Not found. Nothing to update' );
                    error.status = 404;
                    deferred.reject( error );
                } else if ( utils.areOwnPropertiesEqual( obj, account ) ) {
                    account.status = 200;
                    deferred.resolve( account );
                } else {
                    client.hmset( dbKey, account, function( error ) {
                        if ( error ) {
                            deferred.reject( error );
                        }
                        account.status = 201;
                        deferred.resolve( account );
                    } );
                }
            } );
        }
    }
    return deferred.promise;
}

/**
 * Remove an account
 * @param  {{openRosaServer: string, key: string}} account [description]
 * @return {[type]}        [description]
 */
function _remove( account ) {
    var error, dbKey,
        deferred = Q.defer();

    if ( !account.openRosaServer ) {
        error = new Error( 'Bad Request. Server URL missing' );
        error.status = 400;
        deferred.reject( error );
    } else if ( !utils.isValidUrl( account.openRosaServer ) ) {
        error = new Error( 'Bad Request. Server URL is not a valid URL.' );
        error.status = 400;
        deferred.reject( error );
    } else if ( hardcodedAccount && _isAllowed( hardcodedAccount, account.openRosaServer ) ) {
        error = new Error( 'Not Allowed. Hardcoded account cannot be removed via API.' );
        error.status = 405;
        deferred.reject( error );
    } else {
        dbKey = 'ac:' + utils.cleanUrl( account.openRosaServer );
        client.hgetall( dbKey, function( error, obj ) {
            if ( error ) {
                deferred.reject( error );
            } else if ( !obj ) {
                error = new Error( 'Not Found. Account not present.' );
                error.status = 404;
                deferred.reject( error );
            } else {
                client.del( dbKey, function( error ) {
                    if ( error ) {
                        deferred.reject( error );
                    } else {
                        deferred.resolve( account );
                    }
                } );
            }
        } );
    }

    return deferred.promise;
}

/**
 * Obtains a list of acccounts
 * @return {[type]} [description]
 */
function _getList() {
    var error, hardcodedAccount, multi,
        list = [],

        app = app || require( '../../config/express' ),
        deferred = Q.defer();

    hardcodedAccount = _getHardcodedAccount();

    if ( hardcodedAccount ) {
        list.push( hardcodedAccount );
    }

    client.keys( 'ac:*', function( error, accounts ) {
        if ( error ) {
            deferred.reject( error );
        } else if ( accounts.length === 0 ) {
            deferred.resolve( list );
        } else if ( accounts.length > 0 ) {
            multi = client.multi();

            accounts.forEach( function( account ) {
                multi.hgetall( account );
            } );

            multi.exec( function( errors, replies ) {
                if ( errors ) {
                    deferred.reject( errors[ 0 ] );
                }
                deferred.resolve( list.concat( replies ) );
            } );
        }
    } );

    return deferred.promise;
}



/** 
 * Check if account is active and pass parameter if so
 * this passes back the original survey object and therefore differs from _get!
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function _check( survey ) {
    var error,
        hardcodedAccount = _getHardcodedAccount(),
        server = _getServer( survey ),
        deferred = Q.defer();

    if ( !server ) {
        error = new Error( 'Bad Request. Server URL missing' );
        error.status = 400;
        deferred.reject( error );
    } else {
        if ( hardcodedAccount && _isAllowed( hardcodedAccount, server ) ) {
            deferred.resolve( survey );
        } else {
            client.hgetall( 'ac:' + utils.cleanUrl( server ), function( error, obj ) {
                if ( error ) {
                    deferred.reject( error );
                }
                if ( !obj ) {
                    error = new Error( 'Forbidden. This server is not linked with Enketo' );
                    error.status = 403;
                    deferred.reject( error );
                } else {
                    deferred.resolve( survey );
                }
            } );
        }
    }

    return deferred.promise;
}

/**
 * Checks if the provided serverUrl is part of the allowed 'linked' OpenRosa Server
 * @param { {openRosaServer:string, key:string}} account object
 * @param { string} serverUrl
 * @return { boolean } [description]
 */
function _isAllowed( account, serverUrl ) {
    return account.openRosaServer === '' || new RegExp( 'https?:\/\/' + _stripProtocol( account.openRosaServer ) ).test( serverUrl );
}

/**
 * Strips http(s):// from the provided url
 * @return {[type]} stripped url
 */
function _stripProtocol( url ) {
    if ( !url ) {
        return null;
    }

    // strip http(s):// 
    if ( /https?:\/\//.test( url ) ) {
        url = url.substring( url.indexOf( '://' ) + 3 );
    }
    return url;
}

/**
 * Obtains the hardcoded account from the config
 * @return {[type]} [description]
 */
function _getHardcodedAccount() {
    var app, linkedServer;

    if ( hardcodedAccount ) {
        return hardcodedAccount;
    }

    app = require( '../../config/express' );
    linkedServer = app.get( 'linked form and data server' );

    // check if configuration is acceptable
    if ( !linkedServer || typeof linkedServer[ 'server url' ] === 'undefined' || typeof linkedServer[ 'api key' ] === 'undefined' ) {
        return null;
    }

    return {
        openRosaServer: linkedServer[ 'server url' ],
        key: linkedServer[ 'api key' ]
    };
}

/**
 * Extracts the server from a survey object or server string
 * @param  {string|{openRosaServer:string}} survey server string or survey object
 * @return {[type]}        [description]
 */
function _getServer( survey ) {
    if ( !survey || ( typeof survey === 'object' && !survey.openRosaServer ) ) {
        return null;
    }
    return ( typeof survey === 'string' ) ? survey : survey.openRosaServer;
}

module.exports = {
    get: _get,
    set: _set,
    update: _update,
    remove: _remove,
    check: _check,
    getList: _getList
};
