"use strict";

var express = require( 'express' ),
    path = require( 'path' ),
    bodyParser = require( 'body-parser' ),

    index = require( './routes/index' ),
    surveys = require( './routes/surveys' ),
    api = require( './routes/api' ),
    pages = require( './routes/pages' ),
    media = require( './routes/media' ),

    config = require( './config' ),
    logger = require( 'morgan' ),
    errorHandler = require( './controllers/error-handler' ),

    app = express();

// general 
for ( var item in config ) {
    app.set( item, app.get( item ) || config[ item ] );
}
app.set( 'port', process.env.PORT || app.get( "port" ) || 3000 );
app.set( 'env', process.env.NODE_ENV || 'production' );

// views
app.set( 'views', path.join( __dirname, 'views' ) );
app.set( 'view engine', 'jade' );

// pretty json API responses
app.set( 'json spaces', 4 );

// middleware
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded() );
app.use( express.static( path.join( __dirname, 'public' ) ) );

// set variables that should be accessible in all view templates
app.use( function( req, res, next ) {
    res.locals.livereload = req.app.get( 'env' ) === 'development';
    res.locals.environment = req.app.get( 'env' );
    res.locals.tracking = req.app.get( 'google analytics ua' ) ? req.app.get( 'google analytics ua' ) : false;
    res.locals.trackingDomain = req.app.get( 'google analytics domain' );
    res.locals.supportEmail = req.app.get( 'support email' );
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
