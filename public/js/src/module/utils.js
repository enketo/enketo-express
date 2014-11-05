define( [ 'q' ], function( Q ) {
    "use strict";

    //var hasArrayBufferView = new Blob( [ new Uint8Array( 100 ) ] ).size == 100;

    /**
     * Converts a Blob to a (Base64-coded) dataURL
     *
     * @param  {Blob} blob The blob
     * @return {Promise}
     */
    function blobToDataUri( blob ) {
        var deferred = Q.defer(),
            reader = new window.FileReader();

        reader.onloadend = function() {
            var base64data = reader.result;
            deferred.resolve( base64data );
        };
        reader.onerror = function( e ) {
            deferred.reject( e );
        };

        // There is some quirky Chrome and Safari behaviour if blob is undefined or a string
        // so we peform an additional check
        if ( !( blob instanceof Blob ) ) {
            deferred.reject( new Error( 'TypeError: Require Blob' ) );
        } else {
            reader.readAsDataURL( blob );
        }

        return deferred.promise;
    }

    /**
     * The inverse of blobToDataUri, that converts a dataURL back to a Blob
     *
     * @param  {string} dataURI dataURI
     * @return {Promise}
     */
    function dataUriToBlob( dataURI ) {
        var byteString, mimeString, buffer, array, blob,
            deferred = Q.defer();

        try {
            // convert base64 to raw binary data held in a string
            // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
            byteString = atob( dataURI.split( ',' )[ 1 ] );
            // separate out the mime component
            mimeString = dataURI.split( ',' )[ 0 ].split( ':' )[ 1 ].split( ';' )[ 0 ];

            // write the bytes of the string to an ArrayBuffer
            buffer = new ArrayBuffer( byteString.length );
            array = new Uint8Array( buffer );

            for ( var i = 0; i < byteString.length; i++ ) {
                array[ i ] = byteString.charCodeAt( i );
            }

            /*if ( !hasArrayBufferView ) {
                array = buffer;
            }*/

            // write the ArrayBuffer to a blob
            blob = new Blob( [ array ], {
                type: mimeString
            } );

            deferred.resolve( blob );
        } catch ( e ) {
            deferred.reject( e );
        }

        return deferred.promise;
    }


    function getThemeFromFormStr( formStr ) {
        var matches = formStr.match( /<\s?form .*theme-([A-z]+)/ );
        return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
    }


    function getTitleFromFormStr( formStr ) {
        var matches = formStr.match( /<\s?h3 id="form-title">([A-z\s]+)</ );
        return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
    }

    return {
        blobToDataUri: blobToDataUri,
        dataUriToBlob: dataUriToBlob,
        getThemeFromFormStr: getThemeFromFormStr,
        getTitleFromFormStr: getTitleFromFormStr
    };
} );
