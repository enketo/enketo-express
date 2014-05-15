"use strict";

var express = require( 'express' );
var debug = require( 'debug' )( 'surveys-router' );
var router = express.Router();
var form = require( '../controllers/survey-controller' );

router.param( 'enketo_id', function( req, res, next, id ) {
    if ( /^\[[A-z0-9]{4}\]$/.test( id ) ) {
        req.enketoId = id.substring( 1, id.length - 1 );
        next();
    } else {
        next( 'route' );
    }
} );

router
    .get( '/:enketo_id', form.webform )
    .get( '/preview/:enketo_id', form.webform )
    .get( '/edit/:enketo_id', form.webform )
    .get( '/max-size/:enketo_id', form.maxSize );

module.exports = router;
