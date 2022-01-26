/**
 * @module offline-resources-controller
 */

const fs = require( 'fs' );
const path = require( 'path' );
const express = require( 'express' );
const router = express.Router();
const config = require( '../models/config-model' ).server;

// var debug = require( 'debug' )( 'offline-controller' );

module.exports = app => {
    app.use( `${app.get( 'base path' )}/`, router );
};

router
    .get( '/x/offline-app-worker.js', ( req, res, next ) => {
        if ( config[ 'offline enabled' ] === false ) {
            var error = new Error( 'Offline functionality has not been enabled for this application.' );
            error.status = 404;
            next( error );
        } else {
            const scriptContent = fs.readFileSync( path.resolve( config.root, 'public/js/build/module/offline-app-worker.js' ), 'utf8' );

            res
                .set( 'Content-Type', 'text/javascript' )
                .send( scriptContent );
        }
    } );
