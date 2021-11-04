/**
 * @module transformation-controller
 */

const transformer = require( 'enketo-transformer' );
const communicator = require( '../lib/communicator' );
const surveyModel = require( '../models/survey-model' );
const cacheModel = require( '../models/cache-model' );
const account = require( '../models/account-model' );
const user = require( '../models/user-model' );
const config = require( '../models/config-model' ).server;
const utils = require( '../lib/utils' );
const routerUtils = require( '../lib/router-utils' );
const express = require( 'express' );
const url = require( 'url' );
const { replaceMediaSources } = require( '../lib/url' );

const router = express.Router();

// var debug = require( 'debug' )( 'transformation-controller' );

module.exports = app => {
    app.use( `${app.get( 'base path' )}/transform`, router );
};

router.param( 'enketo_id', routerUtils.enketoId );
router.param( 'encrypted_enketo_id_single', routerUtils.encryptedEnketoIdSingle );
router.param( 'encrypted_enketo_id_view', routerUtils.encryptedEnketoIdView );

router
    .post( '*', ( req, res, next ) => {
        // set content-type to json to provide appropriate json Error responses
        res.set( 'Content-Type', 'application/json' );
        next();
    } )
    .post( '/xform/:encrypted_enketo_id_single', getSurveyParts )
    .post( '/xform/:encrypted_enketo_id_view', getSurveyParts )
    .post( '/xform/:enketo_id', getSurveyParts )
    .post( '/xform', getSurveyParts )
    .post( '/xform/hash/:enketo_id', getSurveyHash );

/**
 * Obtains HTML Form, XML model, and existing XML instance
 *
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function getSurveyParts( req, res, next ) {
    _getSurveyParams( req )
        .then( survey => {
            if ( survey.info ) {
                // A request with "xformUrl" body parameter was used (unlaunched form)
                _getFormDirectly( survey )
                    .then( survey => {
                        _respond( res, survey );
                    } )
                    .catch( next );
            } else {
                _authenticate( survey )
                    .then( _getFormFromCache )
                    .then( result => {
                        if ( result ) {
                            return _updateCache( result );
                        } else {
                            return _updateCache( survey );
                        }
                    } )
                    .then( result => {
                        _respond( res, result );
                    } )
                    .catch( next );
            }
        } )
        .catch( next );
}

/**
 * Obtains the hash of the cached Survey Parts
 *
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function getSurveyHash( req, res, next ) {
    _getSurveyParams( req )
        .then( survey => cacheModel.getHashes( survey ) )
        .then( _updateCache )
        .then( survey => {
            if ( Object.prototype.hasOwnProperty.call( survey, 'credentials' ) ) {
                delete survey.credentials;
            }
            res.status( 200 );
            res.send( {
                hash: _getCombinedHash( survey )
            } );
        } )
        .catch( next );
}

/**
 * @param {module:survey-model~SurveyObject} survey - survey object
 *
 * @return { Promise<module:survey-model~SurveyObject> } a Promise resolving with survey object with form transformation result
 *
 */
function _getFormDirectly( survey ) {
    return communicator.getXForm( survey )
        .then( communicator.getManifest )
        .then( transformer.transform );
}

/**
 * @param {module:survey-model~SurveyObject} survey - survey object
 *
 * @return { Promise<module:survey-model~SurveyObject> } a Promise resolving with survey object
 */
function _authenticate( survey ) {
    return communicator.authenticate( survey );
}

/**
 * @param {module:survey-model~SurveyObject} survey - survey object
 *
 * @return { Promise<module:survey-model~SurveyObject> } a Promise resolving with survey object
 */
function _getFormFromCache( survey ) {
    return cacheModel.get( survey );
}

/**
 * Update the Cache if necessary.
 *
 * @param {module:survey-model~SurveyObject} survey - survey object
 *
 * @return { Promise<module:survey-model~SurveyObject> } a Promise resolving with survey object
 */
function _updateCache( survey ) {
    return communicator.getXFormInfo( survey )
        .then( communicator.getManifest )
        .then( survey => Promise.all( [ survey, cacheModel.check( survey ) ] ) )
        .then( ( [ survey, upToDate ] ) => {
            if ( !upToDate ) {
                delete survey.xform;
                delete survey.form;
                delete survey.model;
                delete survey.xslHash;
                delete survey.mediaHash;
                delete survey.mediaUrlHash;
                delete survey.formHash;

                return _getFormDirectly( survey )
                    .then( cacheModel.set );
            }

            return survey;
        } )
        .then( _addMediaHash )
        .catch( error => {
            if ( error.status === 401 || error.status === 404 ) {
                cacheModel.flush( survey )
                    .catch( e => {
                        if ( e.status !== 404 ) {
                            console.error( e );
                        }
                    } );
            } else {
                console.error( 'Unknown Error occurred during attempt to update cache', error );
            }

            throw error;
        } );
}

/**
 * @param {module:survey-model~SurveyObject} survey - survey object
 *
 * @return { Promise } always resolved promise
 *

 */
function _addMediaHash( survey ) {
    survey.mediaHash = utils.getXformsManifestHash( survey.manifest, 'all' );

    return Promise.resolve( survey );
}

/**
 * @param { module:survey-model~SurveyObject } survey - survey object
 *
 * @return { Promise<module:survey-model~SurveyObject> } a Promise resolving with survey object
 */
function _checkQuota( survey ) {
    if ( !config['account lib'] ) {
        // Don't check quota if not running SaaS
        return Promise.resolve( survey );
    }

    return surveyModel
        .getNumber( survey.account.linkedServer )
        .then( quotaUsed => {
            if ( quotaUsed <= survey.account.quota ) {
                return Promise.resolve( survey );
            }
            const error = new Error( 'Forbidden. Quota exceeded.' );
            error.status = 403;
            throw error;
        } );
}

/**
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {module:survey-model~SurveyObject} survey - survey object
 */
function _respond( res, survey ) {
    delete survey.credentials;

    survey = replaceMediaSources( survey );

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
        hash: _getCombinedHash( survey ),
        languageMap: survey.languageMap
    } );
}

/**
 * @param { module:survey-model~SurveyObject } survey - survey object
 * @return { string } - a hash
 */
function _getCombinedHash( survey ) {
    const FORCE_UPDATE = 1;
    const brandingHash = ( survey.account.branding && survey.account.branding.source ) ? utils.md5( survey.account.branding.source ) : '';

    return [ String( survey.formHash ), String( survey.mediaHash ), String( survey.xslHash ), String( survey.theme ), String( brandingHash ), String( FORCE_UPDATE ) ].join( '-' );
}

/**
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 *
 * @return { Promise<module:survey-model~SurveyObject> } a Promise resolving with survey object with added credentials
 */
function _setCookieAndCredentials( survey, req ) {
    // for external authentication, pass the cookie(s)
    survey.cookie = req.headers.cookie;
    // for OpenRosa authentication, add the credentials
    survey.credentials = user.getCredentials( req );

    return Promise.resolve( survey );
}

/**
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @return { Promise<module:survey-model~SurveyObject> } a Promise resolving with survey object
 */
function _getSurveyParams( req ) {
    const params = req.body;
    const customParamName = req.app.get( 'query parameter to pass to submission' );
    const customParam = customParamName ? req.query[ customParamName ] : null;

    if ( req.enketoId ) {
        return surveyModel.get( req.enketoId )
            .then( account.check )
            .then( _checkQuota )
            .then( survey => {
                survey.customParam = customParam;

                return _setCookieAndCredentials( survey, req );
            } );
    } else if ( params.xformUrl ) {
        const urlObj = url.parse( params.xformUrl );
        if ( !urlObj || !urlObj.protocol || !urlObj.host ) {
            const error = new Error( 'Bad Request. Form URL is invalid.' );
            error.status = 400;
            throw error;
        }
        const xUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

        return account.check( {
            openRosaServer: xUrl
        } )
            .then( survey => // no need to check quota
                Promise.resolve( {
                    info: {
                        downloadUrl: params.xformUrl
                    },
                    account: survey.account
                } ) )
            .then( survey => _setCookieAndCredentials( survey, req ) );
    } else {
        const error = new Error( 'Bad Request. Survey information not complete.' );
        error.status = 400;
        throw error;
    }
}
