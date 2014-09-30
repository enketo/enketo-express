"use strict";

var communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' ),
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
    .get( '/max-size/:enketo_id', maxSize )
    .post( '/:enketo_id', submit )
    .all( '/*', function( req, res, next ) {
        var error = new Error( 'Not allowed' );
        error.status = 405;
        next( error );
    } );

/** 
 * Simply pipes well-formed request to the OpenRosa server and
 * pipes back the response received.
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
            var data = '',
                submissionUrl = survey.openRosaServer + '/submission' + query;

            req.pipe( request( submissionUrl ) )
                .on( 'data', function( chunk ) {
                    data += chunk;
                } )
                .on( 'end', function() {
                    res.send( data );
                } )
                .pipe( res );

            // The much simpler: req.pipe( request( submissionUrl ) ).pipe( res ) without 'data' and 'end' 
            // event handlers causes a problem in the (KoBo) VM as the response never closes (until it times out). 
            // For some reason the response body is never piped under certain conditions. 
        } )
        .catch( next );
}

function maxSize( req, res, next ) {
    return surveyModel.get( req.enketoId )
        .then( communicator.getMaxSize )
        .then( function( maxSize ) {
            res.json( {
                maxSize: maxSize
            } );
        } )
        .catch( next );
}
