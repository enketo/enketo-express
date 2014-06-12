"use strict";
var Q = require( "q" );
var debug = require( 'debug' )( "account-model" );

// TODO: find way to access app.get() without requiring it for every method call
/**
 * Obtain account
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function _get( survey ) {
    var error,
        server = _getServer( survey ),
        app = require( '../app' ),
        deferred = Q.defer();

    if ( !server ) {
        error = new Error( 'Bad Request. Server URL missing' );
        error.status = 400;
        deferred.reject( error );
    } else {
        if ( new RegExp( 'https?:\/\/' + _getLinkedUrl() ).test( server ) ) {
            deferred.resolve( {
                key: app.get( 'enketo api key' )
            } );
        } else if ( /https?:\/\/testserver.com\/bob/.test( server ) ) {
            deferred.resolve( {
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
 * check if account is active and pass parameter if so
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function _check( survey ) {
    var error,
        server = _getServer( survey ),
        app = require( '../app' ),
        deferred = Q.defer();

    if ( !server ) {
        error = new Error( 'Bad Request. Server URL missing' );
        error.status = 400;
        deferred.reject( error );
    } else {
        if ( new RegExp( 'https?:\/\/' + _getLinkedUrl() ).test( server ) ) {
            deferred.resolve( survey );
        } else {
            error = new Error( 'Forbidden. Server not linked with Enketo.' );
            error.status = 403;
            deferred.reject( error );
        }
    }

    return deferred.promise;
}

function _getLinkedUrl() {
    var app = require( '../app' ),
        linkedUrl = app.get( 'openrosa server url' );

    // strip http(s):// from config item
    if ( /https?:\/\//.test( linkedUrl ) ) {
        linkedUrl = linkedUrl.substring( linkedUrl.indexOf( '://' ) + 3 );
    }
    return linkedUrl;
}

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
