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

define( [ 'settings', 'q', 'translator', 'enketo-js/FormModel', 'utils', 'jquery' ], function( settings, Q, t, FormModel, utils, $ ) {
    "use strict";
    var that = this,
        currentOnlineStatus = null,
        CONNECTION_URL = '/connection',
        // location.search is added to pass the lang= parameter, in case this is used to override browser/system locale
        TRANSFORM_URL = '/transform/xform' + location.search,
        TRANSFORM_HASH_URL = '/transform/xform/hash',
        SUBMISSION_URL = ( settings.enketoId ) ? '/submission/' + settings.enketoIdPrefix + settings.enketoId + location.search : null,
        INSTANCE_URL = ( settings.enketoId ) ? '/submission/' + settings.enketoIdPrefix + settings.enketoId : null,
        MAX_SIZE_URL = ( settings.enketoId ) ? '/submission/max-size/' + settings.enketoIdPrefix + settings.enketoId : null,
        DEFAULT_MAX_SIZE = 5 * 1024 * 1024,
        ABSOLUTE_MAX_SIZE = 100 * 1024 * 1024;

    /**
     * Initialize the connection object
     */
    function init() {
        _checkOnlineStatus();
        window.setInterval( function() {
            _checkOnlineStatus();
        }, 15 * 1000 );
    }

    function getOnlineStatus() {
        return currentOnlineStatus;
    }

    /**
     * Checks online status
     */
    function _checkOnlineStatus() {
        var online;

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

    /** 
     * Fires an onlinestatuschange event if the status has changed.
     *
     * @param { boolean } newStatus
     */
    function _setOnlineStatus( newStatus ) {
        if ( newStatus !== currentOnlineStatus ) {
            $( window ).trigger( 'onlinestatuschange', newStatus );
        }
        currentOnlineStatus = newStatus;
    }

    /**
     * Uploads a complete record
     *
     * @param  {{xml: string, files: [File]}} record
     * @return {Promise}
     */
    function uploadRecord( record ) {
        var batches,
            tasks = [],
            deferred = Q.defer();

        try {
            batches = _prepareFormDataArray( record );
        } catch ( e ) {
            deferred.reject( e );
            return deferred.promise;
        }

        batches.forEach( function( batch ) {
            batch.formData.append( 'Date', new Date().toUTCString() );
            tasks.push( _uploadBatch( batch ) );
        } );

        return Q.all( tasks )
            .then( function( results ) {
                console.debug( 'results of all batches submitted', results );
                return results[ 0 ];
            } );
    }

    /**
     * Uploads a single batch of a single record.
     *
     * @param  {{formData: FormData, failedFiles: [string]}} data formData object to send
     * @return {Promise}      [description]
     */
    function _uploadBatch( recordBatch ) {
        var deferred = Q.defer();

        console.log( 'uploading batch with failed Files', recordBatch.failedFiles );

        $.ajax( SUBMISSION_URL, {
                type: 'POST',
                data: recordBatch.formData,
                cache: false,
                contentType: false,
                processData: false,
                headers: {
                    'X-OpenRosa-Version': '1.0'
                },
                timeout: 300 * 1000
            } )
            .done( function( data, textStatus, jqXHR ) {
                var result = {
                    status: jqXHR.status,
                    failedFiles: ( recordBatch.failedFiles ) ? recordBatch.failedFiles : undefined
                };
                if ( result.status === 201 || result.status === 202 ) {
                    deferred.resolve( result );
                } else {
                    deferred.reject( result );
                }
            } )
            .fail( function( jqXHR, textStatus, errorThrown ) {
                // TODO: extract message from XML response?
                deferred.reject( {
                    status: jqXHR.status
                        // message: textStatus
                } );
                if ( jqXHR.status === 0 ) {
                    _setOnlineStatus( false );
                }
            } );

        return deferred.promise;
    }

    /**
     * Builds up a record array including media files, divided into batches
     *
     * @param { { name: string, data: string } } record[ description ]
     */
    function _prepareFormDataArray( record ) {
        var model = new FormModel( record.xml ),
            ///instanceID = model.getInstanceID(),
            $fileNodes = model.$.find( '[type="file"]' ).removeAttr( 'type' ),
            xmlData = model.getStr( false, true ),
            xmlSubmissionBlob = new Blob( [ xmlData ], {
                type: 'text/xml'
            } ),
            availableFiles = record.files || [],
            sizes = [],
            failedFiles = [],
            files = [],
            batches = [
                []
            ],
            batchesPrepped = [],
            maxSize = settings.maxSize;

        $fileNodes.each( function() {
            var file,
                $node = $( this ),
                nodeName = $node.prop( 'nodeName' ),
                fileName = $node.text();

            // check if file is actually available
            availableFiles.some( function( f ) {
                if ( f.name === fileName ) {
                    file = f;
                    return true;
                }
                return false;
            } );

            // add the file if it is available
            if ( file ) {
                files.push( {
                    nodeName: nodeName,
                    file: file
                } );
                sizes.push( file.size );
            } else {
                failedFiles.push( file.name );
                console.error( 'Error occured when trying to retrieve ' + file.name );
            }
        } );

        if ( files.length > 0 ) {
            batches = _divideIntoBatches( sizes, maxSize );
        }

        console.debug( 'splitting record into ' + batches.length + ' batches to reduce submission size ', batches );

        batches.forEach( function( batch, index ) {
            var batchPrepped,
                fd = new FormData();

            fd.append( 'xml_submission_file', xmlSubmissionBlob );

            // batch with XML data
            batchPrepped = {
                //instanceID: instanceID,
                formData: fd,
                failedFiles: failedFiles
                    //batches: batches.length,
                    //batchIndex: index
            };

            // add any media files to the batch
            batch.forEach( function( fileIndex ) {
                batchPrepped.formData.append( files[ fileIndex ].nodeName, files[ fileIndex ].file );
            } );

            // push the batch to the array
            batchesPrepped.push( batchPrepped );
        } );

        return batchesPrepped;
    }


    /**
     * splits an array of file sizes into batches (for submission) based on a limit
     *
     * @param  {Array.<number>} fileSizes   array of file sizes
     * @param  {number}     limit   limit in byte size of one chunk (can be exceeded for a single item)
     * @return {Array.<Array.<number>>} array of arrays with index, each secondary array of indices represents a batch
     */

    function _divideIntoBatches( fileSizes, limit ) {
        var i, j, batch, batchSize,
            sizes = [],
            batches = [];
        //limit = limit || 5 * 1024 * 1024;
        for ( i = 0; i < fileSizes.length; i++ ) {
            sizes.push( {
                'index': i,
                'size': fileSizes[ i ]
            } );
        }
        while ( sizes.length > 0 ) {
            batch = [ sizes[ 0 ].index ];
            batchSize = sizes[ 0 ].size;
            if ( sizes[ 0 ].size < limit ) {
                for ( i = 1; i < sizes.length; i++ ) {
                    if ( ( batchSize + sizes[ i ].size ) < limit ) {
                        batch.push( sizes[ i ].index );
                        batchSize += sizes[ i ].size;
                    }
                }
            }
            batches.push( batch );
            for ( i = 0; i < sizes.length; i++ ) {
                for ( j = 0; j < batch.length; j++ ) {
                    if ( sizes[ i ].index === batch[ j ] ) {
                        sizes.splice( i, 1 );
                    }
                }
            }
        }
        return batches;
    }


    /**
     * Returns the value of the X-OpenRosa-Content-Length header returned by the OpenRosa server for this form.
     *
     * @return {number} [description]
     */
    function getMaximumSubmissionSize() {
        var maxSubmissionSize,
            deferred = Q.defer();

        $.ajax( MAX_SIZE_URL, {
                type: 'GET',
                timeout: 5 * 1000,
                dataType: 'json'
            } )
            .done( function( response ) {
                if ( response && response.maxSize && !isNaN( response.maxSize ) ) {
                    maxSubmissionSize = ( Number( response.maxSize ) > ABSOLUTE_MAX_SIZE ) ? ABSOLUTE_MAX_SIZE : Number( response.maxSize );
                    //DEBUG
                    maxSubmissionSize = 3 * 1024 * 1024;

                    deferred.resolve( maxSubmissionSize );
                } else {
                    console.error( MAX_SIZE_URL + ' returned a response that is not a number', response );
                    deferred.resolve( DEFAULT_MAX_SIZE );
                }
            } )
            .fail( function( jqXHR ) {
                deferred.resolve( DEFAULT_MAX_SIZE );
            } );

        return deferred.promise;
    }


    /**
     * Obtains HTML Form, XML Model and External Instances
     *
     * @param  {{serverUrl: ?string=, formId: ?string=, formUrl: ?string=, enketoId: ?string=}  options
     * @return { Promise }
     */
    function getFormParts( props ) {
        var error,
            deferred = Q.defer();

        $.ajax( TRANSFORM_URL, {
                type: 'POST',
                data: {
                    enketoId: props.enketoId,
                    serverUrl: props.serverUrl,
                    xformId: props.xformId,
                    xformUrl: props.xformUrl
                }
            } )
            .done( function( data ) {
                data.enketoId = props.enketoId;
                //deferred.resolve( data );
                _getExternalData( data )
                    .then( deferred.resolve )
                    .catch( deferred.reject );
            } )
            .fail( function( jqXHR, textStatus, errorMsg ) {
                if ( jqXHR.responseJSON && jqXHR.responseJSON.message && /ENOTFOUND/.test( jqXHR.responseJSON.message ) ) {
                    jqXHR.responseJSON.message = 'Form could not be retrieved from server.';
                }
                error = jqXHR.responseJSON || new Error( errorMsg );
                error.status = jqXHR.status;
                deferred.reject( error );
            } );

        return deferred.promise;
    }

    function _getExternalData( survey ) {
        var doc, deferred,
            tasks = [];

        try {
            doc = $.parseXML( survey.model );

            survey.externalData = $( doc ).find( 'instance[id][src]' ).map( function( index, el ) {
                return {
                    id: el.id,
                    src: $( el ).attr( 'src' )
                };
            } ).get();

            survey.externalData.forEach( function( instance ) {
                tasks.push( _getDataFile( instance.src ).then( function( data ) {
                    // if CSV file, transform to XML
                    instance.xmlStr = ( instance.src.indexOf( '.csv' ) === instance.src.length - 4 ) ? utils.csvToXml( data ) : data;
                    return instance;
                } ) );
            } );
        } catch ( e ) {
            deferred = Q.defer();
            deferred.reject( e );
            return deferred.promise;
        }

        return Q.all( tasks )
            .then( function() {
                return survey;
            } );
    }


    /**
     * Obtains a media file
     * JQuery ajax doesn't support blob responses, so we're going native here.
     *
     * @return {Promise} [description]
     */
    function getMediaFile( url ) {
        var deferred = Q.defer(),
            xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function() {
            if ( this.readyState == 4 && this.status == 200 ) {
                deferred.resolve( {
                    url: url,
                    item: this.response
                } );
            }
            // TODO: add fail handler
        };

        xhr.open( 'GET', url );
        xhr.responseType = 'blob';
        xhr.send();

        return deferred.promise;
    }

    /**
     * Obtains a data/text file
     *
     * @return {Promise} [description]
     */
    function _getDataFile( url ) {
        var deferred = Q.defer();

        $.get( url )
            .done( function( data ) {
                deferred.resolve( data );
            } )
            .fail( function( jqXHR, textStatus, errorMsg ) {
                var error = jqXHR.responseJSON || new Error( errorMsg );
                deferred.reject( error );
            } );

        return deferred.promise;
    }

    /**
     * Extracts version from manifest
     * JQuery ajax doesn't support manifest format reponses, so we're going native here.
     *
     * @return {Promise} [description]
     */
    function getManifestVersion( manifestUrl ) {
        var matches,
            deferred = Q.defer(),
            xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function() {
            if ( this.readyState == 4 && this.status == 200 ) {
                if ( ( matches = this.response.match( /version:\s?([^\n]+)\n/ ) ) ) {
                    deferred.resolve( matches[ 1 ] );
                } else {
                    deferred.reject( new Error( 'No version found in manifest' ) );
                }
            }
            // TODO: add fail handler
        };

        xhr.open( 'GET', manifestUrl );
        xhr.responseType = 'text';
        xhr.send();

        return deferred.promise;
    }

    function getFormPartsHash( props ) {
        var error,
            deferred = Q.defer();

        $.ajax( TRANSFORM_HASH_URL, {
                type: 'POST',
                data: {
                    enketoId: props.enketoId
                }
            } )
            .done( function( data ) {
                deferred.resolve( data.hash );
            } )
            .fail( function( jqXHR, textStatus, errorMsg ) {
                error = new Error( errorMsg );
                error.status = jqXHR.status;
                deferred.reject( error );
            } );

        return deferred.promise;
    }

    /**
     * Obtains XML instance that is cached at the server
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
        uploadRecord: uploadRecord,
        getMaximumSubmissionSize: getMaximumSubmissionSize,
        getOnlineStatus: getOnlineStatus,
        getFormParts: getFormParts,
        getFormPartsHash: getFormPartsHash,
        getMediaFile: getMediaFile,
        getExistingInstance: getExistingInstance,
        getManifestVersion: getManifestVersion
    };
} );
