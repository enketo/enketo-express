'use strict';

var express = require( 'express' );
var path = require( 'path' );
var bodyParser = require( 'body-parser' );
var cookieParser = require( 'cookie-parser' );
var fs = require( 'fs' );
var favicon = require( 'serve-favicon' );
var config = require( '../app/models/config-model' ).server;
var logger = require( 'morgan' );
var i18n = require( 'i18next' );
var compression = require( 'compression' );
var errorHandler = require( '../app/controllers/error-handler' );
var controllersPath = path.join( __dirname, '../app/controllers' );
var app = express();
var debug = require( 'debug' )( 'express' );

// general 
for ( var item in config ) {
    if ( config.hasOwnProperty( item ) ) {
        app.set( item, app.get( item ) || config[ item ] );
    }
}
app.set( 'port', process.env.PORT || app.get( 'port' ) || 3000 );
app.set( 'env', process.env.NODE_ENV || 'production' );
app.set( 'authentication cookie name', '__enketo' );

// views
app.set( 'views', path.resolve( __dirname, '../app/views' ) );
app.set( 'view engine', 'jade' );

// pretty json API responses
app.set( 'json spaces', 4 );

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
app.use( cookieParser( app.get( 'encryption key' ) ) );
app.use( i18n.handle );
app.use( favicon( path.resolve( __dirname, '../public/images/favicon.ico' ) ) );
app.use( express.static( path.resolve( __dirname, '../public' ) ) );
app.use( '/locales', express.static( path.resolve( __dirname, '../locales' ) ) );

// set variables that should be accessible in all view templates
app.use( function( req, res, next ) {
    res.locals.livereload = req.app.get( 'env' ) === 'development';
    res.locals.environment = req.app.get( 'env' );
    res.locals.tracking = req.app.get( 'google' ).analytics.ua ? req.app.get( 'google' ).analytics.ua : false;
    res.locals.trackingDomain = req.app.get( 'google' ).analytics.domain || 'auto';
    res.locals.logo = req.app.get( 'logo' );
    res.locals.defaultTheme = req.app.get( 'default theme' ).replace( 'theme-', '' ) || 'kobo';
    res.locals.title = req.app.get( 'app name' );
    res.locals.directionality = function() {
        // TODO: remove this when https://github.com/i18next/i18next/pull/413 is merged, copied to node-i18next, and published.
        // After that we can just access i18n.dir(), in the jade template
        var currentLng = i18n.lng();
        var rtlLangs = [ 'ar', 'shu', 'sqr', 'ssh', 'xaa', 'yhd', 'yud', 'aao', 'abh', 'abv', 'acm',
            'acq', 'acw', 'acx', 'acy', 'adf', 'ads', 'aeb', 'aec', 'afb', 'ajp', 'apc', 'apd', 'arb',
            'arq', 'ars', 'ary', 'arz', 'auz', 'avl', 'ayh', 'ayl', 'ayn', 'ayp', 'bbz', 'pga', 'he',
            'iw', 'ps', 'pbt', 'pbu', 'pst', 'prp', 'prd', 'ur', 'ydd', 'yds', 'yih', 'ji', 'yi', 'hbo',
            'men', 'xmn', 'fa', 'jpr', 'peo', 'pes', 'prs', 'dv', 'sam'
        ];

        if ( rtlLangs.some( function( lang ) {
                return new RegExp( '^' + lang ).test( currentLng );
            } ) ) {
            return 'rtl';
        }
        return 'ltr';
    };
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
app.use( errorHandler[ '404' ] );
if ( app.get( 'env' ) === 'development' ) {
    app.use( errorHandler.development );
}
app.use( errorHandler.production );

module.exports = app;
