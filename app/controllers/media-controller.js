/**
 * @module media-controller
 */

const url = require('url');
const communicator = require('../lib/communicator');
const request = require('request');
const express = require('express');

const router = express.Router();
const debug = require('debug')('enketo:media-controller');
const {
    RequestFilteringHttpAgent,
    RequestFilteringHttpsAgent,
} = require('request-filtering-agent');
const { ResponseError } = require('../lib/custom-error');
const mediaLib = require('../lib/media');

module.exports = (app) => {
    app.use(`${app.get('base path')}/media`, router);
};

router.get('/get/*', getMedia);

function _isPrintView(req) {
    const refererQuery =
        req.headers && req.headers.referer
            ? url.parse(req.headers.referer).query
            : null;

    return !!(refererQuery && refererQuery.includes('print=true'));
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
async function getMedia(req, res, next) {
    try {
        const hostURLOptions = mediaLib.getHostURLOptions(req);
        const url = await mediaLib.getHostURL(hostURLOptions);

        if (url == null) {
            throw new ResponseError(404, 'Not found');
        }

        const { auth, cookie } = hostURLOptions;

        // TODO: while beginning to work on consolidating media logic,
        // it was also discovered that partial content is not handled
        // correctly when content is streamed through a proxy with
        // incomplete configuration. Discovered during dev with the
        // default ODK Central configuration.
        //
        // For example, this presents as being unable to seek <audio>
        // in Chrome.
        const options = communicator.getUpdatedRequestOptions({
            url,
            auth,
            headers: {
                cookie,
            },
        });

        // due to a bug in request/request using options.method with Digest Auth we won't pass method as an option
        delete options.method;

        // filtering agent to stop private ip access to HEAD and GET
        if (options.url.startsWith('https')) {
            options.agent = new RequestFilteringHttpsAgent(
                req.app.get('ip filtering')
            );
        } else {
            options.agent = new RequestFilteringHttpAgent(
                req.app.get('ip filtering')
            );
        }

        if (_isPrintView(req)) {
            request.head(options, (error, response) => {
                if (error) {
                    next(error);
                } else {
                    const contentType = response.headers['content-type'];
                    if (
                        contentType.startsWith('audio') ||
                        contentType.startsWith('video')
                    ) {
                        // Empty response, because audio and video is not helpful in print views.
                        res.status(204).end();
                    } else {
                        _pipeMedia(options, req, res, next);
                    }
                }
            });
        } else {
            _pipeMedia(options, req, res, next);
        }
    } catch (error) {
        next(error);
    }
}

function _pipeMedia(options, req, res, next) {
    request
        .get(options)
        .on('error', (error) => _handleMediaRequestError(error, next))
        .pipe(res)
        .on('error', (error) => _handleMediaRequestError(error, next));
}

function _handleMediaRequestError(error, next) {
    debug(
        `error retrieving media from OpenRosa server: ${JSON.stringify(error)}`
    );
    if (!error.status) {
        error.status = error.code && error.code === 'ENOTFOUND' ? 404 : 500;
    }
    next(error);
}
