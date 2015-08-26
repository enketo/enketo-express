/**
 * @preserve Copyright 2014 Martijn van de Rijdt & Harvard Humanitarian Initiative
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Deals with browser storage
 */
'use strict';

var store = require( './store' );
var connection = require( './connection' );
var gui = require( './gui' );
var Q = require( 'q' );
var settings = require( './settings' );
var t = require( './translator' );
var $ = require( 'jquery' );

var $exportButton;
var $uploadButton;
var $recordList;
var $queueNumber;
var uploadProgress;
var autoSaveKey = '__autoSave_' + settings.enketoId;
var uploadOngoing = false;

function init() {
    _setUploadIntervals();

    // TODO: Add export feature

    $exportButton = $( '.record-list__button-bar__button.export' );
    $uploadButton = $( '.record-list__button-bar__button.upload' );
    $queueNumber = $( '.offline-enabled__queue-length' );

    return store.init()
        .then( _updateRecordList );
}

/**
 * Obtains a record
 *
 * @param  {string} instanceId [description]
 * @return {Promise}            [description]
 */
function get( instanceId ) {
    return store.record.get( instanceId );
}

/**
 * Stores a new record
 *
 * @param {*} record [description]
 * @return {Promise}
 */
function set( record ) {
    return store.record.set( record )
        .then( _updateRecordList );
}

/**
 * Updates an existing record
 *
 * @param  {*} record [description]
 * @return {Promise}        [description]
 */
function update( record ) {
    return store.record.update( record )
        .then( _updateRecordList );
}

/**
 * Removes a record
 * @param  {string} intanceId [description]
 * @return {Promise}        [description]
 */
function remove( instanceId ) {
    return store.record.remove( instanceId )
        .then( _updateRecordList );
}

function getAutoSavedKey() {
    return autoSaveKey;
}


function getAutoSavedRecord() {
    return get( autoSaveKey );
}

function updateAutoSavedRecord( record ) {
    // prevent this record from accidentally being submitted
    record.draft = true;
    // give an internal name
    record.name = '__autoSave_' + Date.now();
    // use the pre-defined key
    record.instanceId = autoSaveKey;
    // make the record valid
    record.enketoId = settings.enketoId;

    return update( record );
}

function removeAutoSavedRecord() {
    return remove( autoSaveKey );
}

/**
 * Gets the countervalue of a new record (guaranteed to be unique)
 *
 * @param  {string} enketoId [description]
 * @return {Promise}          [description]
 */
function getCounterValue( enketoId ) {
    return store.property.getSurveyStats( enketoId )
        .then( function( stats ) {
            return !stats || isNaN( stats.recordCount ) ? 1 : stats.recordCount + 1;
        } );
}

/**
 * Marks a record as active (opened)
 *
 * @param {string} instanceId [description]
 */
function setActive( instanceId ) {
    settings.recordId = instanceId;
    $( '.record-list__records' )
        .find( '.active' ).removeClass( 'active' )
        .addBack().find( '[data-id="' + instanceId + '"]' ).addClass( 'active' );
}

/**
 * Sets the interval to upload queued records
 */
function _setUploadIntervals() {
    // one quick upload attempt soon after page load
    setTimeout( function() {
        uploadQueue();
    }, 30 * 1000 );
    // interval to check upload queued records
    setInterval( function() {
        uploadQueue();
    }, 5 * 60 * 1000 );
}

/**
 * Uploads all final records in the queue
 *
 * @return {Promise} [description]
 */
function uploadQueue() {
    var errorMsg,
        successes = [],
        fails = [];

    if ( !uploadOngoing && connection.getOnlineStatus ) {

        uploadOngoing = true;
        $uploadButton.prop( 'disabled', true );

        store.record.getAll( settings.enketoId, true )
            .then( function( records ) {
                if ( !records || records.length === 0 ) {
                    uploadOngoing = false;
                    return;
                }
                console.debug( 'Uploading queue of ' + records.length + ' records.' );
                // Perform record uploads sequentially for nicer feedback and to avoid issues when connections are very poor
                return records.reduce( function( prevPromise, record ) {
                    return prevPromise.then( function() {
                        // get the whole record including files
                        return store.record.get( record.instanceId )
                            .then( function( record ) {
                                // convert record.files to a simple <File> array
                                record.files = record.files.map( function( object ) {
                                    return object.item;
                                } );
                                uploadProgress.update( record.instanceId, 'ongoing', '', successes.length + fails.length, records.length );
                                return connection.uploadRecord( record );
                            } )
                            .then( function( result ) {
                                successes.push( record.name );
                                uploadProgress.update( record.instanceId, 'success', '', successes.length + fails.length, records.length );
                                return store.record.remove( record.instanceId )
                                    .then( function() {
                                        return store.property.addSubmittedInstanceId( record );
                                    } );
                            } )
                            .catch( function( result ) {
                                // if any non HTTP error occurs, output the error.message
                                errorMsg = result.message || gui.getErrorResponseMsg( result.status );
                                fails.push( record.name );
                                uploadProgress.update( record.instanceId, 'error', errorMsg, successes.length + fails.length, records.length );
                            } )
                            .then( function() {
                                if ( successes.length + fails.length === records.length ) {
                                    uploadOngoing = false;
                                    if ( successes.length > 0 ) {
                                        // let gui send a feedback message
                                        $( document ).trigger( 'queuesubmissionsuccess', successes );
                                    }
                                    // update the list by properly removing obsolete records, reactivating button(s)
                                    _updateRecordList();
                                }
                            } );
                    } );
                }, new Q( null ) );
            } );
    }
}

/**
 * Shows upload progress and record-specific feedback
 *
 * @type {Object}
 */
uploadProgress = {
    _getLi: function( instanceId ) {
        return $( '.record-list__records__record[data-id="' + instanceId + '"]' );
    },
    _reset: function( instanceId ) {
        var $allLis = $( '.record-list__records' ).find( 'li' );
        //if the current record, is the first in the list, reset the list
        if ( $allLis.first().attr( 'data-id' ) === instanceId ) {
            $allLis.removeClass( 'ongoing success error' ).filter( function() {
                return !$( this ).hasClass( 'record-list__records__record' );
            } ).remove();
        }
    },
    _updateClass: function( $el, status ) {
        $el.removeClass( 'ongoing success error' ).addClass( status );
    },
    _updateProgressBar: function( index, total ) {
        var $progress;

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
    _getMsg: function( status, msg ) {
        return ( status === 'error' ) ? msg : '';
    },
    update: function( instanceId, status, msg, index, total ) {
        var $result,
            $li = this._getLi( instanceId ),
            displayMsg = this._getMsg( status, msg );

        this._reset( instanceId );

        // add display messages (always showing end status)
        if ( displayMsg ) {
            $result = $( '<li data-id="' + instanceId + '" class="record-list__records__msg ' + status + '">' + displayMsg + '</li>' ).insertAfter( $li );
            window.setTimeout( function() {
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
 * Updates the record list in the UI
 *
 * @return {Promise} [description]
 */
function _updateRecordList() {
    var $li;
    // deferred = Q.defer();

    // reset the list
    $exportButton.prop( 'disabled', true );
    $uploadButton.prop( 'disabled', true );
    $recordList = $( '.record-list__records' );

    // rebuild the list
    return store.record.getAll( settings.enketoId )
        .then( function( records ) {
            records = records || [];

            // remove autoSaved record
            records = records.filter( function( record ) {
                return record.instanceId !== autoSaveKey;
            } );

            // update queue number
            $queueNumber.text( records.length );

            // add 'no records' message
            if ( records.length === 0 ) {
                $recordList.empty().append( '<li class="record-list__records--none">' + t( 'record-list.norecords' ) + '</li>' );
            } else {
                $recordList.find( '.record-list__records--none' ).remove();
            }

            // remove records that no longer exist
            $recordList.find( '.record-list__records__record' ).each( function() {
                var $rec = $( this );
                if ( !records.some( function( rec ) {
                        return $rec.attr( 'data-id' ) === rec.instanceId;
                    } ) ) {
                    $rec.next( '.msg' ).addBack().remove();
                }
            } );

            // TODO enable export button
            // $exportButton.prop( 'disabled', false );

            records.forEach( function( record ) {
                // if there is at least one record not marked as draft
                if ( !record.draft ) {
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
 * @return {Promise} [description]
 */
function flush() {
    return store.flushTable( 'records' )
        .then( function() {
            store.flushTable( 'files' );
        } )
        .then( function() {
            var deferred = Q.defer();
            deferred.resolve();
            console.log( 'Done! The record store is empty now.' );
            return deferred.promise;
        } );
}

module.exports = {
    init: init,
    get: get,
    set: set,
    update: update,
    remove: remove,
    getAutoSavedKey: getAutoSavedKey,
    getAutoSavedRecord: getAutoSavedRecord,
    updateAutoSavedRecord: updateAutoSavedRecord,
    removeAutoSavedRecord: removeAutoSavedRecord,
    flush: flush,
    getCounterValue: getCounterValue,
    setActive: setActive,
    uploadQueue: uploadQueue
};
