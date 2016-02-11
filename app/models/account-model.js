'use strict';

var Promise = require( 'lie' );
var utils = require( '../lib/utils' );
var config = require( './config-model' ).server;
var customGetAccount = config[ 'account lib' ] ? require( config[ 'account lib' ] ).getAccount : undefined;
var pending = {};
var client = require( 'redis' ).createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );
// var debug = require( 'debug' )( "account-model" );

// in test environment, switch to different db
if ( process.env.NODE_ENV === 'test' ) {
    client.select( 15 );
}

/**
 * Obtain account
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function get( survey ) {
    var error;
    var server = _getServer( survey );

    if ( !server ) {
        error = new Error( 'Bad Request. Server URL missing.' );
        error.status = 400;
        return Promise.reject( error );
    } else if ( !utils.isValidUrl( server ) ) {
        error = new Error( 'Bad Request. Server URL is not a valid URL.' );
        error.status = 400;
        return Promise.reject( error );
    } else if ( /https?:\/\/testserver.com\/bob/.test( server ) ) {
        return Promise.resolve( {
            linkedServer: server,
            key: 'abc',
            quota: 100
        } );
    } else if ( /https?:\/\/testserver.com\/noquota/.test( server ) ) {
        error = new Error( 'Forbidden. No quota left.' );
        error.status = 403;
        return Promise.reject( error );
    } else if ( /https?:\/\/testserver.com\/noapi/.test( server ) ) {
        error = new Error( 'Forbidden. No API access granted.' );
        error.status = 405;
        return Promise.reject( error );
    } else if ( /https?:\/\/testserver.com\/noquotanoapi/.test( server ) ) {
        error = new Error( 'Forbidden. No API access granted.' );
        error.status = 405;
        return Promise.reject( error );
    } else if ( /https?:\/\/testserver.com\/notpaid/.test( server ) ) {
        error = new Error( 'Forbidden. The account is not active.' );
        error.status = 403;
        return Promise.reject( error );
    }

    return _getAccount( server );
}

/**
 * Create an account
 * @param  {{linkedServer: string, key: string}} account [description]
 * @return {[type]}        [description]
 */
function set( account ) {
    var error;
    var dbKey;
    var hardcodedAccount = _getHardcodedAccount();

    return new Promise( function( resolve, reject ) {
        if ( !account.linkedServer || !account.key ) {
            error = new Error( 'Bad Request. Server URL and/or API key missing' );
            error.status = 400;
            reject( error );
        } else if ( !utils.isValidUrl( account.linkedServer ) ) {
            error = new Error( 'Bad Request. Server URL is not a valid URL.' );
            error.status = 400;
            reject( error );
        } else if ( !account.key || typeof account.key !== 'string' || account.key.length === 0 ) {
            error = new Error( 'Bad Request. Account API key malformed or missing.' );
            error.status = 400;
            reject( error );
        } else {
            dbKey = 'ac:' + utils.cleanUrl( account.linkedServer );
            if ( pending[ dbKey ] ) {
                error = new Error( 'Conflict. Busy handling pending request for same account' );
                error.status = 409;
                reject( error );
            }
            if ( hardcodedAccount && _isAllowed( hardcodedAccount, account.linkedServer ) ) {
                resolve( account );
            } else {

                // to avoid issues with fast subsequent requests
                pending[ dbKey ] = true;

                client.hgetall( dbKey, function( error, obj ) {
                    if ( error ) {
                        delete pending[ dbKey ];
                        reject( error );
                    } else if ( !obj || obj.openRosaServer ) {
                        // also update if deprecated openRosaServer property is present
                        client.hmset( dbKey, account, function( error ) {
                            delete pending[ dbKey ];
                            if ( error ) {
                                reject( error );
                            }
                            // remove deprecated field, don't wait for result
                            if ( obj && obj.openRosaServer ) {
                                client.hdel( dbKey, 'openRosaServer' );
                            }
                            account.status = 201;
                            resolve( account );
                        } );
                    } else if ( !obj.linkedServer || !obj.key ) {
                        delete pending[ dbKey ];
                        error = new Error( 'Account information is incomplete.' );
                        error.status = 406;
                        reject( error );
                    } else {
                        delete pending[ dbKey ];
                        obj.status = 200;
                        resolve( obj );
                    }
                } );
            }
        }
    } );
}

/**
 * Update an account
 * @param  {{linkedServer: string, key: string}} account [description]
 * @return {[type]}        [description]
 */
function update( account ) {
    var error;
    var dbKey;
    var hardcodedAccount = _getHardcodedAccount();

    return new Promise( function( resolve, reject ) {
        if ( !account.linkedServer ) {
            error = new Error( 'Bad Request. Server URL missing' );
            error.status = 400;
            reject( error );
        } else if ( !utils.isValidUrl( account.linkedServer ) ) {
            error = new Error( 'Bad Request. Server URL is not a valid URL.' );
            error.status = 400;
            reject( error );
        } else if ( !account.key || typeof account.key !== 'string' || account.key.length === 0 ) {
            error = new Error( 'Bad Request. Account API key malformed or missing.' );
            error.status = 400;
            reject( error );
        } else {
            if ( hardcodedAccount && _isAllowed( hardcodedAccount, account.linkedServer ) ) {
                resolve( account );
            } else {
                dbKey = 'ac:' + utils.cleanUrl( account.linkedServer );
                client.hgetall( dbKey, function( error, obj ) {
                    if ( error ) {
                        reject( error );
                    } else if ( !obj ) {
                        error = new Error( 'Account Not found. Nothing to update' );
                        error.status = 404;
                        reject( error );
                    } else if ( utils.areOwnPropertiesEqual( obj, account ) ) {
                        account.status = 200;
                        resolve( account );
                    } else {
                        client.hmset( dbKey, account, function( error ) {
                            if ( error ) {
                                reject( error );
                            }
                            // remove deprecated field, don't wait for result
                            if ( obj.openRosaServer ) {
                                client.hdel( dbKey, 'openRosaServer' );
                            }
                            account.status = 201;
                            resolve( account );
                        } );
                    }
                } );
            }
        }
    } );
}

/**
 * Remove an account
 * @param  {{linkedServer: string, key: string}} account [description]
 * @return {[type]}        [description]
 */
function remove( account ) {
    var error;
    var dbKey;
    var hardcodedAccount = _getHardcodedAccount();

    return new Promise( function( resolve, reject ) {
        if ( !account.linkedServer ) {
            error = new Error( 'Bad Request. Server URL missing' );
            error.status = 400;
            reject( error );
        } else if ( !utils.isValidUrl( account.linkedServer ) ) {
            error = new Error( 'Bad Request. Server URL is not a valid URL.' );
            error.status = 400;
            reject( error );
        } else if ( hardcodedAccount && _isAllowed( hardcodedAccount, account.linkedServer ) ) {
            error = new Error( 'Not Allowed. Hardcoded account cannot be removed via API.' );
            error.status = 405;
            reject( error );
        } else {
            dbKey = 'ac:' + utils.cleanUrl( account.linkedServer );
            client.hgetall( dbKey, function( error, obj ) {
                if ( error ) {
                    reject( error );
                } else if ( !obj ) {
                    error = new Error( 'Not Found. Account not present.' );
                    error.status = 404;
                    reject( error );
                } else {
                    client.del( dbKey, function( error ) {
                        if ( error ) {
                            reject( error );
                        } else {
                            resolve( account );
                        }
                    } );
                }
            } );
        }
    } );
}

/**
 * Obtains a list of acccounts
 * @return {[type]} [description]
 */
function getList() {
    var error;
    var hardcodedAccount;
    var multi;
    var list = [];
    var app = app || require( '../../config/express' );

    hardcodedAccount = _getHardcodedAccount();

    if ( hardcodedAccount ) {
        list.push( hardcodedAccount );
    }

    return new Promise( function( resolve, reject ) {
        client.keys( 'ac:*', function( error, accounts ) {
            if ( error ) {
                reject( error );
            } else if ( accounts.length === 0 ) {
                resolve( list );
            } else if ( accounts.length > 0 ) {
                multi = client.multi();

                accounts.forEach( function( account ) {
                    multi.hgetall( account );
                } );

                multi.exec( function( errors, replies ) {
                    if ( errors ) {
                        reject( errors[ 0 ] );
                    }
                    resolve( list.concat( replies ) );
                } );
            }
        } );
    } );
}

/** 
 * Check if account for passed survey is active, and not exceeding quota.
 * This passes back the original survey object and therefore differs from the get function!
 * 
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function check( survey ) {
    return get( survey )
        .then( function( account ) {
            survey.account = account;
            return survey;
        } );
}

/**
 * Checks if the provided serverUrl is part of the allowed 'linked' OpenRosa Server
 * @param { {openRosaServer:string, key:string}} account object
 * @param { string} serverUrl
 * @return { boolean } [description]
 */
function _isAllowed( account, serverUrl ) {
    return account.linkedServer === '' || new RegExp( 'https?:\/\/' + _stripProtocol( account.linkedServer ) ).test( serverUrl );
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
 * Obtains account from either configuration (hardcoded) or via custom function
 * 
 * @param  {string} serverUrl the serverUrl to be used to look up the account
 * @return {{linkedServer: string, key: string, quota: number}} account object
 */
function _getAccount( serverUrl ) {
    var error;
    var hardcodedAccount = _getHardcodedAccount();

    if ( _isAllowed( hardcodedAccount, serverUrl ) ) {
        return Promise.resolve( hardcodedAccount );
    }

    if ( customGetAccount ) {
        return customGetAccount( serverUrl, config[ 'account api url' ] );
    }

    return new Promise( function( resolve, reject ) {
        client.hgetall( 'ac:' + utils.cleanUrl( serverUrl ), function( error, obj ) {
            if ( error ) {
                reject( error );
            }
            if ( !obj ) {
                error = new Error( 'Forbidden. This server is not linked with Enketo' );
                error.status = 403;
                reject( error );
            } else {
                // correct deprecated property name if necessary
                resolve( {
                    linkedServer: obj.linkedServer ? obj.linkedServer : obj.openRosaServer,
                    key: obj.key,
                    quota: obj.quota || Infinity
                } );
            }
        } );

    } );
}

/**
 * Obtains the hardcoded account from the config
 * @return {[type]} [description]
 */
function _getHardcodedAccount() {
    var app = require( '../../config/express' );
    var linkedServer = app.get( 'linked form and data server' );

    // check if configuration is acceptable
    if ( !linkedServer || typeof linkedServer[ 'server url' ] === 'undefined' || typeof linkedServer[ 'api key' ] === 'undefined' ) {
        return null;
    }

    // do not add default branding
    return {
        linkedServer: linkedServer[ 'server url' ],
        key: linkedServer[ 'api key' ],
        quota: linkedServer[ 'quota' ] || Infinity
    };
}

/**
 * Extracts the server from a survey object or server string
 * @param  {string|{openRosaServer:string}} survey server string or survey object
 * @return {[type]}        [description]
 */
function _getServer( survey ) {
    if ( !survey || ( typeof survey === 'object' && ( !survey.openRosaServer && !survey.linkedServer ) ) ) {
        return null;
    }
    if ( typeof survey === 'string' ) {
        return survey;
    }
    return survey.linkedServer || survey.openRosaServer;
}

module.exports = {
    get: get,
    check: check,
    set: set,
    update: update,
    remove: remove,
    getList: getList
};
