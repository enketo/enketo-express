"use strict";

var express = require( 'express' );
var router = express.Router();

router
    .get( '/page', function( req, res ) {
        res.send( 'a page' );
    } )
    .get( '/modern-browsers', function( req, res ) {
        res.render( 'pages/modern-browsers', {} );
    } );

module.exports = router;
