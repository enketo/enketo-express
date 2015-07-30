"use strict";

var user = require( '../models/user-model' ),
    communicator = require( '../lib/communicator' ),
    request = require( 'request' ),
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'media-controller' );

module.exports = function( app ) {
    app.use( '/media', router );
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
        auth: user.getCredentials( req )
    } );

    // due to a bug in request/request using options.method with Digest Auth we won't pass method as an option
    delete options.method;

    request.get( options ).pipe( res ).on( 'error', function( error ) {
        debug( 'error retrieving media from OpenRosa server: ' + JSON.stringify( error ) );
        if ( !error.status ) {
            error.status = ( error.code && error.code == 'ENOTFOUND' ) ? 404 : 500;
        }
        next( error );
    } );

    // this simpler alternative does not work properly: req.get( options, next ).pipe( res );
}
