/* global describe, require, it, beforeEach, afterEach */
/* 
 * These tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const request = require( 'supertest' );
const app = require( '../../config/express' );
const surveyModel = require( '../../app/models/survey-model' );
const instanceModel = require( '../../app/models/instance-model' );
const redis = require( 'redis' );
const config = require( '../../app/models/config-model' ).server;
const client = redis.createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );

describe( 'Submissions', () => {
    let enketoId;
    const nonExistingEnketoId = 'nope';
    const validServer = 'https://testserver.com/bob';
    const validFormId = 'something';

    beforeEach( done => {
        // add survey if it doesn't exist in the db
        surveyModel.set( {
            openRosaServer: validServer,
            openRosaId: validFormId,
        } ).then( id => {
            enketoId = id;
            done();
        } );
    } );

    afterEach( done => {
        // select test database and flush it
        client.select( 15, err => {
            if ( err ) {
                return done( err );
            }
            client.flushdb( err => {
                if ( err ) {
                    return done( err );
                }
                done();
            } );
        } );
    } );

    describe( 'for active/existing Enketo IDs', () => {

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
        ].forEach( test => {

            it( `using ${test.method.toUpperCase()} of ${test.data} responds with ${test.status}`,
                done => {

                    request( app )[ test.method ]( `/submission/::${enketoId}` )
                        .field( 'xml_submission_file', new Buffer( [ test.data ] ) )
                        .expect( test.status, done );

                } );
        } );

    } );

    describe( 'for inactive or non-existing Enketo IDs', () => {

        beforeEach( done => {
            // de-activate survey
            surveyModel.update( {
                openRosaServer: validServer,
                openRosaId: validFormId,
                active: false
            } ).then( id => {
                enketoId = id;
                done();
            } );
        } );

        it( 'using POST of <data></data> to inactive ID responds with 404', done => {
            request( app )
                .post( `/submission/::${enketoId}` )
                .field( 'xml_submission_file', '<data></data>' )
                .expect( 404, done );
        } );

        it( 'using POST of <data></data> to non-existing ID responds with 404', done => {
            request( app )
                .post( `/submission/::${nonExistingEnketoId}` )
                .field( 'xml_submission_file', '<data></data>' )
                .expect( 404, done );
        } );

    } );

    describe( 'using GET (existing submissions) for an existing/active Enketo IDs', () => {

        it( 'responds with 400 if no instanceID provided', done => {
            request( app ).get( `/submission/::${enketoId}` )
                .expect( 400, done );
        } );

        it( 'responds with 400 if instanceID is empty', done => {
            request( app ).get( `/submission/::${enketoId}?instanceId=` )
                .expect( 400, done );
        } );

        it( 'responds with 404 if instanceID requested is not found', done => {
            request( app ).get( `/submission/::${enketoId}?instanceId=a` )
                .expect( 404, done );
        } );

        describe( 'for a valid and existing instanceID that does not belong to the current form', () => {

            beforeEach( done => {
                // add survey if it doesn't exist in the db
                instanceModel.set( {
                    openRosaServer: validServer,
                    openRosaId: 'differentId',
                    instanceId: 'b',
                    returnUrl: 'example.com',
                    instance: '<data></data>',
                    instanceAttachments: {
                        'test.jpg': 'https://example.com'
                    }
                } ).then( () => {
                    done();
                } );
            } );

            it( 'responds with 400', done => {
                request( app ).get( `/submission/::${enketoId}?instanceId=b` )
                    .expect( 400, done );
            } );

        } );

        describe( 'for a valid and existing instanceID that belongs to the current form', () => {

            beforeEach( done => {
                // add survey if it doesn't exist in the db
                instanceModel.set( {
                    openRosaServer: validServer,
                    openRosaId: validFormId,
                    instanceId: 'c',
                    returnUrl: 'example.com',
                    instance: '<data></data>'
                } ).then( () => {
                    done();
                } );
            } );

            it( 'responds with 200', done => {
                request( app ).get( `/submission/::${enketoId}?instanceId=c` )
                    .expect( 200, done );
            } );

        } );

    } );

} );
