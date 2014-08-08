"use strict";

var express = require( 'express' );
var router = express.Router();

router.get( '/', function( req, res ) {
    res.render( 'index', {
        title: req.app.get( 'app name' ),
        openrosa: req.app.get( 'openrosa server name' )
    } );
} );

module.exports = router;
