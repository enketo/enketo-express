'use strict';

var Promise = require( 'lie' );
var gui = require( './gui' );

/*
 * Layer that deals with differences in enketo-core's dialog API and gui.js API.
 * In the future it would be good to change gui.js so that this file is no longer required.
 */

/**
 * @param {String | {message: String, heading: String}} content Dialog content
 */
function alert( content ) {
    return Promise.resolve( gui.alert( content ) );
}

/**
 * @param {String | {message: String, heading: String}} content Dialog content
 */
function confirm( content ) {
    return new Promise( function( resolve, reject ) {
        gui.confirm( content, {
            posAction: resolve,
            negAction: reject
        } );
    } );
}

module.exports = {
    alert: alert,
    confirm: confirm,
};
