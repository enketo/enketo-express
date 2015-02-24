"use strict";

var request = require( 'request' ),
    Auth = require( 'request/lib/auth' ).Auth,
    //wwwAuth = require( 'www-authenticate' ),
    TError = require( '../custom-error' ).TranslatedError,
    Q = require( 'q' ),
    debug = require( 'debug' )( 'openrosa-communicator' ),
    parser = new require( 'xml2js' ).Parser();

/**
 * Gets form info
 *
 * @param  {*}     survey  survey object
 * @return {[type]}               promise
 */
function getXFormInfo( survey ) {
    var formListUrl;

    if ( !survey.openRosaServer ) {
        throw new Error( 'No server provided.' );
    }

    return _request( {
        url: getFormListUrl( survey.openRosaServer ),
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
    var deferred = Q.defer();

    return _request( {
        url: survey.info.downloadUrl,
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie
        }
    } ).then( function( xform ) {
        survey.xform = xform;
        deferred.resolve( survey );
        return deferred.promise;
    } );
}


/**
 * Obtains the XForm manifest
 *
 * @param  {[type]} survey survey object
 * @return {[type]}        promise
 */
function getManifest( survey ) {
    var error,
        deferred = Q.defer();

    if ( !survey.info.manifestUrl ) {
        // a manifest is optional
        deferred.resolve( survey );
    } else {
        _request( {
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
                deferred.resolve( survey );
            } );

    }
    return deferred.promise;
}


/**
 * Checks the maximum acceptable submission size the server accepts
 * @param  {[type]} survey survey object
 * @return {[type]}        promise
 */
function getMaxSize( survey ) {
    var server, submissionUrl, options;

    server = survey.openRosaServer;
    submissionUrl = ( server.lastIndexOf( '/' ) === server.length - 1 ) ? server + 'submission' : server + '/submission';

    options = {
        url: submissionUrl,
        auth: survey.credentials,
        headers: {
            cookie: survey.cookie
        }
    };

    return _headRequest( options )
        .then( function( response ) {
            return response.headers[ 'x-openrosa-accept-content-length' ] || 5 * 1024 * 1024;
        } );
}

function authenticate( survey ) {
    var options = {
        url: getFormListUrl( survey.openRosaServer ),
        auth: survey.credentials
    };

    return _request( options )
        .then( function() {
            debug( 'successful (authenticated if it was necessary)' );
            return survey;
        } );
}

function getAuthHeader( url, credentials ) {
    var auth, authHeader,
        deferred = Q.defer(),
        options = {
            url: url,
            method: 'head',
            headers: {
                'X-OpenRosa-Version': '1.0'
            }
        };

    var req = request( options, function( error, response ) {
        if ( response.statusCode === 401 ) {
            auth = new Auth( req );
            auth.hasAuth = true;
            auth.user = credentials.user;
            auth.pass = credentials.pass;
            auth.method = 'POST';
            // TODO: THIS WILL BREAK IN FUTURE request/request module UPDATE
            // to be changed to auth.onResponse(response) and some variable changes above
            authHeader = auth.response( auth.method, url, response.headers );

            // alternatively with www-authenticate
            //var onWwwAuthenticate = wwwAuth( credentials.user, credentials.pass );
            //var authenticator = onWwwAuthenticate( response.headers[ 'www-authenticate' ] );
            //if ( authenticator.err ) deferred.reject( authenticator.err );
            //var authHeader2 = authenticator.authorize( 'POST', url );
            //debug( 'authHeader created by www-authenticate module', authHeader2 );

            deferred.resolve( authHeader );
        } else {
            deferred.resolve( null );
        }
    } );

    return deferred.promise;
}

function getFormListUrl( server ) {
    return ( server.lastIndexOf( '/' ) === server.length - 1 ) ? server + 'formList' : server + '/formList';
}

function getSubmissionUrl( server ) {
    return ( server.lastIndexOf( '/' ) === server.length - 1 ) ? server + 'submission' : server + '/submission';
}

function _headRequest( options ) {
    options.method = 'head';
    return _request( options );
}

/**
 * Sends a request to an OpenRosa server
 *
 * @param  { * } url  request options object
 * @return {?string=}    promise
 */
function _request( options ) {
    var error, r,
        deferred = Q.defer();

    if ( typeof options !== 'object' && !options.url ) {
        error = new Error( 'Bad request. No options provided.' );
        error.status = 400;
        deferred.reject( error );
    }

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
        //debug( 'authenticating with', options.auth );
    }

    // due to bug https://github.com/request/request/issues/1412, we won't pass method as an option (temporarily)
    var method = options.method || 'get';
    delete options.method;

    debug( 'sending request to url: ' + options.url );

    r = request[ method ]( options, function( error, response, body ) {
        if ( error ) {
            debug( 'Error occurred when requesting ' + options.url, error );
            deferred.reject( error );
        } else if ( response.statusCode === 401 ) {
            error = new Error( 'Forbidden. Authorization Required.' );
            error.status = response.statusCode;
            deferred.reject( error );
        } else if ( response.statusCode < 200 || response.statusCode >= 300 ) {
            error = new Error( 'Request to ' + options.url + ' failed.' );
            error.status = response.statusCode;
            deferred.reject( error );
        } else if ( method === 'head' ) {
            deferred.resolve( response );
        } else {
            debug( 'response of request to ' + options.url + ' has status code: ', response.statusCode );
            deferred.resolve( body );
        }
    } );

    return deferred.promise;
}

/**
 * transform XML to JSON for easier processing
 *
 * @param  {string} xml XML string
 * @return {[type]}     promise
 */
function _xmlToJson( xml ) {
    var deferred = Q.defer();

    parser.parseString( xml, function( error, data ) {
        if ( error ) {
            debug( 'error parsing xml and converting to JSON' );
            deferred.reject( error );
        } else {
            debug( 'succesfully converted XML to JSON' );
            deferred.resolve( data );
        }
    } );

    return deferred.promise;
}

/**
 * Finds the relevant form in an OpenRosa XML formList
 *
 * @param  {string} formListXml OpenRosa XML formList
 * @param  {string} formId      Form ID to look for
 * @return {[type]}             promise
 */
function _findFormAddInfo( formListXml, survey ) {
    var found, index, error,
        deferred = Q.defer();

    debug( 'looking for form object with id "' + survey.openRosaId + '" in formlist' );
    // first convert to JSON to make it easier to work with
    _xmlToJson( formListXml )
        .then( function( formListObj ) {
            // find the form and stop looking when found
            found = formListObj.xforms.xform.some( function( xform, i ) {
                index = i;
                return xform.formID.toString() === survey.openRosaId;
            } );
            if ( !found ) {
                error = new TError( 'error.notfoundinformlist', {
                    formId: "'" + survey.openRosaId + "'"
                } );
                error.status = 404;
                deferred.reject( error );
            } else {
                debug( 'found form' );
                survey.info = _simplifyFormObj( formListObj.xforms.xform[ index ] );
                debug( 'survey.info', survey.info );
                deferred.resolve( survey );
            }
        } )
        .catch( deferred.reject );

    return deferred.promise;
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
        formObj.manifestUrl = formObj.manifestUrl || null;
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
    getSubmissionUrl: getSubmissionUrl
};
