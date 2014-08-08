"use strict";

var express = require( 'express' ),
    path = require( 'path' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),

    index = require( '../app/routes/index' ),
    surveys = require( '../app/routes/surveys' ),
    api = require( '../app/routes/api' ),
    pages = require( '../app/routes/pages' ),
    media = require( '../app/routes/media' ),
    favicon = require( 'serve-favicon' ),

    config = require( './config' ),
    logger = require( 'morgan' ),
    errorHandler = require( '../app/controllers/error-handler' ),
    debug = require( 'debug' )( 'express' ),

    app = express();

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
app.use( bodyParser.urlencoded() );
app.use( favicon( path.resolve( __dirname, '../public/images/favicon.ico' ) ) );
app.use( express.static( path.resolve( __dirname, '../public' ) ) );

// set variables that should be accessible in all view templates
app.use( function( req, res, next ) {
    res.locals.livereload = req.app.get( 'env' ) === 'development';
    res.locals.environment = req.app.get( 'env' );
    res.locals.tracking = req.app.get( 'google' ).analytics.ua ? req.app.get( 'google' ).analytics.ua : false;
    res.locals.trackingDomain = req.app.get( 'google' ).analytics.domain;
    next();
} );

// routing
app.use( '/', index );
app.use( '/', pages );
app.use( '/', surveys );
app.use( '/api/v1', api );
app.use( '/media', media );

// logging
app.use( logger( {
    format: ( app.get( 'env' ) === 'development' ? 'dev' : 'tiny' )
} ) );

// error handlers
app.use( errorHandler[ "404" ] );
if ( app.get( 'env' ) === 'development' ) {
    app.use( errorHandler.development );
}
app.use( errorHandler.production );

module.exports = app;
