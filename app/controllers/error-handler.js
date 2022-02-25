/**
 * @module error-handler
 */

// var debug = require( 'debug' )( 'error-handler' );

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {Error} error - Error object.
 */
function getErrorMessage(req, error) {
    if (error.message) {
        // convert certain set of messages into a more readable
        // and translated message
        if (/ECONNREFUSED/.test(error.message)) {
            return req.i18n.t('error.econnrefused');
        }

        // else output the message untranslated
        return error.message;
    }
    if (error.translationKey) {
        // return translated message
        return req.i18n.t(error.translationKey, error.translationParams);
    }
    // return error code
    return error.code;
}

module.exports = {
    /**
     * @param {Error} err - Error object
     * @param {module:api-controller~ExpressRequest} req - HTTP request
     * @param {module:api-controller~ExpressResponse} res - HTTP response
     * @param {Function} next - Express callback
     */
    // Express uses arguments length to determine whether a callback is an error handler.
    // eslint-disable-next-line no-unused-vars
    production(err, req, res, next) {
        // eslint-disable-line no-unused-vars
        const body = {
            code: err.status || 500,
            message: getErrorMessage(req, err),
        };
        const contentType = res.get('Content-type');
        res.status(err.status || 500);
        if (contentType && contentType.indexOf('application/json') === 0) {
            res.json(body);
        } else {
            res.render('error', body);
        }
    },
    /**
     * @param {Error} err - Error object
     * @param {module:api-controller~ExpressRequest} req - HTTP request
     * @param {module:api-controller~ExpressResponse} res - HTTP response
     * @param {Function} next - Express callback
     */
    // Express uses arguments length to determine whether a callback is an error handler.
    // eslint-disable-next-line no-unused-vars
    development(err, req, res, next) {
        // eslint-disable-line no-unused-vars
        const body = {
            code: err.status || 500,
            message: getErrorMessage(req, err),
            stack: err.stack,
        };
        const contentType = res.get('Content-type');
        res.status(err.status || 500);
        if (contentType && contentType.indexOf('application/json') === 0) {
            res.json(body);
        } else {
            res.render('error', body);
        }
    },
    /**
     * @param {module:api-controller~ExpressRequest} req - HTTP request
     * @param {module:api-controller~ExpressResponse} res - HTTP response
     * @param {Function} next - Express callback
     */
    404(req, res, next) {
        const error = new Error(req.i18n.t('error.pagenotfound'));
        error.status = 404;
        next(error);
    },
};
