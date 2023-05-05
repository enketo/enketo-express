/**
 * @module survey-model
 */

const { mainClient } = require('../lib/db');
const utils = require('../lib/utils');
const TError = require('../lib/custom-error').TranslatedError;
const config = require('./config-model').server;

const pending = {};
const debug = require('debug')('enketo:survey-model');

/**
 * @typedef {import('./account-model').AccountObj} AccountObj
 */

/**
 * @typedef {import('./account-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('libxmljs').Document} XMLJSDocument
 */

/**
 * @typedef {Function} EnketoTransformerPreprocess
 * @param {XMLJSDocument} doc
 * @return {XMLJSDocument}
 */

/**
 * @typedef SurveyCredentials
 * @property { string } user
 * @property { string } pass
 * @property { string } bearer
 */

/**
 * @typedef SurveyExternalData Note: a survey's `externalData` may include data from
 *   that survey's {@link https://getodk.github.io/xforms-spec/#virtual-endpoints last-saved virtual endpoint}
 *   when referenced in the survey's model. If the survey does not yet have a last-saved
 *   record, those references will be populated by default with the survey's model.
 * @property { string } id
 * @property { string } src
 * @property { string | Document } xml
 */
/**
 * @typedef SurveyInfo
 * @property { string } downloadUrl
 * @property { string } manifestUrl
 */

/**
 * @typedef ManifestItem
 * @property {string} downloadUrl
 * @property {string} filename
 * @property {string} hash
 */

/**
 * @typedef SurveyObject
 * @property { string } openRosaServer
 * @property { string } openRosaId
 * @property { string } enketoId
 * @property { string } theme
 * @property { SurveyInfo } [info]
 * @property { AccountObj } [account]
 * @property { boolean | 'true' | 'false' } [active]
 * @property { string } [cookie]
 * @property { SurveyCredentials } [credentials]
 * @property { string } [customParam]
 * @property { Array<SurveyExternalData | undefined> } [externalData]
 * @property { string } [form]
 * @property { string } [formHash]
 * @property { EnketoRecord } [instance]
 * @property { Array<string | object> } [instanceAttachments]
 * @property { string } [instanceId]
 * @property { EnketoRecord } [lastSavedRecord]
 * @property { Record<string, unknown> } [languageMap]
 * @property { ManifestItem[] } [manifest]
 * @property { string } [model]
 * @property { EnketoTransformerPreprocess } [preprocess]
 * @property { string } [returnUrl]
 * @property { string } [xslHash]
 * @description
 *   `SurveyObject` is Enketo's internal representation of an XForm, with some
 *   additional properties representing resolved/deserialized external data.
 *   This type definition captures the current state of "what is"—i.e. the full
 *   known set of properties which may be added to a `SurveyObject` through
 *   several data flow paths throught enketo-express. Some related resources,
 *   notably those describing instances, are only populated in paths specific
 *   to the interaction between a `SurveyObject` and those resources.
 */

/**
 * Returns the information stored in the database for an enketo id.
 *
 * @static
 * @name get
 * @function
 * @param { string } id - Survey ID
 * @return {Promise<SurveyObject>} Promise that resolves with a survey object
 */
function getSurvey(id) {
    return new Promise((resolve, reject) => {
        if (!id) {
            const error = new Error(new Error('Bad request. Form ID required'));
            error.status = 400;
            reject(error);
        } else {
            // get from db the record with key: "id:"+id
            mainClient.hgetall(`id:${id}`, (error, obj) => {
                if (error) {
                    reject(error);
                } else if (
                    !obj ||
                    obj.active === 'false' ||
                    obj.active === false
                ) {
                    // currently false is stored as 'false' but in the future node_redis might convert back to false
                    // https://github.com/mranney/node_redis/issues/449
                    error = !obj
                        ? new TError('error.surveyidnotfound')
                        : new TError('error.surveyidnotactive');
                    error.status = 404;
                    reject(error);
                } else if (!obj.openRosaId || !obj.openRosaServer) {
                    error = new Error(
                        'Survey information for this id is incomplete.'
                    );
                    error.status = 406;
                    reject(error);
                } else {
                    // debug( 'object retrieved from database for id "' + id + '"', obj );
                    obj.enketoId = id;
                    // no need to wait for result of updating lastAccessed
                    mainClient.hset(
                        `id:${id}`,
                        'lastAccessed',
                        new Date().toISOString()
                    );
                    resolve(obj);
                }
            });
        }
    });
}

/**
 * Function for updating or creating a survey
 *
 * @static
 * @name set
 * @function
 * @param {SurveyObject} survey - survey object
 * @return {Promise<Error|string>} Promise that eventually resolves with Survey ID
 */
function setSurvey(survey) {
    return new Promise((resolve, reject) => {
        // Set in db:
        // a) a record with key "id:"+ _createEnketoId(mainClient.incr('surveys:counter')) and all survey info
        // b) a record with key "or:"+ _createOpenRosaKey(survey.openRosaUrl, survey.openRosaId) and the enketo_id
        let error;
        const openRosaKey = utils.getOpenRosaKey(survey);
        if (!openRosaKey) {
            error = new Error(
                'Bad request. Survey information not complete or invalid'
            );
            error.status = 400;
            reject(error);
        } else if (pending[openRosaKey]) {
            error = new Error(
                'Conflict. Busy handling pending request for same survey'
            );
            error.status = 409;
            reject(error);
        } else {
            // to avoid issues with fast consecutive requests
            pending[openRosaKey] = true;

            _getEnketoId(openRosaKey)
                .then((id) => {
                    if (id) {
                        survey.active = true;
                        delete pending[openRosaKey];
                        resolve(_updateProperties(id, survey));
                    } else {
                        resolve(_addSurvey(openRosaKey, survey));
                    }
                })
                .catch((error) => {
                    delete pending[openRosaKey];
                    reject(error);
                });
        }
    });
}

/**
 * @static
 * @name update
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return {Promise<Error|string>} Promise that resolves with survey ID
 */
function updateSurvey(survey) {
    return new Promise((resolve, reject) => {
        const openRosaKey = utils.getOpenRosaKey(survey);
        let error;
        if (!openRosaKey) {
            error = new Error(
                'Bad request. Survey information not complete or invalid'
            );
            error.status = 400;
            reject(error);
        } else {
            _getEnketoId(openRosaKey)
                .then((id) => {
                    if (id) {
                        resolve(_updateProperties(id, survey));
                    } else {
                        error = new Error('Survey not found.');
                        error.status = 404;
                        reject(error);
                    }
                })
                .catch((error) => {
                    reject(error);
                });
        }
    });
}

/**
 * @param { string } id - Survey ID
 * @param {module:survey-model~SurveyObject} survey - New survey
 * @return {Promise<Error|string>} Promise that resolves with survey ID
 */
function _updateProperties(id, survey) {
    return new Promise((resolve, reject) => {
        const update = {};
        // create new object only including the updateable properties
        if (typeof survey.openRosaServer !== 'undefined') {
            update.openRosaServer = survey.openRosaServer;
        }
        if (typeof survey.active !== 'undefined') {
            update.active = survey.active;
        }
        // always update the theme, which will delete it if the theme parameter is missing
        // avoid storing undefined as string 'undefined'
        update.theme = survey.theme || '';

        mainClient.hmset(`id:${id}`, update, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve(id);
            }
        });
    });
}

/**
 * @param { string } openRosaKey -
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return {Promise<Error|string>} Promise that eventually resolves with survey ID
 */
function _addSurvey(openRosaKey, survey) {
    // survey:counter no longer serves any purpose, after https://github.com/kobotoolbox/enketo-express/issues/481
    return _createNewEnketoId().then(
        (id) =>
            new Promise((resolve, reject) => {
                mainClient
                    .multi()
                    .hmset(`id:${id}`, {
                        // explicitly set the properties that need to be saved
                        // this will avoid accidentally saving e.g. transformation results and cookies
                        openRosaServer: survey.openRosaServer,
                        openRosaId: survey.openRosaId,
                        submissions: 0,
                        launchDate: new Date().toISOString(),
                        active: true,
                        // avoid storing string 'undefined'
                        theme: survey.theme || '',
                    })
                    .set(openRosaKey, id)
                    .exec((error) => {
                        delete pending[openRosaKey];
                        if (error) {
                            reject(error);
                        } else {
                            resolve(id);
                        }
                    });
            })
    );
}

/**
 * @static
 * @name incrementSubmissions
 * @function
 * @param { string } id - Survey ID
 * @return {Promise<Error|string>} Promise that eventually resolves with survey ID
 */
function incrSubmissions(id) {
    return new Promise((resolve, reject) => {
        mainClient
            .multi()
            .incr('submission:counter')
            .hincrby(`id:${id}`, 'submissions', 1)
            .exec((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(id);
                }
            });
    });
}

/**
 * @static
 * @name getNumber
 * @function
 * @param { string } server - Server URL
 * @return {Promise<Error|string|number>} Promise that resolves with number of surveys
 */
function getNumberOfSurveys(server) {
    return new Promise((resolve, reject) => {
        let error;
        const cleanServerUrl = server === '' ? '' : utils.cleanUrl(server);
        if (!cleanServerUrl && cleanServerUrl !== '') {
            error = new Error('Survey information not complete or invalid');
            error.status = 400;
            reject(error);
        } else {
            // TODO: "Don't use KEYS in your regular application code"
            // (https://redis.io/commands/keys)
            mainClient.keys(`or:${cleanServerUrl}[/,]*`, (err, keys) => {
                if (error) {
                    reject(error);
                } else if (keys) {
                    _getActiveSurveys(keys)
                        .then((surveys) => {
                            resolve(surveys.length);
                        })
                        .catch(reject);
                } else {
                    debug('no replies when obtaining list of surveys');
                    reject('no surveys');
                }
            });
        }
    });
}

/**
 * @static
 * @name getList
 * @function
 * @param { string } server - Server URL
 * @return {Promise<Error|Array<SurveyObject>>} Promise that resolves with a list of SurveyObjects
 */
function getListOfSurveys(server) {
    return new Promise((resolve, reject) => {
        let error;
        const cleanServerUrl = server === '' ? '' : utils.cleanUrl(server);
        if (!cleanServerUrl && cleanServerUrl !== '') {
            error = new Error('Survey information not complete or invalid');
            error.status = 400;
            reject(error);
        } else {
            // TODO: "Don't use KEYS in your regular application code"
            // (https://redis.io/commands/keys)
            mainClient.keys(`or:${cleanServerUrl}[/,]*`, (err, keys) => {
                if (error) {
                    reject(error);
                } else if (keys) {
                    _getActiveSurveys(keys)
                        .then((surveys) => {
                            surveys.sort(_ascendingLaunchDate);
                            const list = surveys.map((survey) => ({
                                openRosaServer: survey.openRosaServer,
                                openRosaId: survey.openRosaId,
                                enketoId: survey.enketoId,
                            }));

                            resolve(list);
                        })
                        .catch(reject);
                } else {
                    debug('no replies when obtaining list of surveys');
                    reject('no surveys');
                }
            });
        }
    });
}

/**
 * @param { string } openRosaKey - database key of survey
 * @return {Promise<Error|null|string>} Promise that resolves with survey ID
 */
function _getEnketoId(openRosaKey) {
    return new Promise((resolve, reject) => {
        if (!openRosaKey) {
            const error = new Error(
                'Survey information not complete or invalid'
            );
            error.status = 400;
            reject(error);
        } else {
            // debug( 'getting id for : ' + openRosaKey );
            mainClient.get(openRosaKey, (error, id) => {
                // debug( 'result', error, id );
                if (error) {
                    reject(error);
                } else if (id === '') {
                    error = new Error('ID for this survey is missing');
                    error.status = 406;
                    reject(error);
                } else if (id) {
                    resolve(id);
                } else {
                    resolve(null);
                }
            });
        }
    });
}

/**
 * @static
 * @name getId
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return {Promise<Error|null|string>} Promise that resolves with survey ID
 */
function getEnketoIdFromSurveyObject(survey) {
    const openRosaKey = utils.getOpenRosaKey(survey);

    return _getEnketoId(openRosaKey);
}

/**
 * @param { Array<string> } openRosaIds - A list of `openRosaId`s
 * @return { Promise<SurveyObject> } a Promise that resolves with a list of survey objects
 */
function _getActiveSurveys(openRosaIds) {
    const tasks = openRosaIds.map((openRosaId) => _getEnketoId(openRosaId));

    return Promise.all(tasks)
        .then((ids) =>
            ids.map(
                (
                    id // getSurvey rejects with 404 status if survey is not active
                ) => getSurvey(id).catch(_404Empty)
            )
        )
        .then((tasks) => Promise.all(tasks))
        .then((surveys) => surveys.filter(_nonEmpty));
}

/**
 * Generates a new random Enketo ID that has not been used yet, or checks whether a provided id has not been used.
 * 8 characters keeps the chance of collisions below about 10% until about 10,000,000 IDs have been generated
 *
 * @static
 * @name createNewEnketoId
 * @function
 * @param { string } [id] - This is only really included to write tests for collissions or a future "vanity ID" feature
 * @param { number } [triesRemaining] - Avoid infinite loops when collissions become the norm.
 * @return {Promise<Error|string|Promise>} a Promise that resolves with a new unique Enketo ID
 */
function _createNewEnketoId(
    id = utils.randomString(config['id length']),
    triesRemaining = 10
) {
    return new Promise((resolve, reject) => {
        mainClient.hgetall(`id:${id}`, (error, obj) => {
            if (error) {
                reject(error);
            } else if (obj) {
                if (triesRemaining--) {
                    resolve(_createNewEnketoId(undefined, triesRemaining));
                } else {
                    const error = new Error(
                        'Failed to create unique Enketo ID.'
                    );
                    error.status = 500;
                    reject(error);
                }
            } else {
                resolve(id);
            }
        });
    });
}

/**
 * Function for launch date comparison
 *
 * @param {module:survey-model~SurveyObject} a - a survey object
 * @param {module:survey-model~SurveyObject} b - a survey object
 * @return {number} difference in launch date as a number
 */
function _ascendingLaunchDate(a, b) {
    return new Date(a.launchDate) - new Date(b.launchDate);
}

/**
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return { boolean } Whether survey has openRosaId
 */
function _nonEmpty(survey) {
    return !!survey.openRosaId;
}

/**
 * @param {Error} error - error object
 * @return { object } Empty object for `404` errors; throws normally for other
 */
function _404Empty(error) {
    if (error && error.status && error.status === 404) {
        return {};
    }
    throw error;
}

module.exports = {
    get: getSurvey,
    set: setSurvey,
    update: updateSurvey,
    getId: getEnketoIdFromSurveyObject,
    getNumber: getNumberOfSurveys,
    getList: getListOfSurveys,
    incrementSubmissions: incrSubmissions,
    createNewEnketoId: _createNewEnketoId,
};
