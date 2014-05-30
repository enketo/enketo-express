"use strict";

var express = require( 'express' );
var debug = require( 'debug' )( 'surveys-router' );
var router = express.Router();
var form = require( '../controllers/survey-controller' );

router.param( 'enketo_id', function( req, res, next, id ) {
    if ( /^\[[A-z0-9]{4,8}\]$/.test( id ) ) {
        req.enketoId = id.substring( 1, id.length - 1 );
        next();
    } else {
        next( 'route' );
    }
} );

router
    .get( '/:enketo_id', form.webform )
    .get( '/preview/:enketo_id', form.preview )
    .get( '/preview', form.previewFromQuery )
    .get( '/edit/:enketo_id', form.edit )
    .get( '/max-size', form.maxSize )
    .get( '/data/max_size/:enketo_id', form.maxSize ); // for backwards compatibility

module.exports = router;
