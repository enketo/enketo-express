var express = require( 'express' );
var path = require( 'path' );
var bodyParser = require( 'body-parser' );

var index = require( './routes/index' );
var surveys = require( './routes/surveys' );
var api = require( './routes/api_v1' );
var pages = require( './routes/pages' );
var config = require( './config' );
var logger = require( 'morgan' );

var app = express();

// general 
for ( var item in config ) {
    app.set( item, app.get( item ) || config[ item ] );
}
app.set( 'port', process.env.PORT || app.get( "port" ) || 3000 );
app.set( 'env', process.env.NODE_ENV || 'production' );

// views
app.set( 'views', path.join( __dirname, 'views' ) );
app.set( 'view engine', 'jade' );

// middleware
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded() );
app.use( express.static( path.join( __dirname, 'public' ) ) );

// set livereload variable before routing, 
// so it is accessible in all view templates
app.use( function( req, res, next ) {
    res.locals.livereload = req.app.get( 'env' ) === 'development';
    next();
} );

// routing
app.use( '/', index );
app.use( '/', pages );
app.use( '/', surveys );
app.use( '/api_v1', api );

// catch 404 and forwarding to error handler
app.use( function( req, res, next ) {
    var err = new Error( 'Not Found' );
    err.status = 404;
    next( err );
} );

// logging
app.use( logger( {
    format: ( app.get( 'env' ) === 'development' ? 'dev' : 'tiny' )
} ) );

// development error handler
// will print stacktrace
if ( app.get( 'env' ) === 'development' ) {
    app.use( function( err, req, res, next ) {
        res.status( err.status || 500 );
        res.render( 'error', {
            message: err.message,
            error: err
        } );
    } );
}

// production error handler
// no stacktraces leaked to user
app.use( function( err, req, res, next ) {
    res.status( err.status || 500 );
    res.render( 'error', {
        message: err.message,
        error: {}
    } );
} );

module.exports = app;
