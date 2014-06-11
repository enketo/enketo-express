"use strict";

var transformer = require( '../lib/transformer' );
var communicator = require( '../lib/communicator' );
var surveyModel = require( '../models/survey-model' )();
var instanceModel = require( '../models/instance-model' )();
var debug = require( 'debug' )( 'api-controller' );

function _getExistingSurvey( req, res, next ) {
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

function _getNewOrExistingSurvey( req, res, next ) {
    var error, body, status,
        survey = {
            openRosaServer: req.param( 'server_url' ),
            openRosaId: req.param( 'form_id' )
        };

    return surveyModel
        .getId( survey ) // will return id only for existing && active surveys
        .then( function( id ) {
            debug( 'id: ' + id );
            if ( id ) {
                debug( 'found id present and active' );
                _render( 200, _generateWebformUrls( id, req ), res );
            } else {
                return surveyModel.set( survey )
                    .then( function( id ) {
                        if ( id ) {
                            _render( 201, _generateWebformUrls( id, req ), res );
                        } else {
                            _render( 404, 'Survey not found', res );
                        }
                    } );
            }
        } )
        .catch( next );
}

function _deactivateSurvey( req, res, next ) {
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


function _getNumber( req, res, next ) {
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

function _getList( req, res, next ) {
    _render( 500, 'This API point is not implemented yet', res );
}

function _cacheInstance( req, res, next ) {
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

function _removeInstance( req, res, next ) {
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
        idPart = '[' + id + ']',
        iframeUrlPart = ( req.iframe ) ? '?iframe=true' : '';

    req.webformType = req.webformType || 'default';

    switch ( req.webformType ) {
        case 'preview':
            obj.preview_url = baseUrl + 'preview/' + idPart + iframeUrlPart;
            break;
        case 'edit':
            iframeUrlPart = ( req.iframe ) ? '&iframe=true' : '';
            obj.edit_url = baseUrl + 'edit/' + idPart + '?instance=' + req.param( 'instance_id' ) + iframeUrlPart;
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

module.exports = {
    survey: {
        get: _getExistingSurvey,
        post: _getNewOrExistingSurvey,
        delete: _deactivateSurvey,
    },
    surveys: {
        number: {
            get: _getNumber,
            post: _getNumber
        },
        list: {
            get: _getList,
            post: _getList
        }
    },
    instance: {
        post: _cacheInstance,
        delete: _removeInstance
    }
};
