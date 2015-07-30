"use strict";

var config = require( '../models/config-model' ),
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'config-controller' );

module.exports = function( app ) {
    app.use( '/client-config.json', router );
};

router
    .get( '/', function( req, res, next ) {
        res.json( config.client );
    } );
