/**
 * @preserve Copyright 2014 Martijn van de Rijdt
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
 * Deals with communication to the server (in process of being transformed to using Promises)
 */

define( [ 'gui', 'settings', 'store', 'q', 'translator', 'jquery' ], function( gui, settings, store, Q, t, $ ) {
    "use strict";
    var progress, maxSubmissionSize,
        that = this,
        CONNECTION_URL = '/connection',
        // location.search is added to pass the lang= parameter, in case this is used to override browser/system locale
        TRANSFORM_URL = '/transform/xform' + location.search,
        SUBMISSION_URL = ( settings.enketoId ) ? '/submission/' + settings.enketoIdPrefix + settings.enketoId + location.search : null,
        INSTANCE_URL = ( settings.enketoId ) ? '/submission/' + settings.enketoIdPrefix + settings.enketoId : null,
        MAX_SIZE_URL = ( settings.enketoId ) ? '/submission/max-size/' + settings.enketoIdPrefix + settings.enketoId : null,
        currentOnlineStatus = null,
        uploadOngoingID = null,
        uploadOngoingBatchIndex = null,
        uploadResult = {
            win: [],
            fail: []
        },
        uploadBatchesResult = {},
        uploadQueue = [];

    /**
     * Initialize the connection object
     * @param  { boolean=} submissions whether or not to prepare the connection object to deal with submissions
     */
    function init( submissions ) {
        checkOnlineStatus();
        if ( submissions ) {
            _setMaxSubmissionSize();
        }
        window.setInterval( function() {
            checkOnlineStatus();
        }, 15 * 1000 );
    }

    function checkOnlineStatus() {
        var online;
        if ( !uploadOngoingID ) {
            $.ajax( {
                type: 'GET',
                url: CONNECTION_URL,
                cache: false,
                dataType: 'json',
                timeout: 3000,
                complete: function( response ) {
                    //important to check for the content of the no-cache response as it will
                    //start receiving the fallback page specified in the manifest!
                    online = typeof response.responseText !== 'undefined' && /connected/.test( response.responseText );
                    _setOnlineStatus( online );
                }
            } );
        }
    }

    function _setOnlineStatus( newStatus ) {
        if ( newStatus !== currentOnlineStatus ) {
            $( window ).trigger( 'onlinestatuschange', newStatus );
        }
        currentOnlineStatus = newStatus;
    }

    function _cancelSubmissionProcess() {
        uploadOngoingID = null;
        uploadOngoingBatchIndex = null;
        _resetUploadResult();
        uploadQueue = [];
    }

    /**
     * [uploadRecords description]
     * @param  {{name: string, instanceID: string, formData: FormData, batches: number, batchIndex: number}}    record   [description]
     * @param  {boolean=}                                                   force     [description]
     * @param  {Object.<string, Function>=}                             callbacks only used for testing
     * @return {boolean}           [description]
     */
    function uploadRecords( record, force, callbacks ) {
        var sameItemInQueue, sameItemSubmitted, sameItemOngoing;

        force = force || false;
        callbacks = callbacks || null;

        console.debug( 'record to submit: ', record, force, callbacks );

        if ( !record.name || !record.instanceID || !record.formData || !record.batches || typeof record.batchIndex == 'undefined' ) {
            console.error( 'record name, instanceID, formData, batches and/or batchIndex was not defined!', record );
            return false;
        }
        sameItemInQueue = $.grep( uploadQueue, function( item ) {
            return ( record.instanceID === item.instanceID && record.batchIndex === item.batchIndex );
        } );
        sameItemSubmitted = $.grep( uploadResult.win, function( item ) {
            return ( record.instanceID === item.instanceID && record.batchIndex === item.batchIndex );
        } );
        sameItemOngoing = ( uploadOngoingID === record.instanceID && uploadOngoingBatchIndex === record.batchIndex );
        if ( sameItemInQueue.length === 0 && sameItemSubmitted.length === 0 && !sameItemOngoing ) {
            record.forced = force;
            //TODO ADD CALLBACKS TO EACH RECORD??
            uploadQueue.push( record );
            if ( !uploadOngoingID ) {
                _resetUploadResult();
                uploadBatchesResult = {};
                _uploadOne( callbacks );
            }
        }
        //override force property
        //this caters to a situation where the record is already in a queue through automatic uploads, 
        //but the user orders a forced upload
        else {
            sameItemInQueue.forced = force;
        }
        return true;
    }

    /**
     * Uploads a record from the queue
     * @param  {Object.<string, Function>=} callbacks [description]
     */
    function _uploadOne( callbacks ) { //dataXMLStr, name, last){
        var record, content, last, props;

        callbacks = ( typeof callbacks === 'undefined' || !callbacks ) ? {
            complete: function( jqXHR, response ) {
                // this event doesn't appear to be use anywhere
                $( document ).trigger( 'submissioncomplete' );
                _processOpenRosaResponse( jqXHR.status,
                    props = {
                        name: record.name,
                        instanceID: record.instanceID,
                        batches: record.batches,
                        batchIndex: record.batchIndex,
                        forced: record.forced
                    } );
                /**
                 * ODK Aggregrate gets very confused if two POSTs are sent in quick succession,
                 * as it duplicates 1 entry and omits the other but returns 201 for both...
                 * so we wait for the previous POST to finish before sending the next
                 */
                _uploadOne();
            },
            error: function( jqXHR, textStatus ) {
                if ( textStatus === 'timeout' ) {
                    console.debug( 'submission request timed out' );
                } else {
                    console.error( 'error during submission, textStatus:', textStatus );
                }
            },
            success: function() {}
        } : callbacks;

        if ( uploadQueue.length > 0 ) {
            record = uploadQueue.shift();
            progress.update( record, 'ongoing', '' );
            if ( currentOnlineStatus === false ) {
                _processOpenRosaResponse( 0, record );
            } else {
                uploadOngoingID = record.instanceID;
                uploadOngoingBatchIndex = record.batchIndex;
                content = record.formData;
                content.append( 'Date', new Date().toUTCString() );
                console.debug( 'prepared to send: ', content );
                //last = (this.uploadQueue.length === 0) ? true : false;
                _setOnlineStatus( null );
                $( document ).trigger( 'submissionstart' );
                //console.debug('calbacks: ', callbacks );
                $.ajax( SUBMISSION_URL, {
                    type: 'POST',
                    data: content,
                    cache: false,
                    contentType: false,
                    processData: false,
                    headers: {
                        'X-OpenRosa-Version': '1.0'
                    },
                    //TIMEOUT TO BE TESTED WITH LARGE SIZE PAYLOADS AND SLOW CONNECTIONS...
                    timeout: 300 * 1000,
                    //beforeSend: function(){return false;},
                    complete: function( jqXHR, response ) {
                        uploadOngoingID = null;
                        uploadOngoingBatchIndex = null;
                        callbacks.complete( jqXHR, response );
                    },
                    error: callbacks.error,
                    success: callbacks.success
                } );
            }
        }
    }

    progress = {

        _getLi: function( record ) {
            var $lis = $( '.record-list' ).find( '[name="' + record.name + '"]' );
            return $lis;
        },

        _reset: function( record ) {
            var $allLis = $( '.record-list' ).find( 'li' );
            //if the current record, is the first in the list, reset the list
            if ( $allLis.first().attr( 'name' ) === record.name ) {
                $allLis.removeClass( 'ongoing success error' ).filter( function() {
                    return !$( this ).hasClass( 'record' );
                } ).remove();
            }
        },

        _updateClass: function( $el, status ) {
            $el.removeClass( 'ongoing error' ).addClass( status );
        },

        _updateProgressBar: function( status ) {
            var $progress,
                max = uploadQueue.length + uploadResult.win.length + uploadResult.fail.length,
                value = uploadResult.win.length + uploadResult.fail.length;

            max += ( status == 'ongoing' ) ? 1 : 0;

            $progress = $( '.upload-progress' ).attr( {
                'max': max,
                'value': value
            } );

            if ( value === max || max === 1 ) {
                $progress.css( 'visibility', 'hidden' );
            } else {
                $progress.css( 'visibility', 'visible' );
            }
        },

        _getMsg: function( record, status, msg ) {
            if ( record.batches > 1 && msg ) {
                return 'part ' + ( record.batchIndex + 1 ) + ' of ' + record.batches + ': ' + msg;
            } else {
                return ( status === 'error' ) ? msg : '';
            }

            return displayMsg;
        },

        update: function( record, status, msg ) {
            var $result,
                $lis = this._getLi( record ),
                displayMsg = this._getMsg( record, status, msg );

            this._reset( record );

            //add display messages (always showing end status)
            if ( displayMsg ) {
                $result = $( '<li name="' + record.name + '" class="' + status + '">' + displayMsg + '</li>' ).insertAfter( $lis.last() );
                window.setTimeout( function() {
                    $result.hide( 500 );
                }, 3000 );
            }

            this._updateClass( $lis.first(), status );
            this._updateProgressBar( status );

            if ( uploadQueue.length === 0 && status !== 'ongoing' ) {
                $( 'button.upload-records' ).removeAttr( 'disabled' );
            } else {
                $( 'button.upload-records' ).attr( 'disabled', 'disabled' );
            }
        }
    };

    //TODO: move this outside this class?
    /**
     * processes the OpenRosa response
     * @param  {number} status [description]
     * @param  {{name:string, instanceID:string, batches:number, batchIndex:number, forced:boolean}} props  record properties
     */
    function _processOpenRosaResponse( status, props ) {
        var i, waswere, name, namesStr, batchText,
            partial = false,
            msg = '',
            names = [],
            level = 'error',
            supportEmailObj = {
                supportEmail: settings.supportEmail
            },
            contactSupport = t( 'contact.support', supportEmailObj ),
            contactAdmin = t( 'contact.admin' ),
            statusMap = {
                0: {
                    success: false,
                    msg: t( 'submission.http0' )
                },
                200: {
                    success: false,
                    msg: t( 'submission.http2xx' ) + contactSupport
                },
                201: {
                    success: true,
                    msg: t( 'submission.http201' )
                },
                202: {
                    success: true,
                    msg: t( 'submission.http202' )
                },
                '2xx': {
                    success: false,
                    msg: t( 'submission.http2xx' ) + contactSupport
                },
                400: {
                    success: false,
                    msg: t( 'submission.http400' ) + contactAdmin
                },
                403: {
                    success: false,
                    msg: t( 'submission.http403' ) + contactAdmin
                },
                404: {
                    success: false,
                    msg: t( 'submission.http404' )
                },
                '4xx': {
                    success: false,
                    msg: t( 'submission.http4xx' )
                },
                413: {
                    success: false,
                    msg: t( 'submission.http413' ) + contactSupport
                },
                500: {
                    success: false,
                    msg: t( 'submission.http500', supportEmailObj )
                },
                503: {
                    success: false,
                    msg: t( 'submission.http500', supportEmailObj )
                },
                '5xx': {
                    success: false,
                    msg: t( 'submission.http500', supportEmailObj )
                }
            };

        console.debug( 'submission results with status: ' + status + ' for ', props );

        batchText = ( props.batches > 1 ) ? ' (batch #' + ( props.batchIndex + 1 ) + ' out of ' + props.batches + ')' : '';
        props.batchText = batchText;

        if ( typeof statusMap[ status ] !== 'undefined' ) {
            props.msg = statusMap[ status ].msg;
            if ( statusMap[ status ].success === true ) {
                level = 'success';
                if ( props.batches > 1 ) {
                    if ( typeof uploadBatchesResult[ props.instanceID ] == 'undefined' ) {
                        uploadBatchesResult[ props.instanceID ] = [];
                    }
                    uploadBatchesResult[ props.instanceID ].push( props.batchIndex );
                    for ( i = 0; i < props.batches; i++ ) {
                        if ( $.inArray( i, uploadBatchesResult[ props.instanceID ] ) === -1 ) {
                            partial = true;
                        }
                    }
                }
                uploadResult.win.push( props );
            } else if ( statusMap[ status ].success === false ) {
                uploadResult.fail.push( props );
            }
        } else if ( status == 401 ) {
            props.msg = 'Authentication Required.';
            _cancelSubmissionProcess();
            gui.confirmLogin();
        }
        //unforeseen statuscodes
        else if ( status > 500 ) {
            console.error( 'Error during uploading, received unexpected statuscode: ' + status );
            props.msg = statusMap[ '5xx' ].msg;
            uploadResult.fail.push( props );
        } else if ( status > 400 ) {
            console.error( 'Error during uploading, received unexpected statuscode: ' + status );
            props.msg = statusMap[ '4xx' ].msg;
            uploadResult.fail.push( props );
        } else if ( status > 200 ) {
            console.error( 'Error during uploading, received unexpected statuscode: ' + status );
            props.msg = statusMap[ '2xx' ].msg;
            uploadResult.fail.push( props );
        }

        progress.update( props, level, props.msg );

        if ( !partial && level === 'success' ) {
            $( document ).trigger( 'submissionsuccess', [ props.name, props.instanceID ] );
        } else if ( level === 'success' ) {
            console.debug( 'not all batches for instanceID have been submitted, current queue:', uploadQueue );
        }

        if ( uploadQueue.length > 0 ) {
            return;
        }

        console.debug( 'online: ' + currentOnlineStatus, uploadResult );

        if ( uploadResult.win.length > 0 ) {
            for ( i = 0; i < uploadResult.win.length; i++ ) {
                name = uploadResult.win[ i ].name;
                if ( $.inArray( name, names ) === -1 ) {
                    names.push( name );
                    msg = ( typeof uploadResult.win[ i ].msg !== 'undefined' ) ? msg + ( uploadResult.win[ i ].msg ) + ' ' : '';
                }
            }
            waswere = ( names.length > 1 ) ? ' were' : ' was';
            namesStr = names.join( ', ' );
            gui.feedback( namesStr.substring( 0, namesStr.length ) + waswere + ' successfully uploaded!' );
            _setOnlineStatus( true );
        }

        if ( uploadResult.fail.length > 0 ) {
            msg = '';
            //console.debug('upload failed');
            if ( currentOnlineStatus !== false ) {
                for ( i = 0; i < uploadResult.fail.length; i++ ) {
                    //if the record upload was forced
                    if ( uploadResult.fail[ i ].forced ) {
                        msg += uploadResult.fail[ i ].name + uploadResult.fail[ i ].batchText + ': ' + uploadResult.fail[ i ].msg + '<br />';
                    }
                }
                if ( msg ) gui.alert( msg, 'Failed data submission' );
            } else {
                // not sure if there should be any notification if forms fail automatic submission when offline
            }

            if ( status === 0 ) {
                _setOnlineStatus( false );
            }
        }
    }

    /**
     * returns the value of the X-OpenRosa-Content-Length header return by the OpenRosa server for this form
     * if request fails, returns a default value. Won't execute again if request was successful.
     *
     * @return {number} [description]
     */
    function _setMaxSubmissionSize() {
        var storedMaxSize = ( store ) ? store.getRecord( '__maxSize' ) : undefined,
            defaultMaxSize = 5000000,
            absoluteMaxSize = 100 * 1024 * 1024;

        if ( typeof maxSubmissionSize == 'undefined' ) {
            $.ajax( MAX_SIZE_URL, {
                type: 'GET',
                timeout: 5 * 1000,
                dataType: 'json',
                success: function( response ) {
                    if ( response && response.maxSize && !isNaN( response.maxSize ) ) {
                        // setting an absolute max corresponding to value in enketo .htaccess file
                        maxSubmissionSize = ( response.maxSize > absoluteMaxSize ) ? absoluteMaxSize : response.maxSize;
                        // make the value available to other modules without having to add complex dependencies
                        $( document ).data( {
                            "maxSubmissionSize": maxSubmissionSize
                        } );
                        // store the value persistently for offline use
                        if ( store ) {
                            store.setRecord( '__maxSize', maxSubmissionSize );
                        }
                    } else {
                        console.error( MAX_SIZE_URL + ' returned a response that is not a number', response );
                    }
                },
                error: function( jqXHR ) {
                    console.error( MAX_SIZE_URL + ' returned an error', jqXHR );
                }
            } );

            maxSubmissionSize = storedMaxSize || defaultMaxSize;
            $( document ).data( {
                "maxSubmissionSize": maxSubmissionSize
            } );
        }
    }

    function getMaxSubmissionSize() {
        return maxSubmissionSize;
    }

    function _resetUploadResult() {
        uploadResult = {
            win: [],
            fail: []
        };
    }

    function _getUploadResult() {
        return uploadResult;
    }

    function getUploadQueue() {
        return uploadQueue;
    }

    function getUploadOngoingID() {
        return uploadOngoingID;
    }

    /**
     * Sets defaults for optional callbacks if not provided
     * @param  {Object.<string, Function>=} callbacks [description]
     * @return {Object.<string, Function>}           [description]
     */
    function _getCallbacks( callbacks ) {
        callbacks = callbacks || {};
        callbacks.error = callbacks.error || function( jqXHR, textStatus, errorThrown ) {
            console.error( textStatus + ' : ' + errorThrown );
        };
        callbacks.complete = callbacks.complete || function() {};
        callbacks.success = callbacks.success || function() {
            console.log( 'success!' );
        };
        return callbacks;
    }


    /**
     * Obtains HTML Form and XML Model
     *
     * @param  {{serverUrl: ?string=, formId: ?string=, formUrl: ?string=, enketoId: ?string=}  options
     * @return { Promise }
     */
    function getFormParts( props ) {
        var deferred = Q.defer();

        $.ajax( TRANSFORM_URL, {
                type: 'POST',
                data: props
            } )
            .done( function( data ) {
                deferred.resolve( data );
            } )
            .fail( function( jqXHR, textStatus, errorMsg ) {
                var error = jqXHR.responseJSON || new Error( errorMsg );
                error.status = jqXHR.status;
                deferred.reject( error );
            } );

        return deferred.promise;
    }

    /**
     * Obtains cached XML instance
     *
     * @param  {{serverUrl: ?string=, formId: ?string=, formUrl: ?string=, enketoId: ?string=, instanceID: string}  options
     * @return { Promise }
     */
    function getExistingInstance( props ) {
        var deferred = Q.defer();

        $.ajax( INSTANCE_URL, {
                type: 'GET',
                data: props
            } )
            .done( function( data ) {
                deferred.resolve( data );
            } )
            .fail( function( jqXHR, textStatus, errorMsg ) {
                var error = jqXHR.responseJSON || new Error( errorMsg );
                deferred.reject( error );
            } );

        return deferred.promise;
    }

    return {
        init: init,
        uploadRecords: uploadRecords,
        getUploadQueue: getUploadQueue,
        getUploadOngoingID: getUploadOngoingID,
        getMaxSubmissionSize: getMaxSubmissionSize,
        getFormParts: getFormParts,
        getExistingInstance: getExistingInstance,
        // "private" but used for tests:
        _processOpenRosaResponse: _processOpenRosaResponse,
        _getUploadResult: _getUploadResult,
        _resetUploadResult: _resetUploadResult,
        _setOnlineStatus: _setOnlineStatus
    };
} );
