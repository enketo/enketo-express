"use strict";

var express = require( 'express' ),
    router = express.Router();

router.get( '/', function( req, res ) {
    res.render( 'index', {
        title: req.app.get( 'app name' ) || 'Enketo Smart Paper',
        openrosa: req.app.get( 'linked form and data server' ).name || '?'
    } );
} );

module.exports = router;
