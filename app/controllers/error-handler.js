/**
 * @module error-handler
 */

// var debug = require( 'debug' )( 'error-handler' );

/**
 * @param {object} req - {@link http://expressjs.com/en/4x/api.html#req|Express Request object}
 * @param {Error} error - Error object.
 */
function getErrorMessage( req, error ) {
    if ( error.message ) {
        // convert certain set of messages into a more readable
        // and translated message
        if ( /ECONNREFUSED/.test( error.message ) ) {
            return req.i18n.t( 'error.econnrefused' );
        }
        // else output the message untranslated
        return error.message;
    } else if ( error.translationKey ) {
        // return translated message
        return req.i18n.t( error.translationKey, error.translationParams );
    } else {
        // return error code
        return error.code;
    }
}

module.exports = {
    /**
     * @param {Error} err - Error object
     * @param {object} req - {@link http://expressjs.com/en/4x/api.html#req|Express Request object}
     * @param {object} res - {@link http://expressjs.com/en/4x/api.html#res|Express Response object}
     * @param {Function} next - Express callback
     */
    production( err, req, res, next ) {
        const body = {
            code: err.status || 500,
            message: getErrorMessage( req, err )
        };
        const contentType = res.get( 'Content-type' );
        res.status( err.status || 500 );
        if ( contentType && contentType.indexOf( 'application/json' ) === 0 ) {
            res.json( body );
        } else {
            res.render( 'error', body );
        }
    },
    /**
     * @param {Error} err - Error object
     * @param {object} req - {@link http://expressjs.com/en/4x/api.html#req|Express Request object}
     * @param {object} res - {@link http://expressjs.com/en/4x/api.html#res|Express Response object}
     * @param {Function} next - Express callback
     */
    development( err, req, res, next ) {
        const body = {
            code: err.status || 500,
            message: getErrorMessage( req, err ),
            stack: err.stack
        };
        const contentType = res.get( 'Content-type' );
        res.status( err.status || 500 );
        if ( contentType && contentType.indexOf( 'application/json' ) === 0 ) {
            res.json( body );
        } else {
            res.render( 'error', body );
        }
    },
    /**
     * @param {object} req - {@link http://expressjs.com/en/4x/api.html#req|Express Request object}
     * @param {object} res - {@link http://expressjs.com/en/4x/api.html#res|Express Response object}
     * @param {Function} next - Express callback
     */
    '404': function( req, res, next ) {
        const error = new Error( req.i18n.t( 'error.pagenotfound' ) );
        error.status = 404;
        next( error );
    }
};
