import Papa from 'papaparse';
const dataUriCache = {};
import { dataUriToBlobSync } from 'enketo-core/src/js/utils';

//var hasArrayBufferView = new Blob( [ new Uint8Array( 100 ) ] ).size == 100;

/**
 * Converts a Blob to a (Base64-coded) dataURL
 *
 * @param  {Blob} blob The blob
 * @return {Promise}
 */
function blobToDataUri( blob, filename ) {
    let reader;
    const cacheKey = ( filename ) ? filename : ( blob && blob.name ? blob.name : null );
    const cacheResult = ( cacheKey ) ? dataUriCache[ cacheKey ] : null;

    return new Promise( ( resolve, reject ) => {
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
            reader.onloadend = () => {
                const base64data = reader.result;
                if ( cacheKey ) {
                    dataUriCache[ cacheKey ] = base64data;
                }
                resolve( base64data );
            };
            reader.onerror = e => {
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
    const reader = new FileReader();

    return new Promise( ( resolve, reject ) => {
        reader.onloadend = () => {
            resolve( reader.result );
        };
        reader.onerror = e => {
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
    let blob;

    return new Promise( ( resolve, reject ) => {
        try {
            blob = dataUriToBlobSync( dataURI );

            resolve( blob );
        } catch ( e ) {
            reject( e );
        }
    } );
}


function getThemeFromFormStr( formStr ) {
    const matches = formStr.match( /<\s?form .*theme-([A-z-]+)/ );
    return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
}

function getTitleFromFormStr( formStr ) {
    if ( typeof formStr !== 'string' ) {
        return console.error( 'Cannot extract form title. Not a string.' );
    }
    const matches = formStr.match( /<\s?h3 [^>]*id="form-title">([^<]+)</ );
    return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
}

function csvToArray( csv ) {
    const options = {
        skipEmptyLines: true
    };
    const result = Papa.parse( csv.trim(), options );
    if ( result.errors.length ) {
        throw result.errors[ 0 ];
    }
    return result.data;
}

function arrayToXml( rows, langMap ) {
    //var xmlStr;
    let headers = rows.shift();
    //var langAttrs = [];
    const langs = [];

    langMap = ( typeof langMap !== 'object' ) ? {} : langMap;

    // Trim the headings
    headers = headers.map( header => header.trim() );

    // Extract and strip languages from headers
    headers = headers.map( ( header, index ) => {
        const parts = header.split( '::' );
        let lang;
        if ( parts && parts.length === 2 ) {
            lang = langMap[ parts[ 1 ] ] || parts[ 1 ];
            //langAttrs[ index ] = ' lang="' + lang + '"';
            langs[ index ] = lang;
            return parts[ 0 ];
        } else {
            langs[ index ] = '';
            return header;
        }
    } );

    // Check if headers are valid XML node names
    headers.every( _throwInvalidXmlNodeName );

    // create an XML Document
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString( '<root></root>', 'text/xml' );
    rows.forEach( row => {
        const item = xmlDoc.createElement( 'item' );
        xmlDoc.firstChild.appendChild( item );
        row.forEach( ( value, index ) => {
            const node = xmlDoc.createElement( headers[ index ] );
            if ( langs[ index ] ) {
                node.setAttribute( 'lang', langs[ index ] );
            }
            // encoding of XML entities is done automatically
            node.textContent = value.trim();
            item.appendChild( node );
        } );
    } );
    return xmlDoc;
}

function csvToXml( csv, langMap ) {
    const result = csvToArray( csv );
    return arrayToXml( result, langMap );
}

/**
 * Generates a querystring from an object or an array of objects with `name` and `value` properties.
 * 
 * @param  {{name: string, value: *}|<{name: string, value: *}>} obj [description]
 * @return {[type]}     [description]
 */
function getQueryString( obj ) {
    let arr;
    let serialized;

    if ( !Array.isArray( obj ) ) {
        arr = [ obj ];
    } else {
        arr = obj;
    }

    serialized = arr.reduce( ( previousValue, item ) => {
        let addition = '';
        if ( item && typeof item.name !== 'undefined' && typeof item.value !== 'undefined' && item.value !== '' && item.value !== null ) {
            addition = ( previousValue ) ? '&' : '';
            addition += _serializeQueryComponent( item.name, item.value );
        }
        return previousValue + addition;
    }, '' );

    return ( serialized.length > 0 ) ? `?${serialized}` : '';
}

function _serializeQueryComponent( name, value ) {
    let n;
    let serialized = '';

    // for both arrays of single-level objects and regular single-level objects
    if ( typeof value === 'object' ) {
        for ( n in value ) {
            if ( value.hasOwnProperty( n ) ) {
                if ( serialized ) {
                    serialized += '&';
                }
                serialized += `${encodeURIComponent( name )}[${encodeURIComponent( n )}]=${encodeURIComponent( value[ n ] )}`;
            }
        }
        return serialized;
    }
    return `${encodeURIComponent( name )}=${encodeURIComponent( value )}`;
}

function _throwInvalidXmlNodeName( name ) {
    // Note: this is more restrictive than XML spec.
    // We cannot accept namespaces prefixes because there is no way of knowing the namespace uri in CSV.
    if ( /^(?!xml)[A-Za-z._][A-Za-z0-9._]*$/.test( name ) ) {
        return true;
    } else {
        throw new Error( `CSV column heading "${name}" cannot be turned into a valid XML element` );
    }
}

export default {
    blobToDataUri,
    blobToArrayBuffer,
    dataUriToBlob,
    dataUriToBlobSync, // why export this?
    getThemeFromFormStr,
    getTitleFromFormStr,
    csvToXml,
    arrayToXml,
    csvToArray,
    getQueryString
};
