/**
 * @module authentication-controller
 */

const csrfProtection = require('csurf')({
    cookie: true,
});
const jwt = require('jwt-simple');
const express = require('express');

const router = express.Router();
// var debug = require( 'debug' )( 'authentication-controller' );

module.exports = (app) => {
    app.use(`${app.get('base path')}/`, router);
};

router
    .get('/login', csrfProtection, login)
    .get('/logout', logout)
    .post('/login', csrfProtection, setToken);

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function login(req, res, next) {
    let error;
    const authSettings = req.app.get(
        'linked form and data server'
    ).authentication;
    const returnUrl = req.query.return_url || '';

    if (authSettings.type.toLowerCase() !== 'basic') {
        if (authSettings.url) {
            // the url is expected to:
            // - authenticate the user,
            // - set a session cookie (cross-domain if necessary) or add a token as query parameter to the return URL,
            // - and return the user back to Enketo
            // - enketo will then pass the cookie or token along when requesting resources, or submitting data
            // Though returnUrl was encoded with encodeURIComponent, for some reason it appears to have been automatically decoded here.
            res.redirect(
                authSettings.url.replace(
                    '{RETURNURL}',
                    encodeURIComponent(returnUrl)
                )
            );
        } else {
            error = new Error(
                'Enketo configuration error. External authentication URL is missing.'
            );
            error.status = 500;
            next(error);
        }
    } else if (
        req.app.get('env') !== 'production' ||
        req.protocol === 'https' ||
        req.headers['x-forwarded-proto'] === 'https' ||
        req.app.get('linked form and data server').authentication[
            'allow insecure transport'
        ]
    ) {
        res.render('surveys/login', {
            csrfToken: req.csrfToken(),
            server: req.app.get('linked form and data server').name,
        });
    } else {
        error = new Error(
            'Forbidden. Enketo needs to use https in production mode to enable authentication.'
        );
        error.status = 405;
        next(error);
    }
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 */
function logout(req, res) {
    res.clearCookie(req.app.get('authentication cookie name'))
        .clearCookie('__enketo_meta_username')
        .clearCookie('__enketo_logout')
        .render('surveys/logout');
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 */
function setToken(req, res) {
    const username = req.body.username.trim();
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    const returnUrl = req.query.return_url || '';

    const token = jwt.encode(
        {
            user: username,
            pass: req.body.password,
        },
        req.app.get('encryption key')
    );

    // Do not allow authentication cookies to be saved if enketo runs on http, unless 'allow insecure transport' is set to true
    // This is double because the check in login() already ensures the login screen isn't even shown.
    const secure =
        req.protocol === 'production' &&
        !req.app.get('linked form and data server').authentication[
            'allow insecure transport'
        ];

    const authOptions = {
        secure,
        signed: true,
        httpOnly: true,
        path: '/',
    };

    const uidOptions = {
        signed: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
    };

    if (req.body.remember) {
        authOptions.maxAge = maxAge;
        uidOptions.maxAge = maxAge;
    }

    // store the token in a cookie on the client
    res.cookie(req.app.get('authentication cookie name'), token, authOptions)
        .cookie('__enketo_logout', true)
        .cookie('__enketo_meta_username', username, uidOptions);

    if (returnUrl) {
        res.redirect(returnUrl);
    } else {
        res.send(
            'Username and password are stored. You can close this page now.'
        );
    }
}
