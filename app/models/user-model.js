'use strict';

var jwt = require( 'jwt-simple' );
// var debug = require( 'debug' )( 'user-model' );

function getCredentials( req ) {
    var token = req.signedCookies[ req.app.get( 'authentication cookie name' ) ];
    var creds = ( token ) ? jwt.decode( token, req.app.get( 'encryption key' ) ) : null;

    return creds;
}

module.exports = {
    getCredentials: getCredentials
};
