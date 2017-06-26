/* global describe, require, it, beforeEach, afterEach */
'use strict';

var Promise = require( 'lie' );
var chai = require( 'chai' );
var expect = chai.expect;
var chaiAsPromised = require( 'chai-as-promised' );
var model = require( '../../app/models/instance-model' );

chai.use( chaiAsPromised );

describe( 'Instance Model', function() {

    afterEach( function( done ) {
        model.remove( {
                instanceId: 'someid'
            } )
            .then( function() {
                done();
            } )
            .catch( function() {
                done();
            } );
    } );

    describe( 'set: when attempting to cache an instance', function() {
        var survey;

        beforeEach( function() {
            survey = {
                openRosaId: 'widgets',
                openRosaServer: 'http://example.com',
                instanceId: 'someid',
                returnUrl: 'http://example.com',
                instance: '<data></data>',
                instanceAttachments: {
                    'test.jpg': 'https://example.com/test.jpg'
                }
            };
        } );

        it( 'returns an 400 error when instanceId is missing', function() {
            delete survey.instanceId;
            return expect( model.set( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 400 error when openRosaId is missing', function() {
            delete survey.openRosaId;
            return expect( model.set( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 400 error when openRosaServer is missing', function() {
            delete survey.openRosaServer;
            return expect( model.set( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 400 error when instance is missing', function() {
            delete survey.instance;
            return expect( model.set( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns the survey object when successful', function() {
            return expect( model.set( survey ) ).to.eventually.deep.equal( survey );
        } );
    } );

    describe( 'get: when attempting to obtain a cached instance', function() {
        var survey;
        var promise;

        beforeEach( function() {
            survey = {
                openRosaId: 'widgets',
                openRosaServer: 'http://example.com',
                instanceId: 'someid',
                returnUrl: 'http://example.com',
                instance: '<data></data>',
                instanceAttachments: {
                    'test.jpg': 'https://example.com/test.jpg'
                }
            };
        } );

        it( 'returns an 400 error when instanceId is missing', function() {
            delete survey.instanceId;
            return expect( model.get( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 404 error when instance record not cached', function() {
            survey.instanceId = 'non-existing';
            return expect( model.get( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 404 );
        } );
        it( 'returns the survey object with the instance property when successful', function() {
            promise = model.set( survey ).then( model.get );
            return Promise.all( [
                expect( promise ).to.eventually
                .have.property( 'instance' ).that.equals( survey.instance ),
                expect( promise ).to.eventually.
                have.property( 'returnUrl' ).that.equals( survey.returnUrl )
            ] );
        } );
    } );

    describe( 'remove: when attempting to remove a cached instance', function() {
        var survey;
        var setPromise;
        var remPromise;
        var getPromise;

        beforeEach( function() {
            survey = {
                openRosaId: 'widgets',
                instanceId: 'someid',
                openRosaServer: 'http://example.com',
                returnUrl: 'http://example.com',
                instance: '<data></data>'
            };
        } );

        it( 'returns a 400 error when the instanceId property is not provided in the parameter', function() {
            setPromise = model.set( survey ).then( model.get );
            remPromise = setPromise.then( function() {
                delete survey.instanceId;
                return model.remove( survey );
            } );
            return expect( remPromise ).to.eventually.be.rejected.and.to.have.property( 'status' ).that.equals( 400 );
        } );

        it( 'returns the removed instanceId when successful', function() {
            setPromise = model.set( survey ).then( model.get );
            remPromise = setPromise.then( model.remove );
            getPromise = remPromise.then( function() {
                return model.get( {
                    instanceId: survey.instanceId
                } );
            } );

            return Promise.all( [
                expect( setPromise ).to.eventually.have.property( 'instance' ).that.equals( survey.instance ),
                expect( remPromise ).to.eventually.equal( survey.instanceId ),
                expect( getPromise ).to.eventually.be.rejected.and.to.have.property( 'status' ).that.equals( 404 )
            ] );
        } );

        it( 'returns the removed instanceId if the record was already removed or never existed', function() {
            return expect( model.remove( survey ) ).to.eventually.equal( survey.instanceId );
        } );
    } );
} );
