/**
 * Deals with communication to the server (in process of being transformed to using Promises)
 */

import settings from './settings';

import { t } from './translator';
import utils from './utils';
import $ from 'jquery';
const parser = new DOMParser();
const CONNECTION_URL = `${settings.basePath}/connection`;
const TRANSFORM_URL = `${settings.basePath}/transform/xform${settings.enketoId ? `/${settings.enketoId}` : ''}`;
const TRANSFORM_HASH_URL = `${settings.basePath}/transform/xform/hash/${settings.enketoId}`;
const INSTANCE_URL = ( settings.enketoId ) ? `${settings.basePath}/submission/${settings.enketoId}` : null;
const MAX_SIZE_URL = ( settings.enketoId ) ? `${settings.basePath}/submission/max-size/${settings.enketoId}` :
    `${settings.basePath}/submission/max-size/?xformUrl=${encodeURIComponent( settings.xformUrl )}`;
const ABSOLUTE_MAX_SIZE = 100 * 1024 * 1024;

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
    return new Promise( ( resolve, reject ) => {
        // Submission URL is dynamic, because settings.submissionParameter only gets populated after loading form from
        // cache in offline mode.
        const submissionUrl = ( settings.enketoId ) ? `${settings.basePath}/submission/${settings.enketoId}${_getQuery()}` : null;

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
            timeout: settings.timeout
        } )
            .done( ( data, textStatus, jqXHR ) => {
                const result = {
                    status: jqXHR.status,
                    failedFiles: ( recordBatch.failedFiles ) ? recordBatch.failedFiles : undefined
                };
                if ( result.status === 201 || result.status === 202 ) {
                    resolve( result );
                } else {
                    reject( result );
                }
            } )
            .fail( jqXHR => {
                let messageEl = null;
                let message = null;
                // 400 is a generic error. Any message returned by the server is probably more useful.
                // Other more specific statusCodes will get harcoded and translated messages.
                if ( jqXHR.status === 400 && jqXHR.responseXML ) {
                    messageEl = jqXHR.responseXML.querySelector( 'OpenRosaResponse > message' );
                    if ( messageEl ) {
                        message = messageEl.textContent;
                    }
                }
                reject( {
                    status: jqXHR.status,
                    message
                } );
            } );
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
    let error;

    //TODO: use fetch
    return new Promise( ( resolve, reject ) => {
        $.ajax( TRANSFORM_URL + _getQuery(), {
            type: 'POST',
            data: {
                serverUrl: props.serverUrl,
                xformId: props.xformId,
                xformUrl: props.xformUrl
            }
        } )
            .done( data => {
                data.enketoId = props.enketoId;
                data.theme = data.theme || utils.getThemeFromFormStr( data.form ) || settings.defaultTheme;
                _getExternalData( data )
                    .then( resolve )
                    .catch( reject );
            } )
            .fail( ( jqXHR, textStatus, errorMsg ) => {
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
    let doc;
    const tasks = [];

    try {
        // TODO: rewrite this
        doc = $.parseXML( survey.model );

        survey.externalData = $( doc ).find( 'instance[id][src]' )
            .map( ( index, el ) => ( {
                id: $( el ).attr( 'id' ),
                src: $( el ).attr( 'src' )
            } ) ).get();
        // end of rewrite TODO

        survey.externalData
            .forEach( ( instance, index ) => {
                tasks.push( _getDataFile( instance.src, survey.languageMap )
                    .then( xmlData => {
                        instance.xml = xmlData;

                        return instance;
                    } )
                    .catch( e => {
                        survey.externalData.splice( index, 1 );
                        // let external data files fail quietly. Rely on Enketo Core to show error.
                        console.error( e );
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
 * JQuery ajax doesn't support blob responses, so we're going native here.
 *
 * @param { string } url - a URL to a media file
 * @return {Promise<{url: string, item: Blob}>} a Promise that resolves with a media file object
 */
function getMediaFile( url ) {
    let error;
    const xhr = new XMLHttpRequest();

    // TODO: use fetch
    return new Promise( ( resolve, reject ) => {
        xhr.onreadystatechange = function() {
            if ( this.readyState === 4 ) {
                if ( this.status >= 200 && this.status < 300 ) {
                    resolve( {
                        url,
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
                    result = ( new DOMParser() ).parseFromString( responseText, contentType );
                    break;
                default:
                    console.error( 'External data not served with expected Content-Type.', contentType );
                    result = ( new DOMParser() ).parseFromString( responseText, 'text/xml' );
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

// TODO: use fetch
function getFormPartsHash() {
    let error;

    return new Promise( ( resolve, reject ) => {
        $.ajax( TRANSFORM_HASH_URL + _getQuery(), {
            type: 'POST'
        } )
            .done( data => {
                resolve( data.hash );
            } )
            .fail( ( jqXHR, textStatus, errorMsg ) => {
                error = new Error( errorMsg );
                error.status = jqXHR.status;
                reject( error );
            } );
    } );
}

/**
 * Obtains XML instance that is cached at the server
 *
 * @param { object } props - form properties object
 * @return { Promise<string> } a Promise that resolves with an XML instance as text
 */
function getExistingInstance( props ) {
    let error;

    return new Promise( ( resolve, reject ) => {
        $.ajax( INSTANCE_URL, {
            type: 'GET',
            data: props
        } )
            .done( data => {
                resolve( data );
            } )
            .fail( ( jqXHR, textStatus, errorMsg ) => {
                error = jqXHR.responseJSON || new Error( errorMsg );
                reject( error );
            } );
    } );
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
