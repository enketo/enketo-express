/**
 * Simple file manager with cross-browser support. That uses the FileReader
 * to create previews. Can be replaced with a more advanced version that
 * obtains files from storage.
 *
 * The replacement should support the same public methods and return the same
 * types.
 */

import store from './store';

import settings from './settings';
import connection from './connection';
import $ from 'jquery';
import utils from './utils';
import { getFilename } from 'enketo-core/src/js/utils';
import { t } from './translator';
let instanceAttachments;

/**
 * Initialize the file manager .
 * @return {[type]} promise boolean or rejection with Error
 */
function init() {
    return Promise.resolve( true );
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
 * @return {[type]}         promise url string or rejection with Error
 */
function getFileUrl( subject ) {
    return new Promise( ( resolve, reject ) => {
        if ( !subject ) {
            resolve( null );
        } else if ( typeof subject === 'string' ) {
            if ( instanceAttachments && ( instanceAttachments.hasOwnProperty( subject ) ) ) {
                resolve( instanceAttachments[ subject ] );
            } else if ( !store.available ) {
                // e.g. in an online-only edit view
                reject( new Error( 'store not available' ) );
            } else {
                // obtain file from storage
                store.record.file.get( _getInstanceId(), subject )
                    .then( file => {
                        if ( file.item ) {
                            if ( isTooLarge( file.item ) ) {
                                reject( _getMaxSizeError() );
                            } else {
                                resolve( URL.createObjectURL( file.item ) );
                            }
                        } else {
                            reject( new Error( 'File Retrieval Error' ) );
                        }
                    } )
                    .catch( reject );
            }
        } else if ( typeof subject === 'object' ) {
            if ( isTooLarge( subject ) ) {
                reject( _getMaxSizeError() );
            } else {
                resolve( URL.createObjectURL( subject ) );
            }
        } else {
            reject( new Error( 'Unknown error occurred' ) );
        }
    } );
}

/**
 * Similar to getFileURL, except that this one is guaranteed to return an objectURL
 * 
 * It is meant for loading images into a canvas.
 * 
 * @param  {?string|Object} subject File or filename in local storage
 * @return {[type]}         promise url string or rejection with Error
 */
function getObjectUrl( subject ) {
    return getFileUrl( subject )
        .then( url => {
            if ( /https?:\/\//.test( url ) ) {
                return connection.getMediaFile( url ).then( obj => URL.createObjectURL( obj.item ) );
            }
            return url;
        } );
}

/**
 * Obtain files currently stored in file input elements of open record
 *
 * @return {Promise} array of files
 */
function getCurrentFiles() {
    const files = [];
    const $fileInputs = $( 'form.or input[type="file"], form.or input[type="text"][data-drawing="true"]' );

    // first get any files inside file input elements
    $fileInputs.each( function() {
        let newFilename;
        let file = null;
        let canvas = null;
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
            newFilename = getFilename( file, this.dataset.filenamePostfix );
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
    let f;
    // relies on all file names to be unique (which they are)
    getCurrentFiles().some( file => {
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
function isTooLarge( file ) {
    return file && file.size > _getMaxSize();
}

function _getMaxSizeError() {
    return new Error( t( 'filepicker.toolargeerror', {
        maxSize: getMaxSizeReadable()
    } ) );
}

/**
 * Returns the maximum size of a file
 * @return {Number}
 */
function _getMaxSize() {
    return settings.maxSize || 5 * 1024 * 1024;
}

function getMaxSizeReadable() {
    return `${Math.round( _getMaxSize() * 100 / ( 1024 * 1024 ) / 100 )}MB`;
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
    getMaxSizeReadable
};
