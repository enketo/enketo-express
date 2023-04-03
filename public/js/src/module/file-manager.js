/*
 * Replaces file-manager in enketo-core.
 */

import { getFilename } from 'enketo-core/src/js/utils';
import store from './store';

import settings from './settings';
import connection from './connection';
import utils from './utils';
import { t } from './translator';

const URL_RE = /[a-zA-Z0-9+-.]+?:\/\//;

/** @type {Record<string, string>} */
let instanceAttachments;

/**
 * Initialize the file manager .
 *
 * @return { object } promise boolean or rejection with Error
 */
function init() {
    return Promise.resolve(true);
}

/**
 * Whether the filemanager is waiting for user permissions
 *
 * @return { boolean } [description]
 */
function isWaitingForPermissions() {
    return false;
}

/**
 * Sets instanceAttachments containing filename:url map
 * to use in getFileUrl
 *
 * @param {{filename: string}} attachments - attachments sent with record to be loaded
 */
function setInstanceAttachments(attachments) {
    instanceAttachments = attachments;
}
/**
 * Obtains a url that can be used to show a preview of the file when used
 * as a src attribute.
 *
 * @param  {?string|object} subject - File or filename
 * @return {Promise<string>}         promise url string or rejection with Error
 */
function getFileUrl(subject) {
    return new Promise((resolve, reject) => {
        if (!subject) {
            resolve(null);
        } else if (typeof subject === 'string') {
            const escapedSubject = encodeURIComponent(subject);

            if (subject.startsWith('/') || subject.startsWith('data:')) {
                resolve(subject);
            } else if (
                instanceAttachments &&
                Object.prototype.hasOwnProperty.call(
                    instanceAttachments,
                    escapedSubject
                )
            ) {
                resolve(instanceAttachments[escapedSubject]);
            } else if (
                instanceAttachments &&
                Object.prototype.hasOwnProperty.call(
                    instanceAttachments,
                    subject
                )
            ) {
                resolve(instanceAttachments[subject]);
            } else if (!settings.offline || !store.available) {
                // e.g. in an online-only edit view
                reject(new Error('store not available'));
            } else if (URL_RE.test(subject)) {
                // Any URL values are default binary values. These should only occur in offline-capable views,
                // because the form cache module removed the src attributes
                // (which are /urls/like/this/http:// and are caught above this statement)
                store.survey.resource
                    .get(settings.enketoId, subject)
                    .then((file) => {
                        if (file.item) {
                            resolve(URL.createObjectURL(file.item));
                        } else {
                            reject(new Error('File Retrieval Error'));
                        }
                    })
                    .catch(reject);
            } else {
                // obtain file from storage
                store.record.file
                    .get(_getInstanceId(), subject)
                    .then((file) => {
                        if (file.item) {
                            if (isTooLarge(file.item)) {
                                reject(_getMaxSizeError());
                            } else {
                                resolve(URL.createObjectURL(file.item));
                            }
                        } else {
                            reject(new Error('File Retrieval Error'));
                        }
                    })
                    .catch(reject);
            }
        } else if (typeof subject === 'object') {
            if (isTooLarge(subject)) {
                reject(_getMaxSizeError());
            } else {
                resolve(URL.createObjectURL(subject));
            }
        } else {
            reject(new Error('Unknown error occurred'));
        }
    });
}

/**
 * Similar to getFileURL, except that this one is guaranteed to return an objectURL
 *
 * It is meant for loading images into a canvas.
 *
 * @param  {?string|object} subject - File or filename in local storage
 * @return { object }         promise url string or rejection with Error
 */
function getObjectUrl(subject) {
    return getFileUrl(subject).then((url) => {
        if (/https?:\/\//.test(url)) {
            return connection
                .getMediaFile(url)
                .then((obj) => URL.createObjectURL(obj.item));
        }

        return url;
    });
}

/**
 * Obtain files currently stored in file input elements of open record
 *
 * @return { Promise } A promise that resolves with an array of files
 */
function getCurrentFiles() {
    const fileInputs = [
        ...document.querySelectorAll(
            'form.or input[type="file"], form.or input[type="text"][data-drawing="true"]'
        ),
    ];
    const fileTasks = [];

    const _processNameAndSize = function (input, file) {
        if (file && file.name) {
            // Correct file names by adding a unique-ish postfix
            // First create a clone, because the name property is immutable
            // TODO: in the future, when browser support increase we can invoke
            // the File constructor to do this.
            const newFilename = getFilename(
                file,
                input.dataset.filenamePostfix
            );
            // If file is resized, get Blob representation of data URI
            if (input.dataset.resized && input.dataset.resizedDataURI) {
                file = utils.dataUriToBlobSync(input.dataset.resizedDataURI);
            }
            file = new Blob([file], {
                type: file.type,
            });
            file.name = newFilename;
        }

        return file;
    };

    fileInputs.forEach((input) => {
        if (input.type === 'file') {
            // first get any files inside file input elements
            if (input.files[0]) {
                fileTasks.push(
                    Promise.resolve(_processNameAndSize(input, input.files[0]))
                );
            }
        } else if (input.value) {
            // then from canvases
            const canvas = input
                .closest('.question')
                .querySelector('.draw-widget canvas');
            if (canvas && !URL_RE.test(input.value)) {
                fileTasks.push(
                    new Promise((resolve) =>
                        canvas.toBlob((blob) => {
                            blob.name = input.value;
                            resolve(_processNameAndSize(input, blob));
                        })
                    )
                );
            }
        }
    });

    return Promise.all(fileTasks).then((files) => {
        // get any file names of files that were loaded as DataURI and have remained unchanged (i.e. loaded from Storage)
        fileInputs
            .filter((input) => input.matches('[data-loaded-file-name]'))
            .forEach((input) =>
                files.push(input.getAttribute('data-loaded-file-name'))
            );

        return files;
    });
}

/**
 * Traverses files currently stored in file input elements of open record to find a specific file.
 *
 * @param { string } filename - filename
 * @return { Promise } array of files
 */
function getCurrentFile(filename) {
    // relies on all file names to be unique (which they are)
    return getCurrentFiles().then((files) =>
        files.find((file) => file.name === filename)
    );
}

/**
 * Obtains the instanceId of the current record.
 *
 * @return {?string} [description]
 */
function _getInstanceId() {
    return settings.recordId;
}

/**
 * Whether the file is too large too handle and should be rejected
 *
 * @param  { object }  file - the File
 * @return { boolean } whether file is too large
 */
function isTooLarge(file) {
    return file && file.size > _getMaxSize();
}

function _getMaxSizeError() {
    return new Error(
        t('filepicker.toolargeerror', {
            maxSize: getMaxSizeReadable(),
        })
    );
}

/**
 * Returns the maximum size of a file
 *
 * @return {number} the maximum size of a file in bytes
 */
function _getMaxSize() {
    return settings.maxSize;
}

function getMaxSizeReadable() {
    return `${Math.round((_getMaxSize() * 100) / (1000 * 1000 * 100))}MB`;
}

export default {
    isWaitingForPermissions,
    init,
    setInstanceAttachments,
    getFileUrl,
    getObjectUrl,
    getCurrentFiles,
    getCurrentFile,
    isTooLarge,
    getMaxSizeReadable,
};
