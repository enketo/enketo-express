/* global process, __dirname */

const { requestContextMiddleware } = require( '../app/lib/context' );
const express = require( 'express' );
const path = require( 'path' );
const bodyParser = require( 'body-parser' );
const cookieParser = require( 'cookie-parser' );
const fs = require( 'fs' );
const favicon = require( 'serve-favicon' );
const config = require( '../app/models/config-model' );
const logger = require( 'morgan' );
const i18next = require( 'i18next' );
const I18nextBackend = require( 'i18next-fs-backend' );
const i18nextMiddleware = require( 'i18next-http-middleware' );
const compression = require( 'compression' );
const errorHandler = require( '../app/controllers/error-handler' );
const controllersPath = path.join( __dirname, '../app/controllers' );
const app = express();
const debug = require( 'debug' )( 'express' );

// general
for ( const item in config.server ) {
    if ( Object.prototype.hasOwnProperty.call( config.server, item ) ) {
        app.set( item, app.get( item ) || config.server[ item ] );
    }
}
app.set( 'port', process.env.PORT || app.get( 'port' ) || 3000 );
app.set( 'env', process.env.NODE_ENV || 'production' );
app.set( 'authentication cookie name', '__enketo_' );

// views
app.set( 'views', path.resolve( __dirname, '../app/views' ) );
app.set( 'view engine', 'pug' );

// pretty json API responses
app.set( 'json spaces', 4 );

// setup i18next
i18next
    .use( i18nextMiddleware.LanguageDetector )
    .use( I18nextBackend )
    .init( {
        //debug: true, // DEBUG
        whitelist: app.get( 'languages supported' ),
        fallbackLng: 'en',
        joinArrays: '\n',
        backend: {
            loadPath: path.resolve( __dirname, '../locales/build/__lng__/translation-combined.json' )
        },
        load: 'languageOnly',
        lowerCaseLng: true,
        detection: {
            order: [ 'querystring', 'header' ],
            lookupQuerystring: 'lang',
            caches: false,
        },
        interpolation: {
            prefix: '__',
            suffix: '__'
        }
    } );

// middleware

app.use( requestContextMiddleware );
app.use( compression() );
app.use( bodyParser.json( {
    limit: config.server[ 'payload limit' ]
} ) );
app.use( bodyParser.urlencoded( {
    limit: config.server[ 'payload limit' ],
    extended: true
} ) );
app.use( cookieParser( app.get( 'encryption key' ) ) );
app.use( i18nextMiddleware.handle( i18next, {
    /*ignoreRoutes: [ '/css', '/fonts', '/images', '/js' ]*/
} ) );
app.use( favicon( path.resolve( __dirname, '../public/images/favicon.ico' ) ) );
app.use( app.get( 'base path' ), express.static( path.resolve( __dirname, '../public' ) ) );
app.use( `${app.get( 'base path' )}/x`, express.static( path.resolve( __dirname, '../public' ) ) );
app.use( `${app.get( 'base path' )}/locales/build`, express.static( path.resolve( __dirname, '../locales/build' ) ) );
app.use( `${`${app.get( 'base path' )}/x`}/locales/build`, express.static( path.resolve( __dirname, '../locales/build' ) ) );

// set variables that should be accessible in all view templates
app.use( ( req, res, next ) => {
    res.locals.livereload = req.app.get( 'env' ) === 'development';
    res.locals.environment = req.app.get( 'env' );
    res.locals.analytics = req.app.get( 'analytics' );
    res.locals.googleAnalytics = {
        ua: req.app.get( 'google' ).analytics.ua,
        domain: req.app.get( 'google' ).analytics.domain || 'auto'
    };
    res.locals.piwikAnalytics = {
        trackerUrl: req.app.get( 'piwik' ).analytics[ 'tracker url' ],
        siteId: req.app.get( 'piwik' ).analytics[ 'site id' ]
    };
    res.locals.logo = req.app.get( 'logo' );
    res.locals.defaultTheme = req.app.get( 'default theme' ).replace( 'theme-', '' ) || 'kobo';
    res.locals.title = req.app.get( 'app name' );
    res.locals.dir = lng => {
        return i18next.dir( lng );
    };
    res.locals.basePath = req.app.get( 'base path' );
    res.locals.draftEnabled = !req.app.get( 'disable save as draft' );
    res.locals.clientConfig = config.client;
    next();
} );

// load controllers (including their routers)
fs.readdirSync( controllersPath ).forEach( file => {
    if ( file.indexOf( '-controller.js' ) >= 0 ) {
        debug( 'loading', file );
        require( `${controllersPath}/${file}` )( app );
    }
} );

// logging
app.use( logger( ( app.get( 'env' ) === 'development' ? 'dev' : 'tiny' ) ) );

// error handlers
app.use( errorHandler[ '404' ] );
if ( app.get( 'env' ) === 'development' ) {
    app.use( errorHandler.development );
} else {
    app.use( errorHandler.production );
}

module.exports = app;
