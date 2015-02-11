"use strict";

var manifest = require( '../models/manifest-model' ),
    Q = require( 'q' ),
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'manifest-controller' );

module.exports = function( app ) {
    app.use( '/', router );
};

router
    .get( '/_/manifest.appcache*', function( req, res, next ) {
        getManifest( req, res )
            .then( function( manifestContent ) {
                res
                    .set( 'Content-Type', 'text/cache-manifest' )
                    .send( manifestContent );
            } )
            .catch( next );
    } );

function getManifest( req, res ) {
    var deferred = Q.defer();

    res.render( 'surveys/webform', {
        manifest: '/_/manifest.appcache'
    }, function( err, html ) {
        if ( err ) {
            deferred.reject( err );
        } else {
            manifest.get( html, req.i18n.lng() )
                .then( deferred.resolve )
                .catch( deferred.reject );
        }
    } );

    return deferred.promise;
}
