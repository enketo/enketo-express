"use strict";

var express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'authentication-controller' );

module.exports = function( app ) {
    app.use( '/login', router );
};

router
    .get( '*', login );

function login( req, res, next ) {
    var error,
        authSettings = req.app.get( 'linked form and data server' ).authentication,
        externalLoginUrl = authSettings[ 'external login url that sets cookie' ],
        authenticationManagedByEnketo = authSettings[ 'managed by enketo' ],
        returnUrl = req.query.return_url || '';

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
    } else {
        error = new Error( 'The form requires authentication. Unfortunately, Enketo-managed (OpenRosa) authentication is not supported yet.' );
        error.status = 401;
        next( error );
    }
}
