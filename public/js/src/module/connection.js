/**
 * Deals with communication to the server (in process of being transformed to using Promises)
 */

import encryptor from './encryptor';
import settings from './settings';
import { t } from './translator';
import utils from './utils';
import {
    getLastSavedRecord,
    LAST_SAVED_VIRTUAL_ENDPOINT,
    populateLastSavedInstances,
    setLastSavedRecord,
} from './last-saved';
import { geoJSONExternalInstance } from './geojson';
import { replaceMediaSources } from './media';

/**
 * @typedef {import('../../../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyExternalData} SurveyExternalData
 */

/**
 * @typedef BatchPrepped
 * @property { string } instanceId
 * @property { string } deprecatedId
 * @property { FormData } formData
 * @property { string[] } failedFiles
 */

/**
 * @typedef UploadRecordOptions
 * @property { boolean } [isLastSaved]
 */

/**
 * @typedef UploadBatchResult
 * @property { number } status
 * @property { Array<string | undefined> } failedFiles
 * @property { string } [message]
 */

const parser = new DOMParser();
const xmlSerializer = new XMLSerializer();
const CONNECTION_URL = `${settings.basePath}/connection`;
const TRANSFORM_HASH_URL = `${settings.basePath}/transform/xform/hash/${settings.enketoId}`;
const INSTANCE_URL = settings.enketoId
    ? `${settings.basePath}/submission/${settings.enketoId}`
    : null;
const MAX_SIZE_URL = settings.enketoId
    ? `${settings.basePath}/submission/max-size/${settings.enketoId}`
    : `${settings.basePath}/submission/max-size/?xformUrl=${encodeURIComponent(
          settings.xformUrl
      )}`;

/**
/**
 * Checks online status
 */
function getOnlineStatus() {
    return (
        fetch(CONNECTION_URL, {
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain' },
        })
            .then((response) => response.text())
            // It is important to check for the content of the no-cache response as it will
            // start receiving the fallback page served by the service worker when offline!
            .then((text) => /connected/.test(text))
            .catch(() => false)
    );
}

/**
 * Uploads a complete record
 *
 * @param  { EnketoRecord } record
 * @return { Promise<UploadBatchResult> }
 */
function _uploadRecord(record) {
    let batches;

    try {
        batches = _prepareFormDataArray(record);
    } catch (e) {
        return Promise.reject(e);
    }

    /** @type { Promise<UploadBatchResult[]> } */
    const resultsPromise = Promise.resolve([]);

    /** @type { UploadBatchResult } */
    let result;

    // Perform batch uploads sequentially for to avoid issues when connections are very poor and
    // a serious issue with ODK Aggregate (https://github.com/kobotoolbox/enketo-express/issues/400)
    return batches
        .reduce(
            (prevPromise, batch) =>
                prevPromise.then((results) =>
                    _uploadBatch(batch).then((result) => {
                        results.push(result);

                        return results;
                    })
                ),
            resultsPromise
        )
        .then((results) => {
            console.log('results of all batches submitted', results);

            result = results[0];
        })
        .then(() => result);
}

const uploadQueuedRecord = _uploadRecord;

const uploadRecord = (survey, record) =>
    setLastSavedRecord(survey, record).then(() => _uploadRecord(record));

/**
 * Uploads a single batch of a single record.
 *
 * @param { BatchPrepped } recordBatch - formData object to send
 * @return { Promise<UploadBatchResult> }      [description]
 */
function _uploadBatch(recordBatch) {
    // Submission URL is dynamic, because settings.submissionParameter only gets populated after loading form from
    // cache in offline mode.
    const submissionUrl = settings.enketoId
        ? `${settings.basePath}/submission/${settings.enketoId}${_getQuery()}`
        : null;
    const controller = new AbortController();

    setTimeout(() => {
        controller.abort();
    }, settings.timeout);

    return fetch(submissionUrl, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'X-OpenRosa-Version': '1.0',
            'X-OpenRosa-Deprecated-Id': recordBatch.deprecatedId,
            'X-OpenRosa-Instance-Id': recordBatch.instanceId,
        },
        signal: controller.signal,
        body: recordBatch.formData,
    })
        .then((response) => {
            /** @type { UploadBatchResult } */
            const result = {
                status: response.status,
                failedFiles: recordBatch.failedFiles
                    ? recordBatch.failedFiles
                    : undefined,
            };

            if (response.status === 400) {
                // 400 is a generic error. Any message returned by the server is probably more useful.
                // Other more specific statusCodes will get hardcoded and translated messages.
                return response.text().then((text) => {
                    const xmlResponse = parser.parseFromString(
                        text,
                        'text/xml'
                    );
                    if (xmlResponse) {
                        const messageEl = xmlResponse.querySelector(
                            'OpenRosaResponse > message'
                        );
                        if (messageEl) {
                            result.message = messageEl.textContent;
                        }
                    }
                    throw result;
                });
            }
            if (response.status !== 201 && response.status !== 202) {
                throw result;
            } else {
                return result;
            }
        })
        .catch((error) => {
            if (
                error.name === 'AbortError' &&
                typeof error.status === 'undefined'
            ) {
                error.status = 408;
            }
            throw error;
        });
}

/**
 * Builds up a record array including media files, divided into batches
 *
 * @param { EnketoRecord } record - record object
 * @return { BatchPrepped[] }
 */
function _prepareFormDataArray(record) {
    const recordDoc = parser.parseFromString(record.xml, 'text/xml');

    /** @type {Array<Omit<HTMLInputElement, 'type'>>} */
    const fileElements = Array.prototype.slice
        .call(recordDoc.querySelectorAll('[type="file"]'))
        .map((el) => {
            el.removeAttribute('type');

            return el;
        });
    const xmlData = xmlSerializer.serializeToString(recordDoc.documentElement);
    const xmlSubmissionBlob = new Blob([xmlData], {
        type: 'text/xml',
    });
    const availableFiles = record.files || [];
    const sizes = [];

    /** @type {string[]} */
    const failedFiles = [];

    const submissionFiles = [];
    let batches = [[]];

    /** @type {BatchPrepped[]} */
    const batchesPrepped = [];

    const { maxSize } = settings;

    fileElements.forEach((el) => {
        let file;
        const { nodeName } = el;
        const fileName = el.textContent;

        // check if file is actually available
        availableFiles.some((f) => {
            if (f.name === fileName) {
                file = f;

                return true;
            }

            return false;
        });

        // add the file if it is available
        if (file) {
            submissionFiles.push({
                nodeName,
                file,
            });
            sizes.push(file.size);
        } else {
            failedFiles.push(fileName);
            console.error(`Error occured when trying to retrieve ${fileName}`);
        }
    });

    if (submissionFiles.length > 0) {
        batches = _divideIntoBatches(sizes, maxSize);
    }

    console.log(
        `splitting record into ${batches.length} batches to reduce submission size `,
        batches
    );

    batches.forEach((batch) => {
        const fd = new FormData();

        fd.append(
            'xml_submission_file',
            xmlSubmissionBlob,
            'xml_submission_file'
        );
        const csrfToken = (
            document.cookie
                .split('; ')
                .find((c) => c.startsWith(settings.csrfCookieName)) || ''
        ).split('=')[1];
        if (csrfToken) fd.append(settings.csrfCookieName, csrfToken);

        // batch with XML data
        const batchPrepped = {
            instanceId: record.instanceId,
            deprecatedId: record.deprecatedId,
            formData: fd,
            failedFiles,
        };

        // add any media files to the batch
        batch.forEach((fileIndex) => {
            // Not clear what name is appropriate. Since file.name is unique and works, this is used.
            batchPrepped.formData.append(
                submissionFiles[fileIndex].file.name,
                submissionFiles[fileIndex].file,
                submissionFiles[fileIndex].file.name
            );
        });

        // push the batch to the array
        batchesPrepped.push(batchPrepped);
    });

    return batchesPrepped;
}

/**
 * splits an array of file sizes into batches (for submission) based on a limit
 *
 * @param  {Array.<number>} fileSizes -   array of file sizes
 * @param  {number}     limit -   limit in byte size of one chunk (can be exceeded for a single item)
 * @return {Array.<Array.<number>>} array of arrays with index, each secondary array of indices represents a batch
 */

function _divideIntoBatches(fileSizes, limit) {
    let i;
    let j;
    let batch;
    let batchSize;
    const sizes = [];
    const batches = [];

    for (i = 0; i < fileSizes.length; i++) {
        sizes.push({
            index: i,
            size: fileSizes[i],
        });
    }

    while (sizes.length > 0) {
        batch = [sizes[0].index];
        batchSize = sizes[0].size;
        if (sizes[0].size < limit) {
            for (i = 1; i < sizes.length; i++) {
                if (batchSize + sizes[i].size < limit) {
                    batch.push(sizes[i].index);
                    batchSize += sizes[i].size;
                }
            }
        }
        batches.push(batch);
        for (i = 0; i < sizes.length; i++) {
            for (j = 0; j < batch.length; j++) {
                if (sizes[i].index === batch[j]) {
                    sizes.splice(i, 1);
                }
            }
        }
    }

    return batches;
}

/**
 * Returns the value of the X-OpenRosa-Content-Length header returned by the OpenRosa server for this form.
 *
 * @param {object} survey - survey object
 * @return { Promise } a Promise that resolves with the provided survey object with added maxSize property if successful
 */
function getMaximumSubmissionSize(survey) {
    // TODO: add 5 sec timeout?
    return fetch(MAX_SIZE_URL)
        .then((response) => response.json())
        .then((data) => {
            if (data && data.maxSize && !isNaN(data.maxSize)) {
                survey.maxSize = Number(data.maxSize);
            } else {
                console.error(
                    'Error retrieving maximum submission size. Unexpected response: ',
                    data
                );
            }
        })
        .catch(() => {})
        .then(() => survey);
}

/**
 * @param {string} basePath
 * @param {string} [enketoId]
 * @return {string}
 */
const getTransformURL = (basePath, enketoId) => {
    const idPath = enketoId ? `/${enketoId}` : '';

    return `${basePath}/transform/xform${idPath}${_getQuery()}`;
};

/**
 * @typedef GetExternalDataOptions
 * @property {boolean} [isPreview]
 */

/**
 * @param {Survey} survey
 * @param {Document} model
 * @param {GetExternalDataOptions} [options]
 * @return {Promise<SurveyExternalData[]>}
 */
const getExternalData = async (survey, model, options = {}) => {
    replaceMediaSources(model, survey.media);

    /** @type {Array<Promise<SurveyExternalData>>} */
    const tasks = [];
    const externalInstances = [
        ...model.querySelectorAll('instance[id][src]'),
    ].map((instance) => ({
        id: instance.id,
        src: instance.getAttribute('src'),
    }));

    externalInstances.forEach((instance, index) => {
        const { src } = instance;

        if (src === LAST_SAVED_VIRTUAL_ENDPOINT) {
            tasks.push(Promise.resolve(instance));

            return;
        }

        const task = async () => {
            try {
                const xml = await getDataFile(src, survey.languageMap);

                return {
                    ...instance,
                    xml,
                };
            } catch (error) {
                tasks.splice(index, 1);

                if (options.isPreview) {
                    return;
                }

                throw error;
            }
        };

        tasks.push(task());
    });

    return Promise.all(tasks);
};

/**
 * @param {string} xformURL
 */
const transformPreviewXForm = async (xformURL) => {
    const { transform } = await import('enketo-transformer/web');
    const response = await fetch(xformURL, {
        credentials: 'same-origin',
        mode: 'cors',
    });
    const xform = await response.text();
    const transformed = await transform({ xform });

    // Since media attachments will not be available for preview-by-URL, map
    // media file names to empty `data:` URLs.
    const media = Object.fromEntries(
        [
            {
                docStr: transformed.form,
                mimeType: 'text/html',
            },
            {
                docStr: transformed.model,
                mimeType: 'text/xml',
            },
        ].flatMap(({ docStr, mimeType }) => {
            const parsed = parser.parseFromString(docStr, mimeType);
            const els = [
                ...parsed.querySelectorAll(
                    '[src^="jr:"]:not(instance[src="jr://instance/last-saved"]), a[href^="jr:"]'
                ),
            ];

            return els.map((el) => {
                const jrURL = el.getAttribute('href') ?? el.getAttribute('src');
                const fileName = jrURL.replace(/.*\/([^/]+$)/, '$1');

                return [fileName, 'data:,'];
            });
        })
    );

    return {
        ...transformed,
        media,
    };
};

/**
 * @typedef GetFormPartsProps
 * @property {string} enketoId
 * @property {Record<string, string>} [defaults]
 * @property {string} [instanceId]
 * @property {boolean} [isPreview]
 * @property {string} [xformUrl]
 */

/**
 * Obtains HTML Form, XML Model and External Instances
 *
 * @param { GetFormPartsProps } props - form properties object
 * @return { Promise<Survey> } a Promise that resolves with a form parts object
 */
async function getFormParts(props) {
    /** @type {import('enketo-transformer').TransformedSurvey} */
    let transformed;

    try {
        if (props.xformUrl) {
            if (!props.isPreview || props.enketoId != null) {
                throw new Error('Unexpected preview request');
            }

            transformed = await transformPreviewXForm(props.xformUrl);
        } else {
            const transformURL = getTransformURL(
                settings.basePath,
                props.enketoId
            );

            transformed = await _postData(transformURL, {
                xformUrl: props.xformUrl,
            });
        }
    } catch (error) {
        if (error.status === undefined) {
            error.message = t('error.formloadfailed');
        }

        throw error;
    }

    const model = parser.parseFromString(transformed.model, 'text/xml');

    const encryptedSubmission = model.querySelector(
        'submission[base64RsaPublicKey]'
    );

    /** @type {Survey} */
    let survey = {
        ...transformed,
        enketoId: props.enketoId,
        theme:
            transformed.theme ||
            utils.getThemeFromFormStr(transformed.form) ||
            settings.defaultTheme,
    };

    if (encryptedSubmission != null) {
        survey = encryptor.setEncryptionEnabled(survey);
    }

    const externalData = await getExternalData(survey, model, {
        isPreview: props.isPreview,
    });

    Object.assign(survey, { externalData });

    const lastSavedRecord = props.isPreview
        ? null
        : await getLastSavedRecord(survey.enketoId);

    return populateLastSavedInstances(survey, lastSavedRecord);
}

function _postData(url, data = {}) {
    return _request(url, 'POST', data);
}

function _getData(url, data = {}) {
    return _request(url, 'GET', data);
}

function _request(url, method = 'POST', data = {}) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
    };
    // add data
    if (method === 'GET' || method === 'HEAD') {
        if (Object.keys(data).length) {
            const urlObj = new URL(url, location.href);
            const search = urlObj.search.slice(1);
            urlObj.search = `?${search}${search ? '&' : ''}${_encodeFormData(
                data
            )}`;
            url = urlObj.href;
        }
    } else {
        options.body = _encodeFormData(data);
    }

    return fetch(url, options)
        .then(_throwResponseError)
        .then((response) => response.json());
}

/**
 * @param { Response } response
 * @return { Response }
 */
function _throwResponseError(response) {
    if (!response.ok) {
        return response.json().then((data) => {
            if (typeof data.status === 'undefined') {
                data.status = response.status;
            }
            if (typeof data.message === 'undefined') {
                data.status = response.statusText;
            }
            throw data;
        });
    }
    return response;
}

function _encodeFormData(data) {
    return Object.keys(data)
        .filter((key) => data[key])
        .map(
            (key) =>
                `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`
        )
        .join('&');
}

/**
 * Obtains a media file
 *
 * @param { string } url - a URL to a media file
 * @return {Promise<{url: string, item: Blob}>} a Promise that resolves with a media file object
 */
function getMediaFile(url) {
    return fetch(url)
        .then(_throwResponseError)
        .then((response) => response.blob())
        .then((item) => ({ url, item }))
        .catch((data) => {
            const error = new Error(
                data.message ||
                    t('error.loadfailed', {
                        resource: url,
                        // switch off escaping just for this known safe value
                        interpolation: {
                            escapeValue: false,
                        },
                    })
            );
            error.status = data.status;
            throw error;
        });
}

/**
 * Obtains a data/text file
 *
 * @private
 * @param {string} url - URL to data tile
 * @param {object } languageMap - language map object with language name properties and IANA subtag values
 * @return {Promise<XMLDocument>} a Promise that resolves with an XML Document
 */
function getDataFile(url, languageMap) {
    let contentType;

    return fetch(url)
        .then((response) => {
            contentType =
                response.headers.get('Content-Type')?.split(';')[0] ?? '';

            // Currently, when using enketo-express with ODK Central, the Content-Type
            // header will not be populated for GeoJSON external instances. Central
            // populates the value based on an upload File's type property, which is
            // determined by the browser for most common file types, but notably not
            // for `.geojson` files.
            if (
                (contentType === '' || String(contentType) === 'null') &&
                url.endsWith('.geojson')
            ) {
                contentType = 'application/geo+json';
            }

            return contentType === 'application/geo+json'
                ? response.json()
                : response.text();
        })
        .then((responseData) => {
            let result;
            switch (contentType) {
                case 'application/geo+json':
                    result = geoJSONExternalInstance(responseData);
                    break;
                case 'text/csv':
                    result = utils.csvToXml(responseData, languageMap);
                    break;
                case 'text/xml':
                    result = parser.parseFromString(responseData, contentType);
                    break;
                default:
                    console.error(
                        'External data not served with expected Content-Type.',
                        contentType
                    );
                    result = parser.parseFromString(responseData, 'text/xml');
            }
            if (
                result &&
                result.querySelector('parsererror') &&
                contentType !== 'text/csv'
            ) {
                console.log(
                    'Failed to parse external data as XML, am going to try as CSV'
                );
                result = utils.csvToXml(responseData, languageMap);
            }

            return result;
        })
        .catch((error) => {
            const errorMsg =
                !error.message || /fetch/.test(error.message)
                    ? t('error.dataloadfailed', {
                          filename: url.replace(/.*\//, ''),
                      })
                    : error.message;
            throw new Error(errorMsg);
        });
}

/**
 * Extracts version from service worker script
 *
 * @param { string } serviceWorkerUrl - service worker URL
 * @return {Promise<string>} a Promise that resolves with the version of the service worker or 'unknown'
 */
function getServiceWorkerVersion(serviceWorkerUrl) {
    return fetch(serviceWorkerUrl)
        .then((response) => response.text())
        .then((text) => {
            const matches = text.match(/version\s?=\s?'([^\n]+)'/);

            return matches ? matches[1] : 'unknown';
        });
}

function getFormPartsHash() {
    return _postData(TRANSFORM_HASH_URL + _getQuery()).then(
        (data) => data.hash
    );
}

/**
 * Obtains XML instance that is cached at the server
 *
 * @param { object } props - form properties object
 * @return { Promise<string> } a Promise that resolves with an XML instance as text
 */
function getExistingInstance(props) {
    return _getData(INSTANCE_URL, props);
}

// Note: settings.submissionParameter is only populated after loading form from cache in offline mode.
function _getQuery() {
    return utils.getQueryString([
        settings.languageOverrideParameter,
        settings.submissionParameter,
    ]);
}

export default {
    uploadRecord,
    uploadQueuedRecord,
    getMaximumSubmissionSize,
    getOnlineStatus,
    getFormParts,
    getFormPartsHash,
    getMediaFile,
    getExistingInstance,
    getServiceWorkerVersion,
};
