/* global describe, require, it, beforeEach, afterEach, expect, Blob, sinon */
'use strict';

global.Promise = require( 'lie' );

var formCache = require( '../../public/js/src/module/form-cache' );
var connection = require( '../../public/js/src/module/connection' );
var Promise = require( 'lie' );
var $ = require( 'jquery' );

var url1 = '/path/to/source.png';
var form1 = '<form class="or"><img src="' + url1 + '"/></form>';
var model1 = '<model></model>';
var hash1 = '12345';

describe( 'Client Form Cache', function() {
    var survey, sandbox, getFormPartsSpy, getFileSpy;

    beforeEach( function() {
        survey = {};
        sandbox = sinon.createSandbox();
        getFormPartsSpy = sandbox.stub( connection, 'getFormParts' ).callsFake( function( survey ) {
            return Promise.resolve( {
                enketoId: survey.enketoId,
                form: form1,
                model: model1,
                hash: hash1
            } );
        } );
        getFileSpy = sandbox.stub( connection, 'getMediaFile' ).callsFake( function( url ) {
            return Promise.resolve( {
                url: url,
                item: new Blob( [ 'babdf' ], {
                    type: 'image/png'
                } )
            } );
        } );
    } );

    afterEach( function() {
        sandbox.restore();
    } );

    it( 'is loaded', function() {
        expect( formCache ).to.be.an( 'object' );
    } );

    describe( 'in empty state', function() {

        it( 'will call connection.getFormParts to obtain the form parts', function( done ) {
            survey.enketoId = '10';
            formCache.init( survey )
                .then( function() {
                    expect( getFormPartsSpy ).to.have.been.calledWith( survey );
                } )
                .then( done, done );
        } );

        it( 'will call connection.getMediaFile to obtain form resources', function( done ) {
            survey.enketoId = '20';
            formCache.init( survey )
                .then( function( result ) {
                    result.$form = $( result.form );
                    return formCache.updateMedia( result );
                } )
                .then( function() {
                    expect( getFileSpy ).to.have.been.calledWith( url1 );
                } )
                .then( done, done );
        } );

        it( 'will populate the cache upon initialization', function( done ) {
            survey.enketoId = '30';
            formCache.get( survey )
                .then( function( result ) {
                    expect( result ).to.equal( undefined );
                    return formCache.init( survey );
                } )
                .then( function() {
                    // we could also leave this out as formCache.init will return the survey object
                    return formCache.get( survey );
                } )
                .then( function( result ) {
                    expect( result.model ).to.equal( model1 );
                    expect( result.hash ).to.equal( hash1 );
                    expect( result.enketoId ).to.equal( survey.enketoId );
                } )
                .then( done, done );
        } );

        it( 'will empty src attributes and copy the original value to a data-offline-src attribute ', function( done ) {
            survey.enketoId = '40';
            formCache.init( survey )
                .then( function( result ) {
                    expect( result.form ).to.contain( 'src=""' ).and.to.contain( 'data-offline-src="' + url1 + '"' );
                } )
                .then( done, done );
        } );

    } );

    /*
    describe( 'in cached state', function() {
        
        it( 'initializes succesfully', function( done ) {
            survey = {
                enketoId: 'TESt',
                form: '<form class="or"></form>',
                model: '<model></model>',
                hash: '12345'
            };
            
            formCache.set( survey )
                .then( function() {
                    return formCache.init( survey );
                } )
                .then( function( result ) {
                    expect( result ).to.deep.equal( survey );
                } )
                .then( done, done );
                
        } );

    } );

        
    describe( 'in outdated cached state', function() {

        it( 'initializes (the outdated survey) succesfully', function() {

        } );

        it( 'updates automatically', function() {

        } );
    } );
    */
} );
