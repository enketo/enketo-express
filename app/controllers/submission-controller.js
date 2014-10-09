"use strict";

var communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' ),
    instanceModel = require( '../models/instance-model' ),
    utils = require( '../lib/utils' ),
    request = require( 'request' ),
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'submission-controller' );

module.exports = function( app ) {
    app.use( '/submission', router );
};

// duplicate in survey-controller
router.param( 'enketo_id', function( req, res, next, id ) {
    if ( /^::[A-z0-9]{4,8}$/.test( id ) ) {
        req.enketoId = id.substring( 2 );
        next();
    } else {
        next( 'route' );
    }
} );

router
    .all( '*', function( req, res, next ) {
        res.set( 'Content-Type', 'application/json' );
        next();
    } )
    .get( '/max-size/:enketo_id', maxSize )
    .get( '/:enketo_id', getInstance )
    .post( '/:enketo_id', submit )
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
    var paramName = req.app.get( "query parameter to pass to submission" ),
        paramValue = req.query[ paramName ],
        query = ( paramValue ) ? '?' + paramName + '=' + paramValue : '';

    surveyModel.get( req.enketoId )
        .then( function( survey ) {
            var submissionUrl = survey.openRosaServer + '/submission' + query,
                submissionRequest = request( submissionUrl );

            // pipe the request
            req.pipe( submissionRequest ).pipe( res );

            // The hack below is to workaround an issue in the (KoBo) VM where the response never closes (until it times out). 
            // For some reason the response body is never piped under certain (fast | race) conditions. 
            var raceConditionHack = function() {
                setTimeout( function() {
                    // if the headers have been sent (not an exact check)
                    if ( res.headersSent ) {
                        // the check below seems to always be true
                        if ( req.socket && !req.socket.destroyed ) {
                            debug( 'manually closing socket in case it is still open' );
                            req.socket.destroy();
                        }
                    } else {
                        raceConditionHack();
                    }
                }, 1000 );
            };
            raceConditionHack();

        } )
        .catch( next );
}

function maxSize( req, res, next ) {
    surveyModel.get( req.enketoId )
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
                    debug( 'survey', survey );
                    debug( 'calc key', utils.getOpenRosaKey( survey ) );
                    // check if found instance actually belongs to the form
                    if ( utils.getOpenRosaKey( survey ) === survey.openRosaKey ) {
                        res.json( {
                            instance: survey.instance
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
