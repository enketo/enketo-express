/**
 * @module offline-resources-controller
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
        res.set('Content-Type', 'text/javascript').send(getScriptContent());
    }
});

/**
 * Assembles script contentå
 */
function getScriptContent() {
    // Determining hash every time, is done to make development less painful (refreshing service worker)
    // The partialScriptHash is not actually required but useful to see which offline-app-worker-partial.js is used during troubleshooting.
    // by going to http://localhost:8005/x/offline-app-worker.js and comparing the version with the version shown in the side slider of the webform.
    const partialOfflineAppWorkerScript = fs.readFileSync(
        path.resolve(
            config.root,
            'public/js/src/module/offline-app-worker-partial.js'
        ),
        'utf8'
    );
    const partialScriptHash = crypto
        .createHash('md5')
        .update(partialOfflineAppWorkerScript)
        .digest('hex')
        .substring(0, 7);
    const configurationHash = crypto
        .createHash('md5')
        .update(JSON.stringify(config))
        .digest('hex')
        .substring(0, 7);
    const version = [config.version, configurationHash, partialScriptHash].join(
        '-'
    );
    // We add as few explicit resources as possible because the offline-app-worker can do this dynamically and that is preferred
    // for easier maintenance of the offline launch feature.
    const resources = config['themes supported']
        .reduce((accumulator, theme) => {
            accumulator.push(
                `${config['base path']}${config['offline path']}/css/theme-${theme}.css`
            );
            accumulator.push(
                `${config['base path']}${config['offline path']}/css/theme-${theme}.print.css`
            );

            return accumulator;
        }, [])
        .concat([
            `${config['base path']}${config['offline path']}/images/icon_180x180.png`,
        ]);

    return `
const version = '${version}';
const resources = [
    '${resources.join("',\n    '")}'
];

${partialOfflineAppWorkerScript}`;
}
