/**
 * @module offline-resources-controller
 */

const fs = require( 'fs' );
const path = require( 'path' );
const crypto = require( 'crypto' );
const offlineResources = require( '../models/offline-resources-model' );
const express = require( 'express' );
const router = express.Router();
const config = require( '../models/config-model' ).server;

const partialOfflineAppWorkerScript = fs.readFileSync( path.join( process.cwd(), 'public/js/src/module/offline-app-worker-partial.js' ), 'utf8' );

// This hash is not actually required but useful to see which offline-app-worker-partial.js is used during troubleshooting.
const scriptHash = crypto.createHash( 'md5' ).update( partialOfflineAppWorkerScript ).digest( 'hex' );
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
            getScriptContent( req, res )
                .then( scriptContent => {
                    res
                        .set( 'Content-Type', 'text/javascript' )
                        .send( scriptContent );
                } )
                .catch( next );
        }
    } );

/**
 * @param {module:api-controller~ExpressRequest} req
 * @param {module:api-controller~ExpressResponse} res
 */
function getScriptContent( req, res ) {
    return Promise.all( [
            _getWebformHtml( req, res ),
            _getOfflineFallbackHtml( req, res )
        ] )
        .then( result => {
            // TODO: if we ever start supporting dialects, we need to change this
            // const lang = req.i18n.language.split( '-' )[ 0 ];
            return offlineResources.get( result[ 0 ], result[ 1 ] );
        } )
        .then( dynamicContent => {
            return `
const version = '${dynamicContent.version}_${scriptHash}';
const resources = [
    '${dynamicContent.resources.join('\',\n    \'')}'
];
const fallback = '${dynamicContent.fallback}';

${partialOfflineAppWorkerScript}`;
        } );
}

/**
 * @param {module:api-controller~ExpressRequest} req
 * @param {module:api-controller~ExpressResponse} res
 */
function _getWebformHtml( req, res ) {
    return new Promise( ( resolve, reject ) => {
        res.render( 'surveys/webform', {
            offlinePath: config[ 'offline path' ]
        }, ( err, html ) => {
            if ( err ) {
                reject( err );
            } else {
                resolve( html );
            }
        } );
    } );
}

/**
 * @param {module:api-controller~ExpressRequest} req
 * @param {module:api-controller~ExpressResponse} res
 */
function _getOfflineFallbackHtml( req, res ) {
    return new Promise( ( resolve, reject ) => {
        res.render( 'pages/offline', {
            offlinePath: config[ 'offline path' ]
        }, ( err, html ) => {
            if ( err ) {
                reject( err );
            } else {
                resolve( html );
            }
        } );
    } );
}
