"use strict";

var communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' ),
    inspect = require( 'util' ).inspect,
    Busboy = require( 'busboy' ),
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

function submit( req, res, next ) {
    var xmlData,
        busboy = new Busboy( {
            headers: req.headers
        } ),
        paramName = req.app.get( "query parameter to pass to submission" ),
        paramValue = req.query[ paramName ],
        query = ( paramValue ) ? '?' + paramName + '=' + paramValue : '';

    busboy.on( 'field', function( fieldname, val, fieldnameTruncated, valTruncated ) {
        if ( fieldname === 'xml_submission_data' ) {
            xmlData = val;
        }
    } );
    busboy.on( 'finish', function() {
        return surveyModel.get( req.enketoId )
            .then( function( survey ) {
                var submissionUrl = survey.openRosaServer + '/submission' + query;
                return communicator.submit( submissionUrl, xmlData )
                    .then( function( code ) {
                        if ( code === 201 ) {
                            // asynchronously increment counters, but ignore errors
                            surveyModel.addSubmission( req.enketoId );
                        }
                        res.send( code );
                    } )
                    .catch( next );
            } )
            .catch( next );
    } );
    req.pipe( busboy );
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
