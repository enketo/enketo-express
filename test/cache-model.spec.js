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
    config = require( "../config/config" ),
    client = redis.createClient( config.redis.cache.port, config.redis.cache.host, {
        auth_pass: config.redis.cache.password
    } ),
    model = require( '../app/models/cache-model' );

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
        model.flush().then( function() {
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
        it( 'returns an 400 error when openRosaServer is missing', function() {
            delete survey.openRosaServer;
            return expect( model.get( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 400 error when openRosaId is missing', function() {
            delete survey.openRosaId;
            return expect( model.get( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns an 400 error when info.hash is missing', function() {
            delete survey.info.hash;
            return expect( model.get( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 400 );
        } );
        it( 'returns 404 when instance record not cached', function() {
            survey.openRosaId = 'non-existing';
            return expect( model.get( survey ) ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 404 );
        } );
        it( 'returns false when the cache is outdated (formHash changed)', function() {
            var setPromise, getPromise, updatedSurvey;

            updatedSurvey = JSON.parse( JSON.stringify( survey ) );
            setPromise = model.set( survey );
            updatedSurvey.formHash = 'something else';
            getPromise = setPromise.then( function() {
                return model.get( updatedSurvey );
            } );

            return Q.all( [
                expect( setPromise ).to.eventually.deep.equal( survey ),
                expect( getPromise ).to.eventually.to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 410 )
            ] );

        } );
        it( 'returns false when the cache is outdated (manifest removed)', function() {
            var setPromise, getPromise, updatedSurvey;

            updatedSurvey = JSON.parse( JSON.stringify( survey ) );
            setPromise = model.set( survey );
            delete updatedSurvey.manifest;
            getPromise = setPromise.then( function() {
                return model.get( updatedSurvey );
            } );

            return Q.all( [
                expect( setPromise ).to.eventually.deep.equal( survey ),
                expect( getPromise ).to.eventually.to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 410 )
            ] );

        } );
        it( 'returns the survey object with the form and model properties when successful for item without manifest', function() {
            var promise;

            delete survey.manifest;
            promise = model.set( survey ).then( model.get );
            return Q.all( [
                expect( promise ).to.eventually.have.property( 'form' ).that.equals( survey.form ),
                expect( promise ).to.eventually.have.property( 'model' ).that.equals( survey.model )
            ] );
        } );
        it( 'returns the survey object with the form and model properties when successful', function() {
            var promise = model.set( survey ).then( model.get );
            return Q.all( [
                expect( promise ).to.eventually.have.property( 'form' ).that.equals( survey.form ),
                expect( promise ).to.eventually.have.property( 'model' ).that.equals( survey.model )
            ] );
        } );
    } );

    describe( 'flush: when attempting to flush the cache', function() {
        it( 'the cache becomes empty ;)', function() {
            var get1Promise = model.set( survey ).then( model.get ),
                get2Promise = get1Promise.then( model.flush ).then( function() {
                    return model.get( survey );
                } );
            return Q.all( [
                expect( get1Promise ).to.eventually.have.property( 'form' ).that.equals( survey.form ),
                expect( get2Promise ).to.eventually.be.rejected
                .and.to.have.property( 'status' ).that.equals( 404 )
            ] );
        } );
    } );
} );
