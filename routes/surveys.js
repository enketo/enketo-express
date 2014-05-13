var express = require( 'express' );
var debug = require( 'debug' )( 'surveys-router' );
var router = express.Router();
var form = require( '../controllers/form' );

router.param( 'enketo_id', function( req, res, next, id ) {
    if ( /^\[[A-z0-9]{4}\]$/.test( id ) ) {

        form.get()
            .then( function( transformationResult ) {
                req.survey = {
                    enketo_id: id.substring( 1, id.length - 1 ),
                    openrosa_server: 'https://ona.io/enketo',
                    openrosa_id: 'widgets',
                    title: 'my form title',
                    form: transformationResult.form,
                    instance: transformationResult.instance
                };
                next();
            } )
            .fail( function( error ) {
                next( error );
            } );
    } else {
        next( 'route' );
    }
} );

router
    .get( '/:enketo_id', function( req, res ) {
        res.render( 'surveys/webform', req.survey );
    } )
    .get( '/preview/:enketo_id', function( req, res ) {
        res.render( 'surveys/webform', req.survey );
    } )
    .get( '/edit/:enketo_id', function( req, res ) {
        res.render( 'surveys/webform', req.survey );
    } );

module.exports = router;
