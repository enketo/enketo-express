"use strict";

var express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'pages-controller' );

module.exports = function( app ) {
    app.use( '/', router );
};

router
    .get( '/', function( req, res ) {
        res.render( 'index', {
            title: req.app.get( 'app name' ) || 'Enketo Smart Paper',
            openrosa: req.app.get( 'linked form and data server' ).name || '?'
        } );
    } )
    .get( '/modern-browsers', function( req, res ) {
        res.render( 'pages/modern-browsers', {} );
    } );
