"use strict";

var Q = require( 'q' ),
    utils = require( '../lib/utils' ),
    TError = require( '../lib/custom-error' ).TranslatedError,
    communicator = require( '../lib/communicator' ),
    surveyModel = require( '../models/survey-model' ),
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
    .get( '/_', offlineWebform )
    .get( '/:enketo_id', webform )
    .get( '/preview/:enketo_id', preview )
    .get( '/preview', preview )
    .get( '/edit/:enketo_id', edit )
    .get( '/xform/:enketo_id', xform )
    .get( '/connection', function( req, res, next ) {
        res.status = 200;
        res.send( 'connected ' + Math.random() );
    } );

function offlineWebform( req, res, next ) {
    var error;

    if ( !req.app.get( 'offline enabled' ) ) {
        error = new Error( 'Offline functionality has not been enabled for this application.' );
        error.status = 405;
        next( error );
    } else {
        req.manifest = '/_/manifest.appcache';
        webform( req, res, next );
    }
}

function webform( req, res, next ) {
    var survey = {
        manifest: req.manifest,
        iframe: !!req.query.iframe
    };

    res.render( 'surveys/webform', survey );
}

function preview( req, res, next ) {
    var survey = {
        type: 'preview',
        iframe: !!req.query.iframe
    };

    res.render( 'surveys/webform', survey );
}

function edit( req, res, next ) {
    var error,
        survey = {
            type: 'edit',
            iframe: !!req.query.iframe
        };

    if ( req.query.instance_id ) {
        res.render( 'surveys/webform', survey );
    } else {
        error = new TError( 'error.invalidediturl' );
        error.status = 400;
        next( error );
    }
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
