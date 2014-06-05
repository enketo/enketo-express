"use strict";

var Q = require( 'q' );
var transformer = require( '../lib/transformer' );
var fs = require( 'fs' );
var communicator = require( '../lib/communicator' );
var surveyModel = require( '../models/survey-model' )();
var instanceModel = require( '../models/instance-model' )();
var debug = require( 'debug' )( 'survey-controller' );

function _getForm( survey ) {
    debug( 'getting form info' );
    return communicator.getXFormInfo( survey.openRosaServer, survey.openRosaId )
        .then( function( info ) {
            debug( 'going to get xform from ' + info.downloadUrl );
            return communicator.getXForm( info.downloadUrl )
                .then( function( xform ) {
                    debug( 'going to transform XForm' );
                    return transformer.transform( xform );
                } );
        } );
}

function _getInstance( survey ) {
    return instanceModel.get( survey );
}

module.exports = {
    webform: function( req, res, next ) {
        return surveyModel.get( req.enketoId )
            .then( _getForm )
            .then( function( survey ) {
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
        console.log( 'req.query', req.query );
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
                .catch( function( error ) {
                    next( error );
                } );
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
