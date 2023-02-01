/**
 * @module submissions-controller
 */

const request = require('request');
const express = require('express');
const errors = require('../lib/custom-error');
const mediaLib = require('../lib/media');
const communicator = require('../lib/communicator');
const surveyModel = require('../models/survey-model');
const userModel = require('../models/user-model');
const instanceModel = require('../models/instance-model');
const submissionModel = require('../models/submission-model');
const utils = require('../lib/utils');

const router = express.Router();
const routerUtils = require('../lib/router-utils');
// var debug = require( 'debug' )( 'submission-controller' );

module.exports = (app) => {
    app.use(`${app.get('base path')}/submission`, router);
};

router.param('enketo_id', routerUtils.enketoId);
router.param('encrypted_enketo_id_single', routerUtils.encryptedEnketoIdSingle);
router.param('encrypted_enketo_id_view', routerUtils.encryptedEnketoIdView);

router
    .all('*', (req, res, next) => {
        res.set('Content-Type', 'application/json');
        next();
    })
    .get('/max-size/:encrypted_enketo_id_single', maxSize)
    .get('/max-size/:encrypted_enketo_id_view', maxSize)
    .get('/max-size/:enketo_id?', maxSize)
    .get('/:encrypted_enketo_id_view', getInstance)
    .get('/:enketo_id', getInstance)
    .post('/:encrypted_enketo_id_single', submit)
    .post('/:enketo_id', submit)
    .all('/*', (req, res, next) => {
        const error = new Error('Not allowed');
        error.status = 405;
        next(error);
    });

/**
 * Simply pipes well-formed request to the OpenRosa server and
 * copies the response received.
 *
 * @param {express.Request} req - HTTP request
 * @param {express.Response} res - HTTP response
 * @param {Function} next - Express callback
 */
async function submit(req, res, next) {
    if (!req.headers['content-type']?.startsWith('multipart/form-data')) {
        res.status(400)
            .set('content-type', 'text/xml')
            .send(
                /* xml */ `
                <OpenRosaResponse xmlns="http://openrosa.org/http/response" items="0">
                    <message nature="error">Required multipart POST field xml_submission_file missing.</message>
                </OpenRosaResponse>
                `.trim()
            );

        return;
    }

    try {
        const paramName = req.app.get('query parameter to pass to submission');
        const paramValue = req.query[paramName];
        const query = paramValue ? `?${paramName}=${paramValue}` : '';
        const instanceId = req.headers['x-openrosa-instance-id'];
        const deprecatedId = req.headers['x-openrosa-deprecated-id'];
        const id = req.enketoId;
        const survey = await surveyModel.get(id);
        const submissionUrl =
            communicator.getSubmissionUrl(survey.openRosaServer) + query;
        const credentials = userModel.getCredentials(req);
        const authHeader = await communicator.getAuthHeader(
            submissionUrl,
            credentials
        );
        const baseHeaders = authHeader ? { Authorization: authHeader } : {};

        // Note even though headers is part of these options, it does not overwrite the headers set on the client!
        const options = {
            method: 'POST',
            url: submissionUrl,
            headers: communicator.getUpdatedRequestHeaders(baseHeaders, req),
            timeout: req.app.get('timeout') + 500,
        };

        /**
         * TODO: When we've replaced request with a non-deprecated library,
         * and as we continue to move toward async/await, we should also:
         *
         * - Eliminate this `pipe` awkwardness with e.g. `await fetch`
         * - Introduce a more idiomatic request async handler interface, e.g. wrapping
         *   handlers to automatically try + res.send or catch + next(error)
         */
        req.pipe(request(options))
            .on('response', (orResponse) => {
                if (orResponse.statusCode === 201) {
                    _logSubmission(id, instanceId, deprecatedId);
                } else if (orResponse.statusCode === 401) {
                    // replace the www-authenticate header to avoid browser built-in authentication dialog
                    orResponse.headers[
                        'WWW-Authenticate'
                    ] = `enketo${orResponse.headers['WWW-Authenticate']}`;
                }
            })
            .on('error', (error) => {
                if (
                    error &&
                    (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET')
                ) {
                    if (error.connect === true) {
                        error.status = 504;
                    } else {
                        error.status = 408;
                    }
                }

                next(error);
            })
            .pipe(res);
    } catch (error) {
        next(error);
    }
}

/**
 * Get max submission size.
 *
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function maxSize(req, res, next) {
    if (req.query.xformUrl) {
        // Non-standard way of attempting to obtain max submission size from XForm url directly
        communicator
            .getMaxSize({
                info: {
                    downloadUrl: req.query.xformUrl,
                },
            })
            .then((maxSize) => {
                res.json({ maxSize });
            })
            .catch(next);
    } else {
        surveyModel
            .get(req.enketoId)
            .then((survey) => {
                survey.credentials = userModel.getCredentials(req);

                return survey;
            })
            .then(communicator.getMaxSize)
            .then((maxSize) => {
                res.json({ maxSize });
            })
            .catch(next);
    }
}

/**
 * Obtains cached instance (for editing)
 *
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
async function getInstance(req, res, next) {
    try {
        const survey = await surveyModel.get(req.enketoId);

        const instance = await instanceModel.get({
            instanceId: req.query.instanceId,
        });

        if (utils.getOpenRosaKey(survey) !== instance.openRosaKey) {
            throw new errors.ResponseError(
                400,
                "Instance doesn't belong to this form"
            );
        }

        const instanceAttachments = await mediaLib.getMediaMap(
            instance.instanceId,
            instance.instanceAttachments,
            mediaLib.getHostURLOptions(req)
        );

        res.json({
            instance: instance.instance,
            instanceAttachments,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * @param { string } id - Enketo ID of survey
 * @param { string } instanceId - instance ID of record
 * @param { string } deprecatedId - deprecated (previous) ID of record
 */
function _logSubmission(id, instanceId, deprecatedId) {
    submissionModel
        .isNew(id, instanceId)
        .then((notRecorded) => {
            if (notRecorded) {
                // increment number of submissions
                surveyModel.incrementSubmissions(id);
                // store/log instanceId
                submissionModel.add(id, instanceId, deprecatedId);
            }
        })
        .catch((error) => {
            console.error(error);
        });
}
