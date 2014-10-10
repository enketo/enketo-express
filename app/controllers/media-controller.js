"use strict";

var request = require( 'request' ),
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
    var mediaUrl = _extractMediaUrl( req.url.substring( '/get/'.length ) );

    debug( 'media Url to be loaded', mediaUrl );

    request( mediaUrl ).pipe( res ).on( 'error', function( error ) {
        debug( 'error retrieving media from OpenRosa server: ' + JSON.stringify( error ) );
        if ( !error.status ) {
            error.status = ( error.code && error.code == 'ENOTFOUND' ) ? 404 : 500;
        }
        next( error );
    } );

    // this simpler alternative does not work properly: request( mediaUrl, next ).pipe( res );
}
