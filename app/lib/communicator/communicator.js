'use strict';

var request = require( 'request' );
var Auth = require( 'request/lib/auth' ).Auth;
var TError = require( '../custom-error' ).TranslatedError;
var Promise = require( 'lie' );
var config = require( '../../models/config-model' ).server;
var debug = require( 'debug' )( 'openrosa-communicator' );
var parser = new require( 'xml2js' ).Parser();

/**
 * Gets form info
 *
 * @param  {*}     survey  survey object
 * @return {[type]}               promise
 */
function getXFormInfo( survey ) {
    if ( !survey || !survey.openRosaServer ) {
        throw new Error( 'No server provided.' );
    }

    return _request( {
        url: getFormListUrl( survey.openRosaServer, survey.openRosaId ),
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie
        }
    } ).then( function( formListXml ) {
        return _findFormAddInfo( formListXml, survey );
    } );
}

/**
 * Gets XForm from url
 *
 * @param  {*}    survey  survey object
 * @return {[type]}         promise
 */
function getXForm( survey ) {

    return _request( {
        url: survey.info.downloadUrl,
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie
        }
    } ).then( function( xform ) {
        survey.xform = xform;
        return Promise.resolve( survey );
    } );
}


/**
 * Obtains the XForm manifest
 *
 * @param  {[type]} survey survey object
 * @return {[type]}        promise
 */
function getManifest( survey ) {

    if ( !survey.info.manifestUrl ) {
        // a manifest is optional
        return Promise.resolve( survey );
    } else {
        return _request( {
                url: survey.info.manifestUrl,
                auth: survey.credentials,
                headers: {
                    cookie: survey.cookie
                }
            } )
            .then( _xmlToJson )
            .then( function( obj ) {
                survey.manifest = ( obj.manifest && obj.manifest.mediaFile ) ? obj.manifest.mediaFile.map( function( file ) {
                    return _simplifyFormObj( file );
                } ) : [];
                return survey;
            } );
    }
}

/**
 * Checks the maximum acceptable submission size the server accepts
 * @param  {[type]} survey survey object
 * @return {[type]}        promise
 */
function getMaxSize( survey ) {
    var server;
    var submissionUrl;
    var options;

    server = survey.openRosaServer;
    submissionUrl = ( server.lastIndexOf( '/' ) === server.length - 1 ) ? server + 'submission' : server + '/submission';

    options = {
        url: submissionUrl,
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie
        },
        method: 'head'
    };

    return _request( options )
        .then( function( response ) {
            return response.headers[ 'x-openrosa-accept-content-length' ];
        } );
}

function authenticate( survey ) {
    var options = {
        url: getFormListUrl( survey.openRosaServer, survey.openRosaId ),
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie
        },
        // Formhub has a bug and cannot use the correct HEAD method.
        method: config[ 'linked form and data server' ][ 'legacy formhub' ] ? 'get' : 'head',
    };

    return _request( options )
        .then( function() {
            debug( 'successful (authenticated if it was necessary)' );
            return survey;
        } );
}

/**
 * Generates an Auhorization header that can be used to inject into piped requests (e.g. submissions).
 * 
 * @param  {string} url         [description]
 * @param  {?{user: string, pass: string}=} credentials [description]
 * @return {string}             [description]
 */
function getAuthHeader( url, credentials ) {
    var auth;
    var authHeader;
    var options = {
        url: url,
        method: 'head',
        headers: {
            'X-OpenRosa-Version': '1.0'
        }
    };

    return new Promise( function( resolve ) {
        var req = request( options, function( error, response ) {
            if ( response.statusCode === 401 && credentials && credentials.user && credentials.pass ) {
                // Using request's internal library we create an appropiate authorization header.
                // This is a bit dangerous because internal changes in request/request, could break this code.
                req.method = 'POST';
                auth = new Auth( req );
                auth.hasAuth = true;
                auth.user = credentials.user;
                auth.pass = credentials.pass;
                authHeader = auth.onResponse( response );
                resolve( authHeader );
            } else {
                resolve( null );
            }
        } );
    } );
}

function getFormListUrl( server, id ) {
    var query = ( id ) ? '?formID=' + id : '';
    var path = ( server.lastIndexOf( '/' ) === server.length - 1 ) ? 'formList' : '/formList';
    return server + path + query;
}

function getSubmissionUrl( server ) {
    return ( server.lastIndexOf( '/' ) === server.length - 1 ) ? server + 'submission' : server + '/submission';
}

function getUpdatedRequestOptions( options ) {
    options.method = options.method || 'get';

    // set headers
    options.headers = options.headers || {};
    options.headers[ 'X-OpenRosa-Version' ] = '1.0';

    if ( !options.headers.cookie ) {
        // remove undefined cookie
        delete options.headers.cookie;
    }

    // set Authorization header
    if ( !options.auth ) {
        delete options.auth;
    } else {
        // check first is DIGEST or BASIC is required
        options.auth.sendImmediately = false;
    }

    return options;
}

/**
 * Sends a request to an OpenRosa server
 *
 * @param  { * } url  request options object
 * @return {?string=}    promise
 */
function _request( options ) {
    var error;
    var method;

    return new Promise( function( resolve, reject ) {
        if ( typeof options !== 'object' && !options.url ) {
            error = new Error( 'Bad request. No options provided.' );
            error.status = 400;
            reject( error );
        }

        options = getUpdatedRequestOptions( options );

        // due to a bug in request/request using options.method with Digest Auth we won't pass method as an option
        method = options.method;
        delete options.method;

        debug( 'sending ' + method + ' request to url: ' + options.url );

        request[ method ]( options, function( error, response, body ) {
            if ( error ) {
                debug( 'Error occurred when requesting ' + options.url, error );
                reject( error );
            } else if ( response.statusCode === 401 ) {
                error = new Error( 'Forbidden. Authorization Required.' );
                error.status = response.statusCode;
                reject( error );
            } else if ( response.statusCode < 200 || response.statusCode >= 300 ) {
                error = new Error( 'Request to ' + options.url + ' failed.' );
                error.status = response.statusCode;
                reject( error );
            } else if ( method === 'head' ) {
                resolve( response );
            } else {
                debug( 'response of request to ' + options.url + ' has status code: ', response.statusCode );
                resolve( body );
            }
        } );
    } );
}

/**
 * transform XML to JSON for easier processing
 *
 * @param  {string} xml XML string
 * @return {[type]}     promise
 */
function _xmlToJson( xml ) {

    return new Promise( function( resolve, reject ) {
        parser.parseString( xml, function( error, data ) {
            if ( error ) {
                debug( 'error parsing xml and converting to JSON' );
                reject( error );
            } else {
                resolve( data );
            }
        } );
    } );
}

/**
 * Finds the relevant form in an OpenRosa XML formList
 *
 * @param  {string} formListXml OpenRosa XML formList
 * @param  {string} formId      Form ID to look for
 * @return {[type]}             promise
 */
function _findFormAddInfo( formListXml, survey ) {
    var found;
    var index;
    var error;

    return new Promise( function( resolve, reject ) {
        // first convert to JSON to make it easier to work with
        _xmlToJson( formListXml )
            .then( function( formListObj ) {
                if ( formListObj.xforms && formListObj.xforms.xform ) {
                    // find the form and stop looking when found
                    found = formListObj.xforms.xform.some( function( xform, i ) {
                        index = i;
                        return xform.formID.toString() === survey.openRosaId;
                    } );
                }

                if ( !found ) {
                    error = new TError( 'error.notfoundinformlist', {
                        formId: '"' + survey.openRosaId + '"'
                    } );
                    error.status = 404;
                    reject( error );
                } else {
                    debug( 'found form' );
                    survey.info = _simplifyFormObj( formListObj.xforms.xform[ index ] );
                    debug( 'survey.info', survey.info );
                    resolve( survey );
                }
            } )
            .catch( reject );
    } );
}

/**
 * Convert arrays property values to strings, knowing that each xml node only
 * occurs once in each xform node in /formList
 *
 * @param  {[type]} formObj [description]
 * @return {[type]}         [description]
 */
function _simplifyFormObj( formObj ) {
    for ( var prop in formObj ) {
        if ( formObj.hasOwnProperty( prop ) && Object.prototype.toString.call( formObj[ prop ] ) === '[object Array]' ) {
            formObj[ prop ] = formObj[ prop ][ 0 ].toString();
        }
    }

    return formObj;
}

module.exports = {
    getXFormInfo: getXFormInfo,
    getXForm: getXForm,
    getManifest: getManifest,
    getMaxSize: getMaxSize,
    authenticate: authenticate,
    getAuthHeader: getAuthHeader,
    getFormListUrl: getFormListUrl,
    getSubmissionUrl: getSubmissionUrl,
    getUpdatedRequestOptions: getUpdatedRequestOptions
};
