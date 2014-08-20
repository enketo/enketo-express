"use strict";

var Q = require( "q" ),
    utils = require( '../lib/utils' ),
    debug = require( 'debug' )( "account-model" );

/**
 * Obtain account
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function _get( survey ) {
    var error,
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
        if ( new RegExp( 'https?:\/\/' + _getLinkedServerUrlStripped() ).test( server ) ) {
            deferred.resolve( {
                openRosaServer: server,
                key: app.get( 'linked form and data server' )[ 'api key' ]
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
        server = _getServer( survey ),
        deferred = Q.defer();

    if ( !server ) {
        error = new Error( 'Bad Request. Server URL missing' );
        error.status = 400;
        deferred.reject( error );
    } else {
        if ( new RegExp( 'https?:\/\/' + _getLinkedServerUrlStripped() ).test( server ) ) {
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
 * Gets the hardcoded server URL from the configuration stripped of http(s)://
 * @return {[type]} [description]
 */
function _getLinkedServerUrlStripped() {
    var linkedUrl,
        hardcodedAccount = _getHardcodedAccount();

    if ( !hardcodedAccount ) {
        return null;
    }
    linkedUrl = hardcodedAccount.openRosaServer;

    // strip http(s):// from config item
    if ( /https?:\/\//.test( linkedUrl ) ) {
        linkedUrl = linkedUrl.substring( linkedUrl.indexOf( '://' ) + 3 );
    }
    return linkedUrl;
}

function _getHardcodedAccount() {
    var app = app || require( '../../config/express' ),
        hardcodedAccount = app.get( 'linked form and data server' );

    if ( !hardcodedAccount || !hardcodedAccount[ 'server url' ] || !hardcodedAccount[ 'api key' ] ) {
        return null;
    }

    return {
        openRosaServer: hardcodedAccount[ 'server url' ],
        key: hardcodedAccount[ 'api key' ]
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
