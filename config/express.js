"use strict";

var themesSupported = [],
    languagesSupported = [],
    express = require( 'express' ),
    path = require( 'path' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    favicon = require( 'serve-favicon' ),
    config = require( './config' ),
    logger = require( 'morgan' ),
    i18n = require( 'i18next' ),
    compression = require( 'compression' ),
    errorHandler = require( '../app/controllers/error-handler' ),
    controllersPath = path.join( __dirname, '../app/controllers' ),
    themePath = path.join( __dirname, '../public/css' ),
    languagePath = path.join( __dirname, '../locales' ),
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

// detect supported themes
if ( fs.existsSync( themePath ) ) {
    fs.readdirSync( themePath ).forEach( function( file ) {
        var matches = file.match( /^theme-([A-z]+)\.css$/ );
        if ( matches && matches.length > 1 ) {
            themesSupported.push( matches[ 1 ] );
        }
    } );
}
app.set( 'themes supported', themesSupported );

// detect supported languages
languagesSupported = fs.readdirSync( languagePath ).filter( function( file ) {
    return fs.statSync( path.join( languagePath, file ) ).isDirectory();
} );
app.set( 'languages supported', languagesSupported );

// setup i18next
i18n.init( {
    // don't bother with these routes
    ignoreRoutes: [ 'css/', 'fonts/', 'images/', 'js/', 'lib/' ],
    // only attemp to translate the supported languages
    supportedLngs: app.get( 'languages supported' ),
    // allow query string lang override
    detectLngQS: 'lang',
    // fallback language
    fallbackLng: 'en',
    // don't use cookies, always detect 
    useCookie: false
} );
// make i18n apphelper available in jade templates
i18n.registerAppHelper( app );

// middleware
app.use( compression() );
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( {
    extended: true
} ) );
app.use( i18n.handle );
app.use( favicon( path.resolve( __dirname, '../public/images/favicon.ico' ) ) );
app.use( express.static( path.resolve( __dirname, '../public' ) ) );
app.use( '/locales', express.static( path.resolve( __dirname, '../locales' ) ) );

// set variables that should be accessible in all view templates
app.use( function( req, res, next ) {
    res.locals.livereload = req.app.get( 'env' ) === 'development';
    res.locals.environment = req.app.get( 'env' );
    res.locals.tracking = req.app.get( 'google' ).analytics.ua ? req.app.get( 'google' ).analytics.ua : false;
    res.locals.trackingDomain = req.app.get( 'google' ).analytics.domain;
    res.locals.logo = req.app.get( 'logo' );
    res.locals.defaultTheme = req.app.get( 'default theme' ).replace( 'theme-', '' ) || 'kobo';
    res.locals.title = req.app.get( 'app name' );
    res.locals.offline = req.app.get( 'offline enabled' ); // temporary to show 'Experimental' warning
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
