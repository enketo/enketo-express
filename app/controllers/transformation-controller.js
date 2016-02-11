'use strict';

var Promise = require( 'lie' );
var transformer = require( 'enketo-transformer' );
var communicator = require( '../lib/communicator' );
var surveyModel = require( '../models/survey-model' );
var cacheModel = require( '../models/cache-model' );
var account = require( '../models/account-model' );
var user = require( '../models/user-model' );
var utils = require( '../lib/utils' );
var isArray = require( 'lodash/lang/isArray' );
var express = require( 'express' );
var url = require( 'url' );
var router = express.Router();
// var debug = require( 'debug' )( 'transformation-controller' );

module.exports = function( app ) {
    app.use( '/transform', router );
};

router
    .post( '*', function( req, res, next ) {
        // set content-type to json to provide appropriate json Error responses
        res.set( 'Content-Type', 'application/json' );
        next();
    } )
    .post( '/xform', getSurveyParts )
    .post( '/xform/hash', getSurveyHash );

/**
 * Obtains HTML Form, XML model, and existing XML instance
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function getSurveyParts( req, res, next ) {
    var surveyBare;

    _getSurveyParams( req.body )
        .then( function( survey ) {

            // for external authentication, pass the cookie(s)
            survey.cookie = req.headers.cookie;
            // for OpenRosa authentication, add the credentials
            survey.credentials = user.getCredentials( req );
            // store a copy of the bare survey object
            surveyBare = JSON.parse( JSON.stringify( survey ) );

            if ( survey.info ) {
                _getFormDirectly( survey )
                    .then( function( survey ) {
                        _respond( res, survey );
                    } )
                    .catch( next );
            } else {
                _authenticate( survey )
                    .then( _getFormFromCache )
                    .then( function( result ) {
                        if ( result ) {
                            // immediately serve from cache without first checking for updates
                            _respond( res, result );
                            // update cache if necessary, asynchronously AFTER responding
                            // This is the ONLY mechanism by with an online-only form will be updated
                            _updateCache( surveyBare );
                        } else {
                            _updateCache( surveyBare )
                                .then( function( survey ) {
                                    _respond( res, survey );
                                } )
                                .catch( next );
                        }
                    } )
                    .catch( next );
            }
        } )
        .catch( next );
}

/**
 * Obtains the hash of the cached Survey Parts
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function getSurveyHash( req, res, next ) {
    _getSurveyParams( req.body )
        .then( function( survey ) {
            return cacheModel.getHashes( survey );
        } )
        .then( function( survey ) {
            return _updateCache( survey );
        } )
        .then( function( survey ) {
            if ( survey.hasOwnProperty( 'credentials' ) ) {
                delete survey.credentials;
            }
            res.status( 200 );
            res.send( {
                hash: _getCombinedHash( survey )
            } );
        } )
        .catch( next );
}

function _getFormDirectly( survey ) {
    return communicator.getXForm( survey )
        .then( _addMediaMap )
        .then( transformer.transform );
}

function _authenticate( survey ) {
    return communicator.authenticate( survey );
}

function _getFormFromCache( survey ) {
    return cacheModel.get( survey );
}

/**
 * Update the Cache if necessary.
 * @param  {[type]} survey [description]
 */
function _updateCache( survey ) {
    return communicator.getXFormInfo( survey )
        .then( communicator.getManifest )
        .then( cacheModel.check )
        .then( function( upToDate ) {
            if ( !upToDate ) {
                delete survey.formHash;
                delete survey.mediaHash;
                delete survey.xslHash;
                return _getFormDirectly( survey )
                    .then( cacheModel.set );
            }
            return survey;
        } )
        .catch( function( error ) {
            if ( error.status === 401 || error.status === 404 ) {
                cacheModel.flush( survey );
            } else {
                console.error( 'Unknown Error occurred during attempt to update cache', error );
            }

            throw error;
        } );
}

/**
 * Adds a media map, see enketo/enketo-transformer
 * 
 * @param {[type]} survey [description]
 */
function _addMediaMap( survey ) {
    var mediaMap = null;

    return new Promise( function( resolve ) {
        if ( isArray( survey.manifest ) ) {
            survey.manifest.forEach( function( file ) {
                mediaMap = mediaMap ? mediaMap : {};
                if ( file.downloadUrl ) {
                    mediaMap[ file.filename ] = _toLocalMediaUrl( file.downloadUrl );
                }
            } );
        }
        survey.media = mediaMap;
        resolve( survey );
    } );
}

/**
 * Converts a url to a local (proxied) url.
 *
 * @param  {string} url The url to convert.
 * @return {string}     The converted url.
 */
function _toLocalMediaUrl( url ) {
    var localUrl = '/media/get/' + url.replace( /(https?):\/\//, '$1/' );
    return localUrl;
}

function _checkQuota( survey ) {
    var error;

    return surveyModel
        .getNumber( survey.account.linkedServer )
        .then( function( quotaUsed ) {
            if ( quotaUsed <= survey.account.quota ) {
                return Promise.resolve( survey );
            }
            error = new Error( 'Forbidden. Quota exceeded.' );
            error.status = 403;
            throw error;
        } );
}

function _respond( res, survey ) {
    delete survey.credentials;

    res.status( 200 );
    res.send( {
        form: survey.form,
        // previously this was JSON.stringified, not sure why
        model: survey.model,
        theme: survey.theme,
        branding: survey.account.branding,
        // The hash components are converted to deal with a node_redis limitation with storing and retrieving null.
        // If a form contains no media this hash is null, which would be an empty string upon first load.
        // Subsequent cache checks will however get the string value 'null' causing the form cache to be unnecessarily refreshed
        // on the client.
        hash: _getCombinedHash( survey )
    } );
}

function _getCombinedHash( survey ) {
    var brandingHash = ( survey.account.branding && survey.account.branding.source ) ? utils.md5( survey.account.branding.source ) : '';
    return [ String( survey.formHash ), String( survey.mediaHash ), String( survey.xslHash ), String( survey.theme ), String( brandingHash ) ].join( '-' );
}

function _getSurveyParams( params ) {
    var error;
    var urlObj;
    var domain;

    if ( params.enketoId ) {
        return surveyModel.get( params.enketoId )
            .then( account.check )
            .then( _checkQuota );
    } else if ( params.serverUrl && params.xformId ) {
        return account.check( {
                openRosaServer: params.serverUrl,
                openRosaId: params.xformId
            } )
            .then( _checkQuota );
    } else if ( params.xformUrl ) {
        urlObj = url.parse( params.xformUrl );
        if ( !urlObj || !urlObj.protocol || !urlObj.host ) {
            error = new Error( 'Bad Request. Form URL is invalid.' );
            error.status = 400;
            throw error;
        }
        // The previews using the xform parameter are less strictly checked.
        // If an account with the domain is active, the check will pass.
        domain = urlObj.protocol + '//' + urlObj.host;
        return account.check( {
                openRosaServer: domain
            } )
            .then( function( survey ) {
                // no need to check quota
                return Promise.resolve( {
                    info: {
                        downloadUrl: params.xformUrl
                    },
                    account: survey.account
                } );
            } );
    } else {
        error = new Error( 'Bad Request. Survey information not complete.' );
        error.status = 400;
        throw error;
    }
}
