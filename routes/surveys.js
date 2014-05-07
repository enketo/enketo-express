var express = require( 'express' );
var router = express.Router();

router.param( 'enketo_id', function( req, res, next, id ) {
    if ( /^\[[A-z0-9]{4}\]$/.test( id ) ) {
        req.survey = {
            enketo_id: id.substring( 1, id.length - 1 ),
            openrosa_server: 'https://ona.io/enketo',
            openrosa_id: 'widgets'
        };
        next();
    } else {
        next( 'route' );
    }
} );

router
    .get( '/:enketo_id', function( req, res ) {
        res.send( 'default webform view for id: ' + req.survey.enketo_id );
    } )
    .get( '/:enketo_id/preview', function( req, res ) {
        res.send( 'preview webform view for hosted form with id: ' + req.survey.enketo_id );
    } )
    .get( '/:enketo_id/edit', function( req, res ) {
        res.send( 'edit webform view for hosted form with id: ' + req.survey.enketo_id );
    } );

module.exports = router;
