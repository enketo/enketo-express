const baseContext = require('express-cls-hooked');

/**
 * Creates an asynchronous context providing access to the currently active request.
 *
 * This middleware must be used before `bodyParser`, and imported before any
 * third party module which may perform async side effects.
 *
 * @type {import('express').Handler}
 */
const requestContextMiddleware = (req, res, next) => {
    baseContext.middleware(req, res, (error) => {
        if (error != null) {
            return next(error);
        }

        baseContext.set('request', req);

        res.once('finish', () => {
            baseContext.set('request', null);
        });

        next();
    });
};

/**
 * @return {import('express').Request | void}
 */
const getCurrentRequest = () => baseContext.get('request');

module.exports = {
    getCurrentRequest,
    requestContextMiddleware,
};
