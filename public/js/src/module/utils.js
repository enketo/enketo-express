'use strict';

var Papa = require( 'papaparse' );
var Promise = require( 'lie' );
var dataUriCache = {};
var coreUtils = require( 'enketo-core/src/js/utils' );

//var hasArrayBufferView = new Blob( [ new Uint8Array( 100 ) ] ).size == 100;

/**
 * Converts a Blob to a (Base64-coded) dataURL
 *
 * @param  {Blob} blob The blob
 * @return {Promise}
 */
function blobToDataUri( blob, filename ) {
    var reader;
    var cacheKey = ( filename ) ? filename : ( blob && blob.name ? blob.name : null );
    var cacheResult = ( cacheKey ) ? dataUriCache[ cacheKey ] : null;

    return new Promise( function( resolve, reject ) {
        if ( cacheResult ) {
            // Using a cache resolves two issues:
            // 1. A mysterious and occasional iOS fileReader NOT_FOUND exception when a File is converted a second time.
            // 2. Reduce rate of linear performance degradation with each image that is added to a record.
            resolve( cacheResult );
        } else if ( !( blob instanceof Blob ) ) {
            // There is some quirky Chrome and Safari behaviour if blob is undefined or a string
            // so we peform an additional check
            reject( new Error( 'TypeError: Require Blob' ) );
        } else {
            reader = new FileReader();
            reader.onloadend = function() {
                var base64data = reader.result;
                if ( cacheKey ) {
                    dataUriCache[ cacheKey ] = base64data;
                }
                resolve( base64data );
            };
            reader.onerror = function( e ) {
                reject( e );
            };
            reader.readAsDataURL( blob );
        }
    } );
}

/**
 * Converts a Blob to a an ArrayBuffer
 *
 * @param  {Blob} blob The blob
 * @return {Promise}
 */
function blobToArrayBuffer( blob ) {
    var reader = new FileReader();

    return new Promise( function( resolve, reject ) {
        reader.onloadend = function() {
            resolve( reader.result );
        };
        reader.onerror = function( e ) {
            reject( e );
        };

        // There is some quirky Chrome and Safari behaviour if blob is undefined or a string
        // so we peform an additional check
        if ( !( blob instanceof Blob ) ) {
            reject( new Error( 'TypeError: Require Blob' ) );
        } else {
            reader.readAsArrayBuffer( blob );
        }
    } );
}

/**
 * The inverse of blobToDataUri, that converts a dataURL back to a Blob
 *
 * @param  {string} dataURI dataURI
 * @return {Promise}
 */
function dataUriToBlob( dataURI ) {
    var blob;

    return new Promise( function( resolve, reject ) {
        try {
            blob = coreUtils.dataUriToBlobSync( dataURI );

            resolve( blob );
        } catch ( e ) {
            reject( e );
        }
    } );
}


function getThemeFromFormStr( formStr ) {
    var matches = formStr.match( /<\s?form .*theme-([A-z-]+)/ );
    return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
}

function getTitleFromFormStr( formStr ) {
    if ( typeof formStr !== 'string' ) {
        return console.error( 'Cannot extract form title. Not a string.' );
    }
    var matches = formStr.match( /<\s?h3 [^>]*id="form-title">([^<]+)</ );
    return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
}

function csvToArray( csv ) {
    var options = {
        skipEmptyLines: true
    };
    var result = Papa.parse( csv.trim(), options );
    if ( result.errors.length ) {
        throw result.errors[ 0 ];
    }
    return result.data;
}

function arrayToXml( rows, langMap ) {
    var xmlStr;
    var headers = rows.shift();
    var langAttrs = [];

    langMap = ( typeof langMap !== 'object' ) ? {} : langMap;

    // trim the headers
    headers = headers.map( function( header ) {
        return header.trim();
    } );

    // extract and strip languages
    headers = headers.map( function( header, index ) {
        var parts = header.split( '::' );
        var lang;
        if ( parts && parts.length === 2 ) {
            lang = langMap[ parts[ 1 ] ] || parts[ 1 ];
            langAttrs[ index ] = ' lang="' + lang + '"';
            return parts[ 0 ];
        } else {
            langAttrs[ index ] = '';
            return header;
        }
    } );

    // check if headers are valid XML node names
    headers.every( _throwInvalidXmlNodeName );

    // create an XML string
    xmlStr = '<root>' +
        rows.map( function( row ) {
            return '<item>' + row.map( function( value, index ) {
                return '<{n}{l}>{v}</{n}>'
                    .replace( /{n}/g, headers[ index ] )
                    .replace( /{l}/, langAttrs[ index ] )
                    .replace( /{v}/, _encodeXmlEntities( value.trim() ) );
            } ).join( '' ) + '</item>';
        } ).join( '' ) +
        '</root>';

    return xmlStr;
}

function csvToXml( csv, langMap ) {
    var result = csvToArray( csv );
    return arrayToXml( result, langMap );
}

/**
 * Generates a querystring from an object or an array of objects with `name` and `value` properties.
 * 
 * @param  {{name: string, value: *}|<{name: string, value: *}>} obj [description]
 * @return {[type]}     [description]
 */
function getQueryString( obj ) {
    var arr;
    var serialized;

    if ( !Array.isArray( obj ) ) {
        arr = [ obj ];
    } else {
        arr = obj;
    }

    serialized = arr.reduce( function( previousValue, item ) {
        var addition = '';
        if ( item && typeof item.name !== 'undefined' && typeof item.value !== 'undefined' && item.value !== '' && item.value !== null ) {
            addition = ( previousValue ) ? '&' : '';
            addition += _serializeQueryComponent( item.name, item.value );
        }
        return previousValue + addition;
    }, '' );

    return ( serialized.length > 0 ) ? '?' + serialized : '';
}

function _serializeQueryComponent( name, value ) {
    var n;
    var serialized = '';

    // for both arrays of single-level objects and regular single-level objects
    if ( typeof value === 'object' ) {
        for ( n in value ) {
            if ( value.hasOwnProperty( n ) ) {
                if ( serialized ) {
                    serialized += '&';
                }
                serialized += encodeURIComponent( name ) + '[' + encodeURIComponent( n ) + ']' +
                    '=' + encodeURIComponent( value[ n ] );
            }
        }
        return serialized;
    }
    return encodeURIComponent( name ) + '=' + encodeURIComponent( value );
}

function _throwInvalidXmlNodeName( name ) {
    // Note: this is more restrictive than XML spec.
    // We cannot accept namespaces prefixes because there is no way of knowing the namespace uri in CSV.
    if ( /^(?!xml)[A-Za-z._][A-Za-z0-9._]*$/.test( name ) ) {
        return true;
    } else {
        throw new Error( 'CSV column heading "' + name + '" cannot be turned into a valid XML element' );
    }
}

function _encodeXmlEntities( str ) {
    return str.replace( /[<>&'"]/g, function( c ) {
        switch ( c ) {
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '&':
                return '&amp;';
            case '\'':
                return '&apos;';
            case '"':
                return '&quot;';
        }
    } );
}

module.exports = {
    blobToDataUri: blobToDataUri,
    blobToArrayBuffer: blobToArrayBuffer,
    dataUriToBlob: dataUriToBlob,
    dataUriToBlobSync: coreUtils.dataUriToBlobSync,
    getThemeFromFormStr: getThemeFromFormStr,
    getTitleFromFormStr: getTitleFromFormStr,
    csvToXml: csvToXml,
    arrayToXml: arrayToXml,
    csvToArray: csvToArray,
    getQueryString: getQueryString
};
