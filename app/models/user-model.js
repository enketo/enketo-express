/**
 * @module user-model
 */

const jwt = require('jwt-simple');
const url = require('url');
// var debug = require( 'debug' )( 'user-model' );

/**
 * Returns credentials from request object.
 * Handles `'basic'` and `'token'` authentication types.
 *
 * @static
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @return {object|null} Credentials
 */
function getCredentials(req) {
    const auth = req.app.get('linked form and data server').authentication;
    const authType = auth.type.toLowerCase();
    let creds = null;

    if (authType === 'basic') {
        const jwToken =
            req.signedCookies[req.app.get('authentication cookie name')];
        creds = jwToken
            ? jwt.decode(jwToken, req.app.get('encryption key'))
            : null;
    } else if (authType === 'token') {
        const paramName = auth['query parameter'];
        if (!paramName) {
            throw new Error(
                'Enketo configuration error. No query parameter name configured for token authentication.'
            );
        }
        // Note url.parse is considered a legacy method now, and can be replaced for nodeJS 8+
        const referer = req.headers.referer
            ? url.parse(req.headers.referer, true)
            : null;
        const tokenValue = referer
            ? referer.query[paramName]
            : req.query[paramName];
        if (tokenValue) {
            creds = {
                bearer: tokenValue,
            };
        }
    }

    return creds;
}

module.exports = {
    getCredentials,
};
