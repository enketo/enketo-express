/**
 * Deals with communication to the server (in process of being transformed to using Promises)
 */

import settings from './settings';
import { t } from './translator';
import utils from './utils';
const parser = new DOMParser();
const CONNECTION_URL = `${settings.basePath}/connection`;
const TRANSFORM_URL = `${settings.basePath}/transform/xform${settings.enketoId ? `/${settings.enketoId}` : ''}`;
const TRANSFORM_HASH_URL = `${settings.basePath}/transform/xform/hash/${settings.enketoId}`;
const INSTANCE_URL = ( settings.enketoId ) ? `${settings.basePath}/submission/${settings.enketoId}` : null;
const MAX_SIZE_URL = ( settings.enketoId ) ? `${settings.basePath}/submission/max-size/${settings.enketoId}` :
    `${settings.basePath}/submission/max-size/?xformUrl=${encodeURIComponent( settings.xformUrl )}`;
const ABSOLUTE_MAX_SIZE = 100 * 1000 * 1000;

/**
/**
 * Checks online status
 */
function getOnlineStatus() {
    return fetch( CONNECTION_URL, { cache: 'no-cache', headers: { 'Content-Type': 'text/plain' } } )
        .then( response => {
            return response.text();
        } )
        // It is important to check for the content of the no-cache response as it will
        // start receiving the fallback page served by the service worker when offline!
        .then( text => /connected/.test( text ) )
        .catch( () => false );
}

/*
 * Uploads a complete record
 *
 * @param  {{xml: string, files: [File]}} record
 * @return { Promise }
 */
function uploadRecord( record ) {
    let batches;

    try {
        batches = _prepareFormDataArray( record );
    } catch ( e ) {
        return Promise.reject( e );
    }

    batches.forEach( batch => {
        batch.instanceId = record.instanceId;
        batch.deprecatedId = record.deprecatedId;
    } );

    // Perform batch uploads sequentially for to avoid issues when connections are very poor and
    // a serious issue with ODK Aggregate (https://github.com/kobotoolbox/enketo-express/issues/400)
    return batches.reduce( ( prevPromise, batch ) => prevPromise.then( () => _uploadBatch( batch ) ), Promise.resolve() )
        .then( results => {
            console.log( 'results of all batches submitted', results );

            return results[ 0 ];
        } );
}

/**
 * Uploads a single batch of a single record.
 *
 * @param {{formData: FormData, failedFiles: [string]}} recordBatch - formData object to send
 * @return { Promise }      [description]
 */
function _uploadBatch( recordBatch ) {
    // Submission URL is dynamic, because settings.submissionParameter only gets populated after loading form from
    // cache in offline mode.
    const submissionUrl = ( settings.enketoId ) ? `${settings.basePath}/submission/${settings.enketoId}${_getQuery()}` : null;
    const controller = new AbortController();

    setTimeout( () => {
        controller.abort();
    }, settings.timeout );

    return fetch( submissionUrl, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'X-OpenRosa-Version': '1.0',
            'X-OpenRosa-Deprecated-Id': recordBatch.deprecatedId,
            'X-OpenRosa-Instance-Id': recordBatch.instanceId
        },
        signal: controller.signal,
        body: recordBatch.formData
    } )
        .then( response => {
            const result = {
                status: response.status,
                failedFiles: ( recordBatch.failedFiles ) ? recordBatch.failedFiles : undefined
            };

            if ( response.status === 400 ){
                // 400 is a generic error. Any message returned by the server is probably more useful.
                // Other more specific statusCodes will get hardcoded and translated messages.
                return response.text()
                    .then( text => {
                        const xmlResponse = parser.parseFromString( text, 'text/xml' );
                        if ( xmlResponse ){
                            const messageEl = xmlResponse.querySelector( 'OpenRosaResponse > message' );
                            if ( messageEl ) {
                                result.message = messageEl.textContent;
                            }
                        }
                        throw result;
                    } );
            } else if ( response.status !== 201  && response.status !== 202 ){
                throw result;
            } else {
                return result;
            }
        } )
        .catch( error => {
            if ( error.name === 'AbortError' && typeof error.status === 'undefined' ){
                error.status = 408;
            }
            throw error;
        } );
}

/**
 * Builds up a record array including media files, divided into batches
 *
 * @param { { name: string, data: string } } record - record object
 */
function _prepareFormDataArray( record ) {
    const recordDoc = parser.parseFromString( record.xml, 'text/xml' );
    const fileElements = Array.prototype.slice.call( recordDoc.querySelectorAll( '[type="file"]' ) ).map( el => {
        el.removeAttribute( 'type' );

        return el;
    } );
    const xmlData = new XMLSerializer().serializeToString( recordDoc.documentElement );
    const xmlSubmissionBlob = new Blob( [ xmlData ], {
        type: 'text/xml'
    } );
    const availableFiles = record.files || [];
    const sizes = [];
    const failedFiles = [];
    const submissionFiles = [];
    let batches = [
        []
    ];
    const batchesPrepped = [];
    const maxSize = settings.maxSize;

    fileElements.forEach( el => {
        let file;
        const nodeName = el.nodeName;
        const fileName = el.textContent;

        // check if file is actually available
        availableFiles.some( f => {
            if ( f.name === fileName ) {
                file = f;

                return true;
            }

            return false;
        } );

        // add the file if it is available
        if ( file ) {
            submissionFiles.push( {
                nodeName,
                file
            } );
            sizes.push( file.size );
        } else {
            failedFiles.push( fileName );
            console.error( `Error occured when trying to retrieve ${fileName}` );
        }
    } );

    if ( submissionFiles.length > 0 ) {
        batches = _divideIntoBatches( sizes, maxSize );
    }

    console.log( `splitting record into ${batches.length} batches to reduce submission size `, batches );

    batches.forEach( batch => {
        let batchPrepped;
        const fd = new FormData();

        fd.append( 'xml_submission_file', xmlSubmissionBlob, 'xml_submission_file' );
        const csrfToken = ( document.cookie.split( '; ' ).find( c => c.startsWith( '__csrf' ) ) || '' ).split( '=' )[1];
        if ( csrfToken ) fd.append( '__csrf', csrfToken );

        // batch with XML data
        batchPrepped = {
            formData: fd,
            failedFiles
        };

        // add any media files to the batch
        batch.forEach( fileIndex => {
            // Not clear what name is appropriate. Since file.name is unique and works, this is used.
            batchPrepped.formData.append( submissionFiles[ fileIndex ].file.name, submissionFiles[ fileIndex ].file, submissionFiles[ fileIndex ].file.name );
        } );

        // push the batch to the array
        batchesPrepped.push( batchPrepped );
    } );

    return batchesPrepped;
}


/**
 * splits an array of file sizes into batches (for submission) based on a limit
 *
 * @param  {Array.<number>} fileSizes -   array of file sizes
 * @param  {number}     limit -   limit in byte size of one chunk (can be exceeded for a single item)
 * @return {Array.<Array.<number>>} array of arrays with index, each secondary array of indices represents a batch
 */

function _divideIntoBatches( fileSizes, limit ) {
    let i;
    let j;
    let batch;
    let batchSize;
    const sizes = [];
    const batches = [];

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
 * @param {object} survey - survey object
 * @return { Promise } a Promise that resolves with the provided survey object with added maxSize property if successful
 */
function getMaximumSubmissionSize( survey ) {
    // TODO: add 5 sec timeout?
    return fetch ( MAX_SIZE_URL )
        .then( response => response.json() )
        .then( data  => {
            if ( data && data.maxSize && !isNaN( data.maxSize ) ) {
                survey.maxSize = Number( data.maxSize ) > ABSOLUTE_MAX_SIZE ? ABSOLUTE_MAX_SIZE : Number( data.maxSize );
            } else {
                console.error( 'Error retrieving maximum submission size. Unexpected response: ', data );
            }
        } )
        .catch( () => {} )
        .then( () => survey );
}

/**
 * Obtains HTML Form, XML Model and External Instances
 *
 * @param { object } props - form properties object
 * @return { Promise } a Promise that resolves with a form parts object
 */
function getFormParts( props ) {

    return _postData( TRANSFORM_URL + _getQuery(), {
        xformUrl: props.xformUrl
    } )
        .then( data => {
            data.enketoId = props.enketoId;
            data.theme = data.theme || utils.getThemeFromFormStr( data.form ) || settings.defaultTheme;

            return _getExternalData( data );
        } );
}

function _postData( url, data = {}  ){
    return _request( url, 'POST', data );
}

function _getData( url, data = {} ){
    return _request( url, 'GET', data );
}

function _request( url, method = 'POST', data = {}  ){
    const options = {
        method,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded','Accept': 'application/json' }
    };
    // add data
    if ( method === 'GET' || method === 'HEAD' ){
        if ( Object.keys( data ).length ){
            const urlObj = new URL( url, location.href );
            const search = urlObj.search.slice( 1 );
            urlObj.search = `?${search}${search ? '&' : ''}${_encodeFormData( data )}`;
            url = urlObj.href;
        }
    } else {
        options.body = _encodeFormData( data );
    }

    return fetch( url, options )
        .then( _throwResponseError )
        .then( response => response.json() )
        .catch(  data => {
            const error = new Error( data.message );
            error.status = data.status;
            throw error;
        } );
}

function _throwResponseError( response ){
    if ( !response.ok ){
        return response.json()
            .then( data => {
                if ( typeof data.status === 'undefined' ){
                    data.status = response.status;
                }
                if ( typeof data.message === 'undefined' ){
                    data.status = response.statusText;
                }
                throw data;
            } );
    } else {
        return response;
    }
}

function _encodeFormData( data ){
    return Object.keys( data )
        .filter( key => data[key] )
        .map( key => encodeURIComponent( key ) + '=' + encodeURIComponent( data[key] ) )
        .join( '&' );
}

function _getExternalData( survey ) {
    const tasks = [];

    try {
        const doc = parser.parseFromString( survey.model, 'text/xml' );

        survey.externalData = [ ...doc.querySelectorAll ( 'instance[id][src]' ) ]
            .map( instance => ( {
                id:  instance.id,
                src: instance.getAttribute( 'src' )
            } ) );

        survey.externalData
            .forEach( ( instance, index ) => {
                tasks.push( _getDataFile( instance.src, survey.languageMap )
                    .then( xmlData => {
                        instance.xml = xmlData;

                        return instance;
                    } )
                    .catch( e => {
                        survey.externalData.splice( index, 1 );
                        // let external data files fail quietly in previews with ?form= parameter
                        if ( !survey.enketoId ){
                            return;
                        }
                        throw e;
                    } ) );
            } );

    } catch ( e ) {
        return Promise.reject( e );
    }

    return Promise.all( tasks )
        .then( () => survey );
}


/**
 * Obtains a media file
 *
 * @param { string } url - a URL to a media file
 * @return {Promise<{url: string, item: Blob}>} a Promise that resolves with a media file object
 */
function getMediaFile( url ) {

    return fetch( url )
        .then( _throwResponseError )
        .then( response =>  response.blob() )
        .then( item => ( { url, item } ) )
        .catch(  data => {
            const error = new Error( data.message || t( 'error.loadfailed', {
                resource: url
            } ) );
            error.status = data.status;
            throw error;
        } );
}

/**
 * Obtains a data/text file
 *
 * @param { string } url - URL to data tile
 * @param {object } languageMap - language map object with language name properties and IANA subtag values
 * @return {Promise<XMLDocument>} a Promise that resolves with an XML Document
 */
function _getDataFile( url, languageMap ) {
    let contentType;

    return fetch( url )
        .then( response => {
            contentType = response.headers.get( 'Content-Type' ).split( ';' )[ 0 ];

            return response.text();
        } )
        .then( responseText => {
            let result;
            switch ( contentType ) {
                case 'text/csv':
                    result = utils.csvToXml( responseText, languageMap );
                    break;
                case 'text/xml':
                    result = parser.parseFromString( responseText, contentType );
                    break;
                default:
                    console.error( 'External data not served with expected Content-Type.', contentType );
                    result = parser.parseFromString( responseText, 'text/xml' );
            }
            if ( result && result.querySelector( 'parsererror' ) && contentType !== 'text/csv' ) {
                console.log( 'Failed to parse external data as XML, am going to try as CSV' );
                result = utils.csvToXml( responseText, languageMap );
            }

            return result;
        } )
        .catch( error => {
            const errorMsg = error.msg || t( 'error.dataloadfailed', {
                url
            } );
            throw new Error( errorMsg );
        } );
}

/**
 * Extracts version from service worker script
 *
 * @param { string } serviceWorkerUrl - service worker URL
 * @return {Promise<string>} a Promise that resolves with the version of the service worker or 'unknown'
 */
function getServiceWorkerVersion( serviceWorkerUrl ) {

    return fetch( serviceWorkerUrl )
        .then( response => {
            return response.text();
        } )
        .then( text => {
            const matches = text.match( /version\s?=\s?'([^\n]+)'/ );

            return matches ? matches[ 1 ] : 'unknown';
        } );
}

function getFormPartsHash() {

    return _postData( TRANSFORM_HASH_URL + _getQuery() )
        .then( data => data.hash );
}

/**
 * Obtains XML instance that is cached at the server
 *
 * @param { object } props - form properties object
 * @return { Promise<string> } a Promise that resolves with an XML instance as text
 */
function getExistingInstance( props ) {
    return _getData( INSTANCE_URL, props );
}

// Note: settings.submissionParameter is only populated after loading form from cache in offline mode.
function _getQuery() {
    return utils.getQueryString( [ settings.languageOverrideParameter, settings.submissionParameter ] );
}

export default {
    uploadRecord,
    getMaximumSubmissionSize,
    getOnlineStatus,
    getFormParts,
    getFormPartsHash,
    getMediaFile,
    getExistingInstance,
    getServiceWorkerVersion,
};
