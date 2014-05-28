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
 * Deals with communication to the server
 */

define( [ 'gui', 'settings', 'store', 'jquery' ], function( gui, settings, store, $ ) {
    "use strict";
    var oRosaHelper, progress, maxSubmissionSize,
        that = this,
        CONNECTION_URL = '/checkforconnection.php',
        SUBMISSION_URL = '/data/submission',
        GETSURVEYURL_URL = '/api_v1/survey',
        //this.SUBMISSION_TRIES = 2;
        currentOnlineStatus = null,
        uploadOngoingID = null,
        uploadOngoingBatchIndex = null,
        uploadResult = {
            win: [],
            fail: []
        },
        uploadBatchesResult = {},
        uploadQueue = [];

    //init();

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
        //console.log('checking connection status');
        //navigator.onLine is totally unreliable (returns incorrect trues) on Firefox, Chrome, Safari (on OS X 10.8),
        //but I assume falses are correct
        if ( navigator.onLine ) {
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
                        online = typeof response.responseText !== 'undefined' && response.responseText === 'connected';
                        _setOnlineStatus( online );
                    }
                } );
            }
        } else {
            _setOnlineStatus( false );
        }
    }

    function _setOnlineStatus( newStatus ) {
        //var oldStatus = onlineStatus;
        //onlineStatus = online;
        if ( newStatus !== currentOnlineStatus ) {
            console.log( 'online status changed to: ' + newStatus + ', triggering window.onlinestatuschange' );
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
            contactSupport = 'Contact ' + settings[ 'supportEmail' ] + ' please.',
            contactAdmin = 'Contact the survey administrator please.',
            serverDown = 'Sorry, the data server for your form or the Enketo server is down. Please try again later or contact ' + settings[ 'supportEmail' ] + ' please.',
            statusMap = {
                0: {
                    success: false,
                    msg: ( typeof jrDataStrToEdit !== 'undefined' ) ? "Failed (offline?). Please try again." : "Failed (offline?)."
                },
                200: {
                    success: false,
                    msg: "Data server did not accept data. " + contactSupport
                },
                201: {
                    success: true,
                    msg: "Done!"
                },
                202: {
                    success: true,
                    msg: "Done! (duplicate)"
                },
                '2xx': {
                    success: false,
                    msg: "Unknown error occurred when submitting data. " + contactSupport
                },
                400: {
                    success: false,
                    msg: "Data server did not accept data. " + contactAdmin
                },
                403: {
                    success: false,
                    msg: "Not allowed to post data to this data server. " + contactAdmin
                },
                404: {
                    success: false,
                    msg: "Submission service on data server not found."
                },
                '4xx': {
                    success: false,
                    msg: "Unknown submission problem on data server."
                },
                413: {
                    success: false,
                    msg: "Data is too large. Please contact " + settings[ 'supportEmail' ] + "."
                },
                500: {
                    success: false,
                    msg: serverDown
                },
                503: {
                    success: false,
                    msg: serverDown
                },
                '5xx': {
                    success: false,
                    msg: serverDown
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
        var maxSize,
            storedMaxSize = ( store ) ? store.getRecord( '__maxSize' ) : undefined,
            defaultMaxSize = 5000000,
            absoluteMaxSize = 100 * 1024 * 1024;
        if ( typeof maxSubmissionSize == 'undefined' ) {
            $.ajax( '/data/max_size', {
                type: 'GET',
                timeout: 5 * 1000,
                success: function( response ) {
                    maxSize = parseInt( response, 10 ) || defaultMax;
                    if ( !isNaN( maxSize ) ) {
                        // setting an absolute max corresponding to value in enketo .htaccess file
                        maxSubmissionSize = ( maxSize > absoluteMaxSize ) ? absoluteMaxSize : maxSize;
                        // make the value available to other modules without having to add complex dependencies
                        $( document ).data( {
                            "maxSubmissionSize": maxSubmissionSize
                        } );
                        // store the value persistently for offline use
                        if ( store ) {
                            store.setRecord( '__maxSize', maxSubmissionSize );
                        }
                    } else {
                        console.error( '/data/max_size return a value that is not a number' );
                    }
                },
                error: function( jqXHR ) {
                    console.error( '/data/max_size returned an error', jqXHR );
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

    function isValidURL( url ) {
        return ( /^(https?:\/\/)(([\da-z\.\-]+)\.([a-z\.]{2,6})(:[0-9]{2,4})?|(([0-9]{1,3}\.){3}[0-9]{1,3})(:[0-9]{2,4})?)([\/\w \.\-]*)*\/?[\/\w \.\-\=\&\?]*$/ ).test( url );
    }

    function getFormlist( serverURL, callbacks ) {
        callbacks = _getCallbacks( callbacks );

        if ( !isValidURL( serverURL ) ) {
            callbacks.error( null, 'validationerror', 'not a valid URL' );
            return;
        }
        $.ajax( '/forms/get_list', {
            type: 'GET',
            data: {
                server_url: serverURL
            },
            cache: false,
            contentType: 'json',
            timeout: 60 * 1000,
            success: callbacks.success,
            error: callbacks.error,
            complete: callbacks.complete
        } );
    }

    function getSurveyURL( serverURL, formId, callbacks ) {
        callbacks = _getCallbacks( callbacks );

        if ( !serverURL || !isValidURL( serverURL ) ) {
            callbacks.error( null, 'validationerror', 'not a valid server URL' );
            return;
        }
        if ( !formId || formId.length === 0 ) {
            callbacks.error( null, 'validationerror', 'not a valid formId' );
            return;
        }
        $.ajax( {
            url: GETSURVEYURL_URL,
            type: 'POST',
            data: {
                server_url: serverURL,
                form_id: formId
            },
            cache: false,
            timeout: 60 * 1000,
            dataType: 'json',
            success: callbacks.success,
            error: callbacks.error,
            complete: callbacks.complete
        } );
    }

    /**
     * Obtains HTML Form from an XML file or from a server url and form id
     * @param  {?string=}                   serverURL   full server URL
     * @param  {?string=}                   formId      form ID
     * @param  {Blob=}                      formFile    XForm XML file
     * @param  {?string=}                   formURL     XForm URL
     * @param  {Object.<string, Function>=} callbacks   callbacks
     */
    function getTransForm( serverURL, formId, formFile, formURL, callbacks ) {
        var formData = new FormData();

        callbacks = _getCallbacks( callbacks );
        serverURL = serverURL || null;
        formId = formId || null;
        formURL = formURL || null;
        formFile = formFile || new Blob();

        if ( formFile.size === 0 && ( !serverURL || !formId ) && !formURL ) {
            callbacks.error( null, 'validationerror', 'No form file or URLs provided' );
            return;
        }
        if ( formFile.size === 0 && !isValidURL( serverURL ) && !isValidURL( formURL ) ) {
            callbacks.error( null, 'validationerror', 'Not a valid server or form url' );
            return;
        }
        if ( formFile.size === 0 && !formURL && ( !formId || formId.length === 0 ) ) {
            callbacks.error( null, 'validationerror', 'No form id provided' );
            return;
        }
        //don't append if null, as FF turns null into 'null'
        if ( serverURL ) formData.append( 'server_url', serverURL );
        if ( formId ) formData.append( 'form_id', formId );
        if ( formURL ) formData.append( 'form_url', formURL );
        if ( formFile ) formData.append( 'xml_file', formFile );

        console.debug( 'form file: ', formFile );

        $.ajax( '/transform/get_html_form', {
            type: 'POST',
            cache: false,
            contentType: false,
            processData: false,
            dataType: 'xml',
            data: formData,
            success: callbacks.success,
            error: callbacks.error,
            complete: callbacks.complete
        } );
    }

    function validateHTML( htmlStr, callbacks ) {
        var content = new FormData();

        callbacks = _getCallbacks( callbacks );

        content.append( 'level', 'error' );
        content.append( 'content', htmlStr );

        $.ajax( '/html5validate/', {
            type: 'POST',
            data: content,
            contentType: false,
            processData: false,
            success: callbacks.success,
            error: callbacks.error,
            complete: callbacks.complete
        } );
    }

    /**
     * Collection of helper functions for openRosa connectivity
     * @param {*} conn [description]
     * @constructor
     */
    oRosaHelper = {
        /**
         * Magically generates a well-formed serverURL from a type and fragment
         * @param  {string} type    type of server or account (http, https, formhub_uni, formhub, appspot)
         * @param  {string} frag    a user input for the given type
         * @return {?string}        a full serverURL
         */
        fragToServerURL: function( type, frag ) {
            var protocol,
                serverURL = '';

            if ( !frag ) {
                console.log( 'nothing to do' );
                return null;
            }
            console.debug( 'frag: ' + frag );
            //always override if valid URL is entered
            //TODO: REMOVE reference to connection
            if ( isValidURL( frag ) ) {
                return frag;
            }

            switch ( type ) {
                case 'http':
                case 'https':
                    protocol = ( /^http(|s):\/\//.test( frag ) ) ? '' : type + '://';
                    serverURL = protocol + frag;
                    break;
                case 'formhub_uni':
                case 'formhub':
                    serverURL = 'https://formhub.org/' + frag;
                    break;
                case 'appspot':
                    serverURL = 'https://' + frag + '.appspot.com';
                    break;
            }

            if ( !isValidURL( serverURL ) ) {
                console.error( 'not a valid url: ' + serverURL );
                return null;
            }
            console.log( 'server_url: ' + serverURL );
            return serverURL;
        }
    };

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

    return {
        init: init,
        uploadRecords: uploadRecords,
        getTransForm: getTransForm,
        getUploadQueue: getUploadQueue,
        getUploadOngoingID: getUploadOngoingID,
        validateHTML: validateHTML,
        getFormlist: getFormlist,
        isValidURL: isValidURL,
        getSurveyURL: getSurveyURL,
        getMaxSubmissionSize: getMaxSubmissionSize,
        oRosaHelper: oRosaHelper,
        // "private" but used for tests:
        _processOpenRosaResponse: _processOpenRosaResponse,
        _getUploadResult: _getUploadResult,
        _resetUploadResult: _resetUploadResult,
        _setOnlineStatus: _setOnlineStatus
    };
} );
