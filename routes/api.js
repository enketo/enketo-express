"use strict";

var express = require( 'express' );
var router = express.Router();
var api = require( '../controllers/api-controller' );
var debug = require( 'debug' )( 'api-router' );


router
    .all( '*', api.auth )
    .all( '/*/iframe', function( req, res, next ) {
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
