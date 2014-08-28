"use strict";

var communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' ),
    instanceModel = require( '../models/instance-model' ),
    account = require( '../models/account-model' ),
    auth = require( '../lib/basic-auth' ),
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'api-controller' );

module.exports = function( app ) {
    app.use( '/api/v1', router );
};

router
    .all( '*', authCheck )
    .all( '/*/iframe', function( req, res, next ) {
        req.iframe = true;
        next();
    } )
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

function _generateWebformUrls( id, req ) {
    var obj = {},
        baseUrl = req.protocol + '://' + req.headers.host + '/',
        idPart = '::' + id,
        iframeUrlPart = ( req.iframe ) ? '?iframe=true' : '';

    req.webformType = req.webformType || 'default';

    switch ( req.webformType ) {
        case 'preview':
            obj.preview_url = baseUrl + 'preview/' + idPart + iframeUrlPart;
            break;
        case 'edit':
            iframeUrlPart = ( req.iframe ) ? '&iframe=true' : '';
            obj.edit_url = baseUrl + 'edit/' + idPart + '?instance_id=' + req.param( 'instance_id' ) + iframeUrlPart;
            break;
        case 'all':
            obj.url = baseUrl + idPart;
            obj.iframe_url = obj.url + '?iframe=true';
            obj.preview_url = baseUrl + 'preview/' + idPart;
            obj.preview_iframe_url = obj.preview_url + '?iframe=true';
            obj.subdomain = '';
            break;
        default:
            obj.url = baseUrl + idPart + iframeUrlPart;
            break;
    }

    return obj;
}

function _render( status, body, res ) {
    if ( status === 204 ) {
        // send 204 response without a body
        res.send( status );
    } else {
        body = body || {};
        if ( typeof body === 'string' ) {
            body = {
                message: body
            };
        }
        body.code = status;
        res.json( status, body );
    }
}
