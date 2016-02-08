'use strict';

var user = require( '../models/user-model' );
var communicator = require( '../lib/communicator' );
var request = require( 'request' );
var express = require( 'express' );
var router = express.Router();
var debug = require( 'debug' )( 'media-controller' );

module.exports = function( app ) {
    app.use( app.get( 'base path' ) + '/media', router );
};

router
    .get( '/get/*', getMedia );

function _extractMediaUrl( path ) {
    if ( !path ) {
        return undefined;
    }
    return path.replace( /\//, '://' );
}

function getMedia( req, res, next ) {
    var options = communicator.getUpdatedRequestOptions( {
        url: _extractMediaUrl( req.url.substring( '/get/'.length ) ),
        auth: user.getCredentials( req ),
        headers: {
            'cookie': req.headers.cookie
        }
    } );

    // due to a bug in request/request using options.method with Digest Auth we won't pass method as an option
    delete options.method;

    request.get( options ).pipe( res ).on( 'error', function( error ) {
        debug( 'error retrieving media from OpenRosa server: ' + JSON.stringify( error ) );
        if ( !error.status ) {
            error.status = ( error.code && error.code === 'ENOTFOUND' ) ? 404 : 500;
        }
        next( error );
    } );
}
