/**
 * @module api-controller
 *
 * @description Handles only redirecting to API documentation.
 */

/**
 * @typedef ExpressRequest
 * @type { object }
 * @see {@link http://expressjs.com/en/4x/api.html#req|Express Request object documentation}
 */

/**
 * @typedef ExpressResponse
 * @type { object }
 * @see {@link http://expressjs.com/en/4x/api.html#res|Express Response object documentation}
 */

const express = require('express');

const router = express.Router();

module.exports = (app) => {
    app.use(`${app.get('base path')}/api`, router);
};

router.get('/', (req, res) => {
    res.redirect('http://apidocs.enketo.org');
});
