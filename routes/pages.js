"use strict";

var express = require( 'express' );
var router = express.Router();

router.get( '/page', function( req, res ) {
    res.send( 'a page' );
} );

module.exports = router;
