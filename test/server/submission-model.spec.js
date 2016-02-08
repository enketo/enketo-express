/* global describe, require, it, afterEach */
'use strict';

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var chai = require( 'chai' );
var expect = chai.expect;
var chaiAsPromised = require( 'chai-as-promised' );
var redis = require( 'redis' );
var config = require( '../../app/models/config-model' ).server;
config[ 'base path' ] = '';
var submission = require( '../../app/models/submission-model' );
var client = redis.createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );

chai.use( chaiAsPromised );

describe( 'Survey Model', function() {

    afterEach( function( done ) {
        // select test database and flush it
        client.select( 15, function( err ) {
            if ( err ) {
                return done( err );
            }
            client.flushdb( function( err ) {
                if ( err ) {
                    return done( err );
                }
                done();
            } );
        } );
    } );

    describe( 'isNew() check', function() {
        var id = 'AAAA';
        var instanceId = 'uuid:BBBB';

        it( 'returns true for not-previously logged submissions', function() {
            var test = submission.isNew( id, instanceId );
            return expect( test ).to.eventually.equal( true );
        } );

        it( 'returns false for previously logged submissions', function() {
            var test = submission.isNew( id, instanceId )
                .then( function() {
                    return submission.isNew( id, instanceId );
                } );
            return expect( test ).to.eventually.equal( false );
        } );

        it( 'is rejected if id is undefined', function() {
            var test = submission.isNew( undefined, instanceId );
            return expect( test ).to.eventually.be.rejected.and.have.property( 'status' ).that.equals( 400 );
        } );

        it( 'is rejected if id is null', function() {
            var test = submission.isNew( null, instanceId );
            return expect( test ).to.eventually.be.rejected.and.have.property( 'status' ).that.equals( 400 );
        } );

        it( 'is rejected if id is false', function() {
            var test = submission.isNew( false, instanceId );
            return expect( test ).to.eventually.be.rejected.and.have.property( 'status' ).that.equals( 400 );
        } );

        it( 'is rejected if instanceId is undefined', function() {
            var test = submission.isNew( id, undefined );
            return expect( test ).to.eventually.be.rejected.and.have.property( 'status' ).that.equals( 400 );
        } );

        it( 'is rejected if instanceId is null', function() {
            var test = submission.isNew( id, null );
            return expect( test ).to.eventually.be.rejected.and.have.property( 'status' ).that.equals( 400 );
        } );

        it( 'is rejected if instanceId is false', function() {
            var test = submission.isNew( id, false );
            return expect( test ).to.eventually.be.rejected.and.have.property( 'status' ).that.equals( 400 );
        } );

    } );

} );
