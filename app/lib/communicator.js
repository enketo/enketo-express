/**
 * @module communicator
 */

const request = require('request');
const { Auth } = require('request/lib/auth');
const TError = require('./custom-error').TranslatedError;
const config = require('../models/config-model').server;
const debug = require('debug')('enketo:openrosa-communicator');
const Xml2Js = require('xml2js');

const parser = new Xml2Js.Parser();
const { getCurrentRequest } = require('./context');

const TIMEOUT = config.timeout;

/**
 * Gets form info
 *
 *
 * @static
 * @param { module:survey-model~SurveyObject } survey - survey object
 * @return { Promise<module:survey-model~SurveyObject> } a Promise that resolves with a survey object with added info
 */
function getXFormInfo(survey) {
    if (!survey || !survey.openRosaServer) {
        throw new Error('No server provided.');
    }

    return _request({
        url: getFormListUrl(
            survey.openRosaServer,
            survey.openRosaId,
            survey.customParam
        ),
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie,
        },
    }).then((formListXml) => _findFormAddInfo(formListXml, survey));
}

/**
 * @typedef OpenRosaXForm
 * @property {string} descriptionText
 * @property {string} downloadUrl
 * @property {string} formID
 * @property {string} hash
 * @property {string} manifestUrl
 * @property {string} name
 * @property {string} version
 */

/**
 * Gets XForm from url
 *
 * @static
 * @param  { object } survey - survey object
 * @return { Promise<module:survey-model~SurveyObject> } a Promise that resolves with a survey object with added XForm
 */
function getXForm(survey) {
    return _request({
        url: survey.info.downloadUrl,
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie,
        },
    }).then((xform) => {
        survey.xform = xform;

        return Promise.resolve(survey);
    });
}

/**
 * Obtains the XForm manifest
 *
 * @static
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return { Promise<module:survey-model~SurveyObject> } a Promise that resolves with a survey object with added manifest
 */
function getManifest(survey) {
    if (survey.info == null || !survey.info.manifestUrl) {
        return Promise.resolve({
            ...survey,
            manifest: [],
        });
    }
    return _request({
        url: survey.info.manifestUrl,
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie,
        },
    })
        .then(_xmlToJson)
        .then((obj) => {
            survey.manifest =
                obj.manifest && obj.manifest.mediaFile
                    ? obj.manifest.mediaFile.map((file) =>
                          _simplifyFormObj(file)
                      )
                    : [];

            return survey;
        });
}

/**
 * Checks the maximum acceptable submission size the server accepts
 *
 * @static
 * @param { module:survey-model~SurveyObject } survey - survey object
 * @return { Promise<string> } promise resolving with max size stringified number
 */
function getMaxSize(survey) {
    // Using survey.xformUrl is non-standard but the only way for previews served from `?form=URL`.
    const submissionUrl = survey.openRosaServer
        ? getSubmissionUrl(survey.openRosaServer)
        : survey.info.downloadUrl;

    const options = {
        url: submissionUrl,
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie,
        },
        method: 'head',
    };

    return _request(options).then(
        (response) => response.headers['x-openrosa-accept-content-length']
    );
}

/**
 * @static
 * @param { module:survey-model~SurveyObject } survey - survey object
 * @return { Promise<module:survey-model~SurveyObject> } a promise that resolves with a survey object
 */
function authenticate(survey) {
    const options = {
        url: getFormListUrl(
            survey.openRosaServer,
            survey.openRosaId,
            survey.customParam
        ),
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie,
        },
        // Formhub has a bug and cannot use the correct HEAD method.
        method: config['linked form and data server']['legacy formhub']
            ? 'get'
            : 'head',
    };

    return _request(options).then(() => {
        debug('successful (authenticated if it was necessary)');

        return survey;
    });
}

/**
 * Generates an Auhorization header that can be used to inject into piped requests (e.g. submissions).
 *
 * @static
 * @param { string } url - URL to request
 * @param { {user: string, pass: string, bearer: string} } [credentials] - user credentials
 * @return { Promise } a promise that resolves with an auth header
 */
function getAuthHeader(url, credentials) {
    const options = {
        url,
        method: 'head',
        headers: {
            'X-OpenRosa-Version': '1.0',
            Date: new Date().toUTCString(),
        },
        timeout: TIMEOUT,
    };

    return new Promise((resolve) => {
        // Don't bother making Head request first if token was provided.
        if (credentials && credentials.bearer) {
            resolve(`Bearer ${credentials.bearer}`);
        } else {
            // Check if Basic or Digest Authorization header is required and return header if so.
            const req = request(options, (error, response) => {
                if (
                    !error &&
                    response &&
                    response.statusCode === 401 &&
                    credentials &&
                    credentials.user &&
                    credentials.pass
                ) {
                    // Using request's internal library we create an appropiate authorization header.
                    // This is a bit dangerous because internal changes in request/request, could break this code.
                    req.method = 'POST';
                    const auth = new Auth(req);
                    auth.hasAuth = true;
                    auth.user = credentials.user;
                    auth.pass = credentials.pass;
                    const authHeader = auth.onResponse(response);
                    resolve(authHeader);
                } else {
                    resolve(null);
                }
            });
        }
    });
}

/**
 * getFormListUrl
 *
 * @static
 * @param { string } server - server URL
 * @param { string } [id] - Form id.
 * @param { string } [customParam] - custom query parameter
 * @return { string } url
 */
function getFormListUrl(server, id, customParam) {
    const baseURL = server.endsWith('/') ? server : `${server}/`;

    const url = new URL('./formList', baseURL);

    if (id != null) {
        url.searchParams.set('formID', id);
    }

    if (customParam != null) {
        const customParamName = config['query parameter to pass to submission'];

        url.searchParams.set(customParamName, customParam);
    }

    return url.toString();
}

/**
 * @static
 * @param { string } server - server URL
 * @return { string } url
 */
function getSubmissionUrl(server) {
    return server.lastIndexOf('/') === server.length - 1
        ? `${server}submission`
        : `${server}/submission`;
}

/**
 * @param {string} value
 */
const sanitizeHeader = (value) =>
    value
        .trim()
        .replace(/\s+/g, ' ')
        // See https://github.com/nodejs/node/blob/3d53ff8ff0e721f908d8aff7a3709bc6dbb07ebb/lib/_http_common.js#L232
        .replace(/[^\t\x20-\x7e\x80-\xff]+/g, (match) => encodeURI(match));

/**
 * @param {Record<string, string | string[]>} [headers]
 * @param {import('express').Request} [currentRequest]
 */
const getUpdatedRequestHeaders = (
    headers = {},
    currentRequest = getCurrentRequest()
) => {
    const clientUserAgent = currentRequest?.headers['user-agent'];
    const serverUserAgent = `Enketo/${config.version}`;
    const userAgent =
        clientUserAgent == null
            ? serverUserAgent
            : `${serverUserAgent} ${clientUserAgent}`;

    return {
        ...headers,

        // The Date header is forbidden to set programmatically client-side
        // so we set it here to comply with OpenRosa
        Date: new Date().toUTCString(),
        'User-Agent': sanitizeHeader(userAgent),
        'X-OpenRosa-Version': '1.0',
    };
};

/**
 * Updates request options.
 *
 * @static
 * @param { object } options - request options
 */
function getUpdatedRequestOptions(options) {
    options.method = options.method || 'get';

    // set headers
    options.headers = getUpdatedRequestHeaders(options.headers);
    options.timeout = TIMEOUT;

    if (!options.headers.cookie) {
        // remove undefined cookie
        delete options.headers.cookie;
    }

    // set Authorization header
    if (!options.auth) {
        delete options.auth;
    } else if (!options.auth.bearer) {
        // check first is DIGEST or BASIC is required
        options.auth.sendImmediately = false;
    }

    return options;
}

/**
 * Sends a request to an OpenRosa server
 *
 * @param {{url: string}} options - request options object
 * @return { Promise } Promise
 */
function _request(options) {
    let error;

    return new Promise((resolve, reject) => {
        if (typeof options !== 'object' && !options.url) {
            error = new Error('Bad request. No options provided.');
            error.status = 400;
            reject(error);
        }

        options = getUpdatedRequestOptions(options);

        // due to a bug in request/request using options.method with Digest Auth we won't pass method as an option
        const { method } = options;
        delete options.method;

        debug(`sending ${method} request to url: ${options.url}`);

        request[method](options, (error, response, body) => {
            if (error) {
                debug(`Error occurred when requesting ${options.url}`, error);
                reject(error);
            } else if (response.statusCode === 401) {
                error = new Error('Forbidden. Authorization Required.');
                error.status = response.statusCode;
                reject(error);
            } else if (
                response.statusCode < 200 ||
                response.statusCode >= 300
            ) {
                error = new Error(`Request to ${options.url} failed.`);
                error.status = response.statusCode;
                reject(error);
            } else if (method === 'head') {
                resolve(response);
            } else {
                debug(
                    `response of request to ${options.url} has status code: `,
                    response.statusCode
                );
                resolve(body);
            }
        });
    });
}

/**
 * transform XML to JSON for easier processing
 *
 * @param { string } xml - XML string
 * @return {Promise<string|Error>} a promise that resolves with JSON
 */
function _xmlToJson(xml) {
    return new Promise((resolve, reject) => {
        parser.parseString(xml, (error, data) => {
            if (error) {
                debug('error parsing xml and converting to JSON');
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * Finds the relevant form in an OpenRosa XML formList
 *
 * @param { string } formListXml - OpenRosa XML formList
 * @param {module:survey-model~SurveyObject} survey - survey object
 * * @return { Promise } promise
 */
function _findFormAddInfo(formListXml, survey) {
    let found;
    let index;
    let error;

    return new Promise((resolve, reject) => {
        // first convert to JSON to make it easier to work with
        _xmlToJson(formListXml)
            .then((formListObj) => {
                if (formListObj.xforms && formListObj.xforms.xform) {
                    // find the form and stop looking when found
                    found = formListObj.xforms.xform.some((xform, i) => {
                        index = i;

                        return xform.formID.toString() === survey.openRosaId;
                    });
                }

                if (!found) {
                    error = new TError('error.notfoundinformlist', {
                        formId: survey.openRosaId,
                    });
                    error.status = 404;
                    reject(error);
                } else {
                    debug('found form');
                    survey.info = _simplifyFormObj(
                        formListObj.xforms.xform[index]
                    );
                    debug('survey.info', survey.info);
                    resolve(survey);
                }
            })
            .catch(reject);
    });
}

/**
 * Convert arrays property values to strings, knowing that each xml node only
 * occurs once in each xform node in /formList
 *
 * @param { object } formObj - a form object
 * @return { object } a simplified form object
 */
function _simplifyFormObj(formObj) {
    for (const prop in formObj) {
        if (
            Object.prototype.hasOwnProperty.call(formObj, prop) &&
            Object.prototype.toString.call(formObj[prop]) === '[object Array]'
        ) {
            formObj[prop] = formObj[prop][0].toString();
        }
    }

    return formObj;
}

module.exports = {
    getXFormInfo,
    getXForm,
    getManifest,
    getMaxSize,
    authenticate,
    getAuthHeader,
    getFormListUrl,
    getSubmissionUrl,
    getUpdatedRequestOptions,
    getUpdatedRequestHeaders,
};
