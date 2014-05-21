/* global describe, require, it, beforeEach, afterEach */
"use strict";

var model,
    Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" ),
    redis = require( "redis" ),
    client = redis.createClient();

chai.use( chaiAsPromised );

describe( 'model', function() {

    beforeEach( function( done ) {
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
            expect( client ).to.be.ok;
        } );
    } );

    describe( 'when attempting to store new surveys with incomplete/false information', function() {
        it( 'returns an error if the OpenRosa Server is missing', function() {
            var survey = {
                openRosaId: 'widgets'
            };
            return expect( model.set( survey ) ).to.eventually.be.rejected;
        } );
        it( 'returns an error if the OpenRosa Form ID is missing', function() {
            var survey = {
                openRosaServer: 'https://ona.io/enketo'
            };
            return expect( model.set( survey ) ).to.eventually.be.rejected;
        } );
    } );

    describe( 'when attempting to store new surveys with correct information', function() {
        var survey = {
            openRosaId: 'widgets',
            openRosaServer: 'https://ona.io/enketo'
        };
        it( 'returns an enketo id of 4 characters', function() {
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

    describe( 'when attempting to obtain a non-existing survey', function() {
        it( 'returns an error', function() {
            return expect( model.get( 'nonexisting' ) ).to.eventually.be.rejected;
        } );
    } );

    describe( 'when attempting to obtain an existing survey', function() {
        it( 'returns the survey object', function() {
            var survey = {
                    openRosaId: 'test',
                    openRosaServer: 'https://ona.io/enketo'
                },
                getSurveyPromise = model.set( survey ).then( function( id ) {
                    return model.get( id );
                } );
            return Q.all( [
                expect( getSurveyPromise ).to.eventually.have.property( 'openRosaId' ).and.to.equal( survey.openRosaId ),
                expect( getSurveyPromise ).to.eventually.have.property( 'openRosaServer' ).and.to.equal( survey.openRosaServer )
            ] );
        } );
    } );

    describe( 'helper to clean openRosaServer URLs', function() {
        var urls1 = [
            "https://ona.io/enketo",
            " https://ona.io/enketo",
            "https://ona.io/enketo/",
            "http://ona.io/enketo",
            "https://www.ona.io/enketo",
            " https://www.ona.io/enketo",
            "https://www.ona.io/enketo/",
            "http://www.ona.io/enketo",
            "https://ona.io/enketo ",
            " https://ona.io/enketo ",
            "https://ona.io/enketo/ ",
            "http://ona.io/enketo ",
            "https://www.ona.io/enketo ",
            " https://www.ona.io/enketo ",
            "https://www.ona.io/enketo/ ",
            "http://www.ona.io/enketo "
        ];
        urls1.forEach( function( url ) {
            it( 'returns clean url for ' + url, function() {
                expect( model.cleanUrl( url ) ).to.equal( 'ona.io/enketo' );
            } );
        } );
        var urls2 = [
            "https://enketo.surveycto.com",
            " https://enketo.surveycto.com",
            "https://enketo.surveycto.com/",
            "http://enketo.surveycto.com",
            "https://www.enketo.surveycto.com",
            " https://www.enketo.surveycto.com",
            "https://www.enketo.surveycto.com/",
            "http://www.enketo.surveycto.com",
            "https://enketo.surveycto.com ",
            " https://enketo.surveycto.com ",
            "https://enketo.surveycto.com/ ",
            "http://enketo.surveycto.com ",
            "https://www.enketo.surveycto.com ",
            " https://www.enketo.surveycto.com ",
            "https://www.enketo.surveycto.com ",
            "http://www.enketo.surveycto.com "
        ];
        urls2.forEach( function( url ) {
            it( 'returns clean url for ' + url, function() {
                expect( model.cleanUrl( url ) ).to.equal( 'enketo.surveycto.com' );
            } );
        } );
        var urls3 = [
            "https://ENKETO.surveycto.com/PaTH",
            " https://ENKETO.surveycto.com/PaTH",
            "https://ENKETO.surveycto.com/PaTH",
            "http://ENKETO.surveycto.com/PaTH/",
            "https://www.ENKETO.surveycto.com/PaTH",
            " https://www.ENKETO.surveycto.com/PaTH",
            "https://www.ENKETO.surveycto.com/PaTH/",
            "http://www.ENKETO.surveycto.com/PaTH",
            "https://ENKETO.surveycto.com/PaTH ",
            " https://ENKETO.surveycto.com/PaTH ",
            "https://ENKETO.surveycto.com/PaTH/ ",
            "http://ENKETO.surveycto.com/PaTH ",
            "https://www.ENKETO.surveycto.com/PaTH ",
            " https://www.ENKETO.surveycto.com/PaTH ",
            "https://www.ENKETO.surveycto.com/PaTH/ ",
            "http://www.ENKETO.surveycto.com/PaTH "
        ];
        urls3.forEach( function( url ) {
            it( 'returns clean url with lowercased domain and path for ' + url, function() {
                expect( model.cleanUrl( url ) ).to.equal( 'enketo.surveycto.com/path' );
            } );
        } );
        var urls4 = [
            "https://255.255.255.255/AGGREGATE",
            " https://255.255.255.255/AGGREGATE",
            "https://255.255.255.255/AGGREGATE/",
            "http://255.255.255.255/AGGREGATE",
            "https://255.255.255.255/AGGREGATE ",
            " https://255.255.255.255/AGGREGATE ",
            "https://255.255.255.255/AGGREGATE/ ",
            "http://255.255.255.255/AGGREGATE "
        ];
        urls4.forEach( function( url ) {
            it( 'returns clean IP url with lowercased path for ' + url, function() {
                expect( model.cleanUrl( url ) ).to.equal( '255.255.255.255/aggregate' );
            } );
        } );
    } );
} );
