/* global describe, require, it, beforeEach, afterEach */
"use strict";

/* 
 * These tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" ),
    request = require( 'supertest' ),
    app = require( '../../config/express' ),
    surveyModel = require( '../../app/models/survey-model' ),
    instanceModel = require( '../../app/models/instance-model' ),
    redis = require( "redis" ),
    config = require( "../../config/config" ),
    client = redis.createClient( config.redis.main.port, config.redis.main.host, {
        auth_pass: config.redis.main.password
    } );

chai.use( chaiAsPromised );

describe( 'Submissions', function() {
    var enketoId,
        nonExistingEnketoId = 'nope',
        validServer = 'https://testserver.com/bob',
        validFormId = 'something';

    beforeEach( function( done ) {
        // add survey if it doesn't exist in the db
        surveyModel.set( {
            openRosaServer: validServer,
            openRosaId: validFormId,
        } ).then( function( id ) {
            enketoId = id;
            done();
        } );
    } );

    afterEach( function( done ) {
        // select test database and flush it
        client.select( 15, function( err ) {
            if ( err ) return done( err );
            client.flushdb( function( err ) {
                if ( err ) return done( err );
                done();
            } );
        } );
    } );

    describe( 'for active/existing Enketo IDs', function() {

        [
            // invalid methods
            {
                method: 'put',
                data: '<data></data>',
                status: 405
            }, {
                method: 'delete',
                data: '<data></data>',
                status: 405
            }
        ].forEach( function( test ) {

            it( 'using ' + test.method.toUpperCase() + ' of ' + test.data +
                ' responds with ' + test.status,
                function( done ) {

                    request( app )[ test.method ]( '/submission/::' + enketoId )
                        .field( 'xml_submission_file', new Buffer( [ test.data ] ) )
                        .expect( test.status, done );

                } );
        } );

    } );

    describe( 'for inactive or non-existing Enketo IDs', function() {

        beforeEach( function( done ) {
            // de-activate survey
            surveyModel.update( {
                openRosaServer: validServer,
                openRosaId: validFormId,
                active: false
            } ).then( function( id ) {
                enketoId = id;
                done();
            } );
        } );

        it( 'using POST of <data></data> to inactive ID responds with 404', function( done ) {
            request( app )
                .post( '/submission/::' + enketoId )
                .field( 'xml_submission_file', '<data></data>' )
                .expect( 404, done );
        } );

        it( 'using POST of <data></data> to non-existing ID responds with 404', function( done ) {
            request( app )
                .post( '/submission/::' + nonExistingEnketoId )
                .field( 'xml_submission_file', '<data></data>' )
                .expect( 404, done );
        } );

    } );

    describe( 'using GET (existing submissions) for an existing/active Enketo IDs', function() {

        it( 'responds with 400 if no instanceID provided', function( done ) {
            request( app ).get( '/submission/::' + enketoId )
                .expect( 400, done );
        } );

        it( 'responds with 400 if instanceID is empty', function( done ) {
            request( app ).get( '/submission/::' + enketoId + '?instanceId=' )
                .expect( 400, done );
        } );

        it( 'responds with 404 if instanceID requested is not found', function( done ) {
            request( app ).get( '/submission/::' + enketoId + '?instanceId=a' )
                .expect( 404, done );
        } );

        describe( 'for a valid and existing instanceID that does not belong to the current form', function() {

            beforeEach( function( done ) {
                // add survey if it doesn't exist in the db
                instanceModel.set( {
                    openRosaServer: validServer,
                    openRosaId: 'differentId',
                    instanceId: 'b',
                    returnUrl: 'example.com',
                    instance: '<data></data>'
                } ).then( function( s ) {
                    done();
                } );
            } );

            it( 'responds with 400', function( done ) {
                request( app ).get( '/submission/::' + enketoId + '?instanceId=b' )
                    .expect( 400, done );
            } );

        } );

        describe( 'for a valid and existing instanceID that belongs to the current form', function() {

            beforeEach( function( done ) {
                // add survey if it doesn't exist in the db
                instanceModel.set( {
                    openRosaServer: validServer,
                    openRosaId: validFormId,
                    instanceId: 'c',
                    returnUrl: 'example.com',
                    instance: '<data></data>'
                } ).then( function( s ) {
                    done();
                } );
            } );

            it( 'responds with 200', function( done ) {
                request( app ).get( '/submission/::' + enketoId + '?instanceId=c' )
                    .expect( 200, done );
            } );

        } );

    } );

} );
