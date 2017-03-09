'use strict';

var csrfProtection = require( 'csurf' )( {
    cookie: true
} );
var jwt = require( 'jwt-simple' );
var express = require( 'express' );
var router = express.Router();
// var debug = require( 'debug' )( 'authentication-controller' );

module.exports = function( app ) {
    app.use( app.get( 'base path' ) + '/', router );
};

router
    .get( '/login', csrfProtection, login )
    .get( '/logout', logout )
    .post( '/login', csrfProtection, setToken );

function login( req, res, next ) {
    var error;
    var authSettings = req.app.get( 'linked form and data server' ).authentication;
    var externalLoginUrl = authSettings[ 'external login url that sets cookie' ];
    var authenticationManagedByEnketo = authSettings[ 'managed by enketo' ];
    var returnUrl = req.query.return_url || '';

    if ( !authenticationManagedByEnketo ) {
        if ( externalLoginUrl ) {
            // the external login url is expected to:
            // - authenticate the user, 
            // - set a session cookie (cross-domain if necessary), 
            // - and return the user back to Enketo
            // - enketo will then pass this cookie along when requesting resources, submitting data
            res.redirect( externalLoginUrl.replace( '{RETURNURL}', returnUrl ) );
        } else {
            error = new Error( 'Enketo-express was not configured correctly. Enketo should either manage authentication itself (configuration set to true), or an external login url that sets a cookie should be provided.)' );
            error.status = 500;
            next( error );
        }
    } else if ( req.app.get( 'env' ) !== 'production' || req.protocol === 'https' || req.headers[ 'x-forwarded-proto' ] === 'https' || req.app.get( 'linked form and data server' ).authentication[ 'allow insecure transport' ] ) {
        res.render( 'surveys/login', {
            csrfToken: req.csrfToken(),
            server: req.app.get( 'linked form and data server' ).name
        } );
    } else {
        error = new Error( 'Forbidden. Enketo needs to use https in production mode to enable authentication.' );
        error.status = 405;
        next( error );
    }
}

function logout( req, res ) {
    res
        .clearCookie( req.app.get( 'authentication cookie name' ) )
        .clearCookie( '__enketo_meta_username' )
        .clearCookie( '__enketo_logout' )
        .render( 'surveys/logout' );
}

function setToken( req, res ) {
    var token;
    var authOptions;
    var uidOptions;
    var secure;
    var username = req.body.username.trim();
    var maxAge = 30 * 24 * 60 * 60 * 1000;
    var returnUrl = req.query.return_url || '';

    token = jwt.encode( {
        user: username,
        pass: req.body.password
    }, req.app.get( 'encryption key' ) );

    // Do not allow authentication cookies to be saved if enketo runs on http, unless 'allow insecure transport' is set to true
    // This is double because the check in login() already ensures the login screen isn't even shown.
    secure = ( req.protocol === 'production' && !req.app.get( 'linked form and data server' ).authentication[ 'allow insecure transport' ] );

    authOptions = {
        secure: secure,
        signed: true,
        httpOnly: true,
        path: '/'
    };

    uidOptions = {
        signed: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/'
    };

    if ( req.body.remember ) {
        authOptions.maxAge = maxAge;
        uidOptions.maxAge = maxAge;
    }

    // store the token in a cookie on the client
    res
        .cookie( req.app.get( 'authentication cookie name' ), token, authOptions )
        .cookie( '__enketo_logout', true )
        .cookie( '__enketo_meta_username', username, uidOptions );

    if ( returnUrl ) {
        res.redirect( returnUrl );
    } else {
        res.send( 'Username and password are stored. You can close this page now.' );
    }
}
