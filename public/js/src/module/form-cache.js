/**
 * Deals with browser storage
 */

import assign from 'lodash/assign';
import store from './store';
import events from './event';
import settings from './settings';
import connection from './connection';
import {
    getLastSavedRecord,
    isLastSaveEnabled,
    populateLastSavedInstances,
    removeLastSavedRecord,
} from './last-saved';
import { replaceMediaSources } from './media';

/**
 * @typedef {import('../../../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyObject} Survey
 */

const CACHE_UPDATE_INITIAL_DELAY = 3 * 1000;
const CACHE_UPDATE_INTERVAL = 20 * 60 * 1000;

let hash;

/**
 * @param {Survey} survey
 * @return {Promise<Survey>}
 */
function init(survey) {
    return store
        .init()
        .then(() => get(survey))
        .then((result) => {
            if (result) {
                return result;
            }
            return set(survey);
        })
        .then(_processDynamicData)
        .then(setUpdateIntervals);
}

/**
 * @typedef GetSurveyOptions
 * @property {string} enketoId
 */

/**
 * @param {Survey} survey
 * @return Survey
 */
function get({ enketoId }) {
    return store.survey
        .get(enketoId)
        .then((survey) => Promise.all([survey, getLastSavedRecord(enketoId)]))
        .then(([survey, lastSavedRecord]) =>
            survey == null
                ? survey
                : populateLastSavedInstances(survey, lastSavedRecord)
        );
}

/**
 * @param {Survey} survey
 * @return {Promise<Survey>}
 */
const updateSurveyCache = (survey) =>
    (isLastSaveEnabled(survey)
        ? Promise.resolve(survey)
        : removeLastSavedRecord(survey.enketoId)
    ).then(() => store.survey.update(survey));

/**
 * @param {Survey} survey
 * @return {Promise<Survey>}
 */
function set(survey) {
    return connection
        .getFormParts(survey)
        .then(addBinaryDefaultsAndUpdateModel)
        .then(store.survey.set);
}

/**
 * @param {Survey} survey
 * @return {Promise<void>}
 */
function remove(survey) {
    return store.survey.remove(survey.enketoId);
}

/**
 * @param {Survey} survey
 * @return {Promise<Survey>}
 */
function _processDynamicData(survey) {
    // TODO: In the future this method could perhaps be used to also store
    // dynamic defaults. However, the issue would be to figure out how to clear
    // those defaults.
    if (!survey) {
        return survey;
    }

    return store.dynamicData
        .get(survey.enketoId)
        .then((data) => {
            const newData = {
                enketoId: survey.enketoId,
            };
            assign(newData, data);
            // Carefully compare settings data with stored data to determine what to update.

            // submissionParameter
            if (
                settings.submissionParameter &&
                settings.submissionParameter.name
            ) {
                if (settings.submissionParameter.value) {
                    // use the settings value
                    newData.submissionParameter = settings.submissionParameter;
                } else if (settings.submissionParameter.value === '') {
                    // delete value
                    delete newData.submissionParameter;
                } else if (
                    data &&
                    data.submissionParameter &&
                    data.submissionParameter.value
                ) {
                    // use the stored value
                    settings.submissionParameter.value =
                        data.submissionParameter.value;
                }
            } else {
                delete newData.submissionParameter;
            }

            // parentWindowOrigin
            if (typeof settings.parentWindowOrigin !== 'undefined') {
                if (settings.parentWindowOrigin) {
                    // use the settings value
                    newData.parentWindowOrigin = settings.parentWindowOrigin;
                } else if (settings.parentWindowOrigin === '') {
                    // delete value
                    delete newData.parentWindowOrigin;
                } else if (data && data.parentWindowOrigin) {
                    // use the stored value
                    settings.parentWindowOrigin = data.parentWindowOrigin;
                }
            } else {
                delete newData.parentWindowOrigin;
            }

            return store.dynamicData.update(newData);
        })
        .then(() => survey);
}

/**
 * @param {Survey} survey
 * @return {Promise<Survey>}
 */
const setUpdateIntervals = async (survey) => {
    hash = survey.hash;

    // Check for form update upon loading.
    await updateCache(survey);

    // Note that for large Xforms where the XSL transformation takes more than 30 seconds,
    // the first update make take 20 minutes to propagate to the browser of the very first user(s)
    // that open the form right after the XForm update.

    setTimeout(() => {
        updateCache(survey);
    }, CACHE_UPDATE_INITIAL_DELAY);

    // check for form update every 20 minutes
    setInterval(() => {
        updateCache(survey);
    }, CACHE_UPDATE_INTERVAL);

    return survey;
};

/**
 * Loads all default binary files and adds them to the survey object. It removes the src
 * attributes from model nodes with default binary files.
 *
 * @param { Survey } survey - survey object
 * @return { Promise<Survey> }
 */
function addBinaryDefaultsAndUpdateModel(survey) {
    // The mechanism for default binary files is as follows:
    // 1. They are stored as binaryDefaults in the resources table with the key being comprised of the VALUE (i.e. jr:// url)
    // 2. Filemanager.getFileUrl will determine whether to load from (survey) resources of (record) files

    const model = new DOMParser().parseFromString(survey.model, 'text/xml');

    replaceMediaSources(model, survey.media);

    const binaryDefaultElements = [
        ...model.querySelectorAll('instance:first-child > * *[src]'),
    ];
    const tasks = [];
    survey.binaryDefaults = [];

    binaryDefaultElements.forEach((el) => {
        tasks.push(
            connection
                .getMediaFile(el.getAttribute('src'))
                .then((result) => {
                    // Overwrite the url to use the jr://images/img.png value. This makes the magic happen.
                    // It causes a jr:// value to be treated the same as a filename.ext value.
                    result.url = el.textContent;
                    survey.binaryDefaults.push(result);
                    // Now the src attribute should be removed because the filemanager.js can return the blob for
                    // the jr://images/... key (as if it is a file).
                    el.removeAttribute('src');
                })
                .catch((e) => {
                    // let files fail quietly. Rely on Enketo Core to show error.
                    console.error(e);
                })
        );
    });

    return Promise.all(tasks).then(() => {
        survey.model = new XMLSerializer().serializeToString(model);

        return survey;
    });
}

/**
 * Updates maximum submission size if this hasn't been defined yet.
 * The first time this function is called is when the user is online.
 * If the form/data server updates their max size setting, this value
 * will be updated the next time the cache is refreshed.
 *
 * @param { Survey } survey - survey object
 * @return { Promise<Survey> }
 */
function updateMaxSubmissionSize(survey) {
    if (!survey.maxSize) {
        return connection.getMaximumSubmissionSize(survey).then((survey) => {
            if (survey.maxSize) {
                // Ignore resources. These should not be updated.
                delete survey.binaryDefaults;

                return updateSurveyCache(survey);
            }

            return survey;
        });
    }
    return Promise.resolve(survey);
}

/**
 * @param {Survey} survey
 * @return {Promise<void>}
 */
function updateCache(survey) {
    console.log('Checking for survey update...');

    return connection
        .getFormPartsHash(survey)
        .then((version) => {
            if (hash === version) {
                console.log('Cached survey is up to date!', hash);
            } else {
                console.log(
                    'Cached survey is outdated! old:',
                    hash,
                    'new:',
                    version
                );

                return connection
                    .getFormParts(survey)
                    .then((formParts) => {
                        // media will be updated next time the form is loaded if resources is undefined
                        formParts.resources = undefined;

                        return formParts;
                    })
                    .then(addBinaryDefaultsAndUpdateModel)
                    .then(updateSurveyCache)
                    .then((result) => {
                        // set the hash so that subsequent update checks won't redownload the form
                        hash = result.hash;

                        if (!isLastSaveEnabled(result)) {
                            return removeLastSavedRecord(result.enketoId);
                        }
                    })
                    .then(() => {
                        console.log(
                            'Survey is now updated in the store. Need to refresh.'
                        );
                        document.dispatchEvent(events.FormUpdated());
                    });
            }
        })
        .catch((error) => {
            // if the form has been de-activated or removed from the server
            if (error.status === 404 || error.status === 401) {
                // remove it from the store
                remove(survey)
                    .then(() => {
                        // TODO notify user to refresh or trigger event on form
                        console.log(
                            `survey ${survey.enketoId} removed from storage`,
                            error.status
                        );
                    })
                    .catch((e) => {
                        console.error(
                            'an error occurred when attempting to remove the survey from storage',
                            e
                        );
                    });
            } else {
                console.log(
                    'Could not obtain latest survey or hash from server or failed to save it. Probably offline.',
                    error.stack
                );
            }
        });
}

/**
 * Completely flush the form cache (not the data storage)
 *
 * @return { Promise } [description]
 */
function flush() {
    return store.survey.removeAll().then(() => {
        console.log(
            'Done! The form cache is empty now. (Records have not been removed)'
        );
    });
}

export default {
    init,
    get,
    updateMaxSubmissionSize,
    remove,
    flush,
    CACHE_UPDATE_INITIAL_DELAY,
    CACHE_UPDATE_INTERVAL,
};
