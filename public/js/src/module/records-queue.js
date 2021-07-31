/**
 * Deals with browser storage
 */

import store from './store';

import connection from './connection';
import gui from './gui';
import events from './event';
import settings from './settings';
import exporter from './exporter';
import { t } from './translator';
import $ from 'jquery';
import formCache from './form-cache';
import { setLastSavedRecord } from './last-saved';

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
    _setUploadIntervals();

    // TODO: Add export feature

    $exportButton = $( '.record-list__button-bar__button.export' );
    $uploadButton = $( '.record-list__button-bar__button.upload' );
    $queueNumber = $( '.offline-enabled__queue-length' );

    return _updateRecordList();
}

/**
 * Obtains a record
 *
 * @param  { string } instanceId - instanceID of record
 * @return {Promise<EnketoRecord|undefined>} a Promise that resolves with a record object or undefined
 */
function get( instanceId ) {
    return store.record.get( instanceId );
}

/**
 * Stores a new record. Overwrites (media) files from auto-saved record.
 *
 * @param { EnketoRecord } record - a record object
 * @return {Promise<undefined>} a promise that resolves with undefined
 */
function set( record ) {
    return getAutoSavedRecord()
        .then( autoSavedRecord => {
            // Add files from autoSavedRecord in case this record was recovered.
            // A more intelligent way to do is to maintain and check a recovered flag
            // first, and only then replace the files.
            if ( autoSavedRecord ) {
                record.files = autoSavedRecord.files;
            }

            return store.record.set( record );
        } );
}

/**
 * Creates (sets) or updates a record.
 *
 * @param { 'set' | 'update' } action - determines whether to create or update the record
 * @param { EnketoRecord } record - the record to save
 *
 * @return { Promise<EnketoRecord> }
 */
function save( action, record ) {
    /** @type { Promise<EnketoRecord> } */
    let promise;

    /** @type { EnketoRecord } */
    let result;

    if ( action === 'set' ) {
        promise = set( record );
    } else {
        promise = store.record.update( record );
    }

    return promise
        .then( record => {
            result = record;

            return result;
        } )
        .then( ( { enketoId } ) => formCache.get( { enketoId } ) )
        .then( survey => setLastSavedRecord( survey, record ) )
        .then( _updateRecordList )
        .then( () => result );
}

/**
 * Removes a record
 *
 * @param { string } instanceId - instanceID of record
 * @return { Promise<undefined> } a promise that resolves with undefined
 */
function remove( instanceId ) {
    return store.record.remove( instanceId )
        .then( _updateRecordList );
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
    return get( getAutoSavedKey() );
}

/**
 * Updates auto-saved record
 *
 * @param { EnketoRecord } record - record object created from the current state of the form
 * @return { Promise<Record> }
 */
function updateAutoSavedRecord( record ) {
    // prevent this record from accidentally being submitted
    record.draft = true;
    // give an internal name
    record.name = `__autoSave_${Date.now()}`;
    // use the pre-defined key
    record.instanceId = getAutoSavedKey();
    // make the record valid
    record.enketoId = settings.enketoId;

    return store.record.update( record );
    // do not update recordList
}

/**
 * Removes auto-saved record
 */
function removeAutoSavedRecord() {
    return store.record.remove( getAutoSavedKey() );
    // do not update recordList
}

/**
 * Gets the countervalue of a new record (guaranteed to be unique)
 *
 * @param  { string } enketoId - Enketo ID
 * @return {Promise<undefined>} Promise that resolves with undefined
 */
function getCounterValue( enketoId ) {
    return store.property.getSurveyStats( enketoId )
        .then( stats => !stats || isNaN( stats.recordCount ) ? 1 : stats.recordCount + 1 );
}

/**
 * Marks a record as active (opened)
 *
 * @param { string } instanceId - instanceID of a record
 */
function setActive( instanceId ) {
    settings.recordId = instanceId;
    $( '.record-list__records' )
        .find( '.active' ).removeClass( 'active' )
        .addBack().find( `[data-id="${instanceId}"]` ).addClass( 'active' );
}

/**
 * Sets the interval to upload queued records
 */
function _setUploadIntervals() {
    // one quick upload attempt soon after page load
    setTimeout( () => {
        uploadQueue();
    }, 30 * 1000 );
    // interval to check upload queued records
    setInterval( () => {
        uploadQueue();
    }, 5 * 60 * 1000 );
}

/**
 * Uploads all final records in the queue
 *
 * @return {Promise<undefined>} a Promise that resolves with undefined
 */
function uploadQueue() {
    let errorMsg;
    const successes = [];
    const fails = [];
    let authRequired;

    if ( uploadOngoing || !finalRecordPresent ) {
        return;
    }

    uploadOngoing = true;
    $uploadButton.prop( 'disabled', true );

    return connection.getOnlineStatus()
        .then( appearsOnline => {
            if ( !appearsOnline ) {
                return;
            }

            return getDisplayableRecordList( settings.enketoId, { finalOnly: true } );
        } )
        .then( records => {
            if ( !records || records.length === 0 ) {
                uploadOngoing = false;

                return;
            }
            console.debug( `Uploading queue of ${records.length} records.` );

            // Perform record uploads sequentially for nicer feedback and to avoid issues when connections are very poor
            return records.reduce( ( prevPromise, record ) => prevPromise.then( () => // get the whole record including files
                store.record.get( record.instanceId )
                    .then( record => {
                    // convert record.files to a simple <File> array
                        record.files = record.files.map( object => {
                        // do not add name property if already has one (a File will throw exception)
                            if ( typeof object.item.name === 'undefined' ) {
                                object.item.name = object.name;
                            }

                            return object.item;
                        } );
                        uploadProgress.update( record.instanceId, 'ongoing', '', successes.length + fails.length, records.length );

                        return connection.uploadQueuedRecord( record );
                    } )
                    .then( () => {
                        successes.push( record.name );
                        uploadProgress.update( record.instanceId, 'success', '', successes.length + fails.length, records.length );

                        return store.record.remove( record.instanceId )
                            .then( () => store.property.addSubmittedInstanceId( record ) );
                    } )
                    .catch( result => {
                    // catch 401 responses (1 of them)
                        if ( result.status === 401 ) {
                            authRequired = true;
                        }
                        // if any non HTTP error occurs, output the error.message
                        errorMsg = result.message || gui.getErrorResponseMsg( result.status );
                        fails.push( record.name );
                        uploadProgress.update( record.instanceId, 'error', errorMsg, successes.length + fails.length, records.length );
                    } )
                    .then( () => {
                        if ( successes.length + fails.length === records.length ) {
                            uploadOngoing = false;
                            if ( authRequired ) {
                                gui.confirmLogin();
                            } else if ( successes.length > 0 ) {
                            // let gui send a feedback message
                                document.dispatchEvent( events.QueueSubmissionSuccess( successes ) );
                            }
                            // update the list by properly removing obsolete records, reactivating button(s)
                            _updateRecordList();
                        }
                    } ) ), Promise.resolve() );
        } );
}

/**
 * Creates a zip file of all locally-saved records.
 *
 * @param { string } formTitle - the title of the form
 * @return {Promise<Blob>} a Promise that resolves with a zip file as Blob
 */
function exportToZip( formTitle ) {

    $exportButton.prop( 'disabled', true );

    return exporter.recordsToZip( settings.enketoId, formTitle )
        .then( blob => {
            $exportButton.prop( 'disabled', false );

            return blob;
        } )
        .catch( error => {
            $exportButton.prop( 'disabled', false );
            throw error;
        } );
}

/**
 * Shows upload progress and record-specific feedback
 *
 * @type { object }
 */
uploadProgress = {
    _getLi( instanceId ) {
        return $( `.record-list__records__record[data-id="${instanceId}"]` );
    },
    _reset( instanceId ) {
        const $allLis = $( '.record-list__records' ).find( 'li' );
        //if the current record, is the first in the list, reset the list
        if ( $allLis.first().attr( 'data-id' ) === instanceId ) {
            $allLis.removeClass( 'ongoing success error' ).filter( function() {
                return !$( this ).hasClass( 'record-list__records__record' );
            } ).remove();
        }
    },
    _updateClass( $el, status ) {
        $el.removeClass( 'ongoing success error' ).addClass( status );
    },
    _updateProgressBar( index, total ) {
        let $progress;

        $progress = $( '.record-list__upload-progress' ).attr( {
            'max': total,
            'value': index
        } );

        if ( index === total || total === 1 ) {
            $progress.css( 'visibility', 'hidden' );
        } else {
            $progress.css( 'visibility', 'visible' );
        }
    },
    _getMsg( status, msg ) {
        return ( status === 'error' ) ? msg : '';
    },
    update( instanceId, status, msg, index, total ) {
        let $result;
        const $li = this._getLi( instanceId );
        const displayMsg = this._getMsg( status, msg );

        this._reset( instanceId );

        // add display messages (always showing end status)
        if ( displayMsg ) {
            $result = $( `<li data-id="${instanceId}" class="record-list__records__msg ${status}">${displayMsg}</li>` ).insertAfter( $li );
            window.setTimeout( () => {
                $result.hide( 600 );
            }, 3000 );
        }

        // update the status class
        this._updateClass( $li, status );

        // hide succesful submissions from record list in side bar
        // they will be properly removed later in _updateRecordList
        if ( status === 'success' ) {
            $li.hide( 1500 );
        }

        // update the submissions progress bar
        if ( index && total ) {
            this._updateProgressBar( index, total );
        }
    }
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
function getDisplayableRecordList( enketoId, { finalOnly = false } = {} ) {
    const autoSavedKey = getAutoSavedKey();
    const records = store.record.getAll( enketoId, finalOnly )
        .then( records => {
            return records.filter( record => record.instanceId !== autoSavedKey );
        } );

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
    $exportButton.prop( 'disabled', true );
    $uploadButton.prop( 'disabled', true );
    $recordList = $( '.record-list__records' );
    finalRecordPresent = false;

    // rebuild the list
    return getDisplayableRecordList( settings.enketoId )
        .then( records => {
            // update queue number
            $queueNumber.text( records.length );

            // add 'no records' message
            if ( records.length === 0 ) {
                $recordList.empty().append( `<li class="record-list__records--none" data-i18n="record-list.norecords">${t( 'record-list.norecords' )}</li>` );
            } else {
                $recordList.find( '.record-list__records--none' ).remove();
                $exportButton.prop( 'disabled', false );
            }

            // remove records that no longer exist
            $recordList.find( '.record-list__records__record' ).each( function() {
                const $rec = $( this );
                if ( !records.some( rec => $rec.attr( 'data-id' ) === rec.instanceId ) ) {
                    $rec.next( '.msg' ).addBack().remove();
                }
            } );

            records.forEach( record => {
                // if there is at least one record not marked as draft
                if ( !record.draft ) {
                    finalRecordPresent = true;
                    $uploadButton.prop( 'disabled', false );
                }
                $li = uploadProgress._getLi( record.instanceId );
                // Add the record to the list if it doesn't exist already
                // Any submission error messages and class will remain present for existing records.
                if ( $li.length === 0 ) {
                    $li = $( '<li class="record-list__records__record" />' )
                        .attr( 'data-id', record.instanceId )
                        .appendTo( $recordList );
                }
                // add or update properties
                $li.text( record.name )
                    .attr( 'data-draft', !!record.draft );
            } );
        } );
}

/**
 * Completely flush the form cache (not the record storage)
 *
 * @return {Promise<undefined>} a Promise that resolves with undefined
 */
function flush() {
    return store.flushTable( 'records' )
        .then( () => store.flushTable( 'files' ) )
        .then( () => {
            console.log( 'Done! The record store is empty now.' );

            return;
        } );
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
    exportToZip
};
