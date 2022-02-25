/**
 * @module api-v1-controller
 */

const auth = require('basic-auth');
const express = require('express');
const surveyModel = require('../models/survey-model');
const instanceModel = require('../models/instance-model');
const account = require('../models/account-model');

const router = express.Router();
const quotaErrorMessage = 'Forbidden. No quota left';
// var debug = require( 'debug' )( 'api-controller-v1' );

module.exports = (app) => {
    app.use(`${app.get('base path')}/api/v1`, router);
    // old enketo-legacy URL structure for migration-friendliness
    app.use(`${app.get('base path')}/api_v1`, router);
};

router
    .get('/', (req, res) => {
        res.redirect('http://apidocs.enketo.org/v1');
    })
    .all('*', authCheck)
    .all('*', _setQuotaUsed)
    .all('/*/iframe', _setIframe)
    .all('/survey/preview*', (req, res, next) => {
        req.webformType = 'preview';
        next();
    })
    .all('/survey/all*', (req, res, next) => {
        req.webformType = 'all';
        next();
    })
    .all('/instance*', (req, res, next) => {
        req.webformType = 'edit';
        next();
    })
    .all('*', _setReturnQueryParam)
    .get('/survey', getExistingSurvey)
    .get('/survey/iframe', getExistingSurvey)
    .post('/survey', getNewOrExistingSurvey)
    .post('/survey/iframe', getNewOrExistingSurvey)
    .delete('/survey', deactivateSurvey)
    .get('/survey/preview', getExistingSurvey)
    .get('/survey/preview/iframe', getExistingSurvey)
    .post('/survey/preview', getNewOrExistingSurvey)
    .post('/survey/preview/iframe', getNewOrExistingSurvey)
    .get('/survey/all', getExistingSurvey)
    .post('/survey/all', getNewOrExistingSurvey)
    .get('/surveys/number', getNumber)
    .post('/surveys/number', getNumber)
    .get('/surveys/list', getList)
    .post('/surveys/list', getList)
    .post('/instance', cacheInstance)
    .post('/instance/iframe', cacheInstance)
    .delete('/instance', removeInstance)
    .all('*', (req, res, next) => {
        const error = new Error('Not allowed');
        error.status = 405;
        next(error);
    });

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function authCheck(req, res, next) {
    // check authentication and account
    let error;
    const creds = auth(req);
    const key = creds ? creds.name : undefined;
    const server = req.body.server_url || req.query.server_url;

    // set content-type to json to provide appropriate json Error responses
    res.set('Content-Type', 'application/json');

    account
        .get(server)
        .then((account) => {
            if (!key || key !== account.key) {
                error = new Error('Not Allowed. Invalid API key.');
                error.status = 401;
                res.status(error.status).set(
                    'WWW-Authenticate',
                    'Basic realm="Enter valid API key as user name"'
                );
                next(error);
            } else {
                req.account = account;
                next();
            }
        })
        .catch(next);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function getExistingSurvey(req, res, next) {
    if (req.account.quota < req.account.quotaUsed) {
        return _render(403, quotaErrorMessage, res);
    }

    return surveyModel
        .getId({
            openRosaServer: req.query.server_url,
            openRosaId: req.query.form_id,
        })
        .then((id) => {
            if (id) {
                _render(200, _generateWebformUrls(id, req), res);
            } else {
                _render(404, 'Survey not found', res);
            }
        })
        .catch(next);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function getNewOrExistingSurvey(req, res, next) {
    const survey = {
        openRosaServer: req.body.server_url || req.query.server_url,
        openRosaId: req.body.form_id || req.query.form_id,
    };

    if (req.account.quota < req.account.quotaUsed) {
        return _render(403, quotaErrorMessage, res);
    }

    return surveyModel
        .getId(survey)
        .then((id) =>
            // will return existing && active surveys
            id ? surveyModel.get(id) : null
        )
        .catch((error) => {
            if (error.status === 404) {
                return null;
            }
            throw error;
        })
        .then((storedSurvey) => {
            if (!storedSurvey && req.account.quota <= req.account.quotaUsed) {
                return _render(403, quotaErrorMessage, res);
            }
            const status = storedSurvey ? 200 : 201;

            // even if id was found still call .set() method to update any properties
            return surveyModel.set(survey).then((id) => {
                if (id) {
                    _render(status, _generateWebformUrls(id, req), res);
                } else {
                    _render(404, 'Survey not found', res);
                }
            });
        })
        .catch(next);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function deactivateSurvey(req, res, next) {
    return surveyModel
        .update({
            openRosaServer: req.body.server_url,
            openRosaId: req.body.form_id,
            active: false,
        })
        .then((id) => {
            if (id) {
                _render(204, null, res);
            } else {
                _render(404, 'Survey not found', res);
            }
        })
        .catch(next);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function getNumber(req, res, next) {
    return surveyModel
        .getNumber(req.body.server_url || req.query.server_url)
        .then((number) => {
            if (number) {
                _render(
                    200,
                    {
                        code: 200,
                        number,
                    },
                    res
                );
            } else {
                // this cannot be reached I think
                _render(404, 'No surveys found', res);
            }
        })
        .catch(next);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function getList(req, res, next) {
    let obj;

    return surveyModel
        .getList(req.body.server_url || req.query.server_url)
        .then((list) => {
            list = list.map((survey) => {
                obj = _generateWebformUrls(survey.enketoId, req);
                obj.form_id = survey.openRosaId;
                obj.server_url = survey.openRosaServer;

                return obj;
            });
            _render(
                200,
                {
                    code: 200,
                    forms: list,
                },
                res
            );
        })
        .catch(next);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function cacheInstance(req, res, next) {
    let survey;
    let enketoId;

    if (req.account.quota < req.account.quotaUsed) {
        return _render(403, quotaErrorMessage, res);
    }

    survey = {
        openRosaServer: req.body.server_url,
        openRosaId: req.body.form_id,
        instance: req.body.instance,
        instanceId: req.body.instance_id,
        returnUrl: req.body.return_url,
    };

    return surveyModel
        .getId(survey)
        .then((id) =>
            // will return existing && active surveys
            id ? surveyModel.get(id) : null
        )
        .catch((error) => {
            if (error.status === 404) {
                return null;
            }
            throw error;
        })
        .then((storedSurvey) => {
            if (!storedSurvey) {
                if (req.account.quota <= req.account.quotaUsed) {
                    return _render(403, quotaErrorMessage, res);
                }

                // Create a new enketo ID.
                return surveyModel.set(survey);
            }

            // Do not update properties if ID was found to avoid overwriting theme.
            return storedSurvey.enketoId;
        })
        .then((id) => {
            enketoId = id;

            return instanceModel.set(survey);
        })
        .then(() => {
            _render(201, _generateWebformUrls(enketoId, req), res);
        })
        .catch(next);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function removeInstance(req, res, next) {
    return instanceModel
        .remove({
            openRosaServer: req.body.server_url,
            openRosaId: req.body.form_id,
            instanceId: req.body.instance_id,
        })
        .then((instanceId) => {
            if (instanceId) {
                _render(204, null, res);
            } else {
                _render(404, 'Record not found', res);
            }
        })
        .catch(next);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function _setQuotaUsed(req, res, next) {
    if (!req.app.get('account lib')) {
        // Pretend quota used = 0 if not running SaaS.
        req.account.quotaUsed = 0;
        next();
    } else {
        // For SaaS service:
        surveyModel
            .getNumber(req.account.linkedServer)
            .then((number) => {
                req.account.quotaUsed = number;
                next();
            })
            .catch(next);
    }
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function _setIframe(req, res, next) {
    req.iframe = true;
    next();
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function _setReturnQueryParam(req, res, next) {
    const returnUrl = req.body.return_url || req.query.return_url;
    if (
        returnUrl &&
        (req.webformType === 'edit' || req.webformType === 'single')
    ) {
        req.returnQueryParam = `return_url=${encodeURIComponent(
            decodeURIComponent(returnUrl)
        )}`;
    }
    next();
}

/**
 * @param {Array<string>} [params] - List of parameters.
 */
function _generateQueryString(params = []) {
    const paramsJoined = params
        .filter((part) => part && part.length > 0)
        .join('&');

    return paramsJoined ? `?${paramsJoined}` : '';
}

/**
 * @param { string } id - Form id.
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 */
function _generateWebformUrls(id, req) {
    let queryString;
    const obj = {};
    const IFRAMEPATH = 'i/';
    const iframePart = req.iframe ? IFRAMEPATH : '';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.headers.host}${req.app.get(
        'base path'
    )}/`;
    const offline = req.app.get('offline enabled');

    req.webformType = req.webformType || 'default';

    switch (req.webformType) {
        case 'preview':
            obj.preview_url = `${baseUrl}preview/${iframePart}${id}`;
            break;
        case 'edit':
            queryString = _generateQueryString([
                `instance_id=${req.body.instance_id}`,
                req.returnQueryParam,
            ]);
            obj.edit_url = `${baseUrl}edit/${iframePart}${id}${queryString}`;
            break;
        case 'all':
            // non-iframe views
            obj.url = offline ? `${baseUrl}x/${id}` : baseUrl + id;
            obj.preview_url = `${baseUrl}preview/${id}`;
            // iframe views
            obj.iframe_url = baseUrl + IFRAMEPATH + id;
            obj.preview_iframe_url = `${baseUrl}preview/${IFRAMEPATH}${id}`;
            // enketo-legacy
            obj.subdomain = '';
            break;
        default:
            if (iframePart) {
                obj.url = offline
                    ? `${baseUrl}x/${id}`
                    : baseUrl + iframePart + id;
            } else {
                obj.url = offline ? `${baseUrl}x/${id}` : baseUrl + id;
            }
            break;
    }

    return obj;
}

/**
 * @param { number } status - HTTP status code
 * @param {object|string} body - response body
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 */
function _render(status, body, res) {
    if (status === 204) {
        // send 204 response without a body
        res.status(status).end();
    } else {
        if (typeof body === 'string') {
            body = {
                message: body,
            };
        }
        body.code = status;
        res.status(status).json(body);
    }
}
