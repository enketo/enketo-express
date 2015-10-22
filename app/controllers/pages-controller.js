'use strict';

var express = require( 'express' );
var router = express.Router();
// var debug = require( 'debug' )( 'pages-controller' );

module.exports = function( app ) {
    app.use( '/', router );
};

router
    .get( '/', function( req, res ) {
        res.render( 'index', {
            openrosa: req.app.get( 'linked form and data server' ).name || '?',
            languages: req.app.get( 'languages supported' )
        } );
    } )
    .get( '/modern-browsers', function( req, res ) {
        res.render( 'pages/modern-browsers', {
            title: 'Modern Browsers'
        } );
    } )
    .get( '/offline', function( req, res ) {
        res.render( 'pages/offline', {
            title: 'Offline'
        } );
    } );
