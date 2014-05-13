"use strict";

var express = require( 'express' );
var router = express.Router();

/* GET home page. */
router.get( '/', function( req, res ) {
    res.send( 'api' );
    //res.render('index', {
    //	title: 'Enketo'
    //});
} );

module.exports = router;
