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

function _md5( message ) {
    var hash = crypto.createHash( 'md5' );
    hash.update( message );
    return hash.digest( 'hex' );
}

module.exports = {
    getOpenRosaKey: _getOpenRosaKey,
    cleanUrl: _cleanUrl,
    md5: _md5
};
