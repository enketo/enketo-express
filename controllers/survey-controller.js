"use strict";

var Q = require( 'q' );
var transformer = require( '../lib/transformer/enketo-transformer' );
var fs = require( 'fs' );
var communicator = require( '../lib/communicator/openrosa-communicator' );
var model = require( '../models/survey-model' );
var debug = require( 'debug' )( 'survey-controller' );

function _getForm( server, id ) {
    debug( 'getting form info' );
    return communicator.getXFormInfo( server, id )
        .then( function( info ) {
            debug( 'going to get xform from ' + info.downloadUrl );
            return communicator.getXForm( info.downloadUrl )
                .then( function( xform ) {
                    debug( 'going to transform XForm now' );
                    return transformer.transform( xform );
                } );
        } );
}

module.exports = {
    webform: function( req, res, next ) {
        return model.get( req.enketoId )
            .then( function( survey ) {
                _getForm( survey.openRosaServer, survey.openRosaId )
                    .then( function( survey ) {
                        res.render( 'surveys/webform', survey );
                    } )
                    .catch( function( error ) {
                        next( error );
                    } );
            } );

    },
    maxSize: function( req, res, next ) {
        return model.get( req.enketoId )
            .then( function( survey ) {
                communicator.getMaxSize( survey.openRosaServer )
                    .then( function( maxSize ) {
                        res.json( {
                            maxSize: maxSize
                        } );
                    } )
                    .catch( function( error ) {
                        next( error );
                    } );
            } );
    }
};
