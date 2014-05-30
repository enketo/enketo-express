"use strict";

var Q = require( 'q' );
var transformer = require( '../lib/transformer' );
var fs = require( 'fs' );
var communicator = require( '../lib/communicator' );
var model = require( '../models/survey-model' )();
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

module.exports = {
    webform: function( req, res, next ) {
        return model.get( req.enketoId )
            .then( _getForm )
            .then( function( survey ) {
                survey.instance = JSON.stringify( survey.instance );
                res.render( 'surveys/webform', survey );
            } )
            .catch( function( error ) {
                debug( 'error caught!', error );
                next( error );
            } );
    },
    // preview of launched form (with enketo id)
    preview: function( req, res, next ) {
        return model.get( req.enketoId )
            .then( _getForm )
            .then( function( survey ) {
                survey.instance = JSON.stringify( survey.instance );
                survey.type = 'preview';
                res.render( 'surveys/webform', survey );
            } )
            .catch( function( error ) {
                next( error );
            } );
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
                    survey.instance = JSON.stringify( survey.instance );
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
                            survey.instance = JSON.stringify( survey.instance );
                            survey.type = 'preview';
                            res.render( 'surveys/webform', survey );
                        } );
                } )
                .catch( function( error ) {
                    next( error );
                } );
        } else {
            var error = new Error( 'Require either server and id parameter or a form parameter' );
            error.status = 400;
            next( error );
        }
    },
    edit: function( req, res, next ) {
        res.render( 'surveys/webform', {
            type: 'edit'
        } );
    },
    maxSize: function( req, res, next ) {
        return model.get( req.enketoId )
            .then( communicator.getMaxSize )
            .then( function( maxSize ) {
                res.json( {
                    maxSize: maxSize
                } );
            } )
            .catch( function( error ) {
                next( error );
            } );
    }
};
