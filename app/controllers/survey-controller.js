'use strict';

var utils = require( '../lib/utils' );
var TError = require( '../lib/custom-error' ).TranslatedError;
var communicator = require( '../lib/communicator' );
var surveyModel = require( '../models/survey-model' );
var userModel = require( '../models/user-model' );
var config = require( '../models/config-model' ).server;
var express = require( 'express' );
var router = express.Router();
// var debug = require( 'debug' )( 'survey-controller' );

module.exports = function( app ) {
    app.use( app.get( 'base path' ) + '/', router );
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

router.param( 'mod', function( req, rex, next, mod ) {
    if ( mod === 'i' ) {
        req.iframe = true;
        next();
    } else {
        req.iframe = false;
        next( 'route' );
    }
} );

router
    .get( '*', loggedInCheck )
    .get( '/_/', offlineWebform )
    .get( '/:enketo_id', webform )
    .get( '/:mod/:enketo_id', webform )
    .get( '/preview/:enketo_id', preview )
    .get( '/preview/:mod/:enketo_id', preview )
    .get( '/preview', preview )
    .get( '/preview/:mod', preview )
    .get( '/edit/:enketo_id', edit )
    .get( '/edit/:mod/:enketo_id', edit )
    .get( '/xform/:enketo_id', xform )
    .get( '/connection', function( req, res ) {
        res.status = 200;
        res.send( 'connected ' + Math.random() );
    } );

function loggedInCheck( req, res, next ) {
    req.logout = !!userModel.getCredentials( req );
    next();
}

function offlineWebform( req, res, next ) {
    var error;

    if ( !req.app.get( 'offline enabled' ) ) {
        error = new Error( 'Offline functionality has not been enabled for this application.' );
        error.status = 405;
        next( error );
    } else {
        req.manifest = req.app.get( 'base path' ) + '/_/manifest.appcache';
        webform( req, res, next );
    }
}

function webform( req, res, next ) {
    var options = {
        manifest: req.manifest,
        // only enable deprecated query string support for online-only forms
        iframe: req.iframe || ( !req.manifest && !!req.query.iframe ),
    };

    _renderWebform( req, res, next, options );
}

function preview( req, res, next ) {
    var options = {
        type: 'preview',
        iframe: req.iframe || !!req.query.iframe,
        notification: utils.pickRandomItemFromArray( config.notifications )
    };

    _renderWebform( req, res, next, options );
}

function edit( req, res, next ) {
    var error,
        options = {
            type: 'edit',
            iframe: req.iframe
        };

    if ( req.query.instance_id ) {
        _renderWebform( req, res, next, options );
    } else {
        error = new TError( 'error.invalidediturl' );
        error.status = 400;
        next( error );
    }
}

function _renderWebform( req, res, next, options ) {
    var deviceId = req.signedCookies[ '__enketo_meta_deviceid' ] || req.hostname + ':' + utils.randomString( 16 ),
        cookieOptions = {
            signed: true,
            maxAge: 10 * 365 * 24 * 60 * 60 * 1000
        };

    res
        .cookie( '__enketo_meta_deviceid', deviceId, cookieOptions )
        .render( 'surveys/webform', options );
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
        .then( function( survey ) {
            survey.credentials = userModel.getCredentials( req );
            return survey;
        } )
        .then( communicator.getXFormInfo )
        .then( communicator.getXForm )
        .then( function( survey ) {
            res
                .set( 'Content-Type', 'text/xml' )
                .send( survey.xform );
        } )
        .catch( next );
}
