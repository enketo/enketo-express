/**
 * @module media-controller
 */

const url = require( 'url' );
const user = require( '../models/user-model' );
const communicator = require( '../lib/communicator' );
const request = require( 'request' );
const express = require( 'express' );
const router = express.Router();
const debug = require( 'debug' )( 'media-controller' );
const { RequestFilteringHttpAgent, RequestFilteringHttpsAgent } = require( 'request-filtering-agent' );

module.exports = app => {
    app.use( `${app.get( 'base path' )}/media`, router );
};

router
    .get( '/get/*', getMedia );

/**
 * @param { string } [path] - path to media
 * @return {string|undefined} path transformed to a URL
 */
function _extractMediaUrl( path ) {
    if ( !path ) {
        return undefined;
    }

    return path.replace( /\//, '://' );
}


function _isPrintView( req ) {
    const refererQuery = req.headers && req.headers.referer ? url.parse( req.headers.referer ).query : null;

    return !!( refererQuery && refererQuery.includes( 'print=true' ) );
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function getMedia( req, res, next ) {
    const options = communicator.getUpdatedRequestOptions( {
        url: _extractMediaUrl( req.url.substring( '/get/'.length ) ),
        auth: user.getCredentials( req ),
        headers: {
            'cookie': req.headers.cookie
        }
    } );

    // due to a bug in request/request using options.method with Digest Auth we won't pass method as an option
    delete options.method;

    //filtering agent to stop private ip access to HEAD and GET
    if ( options.url.startsWith( 'https' ) ) {
        options.agent = new RequestFilteringHttpsAgent( req.app.get( 'ip filtering' ) );
    } else {
        options.agent = new RequestFilteringHttpAgent( req.app.get( 'ip filtering' ) );
    }

    if ( _isPrintView( req ) ) {
        request.head( options, ( error, response ) => {

            if ( error ) {
                next( error );
            } else {
                const contentType = response.headers[ 'content-type' ];
                if ( contentType.startsWith( 'audio' ) || contentType.startsWith( 'video' ) ) {
                    // Empty response, because audio and video is not helpful in print views.
                    res.status( 204 ).end();
                } else {
                    _pipeMedia( options, req, res, next );
                }
            }
        } );
    } else {
        _pipeMedia( options, req, res, next );
    }
}

function _pipeMedia( options, req, res, next ) {
    request.get( options ).on( 'error', error => _handleMediaRequestError( error, next ) ).pipe( res ).on( 'error', error => _handleMediaRequestError( error, next ) );
}

function _handleMediaRequestError( error, next ) {
    debug( `error retrieving media from OpenRosa server: ${JSON.stringify( error )}` );
    if ( !error.status ) {
        error.status = ( error.code && error.code === 'ENOTFOUND' ) ? 404 : 500;
    }
    next( error );
}
