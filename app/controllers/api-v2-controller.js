/**
 * @module api-v2-controller
 */

const auth = require('basic-auth');
const express = require('express');
const surveyModel = require('../models/survey-model');
const instanceModel = require('../models/instance-model');
const cacheModel = require('../models/cache-model');
const account = require('../models/account-model');
const pdf = require('../lib/pdf');
const utils = require('../lib/utils');
const keys = require('../lib/router-utils').idEncryptionKeys;

const router = express.Router();
const quotaErrorMessage = 'Forbidden. No quota left';
// var debug = require( 'debug' )( 'api-controller-v2' );

module.exports = (app) => {
    app.use(`${app.get('base path')}/api/v2`, router);
    // old enketo-legacy URL structure for migration-friendliness
    app.use(`${app.get('base path')}/api_v2`, router);
};

router
    .get('/', (req, res) => {
        res.redirect('http://apidocs.enketo.org/v2');
    })
    .get('/version', getVersion)
    .post('/version', getVersion)
    .all('*', authCheck)
    .all('*', _setQuotaUsed)
    .all('*', _setDefaultsQueryParam)
    .all('/*/iframe', _setIframe)
    .all('/survey/all', _setIframe)
    .all('/surveys/list', _setIframe)
    .all('*/pdf', _setPage)
    .all('/survey/preview*', (req, res, next) => {
        req.webformType = 'preview';
        next();
    })
    .all('/survey/all', (req, res, next) => {
        req.webformType = 'all';
        next();
    })
    .all('/surveys/list', (req, res, next) => {
        req.webformType = 'all';
        next();
    })
    .all('/instance*', (req, res, next) => {
        req.webformType = 'edit';
        next();
    })
    .all('/survey/single*', (req, res, next) => {
        req.webformType = 'single';
        next();
    })
    .all('/survey/single/once*', (req, res, next) => {
        req.multipleAllowed = false;
        next();
    })
    .all('/survey/view*', (req, res, next) => {
        req.webformType = 'view';
        next();
    })
    .all('/instance/view*', (req, res, next) => {
        req.webformType = 'view-instance';
        next();
    })
    .all('*/pdf', (req, res, next) => {
        req.webformType = 'pdf';
        next();
    })
    .all('/survey/offline*', (req, res, next) => {
        if (req.app.get('offline enabled')) {
            req.webformType = 'offline';
            next();
        } else {
            const error = new Error('Not Allowed.');
            error.status = 405;
            next(error);
        }
    })
    .all('*', _setReturnQueryParam)
    .all('*', _setGoToHash)
    .get('/survey', getExistingSurvey)
    .get('/survey/offline', getExistingSurvey)
    .get('/survey/iframe', getExistingSurvey)
    .post('/survey', getNewOrExistingSurvey)
    .post('/survey/offline', getNewOrExistingSurvey)
    .post('/survey/iframe', getNewOrExistingSurvey)
    .delete('/survey', deactivateSurvey)
    .delete('/survey/cache', emptySurveyCache)
    .get('/survey/single', getExistingSurvey)
    .get('/survey/single/iframe', getExistingSurvey)
    .get('/survey/single/once', getExistingSurvey)
    .get('/survey/single/once/iframe', getExistingSurvey)
    .post('/survey/single', getNewOrExistingSurvey)
    .post('/survey/single/iframe', getNewOrExistingSurvey)
    .post('/survey/single/once', getNewOrExistingSurvey)
    .post('/survey/single/once/iframe', getNewOrExistingSurvey)
    .get('/survey/preview', getExistingSurvey)
    .get('/survey/preview/iframe', getExistingSurvey)
    .post('/survey/preview', getNewOrExistingSurvey)
    .post('/survey/preview/iframe', getNewOrExistingSurvey)
    .get('/survey/view', getExistingSurvey)
    .get('/survey/view/iframe', getExistingSurvey)
    .post('/survey/view', getNewOrExistingSurvey)
    .post('/survey/view/iframe', getNewOrExistingSurvey)
    .get('/survey/view/pdf', getExistingSurvey)
    .post('/survey/view/pdf', getNewOrExistingSurvey)
    .get('/survey/all', getExistingSurvey)
    .post('/survey/all', getNewOrExistingSurvey)
    .get('/surveys/number', getNumber)
    .post('/surveys/number', getNumber)
    .get('/surveys/list', getList)
    .post('/surveys/list', getList)
    .post('/instance', cacheInstance)
    .post('/instance/iframe', cacheInstance)
    .post('/instance/view', cacheInstance)
    .post('/instance/view/iframe', cacheInstance)
    .post('/instance/view/pdf', cacheInstance)
    .delete('/instance', removeInstance)
    .all('*', (req, res, next) => {
        const error = new Error('Not allowed.');
        error.status = 405;
        next(error);
    });

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 */
function getVersion(req, res) {
    const version = req.app.get('version');
    _render(200, { version }, res);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function authCheck(req, res, next) {
    // check authentication and account
    const creds = auth(req);
    const key = creds ? creds.name : undefined;
    const server = req.body.server_url || req.query.server_url;

    // set content-type to json to provide appropriate json Error responses
    res.set('Content-Type', 'application/json');

    account
        .get(server)
        .then((account) => {
            if (!key || key !== account.key) {
                const error = new Error('Not Allowed. Invalid API key.');
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
                const status = 200;
                if (req.webformType === 'pdf') {
                    _renderPdf(status, id, req, res);
                } else {
                    _render(status, _generateWebformUrls(id, req), res);
                }
            } else {
                _render(404, 'Survey not found.', res);
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
        theme: req.body.theme || req.query.theme,
    };

    if (req.account.quota < req.account.quotaUsed) {
        return _render(403, quotaErrorMessage, res);
    }

    return surveyModel
        .getId(survey) // will return id only for existing && active surveys
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
                    if (req.webformType === 'pdf') {
                        _renderPdf(status, id, req, res);
                    } else {
                        _render(status, _generateWebformUrls(id, req), res);
                    }
                } else {
                    _render(404, 'Survey not found.', res);
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
                _render(404, 'Survey not found.', res);
            }
        })
        .catch(next);
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function emptySurveyCache(req, res, next) {
    return cacheModel
        .flush({
            openRosaServer: req.body.server_url,
            openRosaId: req.body.form_id,
        })
        .then(() => {
            _render(204, null, res);
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
                _render(404, 'No surveys found.', res);
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
    let enketoId;

    if (req.account.quota < req.account.quotaUsed) {
        return _render(403, quotaErrorMessage, res);
    }

    const survey = {
        openRosaServer: req.body.server_url,
        openRosaId: req.body.form_id,
        instance: req.body.instance,
        instanceId: req.body.instance_id,
        returnUrl: req.body.return_url,
        instanceAttachments: req.body.instance_attachments,
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
            // If the API call is for /instance/edit/*, make sure
            // to not allow caching if it is already cached as some lame
            // protection against multiple people edit the same record simultaneously
            const protect = req.webformType === 'edit';

            return instanceModel.set(survey, protect);
        })
        .then(() => {
            const status = 201;
            if (req.webformType === 'pdf') {
                _renderPdf(status, enketoId, req, res);
            } else {
                _render(status, _generateWebformUrls(enketoId, req), res);
            }
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
                _render(404, 'Record not found.', res);
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
function _setPage(req, res, next) {
    req.page = {};
    req.page.format = req.body.format || req.query.format;
    if (
        req.page.format &&
        !/^(Letter|Legal|Tabloid|Ledger|A0|A1|A2|A3|A4|A5|A6)$/.test(
            req.page.format
        )
    ) {
        const error = new Error('Format parameter is not valid.');
        error.status = 400;
        throw error;
    }
    req.page.landscape = req.body.landscape || req.query.landscape;
    if (req.page.landscape && !/^(true|false)$/.test(req.page.landscape)) {
        const error = new Error('Landscape parameter is not valid.');
        error.status = 400;
        throw error;
    }
    // convert to boolean
    req.page.landscape = req.page.landscape === 'true';
    req.page.margin = req.body.margin || req.query.margin;
    if (req.page.margin && !/^\d+(\.\d+)?(in|cm|mm)$/.test(req.page.margin)) {
        const error = new Error('Margin parameter is not valid.');
        error.status = 400;
        throw error;
    }
    /*
    TODO: scale has not been enabled yet, as it is not supported by Enketo Core's Grid print JS processing function.
    req.page.scale = req.body.scale || req.query.scale;
    if ( req.page.scale && !/^\d+$/.test( req.page.scale ) ) {
        const error = new Error( 'Scale parameter is not valid.' );
        error.status = 400;
        throw error;
    }
    // convert to number
    req.page.scale = Number( req.page.scale );
    */
    next();
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function _setDefaultsQueryParam(req, res, next) {
    let queryParam = '';
    const map = req.body.defaults || req.query.defaults;

    if (map) {
        for (const prop in map) {
            if (Object.prototype.hasOwnProperty.call(map, prop)) {
                const paramKey = `d[${decodeURIComponent(prop)}]`;
                queryParam += `${encodeURIComponent(
                    paramKey
                )}=${encodeURIComponent(decodeURIComponent(map[prop]))}&`;
            }
        }
        req.defaultsQueryParam = queryParam.substring(0, queryParam.length - 1);
    }

    next();
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function _setGoToHash(req, res, next) {
    const goTo = req.body.go_to || req.query.go_to;
    req.goTo = goTo ? `#${encodeURIComponent(goTo)}` : '';

    next();
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function _setIframe(req, res, next) {
    const parentWindowOrigin =
        req.body.parent_window_origin || req.query.parent_window_origin;

    req.iframe = true;
    if (parentWindowOrigin) {
        req.parentWindowOriginParam = `parent_window_origin=${encodeURIComponent(
            decodeURIComponent(parentWindowOrigin)
        )}`;
    }
    next();
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function _setReturnQueryParam(req, res, next) {
    const returnUrl = req.body.return_url || req.query.return_url;

    if (returnUrl) {
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
    const OFFLINEPATH = 'x/';
    const hash = req.goTo;
    const iframePart = req.iframe ? IFRAMEPATH : '';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.headers.host}${req.app.get(
        'base path'
    )}/`;
    const idPartOnce = `${utils.insecureAes192Encrypt(id, keys.singleOnce)}`;
    const idPartView = `${utils.insecureAes192Encrypt(id, keys.view)}`;
    let queryParts;

    req.webformType = req.webformType || 'default';

    switch (req.webformType) {
        case 'preview':
            queryString = _generateQueryString([
                req.defaultsQueryParam,
                req.parentWindowOriginParam,
            ]);
            obj[
                `preview${iframePart ? '_iframe' : ''}_url`
            ] = `${baseUrl}preview/${iframePart}${id}${queryString}${hash}`;
            // Keep in a bug since apps probably started relying on this.

            if (iframePart) {
                obj.preview_url = obj.preview_iframe_url;
            }
            break;
        case 'edit':
            // no defaults query parameter in edit view
            queryString = _generateQueryString([
                `instance_id=${req.body.instance_id}`,
                req.parentWindowOriginParam,
                req.returnQueryParam,
            ]);
            obj.edit_url = `${baseUrl}edit/${iframePart}${id}${queryString}${hash}`;
            break;
        case 'single':
            queryParts = [req.defaultsQueryParam, req.returnQueryParam];
            if (iframePart) {
                queryParts.push(req.parentWindowOriginParam);
            }
            queryString = _generateQueryString(queryParts);
            obj[
                `single${req.multipleAllowed === false ? '_once' : ''}${
                    iframePart ? '_iframe' : ''
                }_url`
            ] = `${baseUrl}single/${iframePart}${
                req.multipleAllowed === false ? idPartOnce : id
            }${queryString}`;
            break;
        case 'view':
        case 'view-instance':
            queryParts = [];
            if (req.webformType === 'view-instance') {
                queryParts.push(`instance_id=${req.body.instance_id}`);
            }
            if (iframePart) {
                queryParts.push(req.parentWindowOriginParam);
            }
            queryParts.push(req.returnQueryParam);
            queryString = _generateQueryString(queryParts);
            obj[
                `view${iframePart ? '_iframe' : ''}_url`
            ] = `${baseUrl}view/${iframePart}${idPartView}${queryString}${hash}`;
            break;
        case 'pdf':
            queryParts = req.body.instance_id
                ? [`instance_id=${req.body.instance_id}`]
                : [];
            queryParts.push('print=true');
            queryString = _generateQueryString(queryParts);
            obj.pdf_url = `${baseUrl}${
                req.body.instance_id ? `view/${idPartView}` : id
            }${queryString}`;
            break;
        case 'all':
            // non-iframe views
            queryString = _generateQueryString([req.defaultsQueryParam]);
            obj.url = baseUrl + id + queryString;
            obj.single_url = `${baseUrl}single/${id}${queryString}`;
            obj.single_once_url = `${baseUrl}single/${idPartOnce}${queryString}`;
            obj.offline_url = baseUrl + OFFLINEPATH + id;
            obj.preview_url = `${baseUrl}preview/${id}${queryString}`;
            // iframe views
            queryString = _generateQueryString([
                req.defaultsQueryParam,
                req.parentWindowOriginParam,
            ]);
            obj.iframe_url = baseUrl + IFRAMEPATH + id + queryString;
            obj.single_iframe_url = `${baseUrl}single/${IFRAMEPATH}${id}${queryString}`;
            obj.single_once_iframe_url = `${baseUrl}single/${IFRAMEPATH}${idPartOnce}${queryString}`;
            obj.preview_iframe_url = `${baseUrl}preview/${IFRAMEPATH}${id}${queryString}`;
            // rest
            obj.enketo_id = id;
            break;
        case 'offline':
            obj.offline_url = baseUrl + OFFLINEPATH + id;
            break;
        default:
            queryString = _generateQueryString([
                req.defaultsQueryParam,
                req.parentWindowOriginParam,
            ]);
            if (iframePart) {
                obj.iframe_url = baseUrl + iframePart + id + queryString;
            } else {
                obj.url = baseUrl + id + queryString;
            }

            break;
    }

    return obj;
}

/**
 * @param { number } status - HTTP status code
 * @param { object|string } body - response body
 * @param { module:api-controller~ExpressResponse } res - HTTP response
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

/**
 * @param { number } status - HTTP status code
 * @param { string } id - Enketo ID of survey
 * @param { module:api-controller~ExpressRequest } req - HTTP request
 * @param { module:api-controller~ExpressResponse } res - HTTP response
 */
function _renderPdf(status, id, req, res) {
    const url = _generateWebformUrls(id, req).pdf_url;

    return pdf
        .get(url, req.page)
        .then((pdfBuffer) => {
            const filename = `${req.body.form_id || req.query.form_id}${
                req.body.instance_id ? `-${req.body.instance_id}` : ''
            }.pdf`;
            // TODO: We've already set to json content-type in authCheck. This may be bad.
            res.set('Content-Type', 'application/pdf')
                .set('Content-disposition', `attachment;filename=${filename}`)
                .status(status)
                .end(pdfBuffer, 'binary');
        })
        .catch((e) => {
            _render(
                e.status || 500,
                `PDF generation failed: ${e.message}`,
                res
            );
        });
}
