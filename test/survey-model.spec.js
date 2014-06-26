/* global describe, require, it, before, after, beforeEach, afterEach */
"use strict";

var model,
    Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" ),
    redis = require( "redis" ),
    config = require( "../config" ),
    client = redis.createClient( config.redis.main.port, config.redis.main.host, {
        auth_pass: config.redis.main.password
    } );

chai.use( chaiAsPromised );

describe( 'Survey Model', function() {

    before( function( done ) {
        // select database #15 to use as the test database
        client.select( 15, function( err ) {
            if ( err ) return done( err );
            model = require( '../models/survey-model' )( client );
            done();
        } );
    } );

    afterEach( function( done ) {
        client.flushdb( function( err ) {
            if ( err ) return done( err );
            done();
        } );
    } );

    describe( 'database and client', function() {
        it( 'are live and operational', function() {
            return expect( client ).to.be.ok;
        } );
    } );

    describe( 'set: when attempting to store new surveys', function() {
        var survey;

        beforeEach( function() {
            survey = {
                openRosaId: 'widgets',
                openRosaServer: 'https://ona.io/enketo'
            };
        } );

        it( 'returns an error if the OpenRosa Server is missing', function() {
            delete survey.openRosaServer;
            return expect( model.set( survey ) ).to.eventually.be.rejected;
        } );

        it( 'returns an error if the OpenRosa Form ID is missing', function() {
            delete survey.openRosaId;
            return expect( model.set( survey ) ).to.eventually.be.rejected;
        } );

        it( 'returns an error if the OpenRosa Form ID is an empty string', function() {
            survey.openRosaId = '';
            return expect( model.set( survey ) ).to.eventually.be.rejected;
        } );

        it( 'returns an error if the OpenRosa Server is an empty string', function() {
            survey.openRosaServer = '';
            return expect( model.set( survey ) ).to.eventually.be.rejected;
        } );

        it( 'returns an enketo id of 4 characters if succesful', function() {
            // the algorithm for the very first survey to be created return YYYp for number 1
            return expect( model.set( survey ) ).to.eventually.equal( 'YYYp' );
        } );

        it( 'drops nearly simultaneous set requests to avoid db corruption', function() {
            return Q.all( [
                expect( model.set( survey ) ).to.eventually.equal( 'YYYp' ),
                expect( model.set( survey ) ).to.eventually.be.rejected,
                expect( model.set( survey ) ).to.eventually.be.rejected
            ] );
        } );
    } );

    describe( 'get: when attempting to obtain a survey', function() {
        it( 'returns an error when survey does not exist', function() {
            return expect( model.get( 'nonexisting' ) ).to.eventually.be.rejected;
        } );

        it( 'returns the survey object when survey exists', function() {
            var survey = {
                    openRosaId: 'test',
                    openRosaServer: 'https://ona.io/enketo'
                },
                getSurveyPromise = model.set( survey ).then( model.get );
            return Q.all( [
                expect( getSurveyPromise ).to.eventually.have.property( 'openRosaId' ).and.to.equal( survey.openRosaId ),
                expect( getSurveyPromise ).to.eventually.have.property( 'openRosaServer' ).and.to.equal( survey.openRosaServer )
            ] );
        } );
    } );

    describe( 'update: when updating an existing survey', function() {
        var survey;

        beforeEach( function() {
            survey = {
                openRosaId: 'test',
                openRosaServer: 'https://ona.io/enketo'
            };
        } );

        it( 'it returns an error when the parameters are incorrect', function() {
            var promise1 = model.set( survey ),
                promise2 = promise1.then( function() {
                    survey.openRosaId = '';
                    //change to http
                    survey.openRosaServer = 'http://ona.io/enketo';
                    return model.update( survey );
                } ).then( model.get );
            return Q.all( [
                expect( promise1 ).to.eventually.have.length( 4 ),
                expect( promise2 ).to.eventually.be.rejected
            ] );
        } );
        it( 'returns the edited survey object when succesful', function() {
            var promise = model.set( survey ).then( function() {
                //change to http
                survey.openRosaServer = 'http://ona.io/enketo';
                return model.update( survey );
            } ).then( model.get );
            return Q.all( [
                expect( promise ).to.eventually.have.property( 'openRosaId' ).and.to.equal( survey.openRosaId ),
                expect( promise ).to.eventually.have.property( 'openRosaServer' ).and.to.equal( 'http://ona.io/enketo' )
            ] );
        } );
        it( 'returns the edited survey object when succesful and called via set()', function() {
            var promise = model.set( survey ).then( function() {
                // change to http
                survey.openRosaServer = 'http://ona.io/enketo';
                // set again
                return model.set( survey );
            } ).then( model.get );
            return Q.all( [
                expect( promise ).to.eventually.have.property( 'openRosaId' ).and.to.equal( survey.openRosaId ),
                expect( promise ).to.eventually.have.property( 'openRosaServer' ).and.to.equal( 'http://ona.io/enketo' )
            ] );
        } );

    } );

    describe( 'getId: when obtaining the enketo ID', function() {
        var survey = {
            openRosaId: 'existing',
            openRosaServer: 'https://ona.io/enketo'
        };
        it( 'of an existing survey, it returns the id', function() {
            var promise1 = model.set( survey ),
                promise2 = promise1.then( function() {
                    return model.getId( survey );
                } );
            return Q.all( [
                expect( promise1 ).to.eventually.equal( 'YYYp' ),
                expect( promise2 ).to.eventually.equal( 'YYYp' )
            ] );
        } );
        it( 'of a non-existing survey, it returns null', function() {
            survey.openRosaId = 'non-existing';

            var promise = model.getId( survey );
            return expect( promise ).to.eventually.be.fulfilled.and.deep.equal( null );
        } );
        it( 'of a survey with incorrect parameters, it returns a 400 error', function() {
            survey.openRosaId = null;
            var promise = model.getId( survey );
            return expect( promise ).to.eventually.be.rejected.and.have.property( 'status' ).that.equals( 400 );
        } );
    } );

} );
