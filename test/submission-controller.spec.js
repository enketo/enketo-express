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
    app = require( '../config/express' ),
    surveyModel = require( '../app/models/survey-model' );

chai.use( chaiAsPromised );

describe( 'submission', function() {
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

    describe( 'for active/existing enketo IDs', function() {

        [
            // invalid methods
            {
                method: 'get',
                data: '<data></data>',
                status: 405
            }, {
                method: 'put',
                data: '<data></data>',
                status: 405
            }, {
                method: 'delete',
                data: '<data></data>',
                status: 405
            },
            // missing data
            {
                method: 'post',
                data: "",
                status: 400
            }
            /*,
            // request ok, but OpenRosa server not there
            {
                method: 'post',
                data: '<data></data>',
                status: 404
            }*/
        ].forEach( function( test ) {

            it( 'using ' + test.method.toUpperCase() + ' of ' + test.data +
                ' responds with ' + test.status, function( done ) {
                    request( app )[ test.method ]( '/submission/::' + enketoId )
                        .field( 'xml_submission_data', test.data )
                        .expect( test.status, done );
                } );
        } );

    } );

    describe( 'for inactive or non-existing enketo IDs', function() {

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
                .field( 'xml_submission_data', '<data></data>' )
                .expect( 404, done );
        } );

        it( 'using POST of <data></data> to non-existing ID responds with 404', function( done ) {
            request( app )
                .post( '/submission/::' + nonExistingEnketoId )
                .field( 'xml_submission_data', '<data></data>' )
                .expect( 404, done );
        } );

    } );
} );
