"use strict";

var Q = require( 'q' ),
    transformer = require( '../lib/transformer' ),
    utils = require( '../lib/utils' ),
    fs = require( 'fs' ),
    communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' )(),
    instanceModel = require( '../models/instance-model' )(),
    cacheModel = require( '../models/cache-model' )(),
    account = require( '../models/account-model' ),
    debug = require( 'debug' )( 'survey-controller' );

function _getForm( survey ) {
    var deferred = Q.defer();

    return communicator.getXFormInfo( survey )
        .then( communicator.getManifest )
        .then( cacheModel.get )
        .then( function( cachedSurvey ) {
            debug( 'obtained Form and Model from cache!' );
            deferred.resolve( cachedSurvey );
            return deferred.promise;
        }, function( error ) {
            if ( !error.status || ( error.status !== 404 && error.status !== 410 ) ) {
                throw error;
            }
            debug( 'going to transform XForm' );
            return communicator.getXForm( survey )
                .then( transformer.transform )
                .then( cacheModel.set );
        } );
}

function _getInstance( survey ) {
    return instanceModel.get( survey );
}

module.exports = {
    webform: function( req, res, next ) {
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
    },
    // preview of launched form (with enketo id)
    preview: function( req, res, next ) {
        return surveyModel.get( req.enketoId )
            .then( _getForm )
            .then( function( survey ) {
                survey.model = JSON.stringify( survey.model );
                survey.type = 'preview';
                survey.iframe = !!req.query.iframe;
                res.render( 'surveys/webform', survey );
            } )
            .catch( next );
    },
    // preview with parameters provided by query string)
    previewFromQuery: function( req, res, next ) {
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
    },
    edit: function( req, res, next ) {
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
    },
    /**
     * Debugging view that shows underlying XForm
     * @param  {[type]}   req  [description]
     * @param  {[type]}   res  [description]
     * @param  {Function} next [description]
     * @return {[type]}        [description]
     */
    xform: function( req, res, next ) {
        return surveyModel.get( req.enketoId )
            .then( communicator.getXFormInfo )
            .then( communicator.getXForm )
            .then( function( survey ) {
                res.set( 'Content-Type', 'text/xml' );
                res.send( survey.xform );
            } )
            .catch( next );
    }
};
