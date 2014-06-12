"use strict";

var request = require( 'request' ),
    debug = require( 'debug' )( 'media-controller' );

function _extractMediaUrl( path ) {
    if ( !path ) {
        return undefined;
    }
    return path.replace( /\//, '://' );
}

module.exports = {
    get: function( req, res, next ) {
        var mediaUrl = _extractMediaUrl( req.params[ 0 ] );
        // url decode this (done in php app)?

        request( mediaUrl )
            .on( 'data', function( chunk ) {
                res.write( chunk );
            } )
            .on( 'error', function( error ) {
                debug( 'error retrieving media from OpenRosa server: ' + JSON.stringify( error ) );
                if ( !error.status ) {
                    error.status = ( error.code && error.code == 'ENOTFOUND' ) ? 404 : 500;
                }
                next( error );
            } )
            .on( 'end', function() {
                res.end();
            } );

        // this simpler alternative does not work properly: request( mediaUrl, next ).pipe( res );
    }
};
