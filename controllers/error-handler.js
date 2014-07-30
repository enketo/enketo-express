"use strict";

module.exports = {
    production: function( err, req, res, next ) {
        var body = {
            code: err.status || 500,
            message: err.message
        };
        res.status( err.status || 500 );
        if ( res.get( 'Content-type' ) === 'application/json' ) {
            res.json( body );
        } else {
            res.render( 'error', body );
        }
    },
    development: function( err, req, res, next ) {
        var body = {
            code: err.status || 500,
            message: err.message,
            stack: err.stack
        };
        res.status( err.status || 500 );
        if ( res.get( 'Content-type' ) === 'application/json' ) {
            res.json( body );
        } else {
            res.render( 'error', body );
        }
    },
    "404": function( req, res, next ) {
        var err = new Error( 'Page not Found' );
        err.status = 404;
        next( err );
    }
};
