'use strict';

var utils = require( './utils' );

function enketoIdParam( req, res, next, id ) {
    if ( /^::[A-z0-9]{4,8}$/.test( id ) ) {
        req.enketoId = id.substring( 2 );
        next();
    } else {
        next( 'route' );
    }
}

function encryptedEnketoIdParam( req, res, next, id ) {
    // either 32 or 64 hexadecimal characters
    if ( /^::([0-9a-fA-F]{32}$|[0-9a-fA-F]{64})$/.test( id ) ) {
        req.encryptedEnketoId = id.substring( 2 );
        try {
            req.enketoId = utils.insecureAes192Decrypt( id.substring( 2 ), req.app.get( 'less secure encryption key' ) );
            next();
        } catch ( e ) {
            console.error( 'Could not decrypt:', req.encryptedEnketoId );
            next( 'route' );
        }
    } else {
        next( 'route' );
    }
}

module.exports = {
    enketoId: enketoIdParam,
    encryptedEnketoId: encryptedEnketoIdParam
};
