'use strict';

var surveyModel = require( '../models/survey-model' );
var instanceModel = require( '../models/instance-model' );
var account = require( '../models/account-model' );
var auth = require( 'basic-auth' );
var express = require( 'express' );
var router = express.Router();
var quotaErrorMessage = 'Forbidden. No quota left';
//var debug = require( 'debug' )( 'api-controller-v1' );

module.exports = function( app ) {
    app.use( app.get( 'base path' ) + '/api/v1', router );
    // old enketo-legacy URL structure for migration-friendliness
    app.use( app.get( 'base path' ) + '/api_v1', router );
};

router
    .get( '/', function( req, res ) {
        res.redirect( 'http://apidocs.enketo.org/v1' );
    } )
    .all( '*', authCheck )
    .all( '*', _setQuotaUsed )
    .all( '/*/iframe', _setIframe )
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
    var error;
    var creds = auth( req );
    var key = ( creds ) ? creds.name : undefined;
    var server = req.body.server_url || req.query.server_url;

    // set content-type to json to provide appropriate json Error responses
    res.set( 'Content-Type', 'application/json' );

    account.get( server )
        .then( function( account ) {
            if ( !key || ( key !== account.key ) ) {
                error = new Error( 'Not Allowed. Invalid API key.' );
                error.status = 401;
                res
                    .status( error.status )
                    .set( 'WWW-Authenticate', 'Basic realm="Enter valid API key as user name"' );
                next( error );
            } else {
                req.account = account;
                next();
            }
        } )
        .catch( next );
}

function getExistingSurvey( req, res, next ) {

    if ( req.account.quota < req.account.quotaUsed ) {
        return _render( 403, quotaErrorMessage, res );
    }

    return surveyModel
        .getId( {
            openRosaServer: req.query.server_url,
            openRosaId: req.query.form_id
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
    var status;
    var survey = {
        openRosaServer: req.body.server_url || req.query.server_url,
        openRosaId: req.body.form_id || req.query.form_id
    };

    if ( req.account.quota < req.account.quotaUsed ) {
        return _render( 403, quotaErrorMessage, res );
    }

    return surveyModel
        .getId( survey ) // will return id only for existing && active surveys
        .then( function( id ) {
            if ( !id && req.account.quota <= req.account.quotaUsed ) {
                return _render( 403, quotaErrorMessage, res );
            }
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

    return surveyModel
        .update( {
            openRosaServer: req.body.server_url,
            openRosaId: req.body.form_id,
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

    return surveyModel
        .getNumber( req.body.server_url || req.query.server_url )
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
    var obj;

    return surveyModel
        .getList( req.body.server_url || req.query.server_url )
        .then( function( list ) {
            list = list.map( function( survey ) {
                obj = _generateWebformUrls( survey.enketoId, req );
                obj.form_id = survey.openRosaId;
                obj.server_url = survey.openRosaServer;
                return obj;
            } );
            _render( 200, {
                code: 200,
                forms: list
            }, res );
        } )
        .catch( next );
}

function cacheInstance( req, res, next ) {
    var survey;
    var enketoId;

    if ( req.account.quota < req.account.quotaUsed ) {
        return _render( 403, quotaErrorMessage, res );
    }

    survey = {
        openRosaServer: req.body.server_url,
        openRosaId: req.body.form_id,
        instance: req.body.instance,
        instanceId: req.body.instance_id,
        returnUrl: req.body.return_url
    };

    return surveyModel
        .getId( survey )
        .then( function( id ) {
            if ( !id && req.account.quota <= req.account.quotaUsed ) {
                return _render( 403, quotaErrorMessage, res );
            }
            // Create a new enketo ID.
            if ( !id ) {
                return surveyModel.set( survey );
            }
            // Do not update properties if ID was found to avoid overwriting theme.
            return id;
        } )
        .then( function( id ) {
            enketoId = id;
            return instanceModel.set( survey );
        } )
        .then( function() {
            _render( 201, _generateWebformUrls( enketoId, req ), res );
        } )
        .catch( next );
}

function removeInstance( req, res, next ) {

    return instanceModel
        .remove( {
            openRosaServer: req.body.server_url,
            openRosaId: req.body.form_id,
            instanceId: req.body.instance_id
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

function _setQuotaUsed( req, res, next ) {
    surveyModel
        .getNumber( req.account.linkedServer )
        .then( function( number ) {
            req.account.quotaUsed = number;
            next();
        } );
}

function _setIframe( req, res, next ) {
    req.iframe = true;
    next();
}

function _setReturnQueryParam( req, res, next ) {
    var returnUrl = req.body.return_url || req.query.return_url;
    if ( returnUrl && ( req.webformType === 'edit' || req.webformType === 'single' ) ) {
        req.returnQueryParam = 'returnUrl=' + encodeURIComponent( decodeURIComponent( returnUrl ) );
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
    var queryString;
    var obj = {};
    var IFRAMEPATH = 'i/';
    var iframePart = ( req.iframe ) ? IFRAMEPATH : '';
    var protocol = req.headers[ 'x-forwarded-proto' ] || req.protocol;
    var baseUrl = protocol + '://' + req.headers.host + req.app.get( 'base path' ) + '/';
    var idPartOnline = '::' + id;
    var idPartOffline = '#' + id;
    var offline = req.app.get( 'offline enabled' );

    req.webformType = req.webformType || 'default';

    switch ( req.webformType ) {
        case 'preview':
            obj.preview_url = baseUrl + 'preview/' + iframePart + idPartOnline;
            break;
        case 'edit':
            queryString = _generateQueryString( [ 'instance_id=' + req.body.instance_id, req.returnQueryParam ] );
            obj.edit_url = baseUrl + 'edit/' + iframePart + idPartOnline + queryString;
            break;
        case 'all':
            // non-iframe views
            obj.url = ( offline ) ? baseUrl + 'x/' + idPartOffline : baseUrl + idPartOnline;
            obj.preview_url = baseUrl + 'preview/' + idPartOnline;
            // iframe views
            obj.iframe_url = baseUrl + IFRAMEPATH + idPartOnline;
            obj.preview_iframe_url = baseUrl + 'preview/' + IFRAMEPATH + idPartOnline;
            // enketo-legacy
            obj.subdomain = '';
            break;
        default:
            if ( iframePart ) {
                obj.url = ( offline ) ? baseUrl + 'x/' + idPartOffline : baseUrl + iframePart + idPartOnline;
            } else {
                obj.url = ( offline ) ? baseUrl + 'x/' + idPartOffline : baseUrl + idPartOnline;
            }
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
