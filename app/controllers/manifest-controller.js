'use strict';

var manifest = require( '../models/manifest-model' );
var Promise = require( 'lie' );
var express = require( 'express' );
var router = express.Router();
// var debug = require( 'debug' )( 'manifest-controller' );

module.exports = function( app ) {
    app.use( app.get( 'base path' ) + '/x/manifest.appcache*', router );
    // legacy:
    app.use( app.get( 'base path' ) + '/_/manifest.appcache*', router );
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
    return Promise.all( [
            _getWebformHtml( req, res ),
            _getOfflineFallbackHtml( req, res )
        ] )
        .then( function( result ) {
            return manifest.get( result[ 0 ], result[ 1 ], req.i18n.language );
        } );
}

function _getWebformHtml( req, res ) {
    return new Promise( function( resolve, reject ) {
        res.render( 'surveys/webform', {
            manifest: req.app.get( 'base path' ) + '/x/manifest.appcache'
        }, function( err, html ) {
            if ( err ) {
                reject( err );
            } else {
                resolve( html );
            }
        } );
    } );
}

function _getOfflineFallbackHtml( req, res ) {
    return new Promise( function( resolve, reject ) {
        res.render( 'pages/offline', {}, function( err, html ) {
            if ( err ) {
                reject( err );
            } else {
                resolve( html );
            }
        } );
    } );
}
