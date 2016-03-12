'use strict';

var express = require( 'express' );
var router = express.Router();

module.exports = function( app ) {
    app.use( app.get( 'base path' ) + '/api', router );
};

router
    .get( '/', function( req, res ) {
        res.redirect( 'http://apidocs.enketo.org' );
    } );
