/**
 * Simple file manager with cross-browser support. That uses the FileReader
 * to create previews. Can be replaced with a more advanced version that
 * obtains files from storage.
 *
 * The replacement should support the same public methods and return the same
 * types.
 */

'use strict';

var store = require( './store' );
var settings = require( './settings' );
var $ = require( 'jquery' );
var utils = require( './utils' );
var coreUtils = require( 'enketo-core/src/js/utils' );

var supported = typeof FileReader !== 'undefined';
var notSupportedAdvisoryMsg = '';

var instanceAttachments;

/**
 * Initialize the file manager .
 * @return {[type]} promise boolean or rejection with Error
 */
function init() {

    return new Promise( function( resolve, reject ) {
        if ( supported ) {
            resolve( true );
        } else {
            reject( new Error( 'FileReader not supported.' ) );
        }
    } );
}

/**
 * Whether filemanager is supported in browser
 * @return {Boolean}
 */
function isSupported() {
    return supported;
}

/**
 * Whether the filemanager is waiting for user permissions
 * @return {Boolean} [description]
 */
function isWaitingForPermissions() {
    return false;
}

/**
 * Sets instanceAttachments containing filename:url map
 * to use in getFileUrl 
 */
function setInstanceAttachments( attachments ) {
    instanceAttachments = attachments;
}
/**
 * Obtains a url that can be used to show a preview of the file when used
 * as a src attribute.
 *
 * @param  {?string|Object} subject File or filename
 * @param  {?string} filename filename override
 * @return {[type]}         promise url string or rejection with Error
 */
function getFileUrl( subject, filename ) {
    return new Promise( function( resolve, reject ) {
        if ( !subject ) {
            resolve( null );
        } else if ( typeof subject === 'string' ) {
            if ( instanceAttachments && ( instanceAttachments.hasOwnProperty( subject ) ) ) {
                resolve( instanceAttachments[ subject ] );
            } else if ( !store.isAvailable() ) {
                // e.g. in an online-only edit view
                reject( new Error( 'store not available' ) );
            } else {
                // obtain file from storage
                store.record.file.get( _getInstanceId(), subject )
                    .then( function( file ) {
                        if ( file.item ) {
                            if ( _isTooLarge( file.item ) ) {
                                reject( _getMaxSizeError() );
                            } else {
                                utils.blobToDataUri( file.item )
                                    .then( resolve )
                                    .catch( reject );
                            }
                        } else {
                            reject( new Error( 'File Retrieval Error' ) );
                        }
                    } )
                    .catch( reject );
            }
        } else if ( typeof subject === 'object' ) {
            if ( _isTooLarge( subject ) ) {
                reject( _getMaxSizeError() );
            } else {
                utils.blobToDataUri( subject, filename )
                    .then( resolve )
                    .catch( reject );
            }
        } else {
            reject( new Error( 'Unknown error occurred' ) );
        }
    } );
}

/**
 * Obtain files currently stored in file input elements of open record
 *
 * @return {Promise} array of files
 */
function getCurrentFiles() {
    var files = [];
    var $fileInputs = $( 'form.or input[type="file"], form.or input[type="text"][data-drawing="true"]' );

    // first get any files inside file input elements
    $fileInputs.each( function() {
        var newFilename;
        var file = null;
        var canvas = null;
        if ( this.type === 'file' ) {
            file = this.files[ 0 ]; // Why doesn't this fail for empty file inputs?
        } else if ( this.value ) {
            canvas = $( this ).closest( '.question' )[ 0 ].querySelector( '.draw-widget canvas' );
            if ( canvas ) {
                // TODO: In the future, we could do canvas.toBlob()
                file = utils.dataUriToBlobSync( canvas.toDataURL() );
                file.name = this.value;
            }
        }
        if ( file && file.name ) {
            // Correct file names by adding a unique-ish postfix
            // First create a clone, because the name property is immutable
            // TODO: in the future, when browser support increase we can invoke
            // the File constructor to do this.
            newFilename = coreUtils.getFilename( file, this.dataset.filenamePostfix );
            file = new Blob( [ file ], {
                type: file.type
            } );
            file.name = newFilename;
            files.push( file );
        }
    } );

    // then get any file names of files that were loaded as DataURI and have remained unchanged (.i.e. loaded from Storage)
    $fileInputs.filter( '[data-loaded-file-name]' ).each( function() {
        files.push( $( this ).attr( 'data-loaded-file-name' ) );
    } );

    return files;
}


/**
 * Traverses files currently stored in file input elements of open record to find a specific file.
 *
 * @return {Promise} array of files
 */
function getCurrentFile( filename ) {
    var f;
    // relies on all file names to be unique (which they are)
    getCurrentFiles().some( function( file ) {
        if ( file.name === filename ) {
            f = file;
            return true;
        }
    } );

    return f;
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
 * @param  {[type]}  file the File
 * @return {Boolean}
 */
function _isTooLarge( file ) {
    return file && file.size > _getMaxSize();
}

function _getMaxSizeError() {
    return new Error( 'File too large (max ' +
        ( Math.round( ( _getMaxSize() * 100 ) / ( 1024 * 1024 ) ) / 100 ) +
        ' Mb)' );
}

/**
 * Returns the maximum size of a file
 * @return {Number}
 */
function _getMaxSize() {
    return settings.maxSize || 5 * 1024 * 1024;
}

module.exports = {
    isSupported: isSupported,
    notSupportedAdvisoryMsg: notSupportedAdvisoryMsg,
    isWaitingForPermissions: isWaitingForPermissions,
    init: init,
    setInstanceAttachments: setInstanceAttachments,
    getFileUrl: getFileUrl,
    getCurrentFiles: getCurrentFiles,
    getCurrentFile: getCurrentFile
};
