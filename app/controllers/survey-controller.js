"use strict";

var Q = require( 'q' ),
    transformer = require( '../lib/enketo-transformer' ),
    utils = require( '../lib/utils' ),
    fs = require( 'fs' ),
    communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' ),
    instanceModel = require( '../models/instance-model' ),
    cacheModel = require( '../models/cache-model' ),
    account = require( '../models/account-model' ),
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'survey-controller' );

module.exports = function( app ) {
    app.use( '/', router );
};

// duplicate in submission-controller
router.param( 'enketo_id', function( req, res, next, id ) {
    if ( /^::[A-z0-9]{4,8}$/.test( id ) ) {
        req.enketoId = id.substring( 2 );
        next();
    } else {
        next( 'route' );
    }
} );

router
    .get( '/:enketo_id', webform )
    .get( '/preview/:enketo_id', preview )
    .get( '/preview', previewFromQuery )
    .get( '/edit/:enketo_id', edit )
    .get( '/xform/:enketo_id', xform )
    .get( '/connection', function( req, res, next ) {
        res.status = 200;
        res.send( 'connected ' + Math.random() );
    } );

function _getForm( survey ) {
    var deferred = Q.defer();

    return communicator.getXFormInfo( survey )
        .then( communicator.getManifest )
        .then( cacheModel.get )
        .then( function( cachedSurvey ) {
            debug( 'obtained Form and Model from cache!' );
            deferred.resolve( cachedSurvey );
            return deferred.promise;
        } )
        .catch( function( error ) {
            // if survey.info is not there something serious happened
            if ( !survey.info || !error.status ) {
                throw error;
            }
            // else attempt to transform
            debug( 'going to transform XForm' );
            return communicator.getXForm( survey )
                .then( transformer.transform )
                .then( cacheModel.set );
        } );
}

function _getInstance( survey ) {
    return instanceModel.get( survey );
}

function webform( req, res, next ) {
    var startTime = new Date().getTime();
    return surveyModel.get( req.enketoId )
        .then( account.check )
        .then( _getForm )
        .then( function( survey ) {
            survey.model = JSON.stringify( survey.model );
            survey.iframe = !!req.query.iframe;
            debug( 'processing before serving took ' + ( new Date().getTime() - startTime ) / 1000 + ' seconds' );
            res.render( 'surveys/webform', survey );
        } )
        .catch( next );
}

// preview of launched form (with enketo id)
function preview( req, res, next ) {
    return surveyModel.get( req.enketoId )
        .then( _getForm )
        .then( function( survey ) {
            survey.model = JSON.stringify( survey.model );
            survey.type = 'preview';
            survey.iframe = !!req.query.iframe;
            res.render( 'surveys/webform', survey );
        } )
        .catch( next );
}

// preview with parameters provided by query string)
function previewFromQuery( req, res, next ) {
    if ( ( req.query.server || req.query.server_url ) && ( req.query.id || req.query.form_id ) ) {
        var survey = {
            openRosaServer: req.query.server,
            openRosaId: req.query.id
        };
        return _getForm( survey )
            .then( function( survey ) {
                survey.model = JSON.stringify( survey.model );
                survey.type = 'preview';
                survey.iframe = !!req.query.iframe;
                res.render( 'surveys/webform', survey );
            } )
            .catch( next );
    } else if ( req.query.form ) {
        return communicator.getXForm( {
                info: {
                    downloadUrl: req.query.form
                }
            } )
            .then( transformer.transform )
            .then( function( survey ) {
                survey.model = JSON.stringify( survey.model );
                survey.type = 'preview';
                res.render( 'surveys/webform', survey );
            } )
            .catch( next );
    } else {
        var error = new Error( 'Bad request. Require either server and id parameter or a form parameter' );
        error.status = 400;
        next( error );
    }
}

function edit( req, res, next ) {
    return surveyModel.get( req.enketoId )
        .then( account.check )
        .then( _getForm )
        .then( function( survey ) {
            survey.instanceId = req.query.instance_id;
            return _getInstance( survey );
        } )
        .then( function( survey ) {
            survey.model = JSON.stringify( survey.model );
            survey.instance = JSON.stringify( survey.instance );
            survey.type = 'edit';
            survey.iframe = !!req.query.iframe;
            res.render( 'surveys/webform', survey );
        } )
        .catch( next );
}

/**
 * Debugging view that shows underlying XForm
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function xform( req, res, next ) {
    return surveyModel.get( req.enketoId )
        .then( communicator.getXFormInfo )
        .then( communicator.getXForm )
        .then( function( survey ) {
            res.set( 'Content-Type', 'text/xml' );
            res.send( survey.xform );
        } )
        .catch( next );
}
