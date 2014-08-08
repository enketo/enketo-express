"use strict";

var express = require( 'express' ),
    router = express.Router(),
    media = require( '../controllers/media-controller' ),
    debug = require( 'debug' )( 'media-router' );

router
    .get( '/get/*', media.get );

module.exports = router;
