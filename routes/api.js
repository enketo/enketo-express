"use strict";

var express = require( 'express' );
var router = express.Router();
var api = require( '../controllers/api-controller' );
var debug = require( 'debug' )( 'api-router' );
var auth = require( '../lib/basic-auth' );

router
    .all( '*', function( req, res, next ) {
        // check authentication and account
        var error,
            creds = auth( req ),
            token = ( creds ) ? creds.name : undefined,
            server = req.param( 'server_url' ),
            testServer = /https?:\/\/testserver.com\/bob/,
            linked = new RegExp( 'https?:\/\/' + req.app.get( 'openrosa server url' ) ),
            isTest = testServer.test( server );

        // set content-type to json to provide appropriate json Error responses
        res.set( 'Content-Type', 'application/json' );

        if ( !server ) {
            error = new Error( 'Bad Request. Server URL parameter missing or not allowed' );
            error.status = 400;
            next( error );
        } else if ( !linked.test( server ) && !isTest ) {
            error = new Error( 'This server is not linked with Enketo' );
            error.status = 404;
            next( error );
        } else if ( !token || ( !isTest && token !== req.app.get( 'enketo api key' ) || ( isTest && token !== 'abc' ) ) ) {
            error = new Error( 'Invalid API key.' );
            error.status = 401;
            res
                .status( error.status )
                .set( 'WWW-Authenticate', 'Basic realm="Enter valid API key as user name"' );
            next( error );
        } else {
            debug( 'valid token provided!' );
            next();
        }
    } )
    .all( '/*/iframe', function( req, res, next ) {
        debug( 'setting iframe to true' );
        req.iframe = true;
        next();
    } )
    .all( '/survey/preview*', function( req, res, next ) {
        req.webformType = 'preview';
        next();
    } )
    .all( '/survey/all*', function( req, res, next ) {
        req.webformType = 'all';
        next();
    } )
    .all( '/instance*', function( req, res, next ) {
        debug( 'setting webform type to "edit"' );
        req.webformType = 'edit';
        next();
    } )
    .get( '/survey', api.survey.get )
    .get( '/survey/iframe', api.survey.get )
    .post( '/survey', api.survey.post )
    .post( '/survey/iframe', api.survey.post )
    .delete( '/survey', api.survey.delete )
    .get( '/survey/preview', api.survey.get )
    .get( '/survey/preview/iframe', api.survey.get )
    .post( '/survey/preview', api.survey.post )
    .post( '/survey/preview/iframe', api.survey.post )
    .get( '/survey/all', api.survey.get )
    .post( '/survey/all', api.survey.post )
    .get( '/surveys/number', api.surveys.number.get )
    .post( '/surveys/number', api.surveys.number.post )
    .get( '/surveys/list', api.surveys.list.get )
    .post( '/surveys/list', api.surveys.list.post )
    .post( '/instance', api.instance.post )
    .post( '/instance/iframe', api.instance.post )
    .delete( '/instance', api.instance.delete )
    .all( '*', function( req, res, next ) {
        var error = new Error( 'Not allowed' );
        error.status = 405;
        next( error );
    } );

module.exports = router;
