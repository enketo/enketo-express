"use strict";

var jwt = require( 'jwt-simple' ),
    debug = require( 'debug' )( 'user-model' );

function getCredentials( req ) {
    var token = req.signedCookies[ req.app.get( 'authentication cookie name' ) ],
        creds = ( token ) ? jwt.decode( token, req.app.get( 'encryption key' ) ) : null;

    return creds;
}

module.exports = {
    getCredentials: getCredentials
};
