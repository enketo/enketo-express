/**
 * Deals with browser storage
 */

import db from 'db.js';
import utils from './utils';
import sniffer from './sniffer';
import { t } from './translator';
import encryptor from './encryptor';

const parser = new DOMParser();

/**
 * @typedef {import('db.js')}
 */

/**
 * @typedef {import('../../../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef {'readonly' | 'readwrite' | 'versionchange'} IDBTransactionMode_
 */

let server;
let blobEncoding;
let available = false;

const databaseName = 'enketo';
const version = 4;

const REMOVE_RECORD_NAME_UNIQUENESS_VERSION = 4;

/**
 * @typedef StoreInitOptions
 * @property {boolean} [failSilently]
 */

/**
 * @param {StoreInitOptions} [options]
 */
function init({ failSilently } = {}) {
    return _checkSupport()
        .then(() => {
            // https://github.com/enketo/enketo-express/issues/416
            // When upgrading from version 3 to 4, ensure that the unique `name` index on
            // `records` is replaced with an index on the combination `['enketoId', 'name']`.
            // For any other version upgrades, defer to `db.js`.

            if (version !== REMOVE_RECORD_NAME_UNIQUENESS_VERSION) {
                return Promise.resolve();
            }

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(databaseName, version);

                request.addEventListener('blocked', reject);
                request.addEventListener('success', resolve);
                request.addEventListener('error', reject);

                request.addEventListener('upgradeneeded', (event) => {
                    const { transaction } = request;
                    try {
                        if (
                            event.oldVersion !==
                                REMOVE_RECORD_NAME_UNIQUENESS_VERSION - 1 ||
                            event.newVersion !==
                                REMOVE_RECORD_NAME_UNIQUENESS_VERSION
                        ) {
                            // If the *previous* verison was not 3 (e.g. for a new DB),
                            // these changes will *not* produce the same schema as db.js.
                            // In those cases, we abort this upgrade and defer to db.js.
                            // This does leave open the much less likely possibility that
                            // an upgrade from versions 1 or 2 will leave the `name` index.
                            transaction.abort();

                            return resolve(event);
                        }

                        const store = transaction.objectStore('records');

                        // This will produce a schema equivalent to the db.js changes specified
                        // for version 4.
                        store.createIndex('recordName', ['enketoId', 'name'], {
                            unique: true,
                        });
                        store.deleteIndex('name');
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        })
        .then(() =>
            db.open({
                server: databaseName,
                version,
                schema: {
                    // the surveys
                    surveys: {
                        key: {
                            keyPath: 'enketoId',
                            autoIncrement: false,
                        },
                        indexes: {
                            enketoId: {
                                unique: true,
                            },
                        },
                    },
                    // the resources that belong to a survey
                    resources: {
                        key: {
                            autoIncrement: false,
                        },
                        indexes: {
                            key: {
                                unique: true,
                            },
                        },
                    },
                    // Records in separate table because it makes more sense for getting, updating and removing records
                    // if they are not stored in one (giant) array or object value.
                    // Need to watch out for bad iOS bug: http://www.raymondcamden.com/2014/9/25/IndexedDB-on-iOS-8--Broken-Bad
                    // but with the current keys there is no risk of using the same key in multiple tables.
                    // InstanceId is the key because instanceName may change when editing a draft.
                    records: {
                        key: {
                            keyPath: 'instanceId',
                        },
                        indexes: {
                            // https://github.com/enketo/enketo-express/issues/416
                            recordName: {
                                keyPath: ['enketoId', 'name'],
                                unique: true,
                            },
                            // the actual key
                            instanceId: {
                                unique: true,
                            },
                            // to get all records belonging to a form
                            enketoId: {
                                unique: false,
                            },
                        },
                    },
                    lastSavedRecords: {
                        /**
                         * @see Note on `records` about unique keys across IndexedDB object stores
                         */
                        key: {
                            keyPath: '_enketoId',
                            autoIncrement: false,
                        },
                    },
                    // the files that belong to a record
                    files: {
                        key: {
                            autoIncrement: false,
                        },
                        indexes: {
                            key: {
                                unique: true,
                            },
                        },
                    },
                    // settings or other global app properties
                    properties: {
                        key: {
                            keyPath: 'name',
                            autoIncrement: false,
                        },
                        indexes: {
                            key: {
                                unique: true,
                            },
                        },
                    },
                    // Dynamic data, passed by via querystring is stored in a separate table,
                    // because its update mechanism is separate from the survey + resources.
                    // Otherwise the all-or-nothing form+resources update would remove this data.
                    data: {
                        key: {
                            keyPath: 'enketoId',
                            autoIncrement: false,
                        },
                        indexes: {
                            enketoId: {
                                unique: true,
                            },
                        },
                    },
                },
            })
        )
        .then((s) => {
            server = s;
        })
        .then(_isWriteable)
        .then(_setBlobStorageEncoding)
        .then(() => {
            available = true;
        })
        .catch((error) => {
            if (failSilently) {
                return;
            }

            console.error('store initialization error', error);
            // make error more useful and throw it further down the line
            if (typeof error === 'string') {
                error = new Error(error);
            } else if (!(error instanceof Error)) {
                error = new Error(
                    t('store.error.notavailable', {
                        error: JSON.stringify(error),
                    })
                );
            }
            error.status = 500;
            throw error;
        });
}

function _checkSupport() {
    let error;

    // best to perform this specific check ourselves and not rely on specific error message in db.js.
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'object') {
            resolve();
        } else {
            if (sniffer.os.ios) {
                error = new Error(t('store.error.iosusesafari'));
            } else {
                error = new Error(t('store.error.notsupported'));
            }
            error.status = 500;
            reject(error);
        }
    });
}

function _isWriteable() {
    return propertyStore.update({
        name: 'testWrite',
        value: new Date().getTime(),
    });
}

// detect older indexedDb implementations that do not support storing blobs properly (e.g. Safari 7 and 8)
function _canStoreBlobs() {
    const aBlob = new Blob(['<a id="a"><b id="b">hey!</b></a>'], {
        type: 'text/xml',
    });

    return propertyStore.update({
        name: 'testBlobWrite',
        value: aBlob,
    });
}

function _setBlobStorageEncoding() {
    return _canStoreBlobs()
        .then(() => {
            blobEncoding = false;
        })
        .catch(() => {
            console.log(
                'This browser is not able to store blobs directly, so blobs will be Base64 encoded'
            );
            blobEncoding = true;
        });
}

const propertyStore = {
    get(name) {
        return server.properties.get(name).then(_firstItemOnly);
    },
    update(property) {
        return server.properties.update(property).then(_firstItemOnly);
    },
    removeAll() {
        return _flushTable('properties');
    },
    getSurveyStats(id) {
        return server.properties.get(`${id}:stats`);
    },
    incrementRecordCount(record) {
        return propertyStore.getSurveyStats(record.enketoId).then((stats) => {
            if (!stats) {
                stats = {
                    name: `${record.enketoId}:stats`,
                };
            }
            if (!stats.recordCount) {
                stats.recordCount = 0;
            }
            ++stats.recordCount;

            return propertyStore.update(stats);
        });
    },
    addSubmittedInstanceId(record) {
        return propertyStore.getSurveyStats(record.enketoId).then((stats) => {
            if (!stats) {
                stats = {
                    name: `${record.enketoId}:stats`,
                };
            }
            if (!stats.submitted) {
                stats.submitted = [];
            }
            stats.submitted.push(record.instanceId);

            return propertyStore.update(stats);
        });
    },
};

const surveyStore = {
    /**
     * Obtains a single survey's form HTML and XML model, theme, external instances from storage
     *
     * @param  { string } id - [description]
     * @return { Promise<Survey> }    [description]
     */
    get(id) {
        return server.surveys
            .get(id)
            .then(_firstItemOnly)
            .then(_deserializeSurvey);
    },
    /**
     * Stores a single survey's form HTML and XML model, theme, external instances
     *
     * @param { Survey } survey - [description]
     * @return { Promise<Survey> }        [description]
     */
    set(survey) {
        if (!survey.form || !survey.model || !survey.enketoId || !survey.hash) {
            throw new Error('Survey not complete');
        }

        return server.surveys
            .add(_serializeSurvey(survey))
            .then(_firstItemOnly)
            .then((storedSurvey) => {
                const tasks = [];
                if (survey.binaryDefaults) {
                    survey.binaryDefaults.forEach((file) => {
                        tasks.push(
                            surveyStore.resource.update(survey.enketoId, file)
                        );
                    });
                }

                return (
                    Promise.all(tasks)
                        // return original survey with orginal survey.binaryDefaults
                        .then(() => storedSurvey)
                );
            })
            .then(_deserializeSurvey);
    },
    /**
     * Updates a single survey's form HTML and XML model as well any external resources belonging to the form
     *
     * @param  { Survey } survey - [description]
     * @return { Promise<Survey> }        [description]
     */
    update(survey) {
        let obsoleteResources = [];
        let obsoleteBinaryDefaults = [];

        if (!survey.form || !survey.model || !survey.enketoId) {
            throw new Error('Survey not complete');
        }

        const resourceKeys = []
            .concat(survey.resources || [])
            .map((resource) => resource.url);
        const binaryDefaultKeys = []
            .concat(survey.binaryDefaults || [])
            .map((resource) => resource.url);

        return server.surveys
            .get(survey.enketoId)
            .then((result) => {
                // Determine obsolete resources to be removed
                // But if undefined, do not determine this!
                if (survey.resources) {
                    obsoleteResources = (result.resources || []).filter(
                        (existing) => resourceKeys.indexOf(existing) < 0
                    );
                }
                if (survey.binaryDefaults) {
                    obsoleteBinaryDefaults = (
                        result.binaryDefaults || []
                    ).filter(
                        (existing) => binaryDefaultKeys.indexOf(existing) < 0
                    );
                }

                const update = { ..._serializeSurvey(survey) };

                // Note: if survey.resources = undefined/null, do not store empty array
                // as it means there are no resources to store (and load) - they may be added later by form-cache.js
                if (survey.resources) {
                    update.resources = resourceKeys;
                }

                if (survey.binaryDefaults) {
                    update.binaryDefaults = binaryDefaultKeys;
                }

                // Update the existing survey
                return server.surveys.update(update);
            })
            .then(_firstItemOnly)
            .then((result) => {
                const tasks = [];
                // Add new or update existing resources, combining binaryDefaults and form resources
                (survey.resources || [])
                    .concat(survey.binaryDefaults || [])
                    .forEach((file) => {
                        tasks.push(
                            surveyStore.resource.update(survey.enketoId, file)
                        );
                    });
                // Remove obsolete resources
                obsoleteResources
                    .concat(obsoleteBinaryDefaults)
                    .forEach((key) => {
                        tasks.push(
                            surveyStore.resource
                                .remove(survey.enketoId, key)
                                .then(() => null)
                        );
                    });

                // Execution
                return Promise.all(tasks).then((resources) => {
                    if (survey.resources) {
                        result.resources = resources.filter(
                            (resource) => resource != null
                        );
                    }

                    return _deserializeSurvey(result);
                });
            });
    },
    /**
     * Removes survey form and all its resources
     *
     * @param  { string } id - Enketo form ID
     * @return { Promise<void> } [description]
     */
    remove(id) {
        let resources;
        const tasks = [];

        return surveyStore
            .get(id)
            .then((survey) => {
                resources = survey.resources || [];
                resources.forEach((resource) => {
                    tasks.push(surveyStore.resource.remove(id, resource));
                });
                tasks.push(server.surveys.remove(id));

                return Promise.all(tasks);
            })
            .then(() => {});
    },
    /**
     * removes all surveys and survey resources
     *
     * @return { Promise } [description]
     */
    removeAll() {
        return _flushTable('surveys').then(() => _flushTable('resources'));
    },
    resource: {
        /**
         * Obtains a form resource
         *
         * @param  { string } id -  Enketo survey ID
         * @param  { string } url - URL of resource
         * @return { Promise<Blob> } A promise resolving with the file.
         */
        get(id, url) {
            return _getFile('resources', id, url);
        },
        /**
         * Updates a form resource in storage or creates it if it does not yet exist.
         *
         * @param { string } id - Enketo survey ID
         * @param {{item:Blob, url:string}} resource - Form resource to update.
         * @return {Promise<Blob>}         A promise resolving with the file that was updated.
         */
        update(id, resource) {
            return _updateFile('resources', id, resource);
        },
        /**
         * Removes form resource
         *
         * @param  { string } id -  Enketo survey ID
         * @param  { string } url - URL of resource
         * @return { Promise } [description]
         */
        remove(id, url) {
            return server.resources.remove(`${id}:${url}`);
        },
    },
};

const dataStore = {
    /**
     * Obtains the stored dynamic data belonging to a form.
     *
     * @param  { string } id - [description]
     * @return { Promise }  A Promise that resolves with data object
     */
    get(id) {
        return server.data.get(id).then(_firstItemOnly);
    },
    /**
     * Updates the dynamic data belonging to a form
     *
     * @param  {{enketoId: string, submissionParameter: {name: string, value: string}}} data - object with dynamic data
     * @return { Promise }        A Promise that resolves with data object
     */
    update(data) {
        if (!data.enketoId) {
            throw new Error('Dynamic data object not complete');
        }

        return server.data.update(data).then(_firstItemOnly);
    },
    /**
     * Removes the dynamic data belonging to a form
     *
     * @param  { string } id - [description]
     * @return { Promise }    [description]
     */
    remove(id) {
        return dataStore.remove(id);
    },
};

const recordStore = {
    /**
     * Obtains a single record (XML + files)
     *
     * @param { string } instanceId - the instance ID of the record to be retrieved
     * @return { Promise } A record from the database.
     */
    get(instanceId) {
        const tasks = [];

        return server.records
            .get(instanceId)
            .then(_firstItemOnly)
            .then((record) => {
                if (!record) {
                    return record;
                }

                record.files.forEach((fileKey) => {
                    tasks.push(
                        recordStore.file.get(record.instanceId, fileKey)
                    );
                });

                return Promise.all(tasks).then((files) => {
                    // filter out the failed files (= undefined)
                    files = files.filter((file) => file);
                    record.files = files || [];

                    return record;
                });
            });
    },
    /**
     * Obtains all stored records for a particular survey without record files
     *
     * @param { string } enketoId -   EnketoId of the survey the record belongs to
     * @param { boolean } finalOnly -  Only included records that are 'final' (i.e. not 'draft')
     * @return { Promise } [description]
     */
    getAll(enketoId, finalOnly) {
        if (!enketoId) {
            return Promise.reject(new Error('No Enketo ID provided'));
        }

        return server.records
            .query('enketoId')
            .only(enketoId)
            .execute()
            .then((records) => {
                // exclude drafts if required
                if (finalOnly) {
                    records = records.filter((record) => !record.draft);
                }

                // order by updated property, ascending
                return records.sort((a, b) => a.updated - b.updated);
            });
    },
    /**
     * Sets a new single record (XML + files)
     *
     * @param { object } record - [description]
     * @return { Promise }        [description]
     */
    set(record) {
        let fileKeys;

        if (
            !record.instanceId ||
            !record.enketoId ||
            !record.name ||
            !record.xml
        ) {
            return Promise.reject(new Error('Record not complete'));
        }

        record.files = record.files || [];

        // build array of file keys
        fileKeys = record.files.map((file) => file.name);

        return server.records
            .add({
                instanceId: record.instanceId,
                enketoId: record.enketoId,
                name: record.name,
                xml: record.xml,
                files: fileKeys,
                created: new Date().getTime(),
                updated: new Date().getTime(),
                draft: record.draft,
            })
            .then(_firstItemOnly)
            .then(propertyStore.incrementRecordCount)
            .then(() =>
                // execution, sequentially
                record.files.reduce(
                    (prevPromise, file) =>
                        prevPromise.then(() => {
                            if (
                                file &&
                                file.item &&
                                file.item instanceof Blob
                            ) {
                                // file can be a string if it was loaded from storage and remained unchanged
                                return recordStore.file.update(
                                    record.instanceId,
                                    file
                                );
                            }

                            return Promise.resolve();
                        }),
                    Promise.resolve()
                )
            )
            .then(() => record);
    },
    /**
     * Updates (or creates) a single record (XML + files)
     *
     * @param { object } record - [description]
     * @return { Promise }        [description]
     */
    update(record) {
        let fileKeys;
        let obsoleteFiles = [];

        if (
            !record.instanceId ||
            !record.enketoId ||
            !record.name ||
            !record.xml
        ) {
            throw new Error('Record not complete');
        }

        record.files = record.files || [];

        // build array of file keys
        fileKeys = record.files.map((file) => file.name);

        return server.records
            .get(record.instanceId)
            .then((result) => {
                // determine obsolete files to be removed
                if (result && result.files) {
                    obsoleteFiles = result.files.filter(
                        (existing) => fileKeys.indexOf(existing) < 0
                    );
                }

                // update the existing record
                return server.records.update({
                    instanceId: record.instanceId,
                    enketoId: record.enketoId,
                    name: record.name,
                    xml: record.xml,
                    files: fileKeys,
                    created:
                        result && result.created
                            ? result.created
                            : new Date().getTime(),
                    updated: new Date().getTime(),
                    draft: record.draft,
                });
            })
            .then(() =>
                // execution, sequentially
                record.files
                    .reduce(
                        (prevPromise, file) =>
                            prevPromise.then(() => {
                                // file can be a string if it was loaded from storage and remained unchanged
                                if (
                                    file &&
                                    file.item &&
                                    file.item instanceof Blob
                                ) {
                                    return recordStore.file.update(
                                        record.instanceId,
                                        file
                                    );
                                }

                                return Promise.resolve();
                            }),
                        Promise.resolve()
                    )
                    .then(() =>
                        obsoleteFiles.reduce(
                            (prevPromise, key) =>
                                prevPromise.then(() =>
                                    recordStore.file.remove(
                                        record.instanceId,
                                        key
                                    )
                                ),
                            Promise.resolve()
                        )
                    )
                    .then(
                        () =>
                            // resolving with original record (not the array returned by server.records.update)
                            record
                    )
            );
    },
    /**
     * Removes a single record (XML + files)
     *
     * @param { string } instanceId - the instance ID of the record to remove
     * @return { Promise }        [description]
     */
    remove(instanceId) {
        return server.records
            .get(instanceId)
            .then(_firstItemOnly)
            .then((record) => {
                const tasks = [];
                const files = record && record.files ? record.files : [];
                files.forEach((fileKey) => {
                    tasks.push(recordStore.file.remove(instanceId, fileKey));
                });
                tasks.push(server.records.remove(instanceId));

                return Promise.all(tasks);
            });
    },
    /**
     * removes all records and record files
     *
     * @return { Promise } [description]
     */
    removeAll() {
        return _flushTable('records').then(() => _flushTable('files'));
    },
    file: {
        /**
         * Obtains a file belonging to a record
         *
         * @param  { string } instanceId - The instanceId that is part of the record (meta>instancID)
         * @param  { string } fileKey -     unique key that identifies the file in the record (meant to be fileName)
         * @return { Promise }  A promise resolving with a File.
         */
        get(instanceId, fileKey) {
            return _getFile('files', instanceId, fileKey);
        },
        /**
         * Updates an file belonging to a record in storage or creates it if it does not yet exist. This function is exported
         * for testing purposes, but not actually used as a public function in Enketo.
         *
         * @param  { string }                     instanceId -  instanceId that is part of the record (meta>instancID)
         * @param  {{item:Blob, name:string }}   file -        file object
         * @return { Promise } A promise resolving with the File.
         */
        update(instanceId, file) {
            return _updateFile('files', instanceId, file);
        },
        /**
         * Removes a record file
         *
         * @param  { string } instanceId -  instanceId that is part of the record (meta>instancID)
         * @param  { string } fileKey -     unique key that identifies the file in the record (meant to be fileName)
         * @return { Promise } A promise
         */
        remove(instanceId, fileKey) {
            return server.files.remove(`${instanceId}:${fileKey}`);
        },
    },
};

/**
 * Db.js get and update functions return arrays. This function extracts the first item of the array
 * and passes it along.
 *
 * @param {object[]} results - Array of retrieved database items.
 * @return { Promise }       [description]
 */
function _firstItemOnly(results) {
    if (Array.isArray(results)) {
        // if an array
        return Promise.resolve(results[0]);
    }
    // if not an array
    return Promise.resolve(results);
}

/**
 * Serializes a survey for storage in IndexedDB:
 *
 * - externalData XMLDocuments are serialized to strings
 * - surveys with encryption enabled are converted to a state which can be deserialized on retrieval
 *
 * @see {encryptor.serializeEncryptedSurvey}
 * @param {Survey} survey
 * @return {Promise<Survey>}
 */
function _serializeSurvey(survey) {
    if (survey) {
        if (survey.externalData) {
            survey.externalData = survey.externalData.map((instance) => {
                if (instance.xml instanceof XMLDocument) {
                    instance.xml = new XMLSerializer().serializeToString(
                        instance.xml.documentElement,
                        'text/xml'
                    );
                }

                return instance;
            });
        }

        return encryptor.serializeEncryptedSurvey(survey);
    }
}

/**
 * Deserializes a survey retrieved from IndexedDB:
 *
 * - externalData strings are deserialized to XMLDocuments
 * - surveys which should have encryption enabled are restored to that state
 *
 * @see {encryptor.deserializeEncryptedSurvey}
 * @param {Survey} survey
 * @return {Promise<Survey>}
 */
function _deserializeSurvey(survey) {
    if (survey) {
        if (survey.externalData) {
            survey.externalData = survey.externalData.map((instance) => {
                if (typeof instance.xml === 'string') {
                    instance.xml = parser.parseFromString(
                        instance.xml,
                        'text/xml'
                    );
                }

                return instance;
            });
        }

        return encryptor.deserializeEncryptedSurvey(survey);
    }
}

/**
 * Obtains a file from a specified table
 *
 * @param  { string } table - database table name
 * @param  { string } id -    Enketo id of the survey
 * @param  { string } key -   unique key of the file (url or fileName)
 * @return {Promise<Blob>} A promise that resolves with a File.
 */
function _getFile(table, id, key) {
    let prop;
    const file = {};

    return new Promise((resolve, reject) => {
        if (table === 'resources' || table === 'files') {
            prop = table === 'resources' ? 'url' : 'name';

            return server[table]
                .get(`${id}:${key}`)
                .then((item) => {
                    file[prop] = key;
                    if (item instanceof Blob) {
                        file.item = item;
                        resolve(file);
                    } else if (typeof item === 'string') {
                        utils.dataUriToBlob(item).then((item) => {
                            file.item = item;
                            resolve(file);
                        });
                    } else {
                        // if item is falsy or unexpected
                        resolve(undefined);
                    }
                })
                .catch(reject);
        }
        reject(new Error('Unknown table or missing id or key.'));
    });
}

/**
 * Updates a file in a specified table or creates a new db entry if it doesn't exist.
 *
 * @param { string } table - database table name
 * @param { string } id -    Enketo id of the survey
 * @param { object } file - new file object (url or name property)
 * @param { string } [file.url] - url of the file
 * @param { string } [file.name] - name of the file (required if url not provided)
 * @param {Blob} file.item - the new file
 * @return { Promise }       [description]
 */
function _updateFile(table, id, file) {
    let error;
    let prop;
    let propValue;

    if (table === 'resources' || table === 'files') {
        prop = table === 'resources' ? 'url' : 'name';
        if (id && file && file.item instanceof Blob && file[prop]) {
            propValue = file[prop];
            file.key = `${id}:${file[prop]}`;
            delete file[prop];
            /*
             * IE doesn't like complex objects with Blob properties so we store
             * the blob as the value.
             * The files table does not have a keyPath for this reason.
             * The format of file (item: Blob, key: string) is db.js way of directing
             * it to store the blob instance as the value.
             */
            if (blobEncoding) {
                return utils.blobToDataUri(file.item).then((convertedBlob) => {
                    file.item = convertedBlob;

                    return server[table].update(file).then(() => {
                        file[prop] = propValue;
                        delete file.key;

                        return file;
                    });
                });
            }
            return server[table].update(file).then(() => {
                file[prop] = propValue;
                delete file.key;

                return file;
            });
        }
        error = new Error('DataError. File not complete or ID not provided.');
        error.name = 'DataError';

        return Promise.reject(error);
    }
    return Promise.reject(new Error('Unknown table or missing ID or key.'));
}

/**
 * Completely remove the database (no db.js function for this yet)
 *
 * @return { object } [description]
 */
function flush() {
    let request;

    return new Promise((resolve, reject) => {
        try {
            server.close(databaseName);
        } catch (e) {
            console.log(
                'Database has probably been removed already. Doing nothing.',
                e
            );
            resolve();
        }

        request = indexedDB.deleteDatabase(databaseName);

        request.onsuccess = () => {
            console.log('Deleted database successfully');
            resolve();
        };
        request.onerror = (error) => {
            reject(error);
        };
        request.onblocked = (error) => {
            reject(error);
        };
    });
}

/**
 * Removes a table from the store
 *
 * @param  { string } table - The database table to flush
 * @return { Promise }       [description]
 */
function _flushTable(table) {
    return server[table].clear();
}

// debugging utilities: TODO: should move elsewhere or be turned into useful functions that return promises
const dump = {
    resources() {
        server.resources
            .query()
            .all()
            .execute()
            .done((results) => {
                console.log(`${results.length} resources found`);
                results.forEach((item) => {
                    if (item instanceof Blob) {
                        console.log(
                            item.type,
                            item.size,
                            URL.createObjectURL(item)
                        );
                    } else {
                        console.log(
                            'resource string with length ',
                            item.length,
                            'found'
                        );
                    }
                });
            });
    },
    surveys() {
        server.surveys
            .query()
            .all()
            .execute()
            .done((results) => {
                console.log(`${results.length} surveys found`);
                results.forEach((item) => {
                    console.log('survey', item);
                });
            });
    },
    records() {
        server.records
            .query()
            .all()
            .execute()
            .done((results) => {
                console.log(`${results.length} records found`);
                results.forEach((item) => {
                    console.log('survey', item);
                });
            });
    },
    files() {
        server.files
            .query()
            .all()
            .execute()
            .done((results) => {
                console.log(`${results.length} resources found`);
                results.forEach((item) => {
                    if (item instanceof Blob) {
                        console.log(
                            item.type,
                            item.size,
                            URL.createObjectURL(item)
                        );
                    } else {
                        console.log(
                            'resource string with length ',
                            item.length,
                            'found'
                        );
                    }
                });
            });
    },
};

export default {
    init,
    get available() {
        return available;
    },
    property: propertyStore,
    survey: surveyStore,
    dynamicData: dataStore,
    record: recordStore,
    flush,
    dump,
    get lastSavedRecords() {
        return server.lastSavedRecords;
    },
};
