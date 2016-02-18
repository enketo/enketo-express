/**
 * Deals with communication to the server (in process of being transformed to using Promises)
 */

'use strict';

var settings = require( './settings' );
var t = require( './translator' );
var utils = require( './utils' );
var $ = require( 'jquery' );

var currentOnlineStatus = null;
var CONNECTION_URL = '/connection';
// location.search is added to pass the lang= parameter, in case this is used to override browser/system locale
var TRANSFORM_URL = '/transform/xform' + location.search;
var TRANSFORM_HASH_URL = '/transform/xform/hash';
var EXPORT_URL = '/export/get-url';
var INSTANCE_URL = ( settings.enketoId ) ? '/submission/' + settings.enketoIdPrefix + settings.enketoId : null;
var MAX_SIZE_URL = ( settings.enketoId ) ? '/submission/max-size/' + settings.enketoIdPrefix + settings.enketoId : null;
var DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
var ABSOLUTE_MAX_SIZE = 100 * 1024 * 1024;

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
    var batches;

    try {
        batches = _prepareFormDataArray( record );
    } catch ( e ) {
        return Promise.reject( e );
    }

    batches.forEach( function( batch ) {
        batch.formData.append( 'Date', new Date().toUTCString() );
        batch.instanceId = record.instanceId;
        batch.deprecatedId = record.deprecatedId;
    } );

    // Perform batch uploads sequentially for to avoid issues when connections are very poor and 
    // a serious issue with ODK Aggregate (https://github.com/kobotoolbox/enketo-express/issues/400)
    return batches.reduce( function( prevPromise, batch ) {
            return prevPromise.then( function() {
                return _uploadBatch( batch );
            } );
        }, Promise.resolve() )
        .then( function( results ) {
            console.log( 'results of all batches submitted', results );
            return results[ 0 ];
        } );
}

function getDownloadUrl( zipFile ) {
    return new Promise( function( resolve, reject ) {
        var formData = new FormData();
        formData.append( 'export', zipFile, zipFile.name );

        $.ajax( EXPORT_URL, {
                type: 'POST',
                data: formData,
                cache: false,
                contentType: false,
                processData: false
            } )
            .done( function( data ) {
                resolve( data.downloadUrl );
            } )
            .fail( function( jqXHR, textStatus ) {
                console.error( jqXHR, textStatus );
                reject( new Error( textStatus || 'Failed to connect with Enketo server.' ) );
            } );
    } );
}

/**
 * Uploads a single batch of a single record.
 *
 * @param  {{formData: FormData, failedFiles: [string]}} data formData object to send
 * @return {Promise}      [description]
 */
function _uploadBatch( recordBatch ) {
    return new Promise( function( resolve, reject ) {
        // submission URL is dynamic
        var submissionUrl = ( settings.enketoId ) ? '/submission/' + settings.enketoIdPrefix + settings.enketoId +
            utils.getQueryString( settings.submissionParameter ) : null;
        $.ajax( submissionUrl, {
                type: 'POST',
                data: recordBatch.formData,
                cache: false,
                contentType: false,
                processData: false,
                headers: {
                    'X-OpenRosa-Version': '1.0',
                    'X-OpenRosa-Deprecated-Id': recordBatch.deprecatedId,
                    'X-OpenRosa-Instance-Id': recordBatch.instanceId
                },
                timeout: 300 * 1000
            } )
            .done( function( data, textStatus, jqXHR ) {
                var result = {
                    status: jqXHR.status,
                    failedFiles: ( recordBatch.failedFiles ) ? recordBatch.failedFiles : undefined
                };
                if ( result.status === 201 || result.status === 202 ) {
                    resolve( result );
                } else {
                    reject( result );
                }
            } )
            .fail( function( jqXHR, textStatus ) {
                // TODO: extract message from XML response?
                reject( {
                    status: jqXHR.status
                        // message: textStatus
                } );
                if ( jqXHR.status === 0 ) {
                    _setOnlineStatus( false );
                }
            } );
    } );
}

/**
 * Builds up a record array including media files, divided into batches
 *
 * @param { { name: string, data: string } } record[ description ]
 */
function _prepareFormDataArray( record ) {
    var recordDoc = $.parseXML( record.xml );
    var $fileNodes = $( recordDoc ).find( '[type="file"]' ).removeAttr( 'type' );
    var xmlData = new XMLSerializer().serializeToString( recordDoc.documentElement, 'text/xml' );
    var xmlSubmissionBlob = new Blob( [ xmlData ], {
        type: 'text/xml'
    } );
    var availableFiles = record.files || [];
    var sizes = [];
    var failedFiles = [];
    var submissionFiles = [];
    var batches = [
        []
    ];
    var batchesPrepped = [];
    var maxSize = settings.maxSize;

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
            submissionFiles.push( {
                nodeName: nodeName,
                file: file
            } );
            sizes.push( file.size );
        } else {
            failedFiles.push( fileName );
            console.error( 'Error occured when trying to retrieve ' + fileName );
        }
    } );

    if ( submissionFiles.length > 0 ) {
        batches = _divideIntoBatches( sizes, maxSize );
    }

    console.log( 'splitting record into ' + batches.length + ' batches to reduce submission size ', batches );

    batches.forEach( function( batch ) {
        var batchPrepped;
        var fd = new FormData();

        fd.append( 'xml_submission_file', xmlSubmissionBlob, 'xml_submission_file' );

        // batch with XML data
        batchPrepped = {
            formData: fd,
            failedFiles: failedFiles
        };

        // add any media files to the batch
        batch.forEach( function( fileIndex ) {
            batchPrepped.formData.append( submissionFiles[ fileIndex ].nodeName, submissionFiles[ fileIndex ].file, submissionFiles[ fileIndex ].file.name );
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
    var i;
    var j;
    var batch;
    var batchSize;
    var sizes = [];
    var batches = [];

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
 * @return {Promise} [description]
 */
function getMaximumSubmissionSize() {
    var maxSubmissionSize;

    return new Promise( function( resolve ) {
        if ( MAX_SIZE_URL ) {
            $.ajax( MAX_SIZE_URL, {
                    type: 'GET',
                    timeout: 5 * 1000,
                    dataType: 'json'
                } )
                .done( function( response ) {
                    if ( response && response.maxSize && !isNaN( response.maxSize ) ) {
                        maxSubmissionSize = ( Number( response.maxSize ) > ABSOLUTE_MAX_SIZE ) ? ABSOLUTE_MAX_SIZE : Number( response.maxSize );
                        resolve( maxSubmissionSize );
                    } else {
                        // Note that in /previews the MAX_SIZE_URL is null, which will immediately call this handler
                        resolve( DEFAULT_MAX_SIZE );
                    }
                } )
                .fail( function() {
                    resolve( DEFAULT_MAX_SIZE );
                } );
        } else {
            resolve( DEFAULT_MAX_SIZE );
        }
    } );
}

/**
 * Obtains HTML Form, XML Model and External Instances
 *
 * @param  {{serverUrl: ?string=, formId: ?string=, formUrl: ?string=, enketoId: ?string=}  options
 * @return { Promise }
 */
function getFormParts( props ) {
    var error;

    return new Promise( function( resolve, reject ) {
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
                _getExternalData( data )
                    .then( resolve )
                    .catch( reject );
            } )
            .fail( function( jqXHR, textStatus, errorMsg ) {
                if ( jqXHR.responseJSON && jqXHR.responseJSON.message && /ENOTFOUND/.test( jqXHR.responseJSON.message ) ) {
                    jqXHR.responseJSON.message = 'Form could not be retrieved from server.';
                }
                error = jqXHR.responseJSON || new Error( errorMsg );
                error.status = jqXHR.status;
                reject( error );
            } );
    } );
}

function _getExternalData( survey ) {
    var doc;
    var tasks = [];

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
                // if CSV file, transform to XML String
                instance.xmlStr = ( typeof data === 'string' ) ? utils.csvToXml( data ) : ( new XMLSerializer() ).serializeToString( data );
                return instance;
            } ) );
        } );
    } catch ( e ) {
        return Promise.reject( e );
    }

    return Promise.all( tasks )
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
    var error;
    var xhr = new XMLHttpRequest();

    return new Promise( function( resolve, reject ) {
        xhr.onreadystatechange = function() {
            if ( this.readyState === 4 ) {
                if ( this.status >= 200 && this.status < 300 ) {
                    resolve( {
                        url: url,
                        item: this.response
                    } );
                } else {
                    error = new Error( this.statusText || t( 'error.loadfailed', {
                        resource: url
                    } ) );
                    error.status = this.status;
                    reject( error );
                }
            }
        };

        xhr.open( 'GET', url );
        xhr.responseType = 'blob';
        xhr.send();
    } );
}

/**
 * Obtains a data/text file
 *
 * @return {Promise} [description]
 */
function _getDataFile( url ) {
    var error;

    return new Promise( function( resolve, reject ) {
        $.get( url )
            .done( function( data ) {
                resolve( data );
            } )
            .fail( function( jqXHR, textStatus, errorMsg ) {
                errorMsg = errorMsg || t( 'error.dataloadfailed', {
                    url: url
                } );
                error = jqXHR.responseJSON || new Error( errorMsg );
                reject( error );
            } );
    } );
}

/**
 * Extracts version from manifest
 * JQuery ajax doesn't support manifest format reponses, so we're going native here.
 *
 * @return {Promise} [description]
 */
function getManifestVersion( manifestUrl ) {
    var matches;
    var xhr = new XMLHttpRequest();

    return new Promise( function( resolve, reject ) {
        xhr.onreadystatechange = function() {
            if ( this.readyState === 4 && this.status === 200 ) {
                if ( ( matches = this.response.match( /version:\s?([^\n]+)\n/ ) ) ) {
                    resolve( matches[ 1 ] );
                } else {
                    reject( new Error( 'No version found in manifest' ) );
                }
            }
            // TODO: add fail handler
        };

        xhr.open( 'GET', manifestUrl );
        xhr.responseType = 'text';
        xhr.send();
    } );
}

function getFormPartsHash( props ) {
    var error;

    return new Promise( function( resolve, reject ) {
        $.ajax( TRANSFORM_HASH_URL, {
                type: 'POST',
                data: {
                    enketoId: props.enketoId
                }
            } )
            .done( function( data ) {
                resolve( data.hash );
            } )
            .fail( function( jqXHR, textStatus, errorMsg ) {
                error = new Error( errorMsg );
                error.status = jqXHR.status;
                reject( error );
            } );
    } );
}

/**
 * Obtains XML instance that is cached at the server
 *
 * @param  {{serverUrl: ?string=, formId: ?string=, formUrl: ?string=, enketoId: ?string=, instanceID: string}  options
 * @return { Promise }
 */
function getExistingInstance( props ) {
    var error;

    return new Promise( function( resolve, reject ) {
        $.ajax( INSTANCE_URL, {
                type: 'GET',
                data: props
            } )
            .done( function( data ) {
                resolve( data );
            } )
            .fail( function( jqXHR, textStatus, errorMsg ) {
                error = jqXHR.responseJSON || new Error( errorMsg );
                reject( error );
            } );
    } );
}

module.exports = {
    init: init,
    uploadRecord: uploadRecord,
    getMaximumSubmissionSize: getMaximumSubmissionSize,
    getOnlineStatus: getOnlineStatus,
    getFormParts: getFormParts,
    getFormPartsHash: getFormPartsHash,
    getMediaFile: getMediaFile,
    getExistingInstance: getExistingInstance,
    getManifestVersion: getManifestVersion,
    getDownloadUrl: getDownloadUrl
};
