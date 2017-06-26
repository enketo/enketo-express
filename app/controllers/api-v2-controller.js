'use strict';

var surveyModel = require( '../models/survey-model' );
var instanceModel = require( '../models/instance-model' );
var cacheModel = require( '../models/cache-model' );
var account = require( '../models/account-model' );
var auth = require( 'basic-auth' );
var express = require( 'express' );
var utils = require( '../lib/utils' );
var keys = require( '../lib/router-utils' ).idEncryptionKeys;
var router = express.Router();
var quotaErrorMessage = 'Forbidden. No quota left';
// var debug = require( 'debug' )( 'api-controller-v2' );

module.exports = function( app ) {
    app.use( app.get( 'base path' ) + '/api/v2', router );
    // old enketo-legacy URL structure for migration-friendliness
    app.use( app.get( 'base path' ) + '/api_v2', router );
};

router
    .get( '/', function( req, res, next ) {
        res.redirect( 'http://apidocs.enketo.org/v2' );
    } )
    .all( '*', authCheck )
    .all( '*', _setQuotaUsed )
    .all( '*', _setDefaultsQueryParam )
    .all( '/*/iframe', _setIframe )
    .all( '/survey/all', _setIframe )
    .all( '/surveys/list', _setIframe )
    .all( '/survey/preview*', function( req, res, next ) {
        req.webformType = 'preview';
        next();
    } )
    .all( '/survey/all', function( req, res, next ) {
        req.webformType = 'all';
        next();
    } )
    .all( '/surveys/list', function( req, res, next ) {
        req.webformType = 'all';
        next();
    } )
    .all( '/instance*', function( req, res, next ) {
        req.webformType = 'edit';
        next();
    } )
    .all( '/survey/single*', function( req, res, next ) {
        req.webformType = 'single';
        next();
    } )
    .all( '/survey/single/once*', function( req, res, next ) {
        req.multipleAllowed = false;
        next();
    } )
    .all( '/survey/view*', function( req, res, next ) {
        req.webformType = 'view';
        next();
    } )
    .all( '/instance/view*', function( req, res, next ) {
        req.webformType = 'view-instance';
        next();
    } )
    .all( '/survey/offline*', function( req, res, next ) {
        var error;
        if ( req.app.get( 'offline enabled' ) ) {
            req.webformType = 'offline';
            next();
        } else {
            error = new Error( 'Not Allowed.' );
            error.status = 405;
            next( error );
        }
    } )
    .all( '*', _setReturnQueryParam )
    .all( '*', _setGoToHash )
    .get( '/survey', getExistingSurvey )
    .get( '/survey/offline', getExistingSurvey )
    .get( '/survey/iframe', getExistingSurvey )
    .post( '/survey', getNewOrExistingSurvey )
    .post( '/survey/offline', getNewOrExistingSurvey )
    .post( '/survey/iframe', getNewOrExistingSurvey )
    .delete( '/survey', deactivateSurvey )
    .delete( '/survey/cache', emptySurveyCache )
    .get( '/survey/single', getExistingSurvey )
    .get( '/survey/single/iframe', getExistingSurvey )
    .get( '/survey/single/once', getExistingSurvey )
    .get( '/survey/single/once/iframe', getExistingSurvey )
    .post( '/survey/single', getNewOrExistingSurvey )
    .post( '/survey/single/iframe', getNewOrExistingSurvey )
    .post( '/survey/single/once', getNewOrExistingSurvey )
    .post( '/survey/single/once/iframe', getNewOrExistingSurvey )
    .get( '/survey/preview', getExistingSurvey )
    .get( '/survey/preview/iframe', getExistingSurvey )
    .post( '/survey/preview', getNewOrExistingSurvey )
    .post( '/survey/preview/iframe', getNewOrExistingSurvey )
    .get( '/survey/view', getExistingSurvey )
    .get( '/survey/view/iframe', getExistingSurvey )
    .post( '/survey/view', getNewOrExistingSurvey )
    .post( '/survey/view/iframe', getNewOrExistingSurvey )
    .get( '/survey/all', getExistingSurvey )
    .post( '/survey/all', getNewOrExistingSurvey )
    .get( '/surveys/number', getNumber )
    .post( '/surveys/number', getNumber )
    .get( '/surveys/list', getList )
    .post( '/surveys/list', getList )
    .post( '/instance', cacheInstance )
    .post( '/instance/iframe', cacheInstance )
    .post( '/instance/view', cacheInstance )
    .post( '/instance/view/iframe', cacheInstance )
    .delete( '/instance', removeInstance )
    .all( '*', function( req, res, next ) {
        var error = new Error( 'Not allowed.' );
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
                _render( 404, 'Survey not found.', res );
            }
        } )
        .catch( next );
}

function getNewOrExistingSurvey( req, res, next ) {
    var status;
    var survey = {
        openRosaServer: req.body.server_url || req.query.server_url,
        openRosaId: req.body.form_id || req.query.form_id,
        theme: req.body.theme || req.query.theme
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
                        _render( 404, 'Survey not found.', res );
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
                _render( 404, 'Survey not found.', res );
            }
        } )
        .catch( next );
}

function emptySurveyCache( req, res, next ) {

    return cacheModel
        .flush( {
            openRosaServer: req.body.server_url,
            openRosaId: req.body.form_id
        } )
        .then( function( survey ) {
            _render( 204, null, res );
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
                _render( 404, 'No surveys found.', res );
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
        returnUrl: req.body.return_url,
        instanceAttachments: req.body.instance_attachments
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
                _render( 404, 'Record not found.', res );
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
        } )
        .catch( next );
}

function _setDefaultsQueryParam( req, res, next ) {
    var queryParam = '';
    var map = req.body.defaults || req.query.defaults;

    if ( map ) {
        for ( var prop in map ) {
            if ( map.hasOwnProperty( prop ) ) {
                queryParam += 'd[' + encodeURIComponent( decodeURIComponent( prop ) ) + ']' + '=' +
                    encodeURIComponent( decodeURIComponent( map[ prop ] ) ) + '&';
            }
        }
        req.defaultsQueryParam = queryParam.substring( 0, queryParam.length - 1 );
    }

    next();
}

function _setGoToHash( req, res, next ) {
    var goTo = req.body.go_to || req.query.go_to;
    req.goTo = ( goTo ) ? '#' + goTo : '';

    next();
}

function _setIframe( req, res, next ) {
    var parentWindowOrigin = req.body.parent_window_origin || req.query.parent_window_origin;

    req.iframe = true;
    if ( parentWindowOrigin ) {
        req.parentWindowOriginParam = 'parentWindowOrigin=' + encodeURIComponent( decodeURIComponent( parentWindowOrigin ) );
    }
    next();
}

function _setReturnQueryParam( req, res, next ) {
    var returnUrl = req.body.return_url || req.query.return_url;

    if ( returnUrl ) {
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
    var OFFLINEPATH = 'x/';
    var hash = req.goTo;
    var iframePart = ( req.iframe ) ? IFRAMEPATH : '';
    var protocol = req.headers[ 'x-forwarded-proto' ] || req.protocol;
    var baseUrl = protocol + '://' + req.headers.host + req.app.get( 'base path' ) + '/';
    var idPartOnline = '::' + id;
    var idPartOffline = '#' + id;
    var idPartOnce = '::' + utils.insecureAes192Encrypt( id, keys.singleOnce );
    var idPartView = '::' + utils.insecureAes192Encrypt( id, keys.view );
    var queryParts;

    req.webformType = req.webformType || 'default';

    switch ( req.webformType ) {
        case 'preview':
            queryString = _generateQueryString( [ req.defaultsQueryParam, req.parentWindowOriginParam ] );
            obj.preview_url = baseUrl + 'preview/' + iframePart + idPartOnline + queryString + hash;
            break;
        case 'edit':
            // no defaults query parameter in edit view
            queryString = _generateQueryString( [ 'instance_id=' + req.body.instance_id, req.parentWindowOriginParam, req.returnQueryParam ] );
            obj.edit_url = baseUrl + 'edit/' + iframePart + idPartOnline + queryString + hash;
            break;
        case 'single':
            queryParts = [ req.defaultsQueryParam, req.returnQueryParam ];
            if ( iframePart ) {
                queryParts.push( req.parentWindowOriginParam );
            }
            queryString = _generateQueryString( queryParts );
            obj[ 'single' + ( req.multipleAllowed === false ? '_once' : '' ) + ( iframePart ? '_iframe' : '' ) + '_url' ] = baseUrl +
                'single/' + iframePart + ( req.multipleAllowed === false ? idPartOnce : idPartOnline ) + queryString;
            break;
        case 'view':
        case 'view-instance':
            queryParts = [];
            if ( req.webformType === 'view-instance' ) {
                queryParts.push( 'instance_id=' + req.body.instance_id );
            }
            if ( iframePart ) {
                queryParts.push( req.parentWindowOriginParam );
            }
            queryParts.push( req.returnQueryParam );
            queryString = _generateQueryString( queryParts );
            obj[ 'view' + ( iframePart ? '_iframe' : '' ) + '_url' ] = baseUrl + 'view/' + iframePart + idPartView + queryString + hash;
            break;
        case 'all':
            // non-iframe views
            queryString = _generateQueryString( [ req.defaultsQueryParam ] );
            obj.url = baseUrl + idPartOnline + queryString;
            obj.single_url = baseUrl + 'single/' + idPartOnline + queryString;
            obj.single_once_url = baseUrl + 'single/' + idPartOnce + queryString;
            obj.offline_url = baseUrl + OFFLINEPATH + idPartOffline;
            obj.preview_url = baseUrl + 'preview/' + idPartOnline + queryString;
            // iframe views
            queryString = _generateQueryString( [ req.defaultsQueryParam, req.parentWindowOriginParam ] );
            obj.iframe_url = baseUrl + IFRAMEPATH + idPartOnline + queryString;
            obj.single_iframe_url = baseUrl + 'single/' + IFRAMEPATH + idPartOnline + queryString;
            obj.single_once_iframe_url = baseUrl + 'single/' + IFRAMEPATH + idPartOnce + queryString;
            obj.preview_iframe_url = baseUrl + 'preview/' + IFRAMEPATH + idPartOnline + queryString;
            // rest
            obj.enketo_id = id;
            break;
        case 'offline':
            obj.offline_url = baseUrl + OFFLINEPATH + idPartOffline;
            break;
        default:
            queryString = _generateQueryString( [ req.defaultsQueryParam, req.parentWindowOriginParam ] );
            if ( iframePart ) {
                obj.iframe_url = baseUrl + iframePart + idPartOnline + queryString;
            } else {
                obj.url = baseUrl + idPartOnline + queryString;
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
