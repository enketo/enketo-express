/**
 * Simple file manager with cross-browser support. That uses the FileReader
 * to create previews. Can be replaced with a more advanced version that
 * obtains files from storage.
 *
 * The replacement should support the same public methods and return the same
 * types.
 */

define( [ "q", "store", "settings", "jquery" ], function( Q, store, settings, $ ) {
    "use strict";

    var supported = typeof FileReader !== 'undefined',
        notSupportedAdvisoryMsg = '';

    /**
     * Initialize the file manager .
     * @return {[type]} promise boolean or rejection with Error
     */
    function init() {
        var deferred = Q.defer();

        if ( supported ) {
            deferred.resolve( true );
        } else {
            deferred.reject( new Error( 'FileReader not supported.' ) );
        }

        return deferred.promise;
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
     * Obtains a url that can be used to show a preview of the file when used
     * as a src attribute.
     *
     * @param  {?string|Object} subject File or filename
     * @return {[type]}         promise url string or rejection with Error
     */
    function getFileUrl( subject ) {
        var error,
            deferred = Q.defer(),
            reader = new FileReader();

        reader.onload = function( e ) {
            deferred.resolve( e.target.result );
        };
        reader.onerror = function( e ) {
            deferred.reject( error );
        };

        if ( !subject ) {
            deferred.resolve( null );
        } else if ( typeof subject === 'string' ) {
            // obtain file from storage
            store.record.file.get( _getInstanceId(), subject )
                .then( function( file ) {
                    if ( file.item ) {
                        if ( _isTooLarge( file.item ) ) {
                            deferred.reject( _getMaxSizeError() );
                        } else {
                            reader.readAsDataURL( file.item );
                        }
                    } else {
                        deferred.reject( new Error( 'File Retrieval Error' ) );
                    }
                } );
        } else if ( typeof subject === 'object' ) {
            if ( _isTooLarge( subject ) ) {
                deferred.reject( _getMaxSizeError() );
            } else {
                reader.readAsDataURL( subject );
            }
        } else {
            deferred.reject( new Error( 'Unknown error occurred' ) );
        }
        return deferred.promise;
    }

    /**
     * Obtain files currently stored in file input elements of open record
     *
     * @return {Promise} array of files
     */
    function getCurrentFiles() {
        var file,
            files = [],
            $fileInputs = $( 'form.or input[type="file"]' );

        // first get any files inside file input elements
        $fileInputs.each( function() {
            file = this.files[ 0 ];
            if ( file ) {
                files.push( file );
            }
        } );

        // then get any file names of files that were loaded as DataURI and have remained unchanged (.i.e. loaded from Storage)
        $fileInputs.filter( '[data-loaded-file-name]' ).each( function() {
            files.push( $( this ).attr( 'data-loaded-file-name' ) );
        } );

        return files;
    }

    function _getInstanceId() {
        // this isn't right
        return $( '.record-list__records__record.active' ).eq( 0 ).attr( 'data-id' );
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

    return {
        isSupported: isSupported,
        notSupportedAdvisoryMsg: notSupportedAdvisoryMsg,
        isWaitingForPermissions: isWaitingForPermissions,
        init: init,
        getFileUrl: getFileUrl,
        getCurrentFiles: getCurrentFiles
    };
} );
