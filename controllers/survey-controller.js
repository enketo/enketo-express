"use strict";

var Q = require( 'q' ),
    transformer = require( '../lib/transformer' ),
    fs = require( 'fs' ),
    communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' )(),
    instanceModel = require( '../models/instance-model' )(),
    account = require( '../models/account-model' ),
    debug = require( 'debug' )( 'survey-controller' );

function _getForm( survey ) {
    debug( 'getting form info' );
    return communicator.getXFormInfo( survey.openRosaServer, survey.openRosaId )
        .then( function( info ) {
            return Q.all( [
                communicator.getXForm( info.downloadUrl ),
                communicator.getManifest( info.manifestUrl )
            ] ).spread( function( xform, manifest ) {
                debug( 'going to transform XForm', typeof xform, typeof xform );
                return transformer.transform( xform, manifest );
            } );
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
                debug( 'processing before serving took ' + ( new Date().getTime() - startTime ) / 1000 + ' seconds' );
                survey.model = JSON.stringify( survey.model );
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
                    res.render( 'surveys/webform', survey );
                } )
                .catch( next );
        } else if ( req.query.form ) {
            return communicator.getXForm( req.query.form )
                .then( function( xform ) {
                    return transformer.transform( xform )
                        .then( function( survey ) {
                            survey.model = JSON.stringify( survey.model );
                            survey.type = 'preview';
                            res.render( 'surveys/webform', survey );
                        } );
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
                res.render( 'surveys/webform', survey );
            } )
            .catch( next );

    }
};
