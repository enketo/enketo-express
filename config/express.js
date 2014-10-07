"use strict";

var express = require( 'express' ),
    path = require( 'path' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    favicon = require( 'serve-favicon' ),
    config = require( './config' ),
    logger = require( 'morgan' ),
    errorHandler = require( '../app/controllers/error-handler' ),
    controllersPath = path.join( __dirname, '../app/controllers' ),
    app = express(),
    debug = require( 'debug' )( 'express' );

// general 
for ( var item in config ) {
    app.set( item, app.get( item ) || config[ item ] );
}
app.set( 'port', process.env.PORT || app.get( "port" ) || 3000 );
app.set( 'env', process.env.NODE_ENV || 'production' );

// views
app.set( 'views', path.resolve( __dirname, '../app/views' ) );
app.set( 'view engine', 'jade' );

// pretty json API responses
app.set( 'json spaces', 4 );

// middleware
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( {
    extended: false
} ) );
app.use( favicon( path.resolve( __dirname, '../public/images/favicon.ico' ) ) );
app.use( express.static( path.resolve( __dirname, '../public' ) ) );

// set variables that should be accessible in all view templates
app.use( function( req, res, next ) {
    res.locals.livereload = req.app.get( 'env' ) === 'development';
    res.locals.environment = req.app.get( 'env' );
    res.locals.tracking = req.app.get( 'google' ).analytics.ua ? req.app.get( 'google' ).analytics.ua : false;
    res.locals.trackingDomain = req.app.get( 'google' ).analytics.domain;
    res.locals.logo = req.app.get( 'logo source' );
    next();
} );

// load controllers (including routers)
fs.readdirSync( controllersPath ).forEach( function( file ) {
    if ( file.indexOf( '-controller.js' ) >= 0 ) {
        debug( 'loading', file );
        require( controllersPath + '/' + file )( app );
    }
} );

// logging
app.use( logger( ( app.get( 'env' ) === 'development' ? 'dev' : 'tiny' ) ) );

// error handlers
app.use( errorHandler[ "404" ] );
if ( app.get( 'env' ) === 'development' ) {
    app.use( errorHandler.development );
}
app.use( errorHandler.production );

module.exports = app;
