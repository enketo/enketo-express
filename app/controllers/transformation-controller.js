"use strict";

var Q = require( 'q' ),
    transformer = require( '../lib/enketo-transformer' ),
    communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' ),
    cacheModel = require( '../models/cache-model' ),
    account = require( '../models/account-model' ),
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'transformation-controller' );

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
    .post( '/xform/hash', getCachedSurveyHash );


/**
 * Obtains HTML Form, XML model, and existing XML instance
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function getSurveyParts( req, res, next ) {
    _getSurveyParams( req.body )
        .then( function( survey ) {
            // for external authentication, pass the cookie(s)
            survey.cookie = req.headers.cookie;

            if ( survey.info ) {
                _getFormDirectly( survey )
                    .then( function( survey ) {
                        _respond( res, survey );
                    } )
                    .catch( next );
            } else {
                _getFormFromCache( survey )
                    .then( function( result ) {
                        if ( result ) {
                            // immediately serve from cache without first checking for updates
                            _respond( res, result );
                            // update cache if necessary, asynchronously AFTER responding
                            // This is the ONLY mechanism by with an online-only form will be updated
                            _updateCache( survey );
                        } else {
                            _updateCache( survey )
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
function getCachedSurveyHash( req, res, next ) {
    var s;
    _getSurveyParams( req.body )
        .then( function( survey ) {
            s = survey;
            return cacheModel.getHashes( survey );
        } )
        .then( function( result ) {
            _respond( res, result );
            // update cache if necessary, asynchronously AFTER responding
            // this is the ONLY mechanism by which a locally browser-stored form
            // will be updated
            _updateCache( s );
        } )
        .catch( next );
}

function _getFormDirectly( survey ) {
    return communicator.getXForm( survey )
        .then( transformer.transform );
}

function _getFormFromCache( survey ) {
    return cacheModel.get( survey );
}

/**
 * Update the Cache if neccesary. This function never returns anything.
 * @param  {[type]} survey [description]
 */
function _updateCache( survey ) {
    return communicator.getXFormInfo( survey )
        .then( communicator.getManifest )
        .then( cacheModel.check )
        .then( function( upToDate ) {
            if ( !upToDate ) {
                return _getFormDirectly( survey )
                    .then( cacheModel.set );
            }
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

function _respond( res, survey ) {
    res.status( 200 );
    res.send( {
        form: survey.form,
        // previously this was JSON.stringified, not sure why
        model: survey.model,
        theme: survey.theme,
        // The hash components are converted to deal with a node_redis limitation with storing and retrieving null.
        // If a form contains no media this hash is null, which would be an empty string upon first load.
        // Subsequent cache checks will however get the value 'null' causing the form cache to be unnecessarily refreshed
        // on the client.
        hash: [ String( survey.formHash ), String( survey.mediaHash ), String( survey.xslHash ) ].join( '-' )
    } );
}

function _getSurveyParams( params ) {
    var error, cleanId,
        deferred = Q.defer();

    if ( params.enketoId ) {
        return surveyModel.get( params.enketoId )
            .then( account.check );
    } else if ( params.serverUrl && params.xformId ) {
        return account.check( {
            openRosaServer: params.serverUrl,
            openRosaId: params.xformId
        } );
    } else if ( params.xformUrl ) {
        // do not check account
        deferred.resolve( {
            info: {
                downloadUrl: params.xformUrl
            }
        } );
    } else {
        error = new Error( 'Bad Request. Survey information not complete.' );
        error.status = 400;
        deferred.reject( error );
    }

    return deferred.promise;
}
