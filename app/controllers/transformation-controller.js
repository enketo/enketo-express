"use strict";

var Q = require( 'q' ),
    transformer = require( '../lib/enketo-transformer' ),
    communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' ),
    cacheModel = require( '../models/cache-model' ),
    //instanceModel = require( '../models/instance-model' ),
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
    .post( '/xform', getSurveyParts );


/**
 * Obtains HTML Form, XML model, and existing XML instance
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function getSurveyParts( req, res, next ) {
    debug( 'params', req.body );

    _getSurveyParams( req.body )
        .then( function( survey ) {
            debug( 'survey', survey, !!survey.info );
            if ( survey.info ) {
                _getFormDirectly( survey )
                    .then( function( survey ) {
                        _respond( res, survey );
                    } )
                    .catch( next );
            } else {
                _getFormViaFormlist( survey )
                    .then( function( survey ) {
                        _respond( res, survey );
                    } )
                    .catch( next );
            }
        } )
        .catch( next );
}

/**
 * Obtain cached instance
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
//function _getInstance( survey ) {
//    return instanceModel.get( survey );
//}

function _getFormViaFormlist( survey ) {
    return communicator.getXFormInfo( survey )
        .then( communicator.getManifest )
        .then( cacheModel.get )
        .catch( function( error ) {
            // it don't like this, maybe better for cachemodel to resolve
            // with null or something
            if ( !error.status || error.status >= 500 ) {
                throw error;
            }
            return _getFormDirectly( survey )
                .then( cacheModel.set );
        } );
}

function _getFormDirectly( survey ) {
    debug( 'going to transform XForm' );
    return communicator.getXForm( survey )
        .then( transformer.transform );
}

function _respond( res, survey ) {
    res.status = 200;
    res.send( {
        form: survey.form,
        // previously this was JSON.stringified, not sure why
        model: survey.model
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
        debug( 'resolving with info.downloadUrl' );
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
