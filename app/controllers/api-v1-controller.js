"use strict";

var communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' ),
    instanceModel = require( '../models/instance-model' ),
    account = require( '../models/account-model' ),
    auth = require( 'basic-auth' ),
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'api-controller' );

module.exports = function( app ) {
    app.use( '/api/v1', router );
    // old enketo-legacy URL structure for migration-friendliness
    app.use( '/api_v1', router );
};

router
    .get( '/', function( req, res ) {
        res.redirect( 'http://apidocs.enketo.org' );
    } )
    .all( '*', authCheck )
    .all( '/*/iframe', _setIframeQueryParam )
    .all( '/survey/preview*', function( req, res, next ) {
        req.webformType = 'preview';
        next();
    } )
    .all( '/survey/all*', function( req, res, next ) {
        req.webformType = 'all';
        next();
    } )
    .all( '/instance*', function( req, res, next ) {
        req.webformType = 'edit';
        next();
    } )
    .all( '*', _setReturnQueryParam )
    .get( '/survey', getExistingSurvey )
    .get( '/survey/iframe', getExistingSurvey )
    .post( '/survey', getNewOrExistingSurvey )
    .post( '/survey/iframe', getNewOrExistingSurvey )
    .delete( '/survey', deactivateSurvey )
    .get( '/survey/preview', getExistingSurvey )
    .get( '/survey/preview/iframe', getExistingSurvey )
    .post( '/survey/preview', getNewOrExistingSurvey )
    .post( '/survey/preview/iframe', getNewOrExistingSurvey )
    .get( '/survey/all', getExistingSurvey )
    .post( '/survey/all', getNewOrExistingSurvey )
    .get( '/surveys/number', getNumber )
    .post( '/surveys/number', getNumber )
    .get( '/surveys/list', getList )
    .post( '/surveys/list', getList )
    .post( '/instance', cacheInstance )
    .post( '/instance/iframe', cacheInstance )
    .delete( '/instance', removeInstance )
    .all( '*', function( req, res, next ) {
        var error = new Error( 'Not allowed' );
        error.status = 405;
        next( error );
    } );

function authCheck( req, res, next ) {
    // check authentication and account
    var error,
        creds = auth( req ),
        key = ( creds ) ? creds.name : undefined,
        server = req.param( 'server_url' );

    // set content-type to json to provide appropriate json Error responses
    res.set( 'Content-Type', 'application/json' );

    account.get( server )
        .then( function( account ) {
            debug( 'account', account );
            if ( !key || ( key !== account.key ) ) {
                error = new Error( 'Not Allowed. Invalid API key.' );
                error.status = 401;
                res
                    .status( error.status )
                    .set( 'WWW-Authenticate', 'Basic realm="Enter valid API key as user name"' );
                next( error );
            } else {
                next();
            }
        } )
        .catch( next );
}

function getExistingSurvey( req, res, next ) {
    var error, body;

    return surveyModel
        .getId( {
            openRosaServer: req.param( 'server_url' ),
            openRosaId: req.param( 'form_id' )
        } )
        .then( function( id ) {
            if ( id ) {
                _render( 200, _generateWebformUrls( id, req ), res );
            } else {
                _render( 404, 'Survey not found', res );
            }
        } )
        .catch( next );
}

function getNewOrExistingSurvey( req, res, next ) {
    var error, body, status,
        survey = {
            openRosaServer: req.param( 'server_url' ),
            openRosaId: req.param( 'form_id' )
        };

    return surveyModel
        .getId( survey ) // will return id only for existing && active surveys
        .then( function( id ) {
            debug( 'id: ' + id );
            status = ( id ) ? 200 : 201;
            // even if id was found still call .set() method to update any properties
            return surveyModel.set( survey )
                .then( function( id ) {
                    if ( id ) {
                        _render( status, _generateWebformUrls( id, req ), res );
                    } else {
                        _render( 404, 'Survey not found', res );
                    }
                } );
        } )
        .catch( next );
}

function deactivateSurvey( req, res, next ) {
    var error;

    return surveyModel
        .update( {
            openRosaServer: req.param( 'server_url' ),
            openRosaId: req.param( 'form_id' ),
            active: false
        } )
        .then( function( id ) {
            if ( id ) {
                _render( 204, null, res );
            } else {
                _render( 404, 'Survey not found', res );
            }
        } )
        .catch( next );
}

function getNumber( req, res, next ) {
    var error, body;

    return surveyModel
        .getNumber( req.param( 'server_url' ) )
        .then( function( number ) {
            if ( number ) {
                _render( 200, {
                    code: 200,
                    number: number
                }, res );
            } else {
                // this cannot be reached I think
                _render( 404, 'No surveys found', res );
            }
        } )
        .catch( next );
}

function getList( req, res, next ) {
    _render( 500, 'This API point is not implemented yet', res );
}

function cacheInstance( req, res, next ) {
    var error, body, survey;

    survey = {
        openRosaServer: req.param( 'server_url' ),
        openRosaId: req.param( 'form_id' ),
        instance: req.param( 'instance' ),
        instanceId: req.param( 'instance_id' ),
        returnUrl: req.param( 'return_url' )
    };
    instanceModel
        .set( survey )
        .then( surveyModel.getId )
        .then( function( id ) {
            debug( 'edit url generated:', _generateWebformUrls( id, req ) );
            _render( 201, _generateWebformUrls( id, req ), res );
        } )
        .catch( next );
}

function removeInstance( req, res, next ) {
    var error;

    return instanceModel
        .remove( {
            openRosaServer: req.param( 'server_url' ),
            openRosaId: req.param( 'form_id' ),
            instanceId: req.param( 'instance_id' )
        } )
        .then( function( instanceId ) {
            if ( instanceId ) {
                _render( 204, null, res );
            } else {
                _render( 404, 'Record not found', res );
            }
        } )
        .catch( next );
}

function _setIframeQueryParam( req, res, next ) {
    req.iframeQueryParam = 'iframe=true';
    next();
}

function _setReturnQueryParam( req, res, next ) {
    if ( req.param( 'return_url' ) && ( req.webformType === 'edit' || req.webformType === 'single' ) ) {
        req.returnQueryParam = 'returnUrl=' + encodeURIComponent( decodeURIComponent( req.param( 'return_url' ) ) );
    }
    next();
}

function _generateQueryString( params ) {
    var paramsJoined;

    params = params || [];

    paramsJoined = params.filter( function( part ) {
        return part && part.length > 0;
    } ).join( '&' );

    return paramsJoined ? '?' + paramsJoined : '';
}

function _generateWebformUrls( id, req ) {
    var queryString,
        obj = {},
        baseUrl = req.protocol + '://' + req.headers.host + '/',
        idPartOnline = '::' + id,
        idPartOffline = '#' + id,
        offline = req.app.get( 'offline enabled' ) && !req.iframeQueryParam;

    req.webformType = req.webformType || 'default';

    switch ( req.webformType ) {
        case 'preview':
            queryString = _generateQueryString( [ req.iframeQueryParam ] );
            obj.preview_url = baseUrl + 'preview/' + idPartOnline + queryString;
            break;
        case 'edit':
            queryString = _generateQueryString( [ req.iframeQueryParam, 'instance_id=' + req.param( 'instance_id' ), req.returnQueryParam ] );
            obj.edit_url = baseUrl + 'edit/' + idPartOnline + queryString;
            break;
        case 'all':
            // non-iframe views
            queryString = _generateQueryString( [] );
            obj.url = ( offline ) ? baseUrl + '_' + idPartOffline : baseUrl + idPartOnline + queryString;
            obj.preview_url = baseUrl + 'preview/' + idPartOnline + queryString;
            // iframe views
            queryString = _generateQueryString( [ 'iframe=true' ] );
            obj.iframe_url = baseUrl + idPartOnline + queryString;
            obj.preview_iframe_url = baseUrl + 'preview/' + idPartOnline + queryString;
            // enketo-legacy
            obj.subdomain = '';
            break;
        default:
            queryString = _generateQueryString( [ req.iframeQueryParam ] );
            obj.url = ( offline ) ? baseUrl + '_' + idPartOffline : baseUrl + idPartOnline + queryString;
            break;
    }

    return obj;
}

function _render( status, body, res ) {
    if ( status === 204 ) {
        // send 204 response without a body
        res.status( status ).end();
    } else {
        body = body || {};
        if ( typeof body === 'string' ) {
            body = {
                message: body
            };
        }
        body.code = status;
        res.status( status ).json( body );
    }
}
