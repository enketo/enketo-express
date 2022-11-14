/**
 * @module offline-resources-controller
 */

const fs = require('fs');
const express = require('express');

const router = express.Router();
const config = require('../models/config-model').server;

// var debug = require( 'debug' )( 'offline-controller' );

module.exports = (app) => {
    app.use(`${app.get('base path')}/`, router);
};

router.get('/x/offline-app-worker.js', (req, res, next) => {
    if (config['offline enabled'] === false) {
        const error = new Error(
            'Offline functionality has not been enabled for this application.'
        );
        error.status = 404;
        next(error);
    } else {
        // We add as few explicit resources as possible because the offline-app-worker can do this dynamically and that is preferred
        // for easier maintenance of the offline launch feature.
        const resources = config['themes supported']
            .flatMap((theme) => [
                `${config['base path']}${config['offline path']}/css/theme-${theme}.css`,
                `${config['base path']}${config['offline path']}/css/theme-${theme}.print.css`,
            ])
            .concat([
                `${config['base path']}${config['offline path']}/images/icon_180x180.png`,
            ]);

        const link = resources
            .map((resource) => `<${resource}>; rel="prefetch"`)
            .join(', ');

        const script = fs.readFileSync(config.offlineWorkerPath, 'utf-8');

        res.set('Content-Type', 'text/javascript');
        res.set('Link', link);
        res.send(script);
    }
});
