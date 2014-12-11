"use strict";

var crypto = require( 'crypto' ),
    debug = require( 'debug' )( 'utils' );

/** 
 * Returns a unique, predictable openRosaKey from a survey oject
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function _getOpenRosaKey( survey, prefix ) {
    if ( !survey || !survey.openRosaServer || !survey.openRosaId ) {
        return null;
    }
    prefix = prefix || 'or:';
    return prefix + _cleanUrl( survey.openRosaServer ) + ',' + survey.openRosaId.trim().toLowerCase();
}

/**
 * cleans a Server URL so it becomes useful as a db key
 * It strips the protocol, removes a trailing slash, and converts to lowercase
 * @param  {string} url [description]
 * @return {string=}     [description]
 */
function _cleanUrl( url ) {
    var matches;
    url = url.trim();
    if ( url.lastIndexOf( '/' ) === url.length - 1 ) {
        url = url.substring( 0, url.length - 1 );
    }
    matches = url.match( /https?\:\/\/(www\.)?(.+)/ );
    if ( matches.length > 2 ) {
        return matches[ 2 ].toLowerCase();
    }
    return null;
}

function _isValidUrl( url ) {
    var validUrl = /^(https?:\/\/)(([\da-z\.\-]+)\.([a-z\.]{2,6})|(([0-9]{1,3}\.){3}[0-9]{1,3})|localhost)(:(102[4-9]|10[3-9][0-9]|1[1-9][0-9]{2}|[2-9][0-9]{3}|[1-4][0-8]{4}|490[0-9]{2}|491[0-4][0-9]|4915[0-1]))?([\/\w \.\-]*)*\/?[\/\w \.\-\=\&\?]*$/;
    return validUrl.test( url );
}

function _md5( message ) {
    var hash = crypto.createHash( 'md5' );
    hash.update( message );
    return hash.digest( 'hex' );
}


// not recursive, only goes one property level deep
function _areOwnPropertiesEqual( a, b ) {
    var prop,
        results = [];

    if ( typeof a !== 'object' || typeof b !== 'object' ) {
        return null;
    }

    for ( prop in a ) {
        if ( a.hasOwnProperty( prop ) ) {
            if ( a[ prop ] !== b[ prop ] ) {
                return false;
            }
            results[ prop ] = true;
        }
    }
    for ( prop in b ) {
        if ( !results[ prop ] && b.hasOwnProperty( prop ) ) {
            if ( b[ prop ] !== a[ prop ] ) {
                return false;
            }
        }
    }
    return true;
}

module.exports = {
    getOpenRosaKey: _getOpenRosaKey,
    cleanUrl: _cleanUrl,
    isValidUrl: _isValidUrl,
    md5: _md5,
    areOwnPropertiesEqual: _areOwnPropertiesEqual
};
