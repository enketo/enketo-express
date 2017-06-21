'use strict';

var communicator = require( '../lib/communicator' );
var surveyModel = require( '../models/survey-model' );
var userModel = require( '../models/user-model' );
var instanceModel = require( '../models/instance-model' );
var submissionModel = require( '../models/submission-model' );
var utils = require( '../lib/utils' );
var request = require( 'request' );
var express = require( 'express' );
var router = express.Router();
var routerUtils = require( '../lib/router-utils' );
// var debug = require( 'debug' )( 'submission-controller' );

module.exports = function( app ) {
    app.use( app.get( 'base path' ) + '/submission', router );
};

router.param( 'enketo_id', routerUtils.enketoId );
router.param( 'encrypted_enketo_id_single', routerUtils.encryptedEnketoIdSingle );
router.param( 'encrypted_enketo_id_view', routerUtils.encryptedEnketoIdView );

router
    .all( '*', function( req, res, next ) {
        res.set( 'Content-Type', 'application/json' );
        next();
    } )
    .get( '/max-size/:enketo_id', maxSize )
    .get( '/max-size/:encrypted_enketo_id_single', maxSize )
    .get( '/:enketo_id', getInstance )
    .get( '/:encrypted_enketo_id_view', getInstance )
    .post( '/:enketo_id', submit )
    .post( '/:encrypted_enketo_id_single', submit )
    .all( '/*', function( req, res, next ) {
        var error = new Error( 'Not allowed' );
        error.status = 405;
        next( error );
    } );

/** 
 * Simply pipes well-formed request to the OpenRosa server and
 * copies the response received.
 *
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function submit( req, res, next ) {
    var submissionUrl;
    var credentials;
    var options;
    var paramName = req.app.get( 'query parameter to pass to submission' );
    var paramValue = req.query[ paramName ];
    var query = ( paramValue ) ? '?' + paramName + '=' + paramValue : '';
    var instanceId = req.headers[ 'x-openrosa-instance-id' ];
    var deprecatedId = req.headers[ 'x-openrosa-deprecated-id' ];
    var id = req.enketoId;

    surveyModel.get( id )
        .then( function( survey ) {
            submissionUrl = communicator.getSubmissionUrl( survey.openRosaServer ) + query;
            credentials = userModel.getCredentials( req );

            // first check if authentication is required and if so get the Basic or Digest Authorization header
            return communicator.getAuthHeader( submissionUrl, credentials );
        } )
        .then( function( authHeader ) {
            options = {
                method: 'POST',
                url: submissionUrl,
                headers: authHeader ? {
                    'Authorization': authHeader
                } : {},
                timeout: req.app.get( 'timeout' ) + 500
            };
            // pipe the request 
            req.pipe( request( options ) )
                .on( 'response', function( orResponse ) {
                    if ( orResponse.statusCode === 201 ) {
                        _logSubmission( id, instanceId, deprecatedId );
                    } else if ( orResponse.statusCode === 401 ) {
                        // replace the www-authenticate header to avoid browser built-in authentication dialog
                        orResponse.headers[ 'WWW-Authenticate' ] = 'enketo' + orResponse.headers[ 'WWW-Authenticate' ];
                    }
                } )
                .on( 'error', function( error ) {
                    if ( error && ( error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' ) ) {
                        if ( error.connect === true ) {
                            error.status = 504;
                        } else {
                            error.status = 408;
                        }
                    }

                    next( error );
                } )
                .pipe( res );

        } )
        .catch( next );
}

function maxSize( req, res, next ) {
    surveyModel.get( req.enketoId )
        .then( function( survey ) {
            survey.credentials = userModel.getCredentials( req );
            return survey;
        } )
        .then( communicator.getMaxSize )
        .then( function( maxSize ) {
            res.json( {
                maxSize: maxSize
            } );
        } )
        .catch( next );
}

/**
 * Obtains cached instance (for editing)
 *
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function getInstance( req, res, next ) {
    var error;

    surveyModel.get( req.enketoId )
        .then( function( survey ) {
            survey.instanceId = req.query.instanceId;
            instanceModel.get( survey )
                .then( function( survey ) {
                    // check if found instance actually belongs to the form
                    if ( utils.getOpenRosaKey( survey ) === survey.openRosaKey ) {
                        res.json( {
                            instance: survey.instance,
                            instanceAttachments: survey.instanceAttachments
                        } );
                    } else {
                        error = new Error( 'Instance doesn\'t belong to this form' );
                        error.status = 400;
                        throw error;
                    }
                } ).catch( next );
        } )
        .catch( next );
}

function _logSubmission( id, instanceId, deprecatedId ) {
    submissionModel.isNew( id, instanceId )
        .then( function( notRecorded ) {
            if ( notRecorded ) {
                // increment number of submissions
                surveyModel.incrementSubmissions( id );
                // store/log instanceId
                submissionModel.add( id, instanceId, deprecatedId );
            }
        } )
        .catch( function( error ) {
            console.error( error );
        } );
}
