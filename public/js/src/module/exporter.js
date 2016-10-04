'use strict';

var JSZip = require( 'jszip' );
var store = require( './store' );
var Promise = require( 'lie' );
var utils = require( './utils' );
var fileSaver = require( 'file-saver' );

function recordsToZip( enketoId, formTitle ) {
    var folder;
    var folderName;
    var failures = [];
    var tasks = [];
    var meta = [];
    var name = formTitle || enketoId;
    var zip = new JSZip();

    return store.record.getAll( enketoId )
        .then( function( records ) {
            // sequentially to be kind to indexedDB
            return records.reduce( function( prevPromise, record ) {
                return prevPromise.then( function() {
                    // get the full record with all its files
                    return store.record.get( record.instanceId )
                        .then( function( record ) {
                            var failedFiles = [];
                            var folderMeta;
                            folderName = name + '_' + _formatDate( record.created );
                            // create folder
                            folder = zip.folder( folderName );
                            // add XML file to folder
                            folder.file( folderName + '.xml', '<?xml version="1.0" ?>\n' + record.xml, {
                                date: new Date( record.updated )
                            } );
                            folderMeta = {
                                'folder': folderName,
                                'draft': record.draft,
                                'local name': record.name,
                                'instanceID': record.instanceId
                            };
                            // add media files to folder
                            record.files.forEach( function( file ) {
                                tasks.push( utils.blobToArrayBuffer( file.item )
                                    .then( function( arrayBuffer ) {
                                        // It's unfortunate we have to do this conversion.
                                        // In the future JSZip will probably support Blobs directly.
                                        folder.file( file.name, arrayBuffer );
                                    } )
                                    .catch( function( error ) {
                                        // Don't let failing files prevent export from being created.
                                        console.error( error );
                                        failedFiles.push( file.name );
                                        failures.push( 'Failed to retrieve ' + file.name + ' for record "' + record.name + '".' );
                                    } )
                                );
                            } );

                            return Promise.all( tasks )
                                .then( function() {
                                    if ( failedFiles.length > 0 ) {
                                        folderMeta[ 'failed files' ] = failedFiles;
                                    }
                                    meta.push( folderMeta );
                                } );
                        } );
                } );
            }, Promise.resolve() );
        } )
        .then( function() {
            zip.file( 'meta.json', JSON.stringify( meta, null, 4 ) );
            return zip.generateAsync( {
                type: 'blob'
            } );
        } )
        .then( function( blob ) {
            blob.name = name + '_' + _formatDate( new Date() ) + '.zip';
            fileSaver.saveAs( blob );
            return blob;
        } )
        .then( function( blob ) {
            var error;
            if ( failures.length > 0 ) {
                error = new Error( '<ul class="error-list"><li>' + failures.join( '</li><li>' ) + '</li></ul>' );
                error.exportFile = blob;
                throw error;
            } else {
                return blob;
            }
        } );
}

function _formatDate( date ) {
    var d = new Date( date );

    if ( d.toString() === 'Invalid Date' ) {
        return 'unknown' + Math.floor( Math.random() * 10000 );
    }

    return d.getFullYear() + '-' + _pad( d.getMonth() + 1, 2 ) + '-' + _pad( d.getDate(), 2 ) + '_' + _pad( d.getHours(), 2 ) + '-' + _pad( d.getMinutes(), 2 ) + '-' + _pad( d.getSeconds(), 2 );
}

function _pad( num, l ) {
    var j;
    var str = num.toString();
    var zeros = l - str.length;

    for ( j = 0; j < zeros; j++ ) {
        str = '0' + str;
    }

    return str;
}

module.exports = {
    recordsToZip: recordsToZip
};
