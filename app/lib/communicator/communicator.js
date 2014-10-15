"use strict";

var request = require( 'request' );
var Q = require( 'q' );
var debug = require( 'debug' )( 'openrosa-communicator' );
var parser = new require( 'xml2js' ).Parser();

function _getFormList( server ) {
    var formListUrl;

    if ( !server ) {
        throw new Error( 'No server provided.' );
    }

    formListUrl = ( server.lastIndexOf( '/' ) === server.length - 1 ) ? server + 'formList' : server + '/formList';

    return _request( {
        url: formListUrl
    } );
}

function _getHeaders( url ) {
    var options = {
        method: 'head',
        url: url,
    };

    return _request( options );
}

function _getMaxSize( survey ) {
    var server, submissionUrl;

    server = survey.openRosaServer;
    submissionUrl = ( server.lastIndexOf( '/' ) === server.length - 1 ) ? server + 'submission' : server + '/submission';

    return _getHeaders( submissionUrl )
        .then( function( headers ) {
            return headers[ 'x-openrosa-accept-content-length' ] || headers[ 'X-Openrosa-Accept-Content-Length' ] || 5 * 1024 * 1024;
        } );
}

/**
 * Sends a request to an OpenRosa server
 *
 * @param  { { url:string, convertToJson:boolean } } url  request options object
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

    options.headers = {
        'X-OpenRosa-Version': '1.0'
    };

    debug( 'sending request to url: ' + options.url );

    r = request( options, function( error, response, body ) {
        if ( error ) {
            debug( 'Error occurred when requesting ' + options.url, error );
            deferred.reject( error );
        } else if ( response.statusCode === 401 ) {
            error = new Error( 'Authentication is required for this form. ' +
                'Unfortunately, authentication is not yet supported in this Enketo app.' );
            error.status = response.statusCode;
            deferred.reject( error );
        } else if ( response.statusCode < 200 || response.statusCode >= 300 ) {
            error = new Error( 'Request to ' + options.url + ' failed.' );
            error.status = response.statusCode;
            deferred.reject( error );
        } else if ( options.method === 'head' ) {
            deferred.resolve( response.headers );
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
    var found, index,
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
                deferred.reject( new Error( 'Form with ID ' + survey.openRosaId + ' not found in /formList' ) );
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
    /**
     * Gets form info
     *
     * @param  {string}     server    OpenRosa server URL
     * @param  {string}     id        OpenRosa form ID
     * @return {[type]}               promise
     */
    getXFormInfo: function( survey ) {
        return _getFormList( survey.openRosaServer )
            .then( function( formListXml ) {
                return _findFormAddInfo( formListXml, survey );
            } );
    },
    /**
     * Gets XForm from url
     *
     * @param  {string}   url      URL where XForm is published
     * @return {[type]}            promise
     */
    getXForm: function( survey ) {
        var deferred = Q.defer();

        return _request( {
            url: survey.info.downloadUrl
        } ).then( function( xform ) {
            survey.xform = xform;
            deferred.resolve( survey );
            return deferred.promise;
        } );
    },
    getManifest: function( survey ) {
        var error,
            deferred = Q.defer();

        if ( !survey.info.manifestUrl ) {
            // a manifest is optional
            deferred.resolve( survey );
        } else {
            _request( {
                    url: survey.info.manifestUrl
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
    },
    getMaxSize: _getMaxSize
};
