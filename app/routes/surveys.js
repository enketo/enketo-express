"use strict";

var express = require( 'express' );
var debug = require( 'debug' )( 'surveys-router' );
var router = express.Router();
var survey = require( '../controllers/survey-controller' );
var submission = require( '../controllers/submission-controller' );

router.param( 'enketo_id', function( req, res, next, id ) {
    if ( /^::[A-z0-9]{4,8}$/.test( id ) ) {
        req.enketoId = id.substring( 2 );
        next();
    } else {
        next( 'route' );
    }
} );

router
    .get( '/:enketo_id', survey.webform )
    .get( '/preview/:enketo_id', survey.preview )
    .get( '/preview', survey.previewFromQuery )
    .get( '/edit/:enketo_id', survey.edit )
    .get( '/xform/:enketo_id', survey.xform )
    .get( '/max-size/:enketo_id', submission.maxSize )
    .post( '/submission/:enketo_id', submission.submit )
    .all( '/submission/*', function( req, res, next ) {
        var error = new Error( 'Not allowed' );
        error.status = 405;
        next( error );
    } )
    .get( '/connection', function( req, res, next ) {
        res.status = 200;
        res.send( 'connected ' + Math.random() );
    } );

module.exports = router;
