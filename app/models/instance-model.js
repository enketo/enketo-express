/**
 * @module instance-model
 */

const config = require('./config-model').server;
const TError = require('../lib/custom-error').TranslatedError;
const { mainClient } = require('../lib/db');
const utils = require('../lib/utils');
// var debug = require( 'debug' )( 'instance-model' );

/**
 * * @param protect
 * * @param protect
 *
 * @static
 * @name set
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @param { boolean } [protect] - whether to refuse if record is currently pending (to avoid editing conflicts)
 */
function _cacheInstance(survey, protect = true) {
    return new Promise((resolve, reject) => {
        let error;
        if (
            !survey ||
            !survey.openRosaId ||
            !survey.openRosaServer ||
            !survey.instanceId ||
            !survey.instance
        ) {
            error = new Error(
                'Bad request. Survey information not complete or invalid'
            );
            error.status = 400;
            reject(error);
        } else {
            const instanceKey = `in:${survey.instanceId}`;
            const openRosaKey = utils.getOpenRosaKey(survey);
            const instanceAttachments = survey.instanceAttachments || {};

            // first check if record exists (i.e. if it is being edited or viewed)
            mainClient.hgetall(`in:${survey.instanceId}`, (err, obj) => {
                if (err) {
                    reject(err);
                } else if (obj && protect) {
                    error = new Error(
                        'Not allowed. Record is already being edited'
                    );
                    error.status = 405;
                    reject(error);
                } else {
                    mainClient.hmset(
                        instanceKey,
                        {
                            returnUrl: survey.returnUrl || '',
                            instance: survey.instance,
                            openRosaKey,
                            instanceAttachments:
                                JSON.stringify(instanceAttachments),
                        },
                        (error) => {
                            if (error) {
                                reject(error);
                            } else {
                                // expire, no need to wait for result
                                mainClient.expire(
                                    instanceKey,
                                    config['expiry for record cache'] / 1000
                                );
                                resolve(survey);
                            }
                        }
                    );
                }
            });
        }
    });
}

/**
 * @static
 *
 * @name get
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object \n
 */
function _getInstance(survey) {
    return new Promise((resolve, reject) => {
        let error;
        if (!survey || !survey.instanceId) {
            error = new Error(
                'Bad Request. Survey information not complete or invalid'
            );
            error.status = 400;
            reject(error);
        } else {
            mainClient.hgetall(`in:${survey.instanceId}`, (err, obj) => {
                if (err) {
                    reject(err);
                } else if (!obj) {
                    error = new TError('error.instancenotfound');
                    error.status = 404;
                    reject(error);
                } else {
                    survey.instance = obj.instance;
                    survey.returnUrl = obj.returnUrl;
                    survey.openRosaKey = obj.openRosaKey;
                    survey.instanceAttachments = JSON.parse(
                        obj.instanceAttachments
                    );
                    resolve(survey);
                }
            });
        }
    });
}

/**
 * @static
 *
 * @name remove
 * @function
 * @param {module:survey-model~SurveyObject} survey - survey object \n
 */
function _removeInstance(survey) {
    return new Promise((resolve, reject) => {
        if (!survey || !survey.instanceId) {
            const error = new Error(
                'Bad request. Survey information not complete or invalid'
            );
            error.status = 400;
            reject(error);
        } else {
            mainClient.del(`in:${survey.instanceId}`, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(survey.instanceId);
                }
            });
        }
    });
}

module.exports = {
    get: _getInstance,
    set: _cacheInstance,
    remove: _removeInstance,
};
