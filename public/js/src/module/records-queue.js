/**
 * Deals with browser storage
 */

import $ from 'jquery';
import store from './store';

import connection from './connection';
import gui from './gui';
import settings from './settings';
import exporter from './exporter';
import { t } from './translator';
import formCache from './form-cache';
import { setLastSavedRecord } from './last-saved';
import { backoff, cancelBackoff } from './exponential-backoff';

let $exportButton;
let $uploadButton;
let $recordList;
let $queueNumber;
let uploadProgress;
let finalRecordPresent;
let uploadOngoing = false;

/**
 * @typedef {import('../../app/models/record-model').EnketoRecord} EnketoRecord
 */

function init() {
    // TODO: Add export feature

    $exportButton = $('.record-list__button-bar__button.export');
    $uploadButton = $('.record-list__button-bar__button.upload');
    $queueNumber = $('.offline-enabled__queue-length');

    finalRecordPresent = false;
    uploadOngoing = false;

    return _updateRecordList().then(uploadQueue);
}

/**
 * Obtains a record
 *
 * @param  { string } instanceId - instanceID of record
 * @return {Promise<EnketoRecord|undefined>} a Promise that resolves with a record object or undefined
 */
function get(instanceId) {
    return store.record.get(instanceId);
}

/**
 * Stores a new record. Overwrites (media) files from auto-saved record.
 *
 * @param { EnketoRecord } record - a record object
 * @return {Promise<undefined>} a promise that resolves with undefined
 */
function set(record) {
    return getAutoSavedRecord().then((autoSavedRecord) => {
        // Add files from autoSavedRecord in case this record was recovered.
        // A more intelligent way to do is to maintain and check a recovered flag
        // first, and only then replace the files.
        if (autoSavedRecord) {
            record.files = autoSavedRecord.files;
        }

        return store.record.set(record);
    });
}

/**
 * Creates (sets) or updates a record.
 *
 * @param { 'set' | 'update' } action - determines whether to create or update the record
 * @param { EnketoRecord } record - the record to save
 *
 * @return { Promise<EnketoRecord> }
 */
function save(action, record) {
    /** @type { Promise<EnketoRecord> } */
    let promise;

    /** @type { EnketoRecord } */
    let result;

    if (action === 'set') {
        promise = set(record);
    } else {
        promise = store.record.update(record);
    }

    return promise
        .then((record) => {
            result = record;

            return result;
        })
        .then(({ enketoId }) => formCache.get({ enketoId }))
        .then((survey) => setLastSavedRecord(survey, record))
        .then(_updateRecordList)
        .then(() => result);
}

/**
 * Removes a record
 *
 * @param { string } instanceId - instanceID of record
 * @return { Promise<undefined> } a promise that resolves with undefined
 */
function remove(instanceId) {
    return store.record.remove(instanceId).then(_updateRecordList);
}

/**
 * Obtains auto-saved record key
 */
function getAutoSavedKey() {
    return `__autoSave_${settings.enketoId}`;
}

/**
 * Obtains auto-saved record.
 */
function getAutoSavedRecord() {
    return get(getAutoSavedKey());
}

/**
 * Updates auto-saved record
 *
 * @param { EnketoRecord } record - record object created from the current state of the form
 * @return { Promise<Record> }
 */
function updateAutoSavedRecord(record) {
    // prevent this record from accidentally being submitted
    record.draft = true;
    // give an internal name
    record.name = `__autoSave_${Date.now()}`;
    // use the pre-defined key
    record.instanceId = getAutoSavedKey();
    // make the record valid
    record.enketoId = settings.enketoId;

    return store.record.update(record);
    // do not update recordList
}

/**
 * Removes auto-saved record
 */
function removeAutoSavedRecord() {
    return store.record.remove(getAutoSavedKey());
    // do not update recordList
}

/**
 * Gets the countervalue of a new record (guaranteed to be unique)
 *
 * @param  { string } enketoId - Enketo ID
 * @return {Promise<undefined>} Promise that resolves with undefined
 */
function getCounterValue(enketoId) {
    return store.property
        .getSurveyStats(enketoId)
        .then((stats) =>
            !stats || isNaN(stats.recordCount) ? 1 : stats.recordCount + 1
        );
}

/**
 * Marks a record as active (opened)
 *
 * @param { string } instanceId - instanceID of a record
 */
function setActive(instanceId) {
    settings.recordId = instanceId;
    $('.record-list__records')
        .find('.active')
        .removeClass('active')
        .addBack()
        .find(`[data-id="${instanceId}"]`)
        .addClass('active');
}

/** @type {'offline' | 'failure' | null} */
let backoffReason = null;

/**
 * @typedef UploadQueueOptions
 * @property {boolean} isUserTriggered
 * @property {boolean} [isLoading]
 * @property {boolean} [isRetry]
 */

/**
 * Uploads all final records in the queue
 *
 * @param {UploadQueueOptions} [options]
 * @return {Promise<boolean>} resolves true on success
 */
const uploadQueue = async (
    options = { isRetry: false, isUserTriggered: false }
) => {
    const { isRetry, isUserTriggered } = options;
    const successes = [];

    /** @type {string | null} */
    let errorMsg = null;

    /** @type {Error | null} */
    let authError = null;

    if (
        uploadOngoing ||
        (!finalRecordPresent && !isUserTriggered && !isRetry)
    ) {
        return false;
    }

    if (isUserTriggered) {
        cancelBackoff();
    }

    const appearsOnline = await connection.getOnlineStatus();

    if (appearsOnline && backoffReason === 'offline') {
        cancelBackoff();
        backoffReason = null;
    }

    if (!appearsOnline) {
        backoff(uploadQueue);
        backoffReason = 'offline';

        $uploadButton.btnBusyState(false);

        if (isUserTriggered) {
            gui.alert(
                `${t('record-list.msg2')}`,
                t('alert.recordsavesuccess.finalmsg'),
                'info',
                10
            );
        }

        return false;
    }

    uploadOngoing = true;
    $uploadButton.btnBusyState(true);

    const displayableRecords = await getDisplayableRecordList(
        settings.enketoId,
        {
            finalOnly: true,
        }
    );

    if (!displayableRecords || displayableRecords.length === 0) {
        uploadOngoing = false;

        return;
    }

    console.debug(`Uploading queue of ${displayableRecords.length} records.`);

    /**
     * TODO (and notes about this flow, as it wasn't entirely obvious):
     * currently, the call above to {@link getDisplayableRecordList} calls
     * {@link store.record.getAll}, which returns the current queue of
     * non-uploaded records which are "final" (i.e. explicitly submitted by the
     * user, therefore excluding drafts and auto-save records). That call does
     * not, however, resolve file attachments which are in a separate IndexedDB
     * store. Then below we call {@link store.record.get}, which as the comment
     * suggests also queries for each record's file attachments. This is a weird
     * bit of indirection that's doing more work than necessary, and it would
     * probably make more sense to abstract the resolution of file attachments
     * (and perhaps make it an option in the `getAll` call).
     */

    // Get whole records, including files
    const records = await Promise.all(
        displayableRecords.map(({ instanceId }) => store.record.get(instanceId))
    );

    // Perform record uploads sequentially for nicer feedback and to avoid issues when connections are very poor
    // eslint-disable-next-line no-restricted-syntax
    for await (const record of records) {
        try {
            // convert record.files to a simple <File> array
            record.files = record.files.map((object) => {
                // do not add name property if already has one (a File will throw exception)
                if (typeof object.item.name === 'undefined') {
                    object.item.name = object.name;
                }

                return object.item;
            });

            uploadProgress.update(record.instanceId, 'ongoing');

            await connection.uploadQueuedRecord(record);

            successes.push(record.name);
            uploadProgress.update(record.instanceId, 'success');

            await store.record.remove(record.instanceId);
            await store.property.addSubmittedInstanceId(record);
        } catch (error) {
            // catch 401 responses (1 of them)
            if (error.status === 401) {
                authError = error;
            }

            // if any non HTTP error occurs, output the error.message
            errorMsg = error.message || gui.getErrorResponseMsg(error.status);
            uploadProgress.update(record.instanceId, 'error', errorMsg);
        }
    }

    uploadOngoing = false;
    $uploadButton.btnBusyState(false);

    const success = authError == null && successes.length === records.length;

    if (success) {
        // Cancel current backoff if upload is successful
        cancelBackoff();

        gui.feedback(
            t('alert.queuesubmissionsuccess.msg', {
                count: successes.length,
                recordNames: successes.join(', '),
            }),
            7
        );
    } else if (authError == null) {
        // Start/continue upload retries with exponential backoff if upload is not successful
        uploadOngoing = false;
        backoffReason = 'failure';
        backoff(uploadQueue);

        if (isUserTriggered) {
            gui.alert(
                `${t('record-list.msg2')}`,
                t('alert.recordsavesuccess.finalmsg'),
                'info',
                10
            );
        }
    } else {
        gui.confirmLogin(t('confirm.login.queuedMsg'));
    }

    // update the list by properly removing obsolete records, reactivating button(s)
    _updateRecordList();

    return success;
};

/**
 * Creates a zip file of all locally-saved records.
 *
 * @param { string } formTitle - the title of the form
 * @return {Promise<Blob>} a Promise that resolves with a zip file as Blob
 */
function exportToZip(formTitle) {
    $exportButton.prop('disabled', true);

    return exporter
        .recordsToZip(settings.enketoId, formTitle)
        .then((blob) => {
            $exportButton.prop('disabled', false);

            return blob;
        })
        .catch((error) => {
            $exportButton.prop('disabled', false);
            throw error;
        });
}

/**
 * Shows upload progress and record-specific feedback
 *
 * @type { object }
 */
uploadProgress = {
    _getLi(instanceId) {
        return $(`.record-list__records__record[data-id="${instanceId}"]`);
    },
    _reset(instanceId) {
        const $allFinalizedLis = $('.record-list__records').find(
            'li:not([data-draft])'
        );
        // if the current record, is the first finalized record in the list, reset the list
        if ($allFinalizedLis.first().attr('data-id') === instanceId) {
            $allFinalizedLis
                .removeClass('ongoing success error')
                .filter(function () {
                    return !$(this).hasClass('record-list__records__record');
                })
                .remove();
        }
    },
    _updateClass($el, status) {
        $el.removeClass('ongoing success error').addClass(status);
    },
    update(instanceId, status, msg) {
        let $result;
        const $li = this._getLi(instanceId);

        this._reset(instanceId);

        // add display messages (always showing end status)
        if (msg) {
            $result = $(
                `<li data-id="${instanceId}" class="record-list__records__msg ${status}">${msg}</li>`
            ).insertAfter($li);
            window.setTimeout(() => {
                $result.hide(600);
            }, 3000);
        }

        // update the status class
        this._updateClass($li, status);

        // hide successful submissions from record list in side bar
        // they will be properly removed later in _updateRecordList
        if (status === 'success') {
            $li.hide(1500);
        }
    },
};

/**
 * Retrieves a list of records for the active form, excluding auto-saved records.
 * This was isolated from the `_updateRecordList` function to allow testing, and
 * reused in `uploadQueue` to share the behavior.
 *
 * @param { string } enketoId
 * @param { { finalOnly?: boolean } } [options] - Only included records that are 'final' (i.e. not 'draft')
 * @return { Promise<Record[]> } - records to be displayed in the UI
 */
function getDisplayableRecordList(enketoId, { finalOnly = false } = {}) {
    const autoSavedKey = getAutoSavedKey();
    const records = store.record
        .getAll(enketoId, finalOnly)
        .then((records) =>
            records.filter((record) => record.instanceId !== autoSavedKey)
        );

    return records;
}

/**
 * Updates the record list in the UI
 *
 * @return { Promise<undefined> } [description]
 */
function _updateRecordList() {
    let $li;

    // reset the list
    $exportButton.prop('disabled', true);
    $uploadButton.prop('disabled', true);
    $recordList = $('.record-list__records');
    finalRecordPresent = false;

    // rebuild the list
    return getDisplayableRecordList(settings.enketoId).then((records) => {
        // update queue number
        $queueNumber.text(records.length);

        // add 'no records' message
        if (records.length === 0) {
            $recordList
                .empty()
                .append(
                    `<li class="record-list__records--none" data-i18n="record-list.norecords">${t(
                        'record-list.norecords'
                    )}</li>`
                );
        } else {
            $recordList.find('.record-list__records--none').remove();
            $exportButton.prop('disabled', false);
        }

        // remove records that no longer exist
        $recordList.find('.record-list__records__record').each(function () {
            const $rec = $(this);
            if (
                !records.some((rec) => $rec.attr('data-id') === rec.instanceId)
            ) {
                $rec.next('.msg').addBack().remove();
            }
        });

        records.forEach((record) => {
            // if there is at least one record not marked as draft
            if (!record.draft) {
                finalRecordPresent = true;
                $uploadButton.prop('disabled', false);
            }
            $li = uploadProgress._getLi(record.instanceId);
            // Add the record to the list if it doesn't exist already
            // Any submission error messages and class will remain present for existing records.
            if ($li.length === 0) {
                $li = $('<li class="record-list__records__record" />')
                    .attr('data-id', record.instanceId)
                    .appendTo($recordList);
            }
            // add or update properties
            $li.text(record.name).attr('data-draft', !!record.draft);
        });
    });
}

/**
 * Completely flush the form cache (not the record storage)
 *
 * @return {Promise<undefined>} a Promise that resolves with undefined
 */
function flush() {
    return store
        .flushTable('records')
        .then(() => store.flushTable('files'))
        .then(() => {
            console.log('Done! The record store is empty now.');
        });
}

export default {
    init,
    get,
    save,
    remove,
    getAutoSavedKey,
    getAutoSavedRecord,
    getDisplayableRecordList,
    updateAutoSavedRecord,
    removeAutoSavedRecord,
    flush,
    getCounterValue,
    setActive,
    uploadQueue,
    exportToZip,
};
