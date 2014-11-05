/* global describe, require, it, before, after, beforeEach, afterEach */
"use strict";

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var model, survey,
    Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" ),
    redis = require( "redis" ),
    config = require( "../../config/config" ),
    client = redis.createClient( config.redis.cache.port, config.redis.cache.host, {
        auth_pass: config.redis.cache.password
    } ),
    model = require( '../../app/models/cache-model' );

chai.use( chaiAsPromised );
// select database #15 to use as the test database
client.select( 15 );

describe( 'Cache Model', function() {

    beforeEach( function() {
        survey = {
            openRosaServer: 'https://testserver.com/bob',
            openRosaId: 'widgets',
            info: {
                hash: 'abc'
            },
            manifest: [ {
                some: 'manifest'
            } ],
            form: '<form>some form</form>',
            model: '<data>some model</data>'
        };
    } );

    afterEach( function( done ) {
        model.flushAll().then( function() {
            done();
        } );
    } );

    describe( 'set: when attempting to cache a survey', function() {
        it( 'returns an 400 error when openRosaServer is missing', function() {
            delete survey.openRosaServer;
            return expect( model.set( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 400 error when openRosaId is missing', function() {
            delete survey.openRosaId;
            return expect( model.set( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 400 error when info.hash is missing', function() {
            delete survey.info.hash;
            return expect( model.set( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 400 error when form is missing', function() {
            delete survey.form;
            return expect( model.set( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 400 error when model is missing', function() {
            delete survey.model;
            return expect( model.set( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns the survey object when successful if no manifest was provided', function() {
            delete survey.manifest;
            return expect( model.set( survey ) ).to.eventually.deep.equal( survey );
        } );
        it( 'returns the survey object when successful if an empty manifest was provided', function() {
            survey.manifest = [];
            return expect( model.set( survey ) ).to.eventually.deep.equal( survey );
        } );
        it( 'returns the survey object when successful if a manifest was provided', function() {
            return expect( model.set( survey ) ).to.eventually.deep.equal( survey );
        } );
    } );

    describe( 'expiration', function() {
        var expiration = 30 * 24 * 60 * 60 * 1000,
            getTtl = function( key ) {
                var deferred = Q.defer();
                client.pttl( key, function( error, ttl ) {
                    if ( error ) deferred.reject( error );
                    deferred.resolve( ttl );
                } );
                return deferred.promise;
            };
        it( 'is ' + expiration + ' milliseconds for new cache items', function() {
            var promise = model.set( survey )
                .then( function() {
                    return getTtl( 'ca:testserver.com/bob,widgets' );
                } );
            return expect( promise ).to.eventually.be.at.most( expiration )
                .and.to.be.at.least( expiration - 10 );
        } );
        it( 'is reset to the original expiration every time the cache item is accessed ', function() {
            var promise1, promise2,
                delayTime = 1 * 1000,
                delay = function() {
                    var deferred = Q.defer();
                    setTimeout( function() {
                        deferred.resolve( true );
                    }, delayTime );
                    return deferred.promise;
                };

            promise1 = model.set( survey )
                .then( delay )
                .then( function() {
                    return getTtl( 'ca:testserver.com/bob,widgets' );
                } );
            promise2 = promise1.then( function() {
                return model.get( survey );
            } ).then( function() {
                return getTtl( 'ca:testserver.com/bob,widgets' );
            } );

            return Q.all( [
                expect( promise1 ).to.eventually.be.at.most( expiration - delayTime )
                .and.to.be.at.least( expiration - delayTime - 100 ),
                expect( promise2 ).to.eventually.be.at.most( expiration )
                .and.to.be.at.least( expiration - 10 ),
            ] );
        } );
    } );

    describe( 'get: when attempting to obtain a cached survey', function() {
        it( 'returns a 400 error when openRosaServer is missing', function() {
            delete survey.openRosaServer;
            return expect( model.get( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns a 400 error when openRosaId is missing', function() {
            delete survey.openRosaId;
            return expect( model.get( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns null when instance record not cached', function() {
            survey.openRosaId = 'non-existing';
            return expect( model.get( survey ) ).to.eventually.deep.equal( null );
        } );
        it( 'returns the survey object with the form and model properties when successful for item without manifest', function() {
            var promise;

            delete survey.manifest;
            promise = model.set( survey ).then( model.get );
            return Q.all( [
                expect( promise ).to.eventually.have.property( 'form' ).that.equals( survey.form ),
                expect( promise ).to.eventually.have.property( 'model' ).that.equals( survey.model ),
                expect( promise ).to.eventually.have.property( 'xslHash' ).and.to.have.length.above( 2 ),
                expect( promise ).to.eventually.have.property( 'mediaHash' ).and.to.have.length.above( 2 ),
                expect( promise ).to.eventually.have.property( 'formHash' ).and.to.have.length.above( 2 )
            ] );
        } );
        it( 'returns the survey object with the form and model properties when successful', function() {
            var promise = model.set( survey ).then( model.get );
            return Q.all( [
                expect( promise ).to.eventually.have.property( 'form' ).that.equals( survey.form ),
                expect( promise ).to.eventually.have.property( 'model' ).that.equals( survey.model ),
                expect( promise ).to.eventually.have.property( 'xslHash' ).and.to.have.length.above( 2 ),
                expect( promise ).to.eventually.have.property( 'mediaHash' ).and.to.have.length.above( 2 ),
                expect( promise ).to.eventually.have.property( 'formHash' ).and.to.have.length.above( 2 )
            ] );
        } );
    } );

    describe( 'check: when checking the status of a cached survey', function() {
        it( 'returns a 400 error when info.hash is missing', function() {
            delete survey.info.hash;
            return expect( model.check( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns false when the cache is outdated (formHash changed)', function() {
            var setPromise, checkPromise, updatedSurvey;

            updatedSurvey = JSON.parse( JSON.stringify( survey ) );
            setPromise = model.set( survey );
            updatedSurvey.formHash = 'something else';
            checkPromise = setPromise.then( function() {
                return model.check( updatedSurvey );
            } );

            return Q.all( [
                expect( setPromise ).to.eventually.deep.equal( survey ),
                expect( checkPromise ).to.eventually.to.eventually.deep.equal( false )
            ] );

        } );
        it( 'returns false when the cache is outdated (manifest removed)', function() {
            var setPromise, checkPromise, updatedSurvey;

            updatedSurvey = JSON.parse( JSON.stringify( survey ) );
            setPromise = model.set( survey );
            delete updatedSurvey.manifest;
            checkPromise = setPromise.then( function() {
                return model.check( updatedSurvey );
            } );

            return Q.all( [
                expect( setPromise ).to.eventually.deep.equal( survey ),
                expect( checkPromise ).to.eventually.to.eventually.deep.equal( false )
            ] );

        } );
        it( 'returns null when instance record not cached', function() {
            survey.openRosaId = 'non-existing';
            return expect( model.check( survey ) ).to.eventually.deep.equal( null );
        } );
        it( 'returns true when the cache is existing and up-to-date', function() {
            return expect( model.set( survey ).then( model.check ) ).to.eventually.deep.equal( true );
        } );
    } );

    describe( 'flush(ing): when attempting to flush the cache', function() {
        var getCacheCount = function() {
            var deferred = Q.defer();
            client.keys( 'ca:*', function( error, keys ) {
                if ( error ) deferred.reject( error );
                deferred.resolve( keys.length );
            } );
            return deferred.promise;
        };
        it( 'with flushAll, the entire cache becomes empty...', function() {
            var count1, count2, survey2;
            survey2 = JSON.parse( JSON.stringify( survey ) );
            survey2.openRosaId = 'something_else';
            count1 = model.set( survey ).then( function() {
                model.set( survey2 );
            } ).then( getCacheCount );
            count2 = count1.then( model.flushAll ).then( getCacheCount );

            return Q.all( [
                expect( count1 ).to.eventually.equal( 2 ),
                expect( count2 ).to.eventually.deep.equal( 0 )
            ] );
        } );
        it( 'with flush, an individual survey cache becomes empty...', function() {
            var get1Promise = model.set( survey ).then( model.get ),
                get2Promise = get1Promise.then( model.flush ).then( function() {
                    return model.get( survey );
                } );
            return Q.all( [
                expect( get1Promise ).to.eventually.have.property( 'form' ).that.equals( survey.form ),
                expect( get2Promise ).to.eventually.deep.equal( null )
            ] );
        } );
    } );
} );
