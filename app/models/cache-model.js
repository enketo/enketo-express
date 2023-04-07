/**
 * @module cache-model
 */

const transformer = require('enketo-transformer');
const { promisify } = require('util');
const { cacheClient } = require('../lib/db');
const utils = require('../lib/utils');

const prefix = 'ca:';
const expiry = 30 * 24 * 60 * 60;
const debug = require('debug')('enketo:cache-model');

const clientGet = promisify(cacheClient.get).bind(cacheClient);
const clientSet = promisify(cacheClient.set).bind(cacheClient);
const expire = promisify(cacheClient.expire).bind(cacheClient);

/**
 * Gets an item from the cache.
 *
 * @static
 * @name get
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return {Promise<Error|null|module:survey-model~SurveyObject>} Promise that resolves with cached {@link module:survey-model~SurveyObject|SurveyObject} or `null`
 */
function getSurvey(survey) {
    return new Promise((resolve, reject) => {
        if (!survey || !survey.openRosaServer || !survey.openRosaId) {
            const error = new Error(
                'Bad Request. Survey information to perform cache lookup is not complete.'
            );
            error.status = 400;
            reject(error);
        } else {
            const key = _getKey(survey);

            cacheClient.hgetall(key, (error, cacheObj) => {
                if (error) {
                    reject(error);
                } else if (!cacheObj) {
                    resolve(null);
                } else {
                    // form is 'actively used' so we're resetting the cache expiry
                    debug('cache is up to date and used, resetting expiry');
                    cacheClient.expire(key, expiry);
                    survey.form = cacheObj.form;
                    survey.model = cacheObj.model;
                    survey.formHash = cacheObj.formHash;
                    survey.xslHash = cacheObj.xslHash;
                    survey.languageMap = JSON.parse(
                        cacheObj.languageMap || '{}'
                    );
                    resolve(survey);
                }
            });
        }
    });
}

/**
 * Gets the hashes of an item from the cache.
 *
 * @static
 * @name getHashes
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return {Promise<Error|module:survey-model~SurveyObject>} Promise that resolves with {@link module:survey-model~SurveyObject|SurveyObject} (updated with hash array if such exist)
 */
function getSurveyHashes(survey) {
    return new Promise((resolve, reject) => {
        if (!survey || !survey.openRosaServer || !survey.openRosaId) {
            const error = new Error(
                'Bad Request. Survey information to perform cache lookup is not complete.'
            );
            error.status = 400;
            reject(error);
        } else {
            const key = _getKey(survey);

            cacheClient.hmget(
                key,
                ['formHash', 'xslHash'],
                (error, hashArr) => {
                    if (error) {
                        reject(error);
                    } else if (!hashArr || !hashArr[0] || !hashArr[1]) {
                        resolve(survey);
                    } else {
                        survey.formHash = hashArr[0];
                        survey.xslHash = hashArr[1];
                        resolve(survey);
                    }
                }
            );
        }
    });
}

/**
 * Checks if cache is present and up to date
 *
 * @static
 * @name check
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return {Promise<Error|null|boolean>} a Promise that resolves with a boolean
 */
function isCacheUpToDate(survey) {
    return new Promise((resolve, reject) => {
        if (
            !survey ||
            !survey.openRosaServer ||
            !survey.openRosaId ||
            !survey.info.hash
        ) {
            const error = new Error(
                'Bad Request. Survey information to perform cache check is not complete.'
            );
            error.status = 400;
            reject(error);
        } else {
            // clean up the survey object to make sure no artefacts of cached survey are present
            survey = {
                openRosaServer: survey.openRosaServer,
                openRosaId: survey.openRosaId,
                info: {
                    hash: survey.info.hash,
                },
                manifest: survey.manifest,
            };

            const key = _getKey(survey);

            cacheClient.hgetall(key, (error, cacheObj) => {
                if (error) {
                    reject(error);
                } else if (!cacheObj) {
                    debug('cache is missing');
                    resolve(null);
                } else {
                    // Adding the hashes to the referenced survey object can be efficient, since this object
                    // is passed around. The hashes may therefore already have been calculated
                    // when setting the cache later on.
                    // Note that this server cache only cares about media URLs, not media content.
                    // This allows the same cache to be used for a form for the OpenRosa server serves different media content,
                    // e.g. based on the user credentials.
                    _addHashes(survey);
                    if (
                        cacheObj.formHash !== survey.formHash ||
                        cacheObj.xslHash !== survey.xslHash ||
                        cacheObj.mediaUrlHash
                    ) {
                        debug('cache is obsolete');
                        resolve(false);
                    } else {
                        debug('cache is up to date');
                        resolve(true);
                    }
                }
            });
        }
    });
}

/**
 * Adds an item to the cache
 *
 * @static
 *
 * @name set
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return {Promise<Error|module:survey-model~SurveyObject>} a Promise that resolves with the survey object
 */
function setSurvey(survey) {
    return new Promise((resolve, reject) => {
        if (
            !survey ||
            !survey.openRosaServer ||
            !survey.openRosaId ||
            !survey.info.hash ||
            !survey.form ||
            !survey.model
        ) {
            const error = new Error(
                'Bad Request. Survey information to cache is not complete.'
            );
            error.status = 400;
            reject(error);
        } else {
            _addHashes(survey);
            const obj = {
                formHash: survey.formHash,
                xslHash: survey.xslHash,
                form: survey.form,
                model: survey.model,
                // The mediaUrlHash property is an artefact and no longer used.
                // When hmset updates the database it would keep it in place, so we explicitly set it to empty.s
                mediaUrlHash: '',
                languageMap: JSON.stringify(survey.languageMap || {}),
            };

            const key = _getKey(survey);

            cacheClient.hmset(key, obj, (error) => {
                if (error) {
                    reject(error);
                } else {
                    debug('cache has been updated');
                    // expire in 30 days
                    cacheClient.expire(key, expiry);
                    resolve(survey);
                }
            });
        }
    });
}

/**
 * Flushes the cache of a single survey
 *
 * @static
 * @name flush
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return {Promise<Error|module:survey-model~SurveyObject>} Flushed {@link module:survey-model~SurveyObject|SurveyObject}
 */
function flushSurvey(survey) {
    return new Promise((resolve, reject) => {
        if (!survey || !survey.openRosaServer || !survey.openRosaId) {
            const error = new Error(
                'Bad Request. Survey information to cache is not complete.'
            );
            error.status = 400;
            reject(error);
        } else {
            const key = _getKey(survey);

            cacheClient.hgetall(key, (error, cacheObj) => {
                if (error) {
                    reject(error);
                } else if (!cacheObj) {
                    error = new Error('Survey cache not found.');
                    error.status = 404;
                    reject(error);
                } else {
                    cacheClient.del(key, (error) => {
                        if (error) {
                            reject(error);
                        } else {
                            delete survey.form;
                            delete survey.model;
                            delete survey.formHash;
                            delete survey.xslHash;
                            delete survey.mediaHash;
                            delete survey.mediaUrlHash;
                            delete survey.languageMap;
                            resolve(survey);
                        }
                    });
                }
            });
        }
    });
}

/**
 * Completely empties the cache
 *
 * @static
 * @return {Promise<Error|boolean>} Promise that resolves `true` after all cache is flushed
 */
function flushAll() {
    return new Promise((resolve, reject) => {
        // TODO: "Don't use KEYS in your regular application code"
        // (https://redis.io/commands/keys)
        cacheClient.keys(`${prefix}*`, (error, keys) => {
            if (error) {
                reject(error);
            }
            keys.forEach((key) => {
                cacheClient.del(key, (error) => {
                    if (error) {
                        console.error(error);
                    }
                });
            });
            // TODO: use Promise.All to resolve when all deletes have completed.
            resolve(true);
        });
    });
}

/**
 * Gets the key used for the cache item
 *
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @return {string|null} openRosaKey or `null`
 *
 */
function _getKey(survey) {
    const openRosaKey = utils.getOpenRosaKey(survey, prefix);

    return openRosaKey || null;
}

/**
 * Adds the 3 relevant hashes to the survey object if they haven't been added already.
 *
 * @param {module:survey-model~SurveyObject} survey - survey object
 *
 */
function _addHashes(survey) {
    survey.formHash = survey.formHash || survey.info.hash;
    survey.xslHash = survey.xslHash || transformer.version;
}

/**
 * @param {string} mediaURL
 * @param {string} hostURL
 */
const cacheManifestItem = async (mediaURL, hostURL) => {
    const key = `${prefix}${mediaURL}`;

    await clientSet(key, hostURL);
    await expire('GT', 10);

    return [key, hostURL];
};

const getManifestItem = (mediaURL) => {
    const key = `${prefix}${mediaURL}`;

    return clientGet(key);
};

module.exports = {
    get: getSurvey,
    getHashes: getSurveyHashes,
    set: setSurvey,
    check: isCacheUpToDate,
    flush: flushSurvey,
    flushAll,
    cacheManifestItem,
    getManifestItem,
};
