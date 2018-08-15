const communicator = require( '../lib/communicator' );
const surveyModel = require( '../models/survey-model' );
const userModel = require( '../models/user-model' );
const instanceModel = require( '../models/instance-model' );
const submissionModel = require( '../models/submission-model' );
const utils = require( '../lib/utils' );
const request = require( 'request' );
const express = require( 'express' );
const router = express.Router();
const routerUtils = require( '../lib/router-utils' );
// var debug = require( 'debug' )( 'submission-controller' );

module.exports = app => {
    app.use( `${app.get( 'base path' )}/submission`, router );
};

router.param( 'enketo_id', routerUtils.enketoId );
router.param( 'encrypted_enketo_id_single', routerUtils.encryptedEnketoIdSingle );
router.param( 'encrypted_enketo_id_view', routerUtils.encryptedEnketoIdView );

router
    .all( '*', ( req, res, next ) => {
        res.set( 'Content-Type', 'application/json' );
        next();
    } )
    .get( '/max-size/:enketo_id?', maxSize )
    .get( '/max-size/:encrypted_enketo_id_single', maxSize )
    .get( '/:enketo_id', getInstance )
    .get( '/:encrypted_enketo_id_view', getInstance )
    .post( '/:enketo_id', submit )
    .post( '/:encrypted_enketo_id_single', submit )
    .all( '/*', ( req, res, next ) => {
        const error = new Error( 'Not allowed' );
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
    let submissionUrl;
    const paramName = req.app.get( 'query parameter to pass to submission' );
    const paramValue = req.query[ paramName ];
    const query = paramValue ? `?${paramName}=${paramValue}` : '';
    const instanceId = req.headers[ 'x-openrosa-instance-id' ];
    const deprecatedId = req.headers[ 'x-openrosa-deprecated-id' ];
    const id = req.enketoId;

    surveyModel.get( id )
        .then( survey => {
            submissionUrl = communicator.getSubmissionUrl( survey.openRosaServer ) + query;
            const credentials = userModel.getCredentials( req );
            return communicator.getAuthHeader( submissionUrl, credentials );
        } )
        .then( authHeader => {
            // Note even though headers is part of these options, it does not overwrite the headers set on the client!
            const options = {
                method: 'POST',
                url: submissionUrl,
                headers: authHeader ? {
                    'Authorization': authHeader
                } : {},
                timeout: req.app.get( 'timeout' ) + 500
            };

            // The Date header is actually forbidden to set programmatically, but we do it anyway to comply with OpenRosa
            options.headers[ 'Date' ] = new Date().toUTCString();

            // pipe the request 
            req.pipe( request( options ) )
                .on( 'response', orResponse => {
                    if ( orResponse.statusCode === 201 ) {
                        _logSubmission( id, instanceId, deprecatedId );
                    } else if ( orResponse.statusCode === 401 ) {
                        // replace the www-authenticate header to avoid browser built-in authentication dialog
                        orResponse.headers[ 'WWW-Authenticate' ] = `enketo${orResponse.headers[ 'WWW-Authenticate' ]}`;
                    }
                } )
                .on( 'error', error => {
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
    if ( req.query.xformUrl ) {
        // Non-standard way of attempting to obtain max submission size from XForm url directly
        communicator.getMaxSize( {
                info: {
                    downloadUrl: req.query.xformUrl
                }
            } )
            .then( maxSize => {
                res.json( { maxSize } );
            } )
            .catch( next );
    } else {
        surveyModel.get( req.enketoId )
            .then( survey => {
                survey.credentials = userModel.getCredentials( req );
                return survey;
            } )
            .then( communicator.getMaxSize )
            .then( maxSize => {
                res.json( { maxSize } );
            } )
            .catch( next );
    }
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
    surveyModel.get( req.enketoId )
        .then( survey => {
            survey.instanceId = req.query.instanceId;
            instanceModel.get( survey )
                .then( survey => {
                    // check if found instance actually belongs to the form
                    if ( utils.getOpenRosaKey( survey ) === survey.openRosaKey ) {
                        // Change URLs of instanceAttachments to local URLs
                        Object.keys( survey.instanceAttachments ).forEach( key => survey.instanceAttachments[ key ] = utils.toLocalMediaUrl( survey.instanceAttachments[ key ] ) );

                        res.json( {
                            instance: survey.instance,
                            instanceAttachments: survey.instanceAttachments
                        } );
                    } else {
                        const error = new Error( 'Instance doesn\'t belong to this form' );
                        error.status = 400;
                        throw error;
                    }
                } ).catch( next );
        } )
        .catch( next );
}

function _logSubmission( id, instanceId, deprecatedId ) {
    submissionModel.isNew( id, instanceId )
        .then( notRecorded => {
            if ( notRecorded ) {
                // increment number of submissions
                surveyModel.incrementSubmissions( id );
                // store/log instanceId
                submissionModel.add( id, instanceId, deprecatedId );
            }
        } )
        .catch( error => {
            console.error( error );
        } );
}
