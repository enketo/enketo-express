"use strict";

var hardcodedAccount,
    Q = require( "q" ),
    utils = require( '../lib/utils' ),
    debug = require( 'debug' )( "account-model" );

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
            error = new Error( 'Forbidden. This server is not linked with Enketo' );
            error.status = 403;
            deferred.reject( error );
        }
    }

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
            error = new Error( 'Forbidden. This server is not linked with Enketo' );
            error.status = 403;
            deferred.reject( error );
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
    check: _check
};
