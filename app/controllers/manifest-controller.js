"use strict";

var manifest = require( '../models/manifest-model' ),
    Promise = require( 'q' ).Promise,
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'manifest-controller' );

module.exports = function( app ) {
    app.use( '/_/manifest.appcache*', router );
};
router
    .get( '*', function( req, res, next ) {
        getManifest( req, res )
            .then( function( manifestContent ) {
                res
                    .set( 'Content-Type', 'text/cache-manifest' )
                    .send( manifestContent );
            } )
            .catch( next );
    } );

function getManifest( req, res ) {
    return new Promise( function( resolve, reject ) {
        res.render( 'surveys/webform', {
            manifest: '/_/manifest.appcache'
        }, function( err, html ) {
            if ( err ) {
                reject( err );
            } else {
                manifest.get( html, req.i18n.lng() )
                    .then( resolve )
                    .catch( reject );
            }
        } );
    } );
}
