/* global describe, require, it, beforeEach, afterEach */
"use strict";

/* 
 * These tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org. They will create 1 entry in the production database, which
 * is probably not such a good idea.
 */

var Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" ),
    request = require( 'supertest' ),
    app = require( '../app' ),
    surveyModel = require( '../models/survey-model' )();

chai.use( chaiAsPromised );

describe( 'api', function() {
    var validApiToken = 'abc',
        validAuth = {
            'Authorization': 'Basic ' + new Buffer( validApiToken + ':' ).toString( 'base64' )
        },
        invalidApiToken = 'def',
        invalidAuth = {
            'Authorization': 'Basic ' + new Buffer( invalidApiToken + ':' ).toString( 'base64' )
        },
        validServer = 'https://testserver.com/bob',
        validFormId = 'something',
        invalidServer = 'https://someotherserver.com/john';

    beforeEach( function( done ) {
        // add survey if it doesn't exist in the db
        surveyModel.set( {
            openRosaServer: validServer,
            openRosaId: validFormId,
        } ).then( function() {
            done();
        } );
    } );

    afterEach( function( done ) {
        // de-activate it
        surveyModel.update( {
            openRosaServer: validServer,
            openRosaId: validFormId,
            active: false
        } ).then( function() {
            done();
        } );
    } );

    describe( '', function() {

        [
            //valid token
            {
                method: 'get',
                auth: true,
                status: 200
            }, {
                method: 'post',
                auth: true,
                status: 200
            }, {
                method: 'put',
                auth: true,
                status: 405
            }, {
                method: 'delete',
                auth: true,
                status: 204
            },
            //invalid token
            {
                method: 'get',
                auth: false,
                status: 401
            }, {
                method: 'post',
                auth: false,
                status: 401
            }, {
                method: 'put',
                auth: false,
                status: 401
            }, {
                method: 'delete',
                auth: false,
                status: 401
            },
            //missing token
            {
                method: 'get',
                auth: null,
                status: 401
            }, {
                method: 'post',
                auth: null,
                status: 401
            }, {
                method: 'put',
                auth: null,
                status: 401
            }, {
                method: 'delete',
                auth: null,
                status: 401
            },
            //non-existing account
            {
                method: 'get',
                auth: true,
                status: 403,
                server: invalidServer
            }, {
                method: 'post',
                auth: true,
                status: 403,
                server: invalidServer
            }, {
                method: 'put',
                auth: true,
                status: 403,
                server: invalidServer
            }, {
                method: 'delete',
                auth: true,
                status: 403,
                server: invalidServer
            },
            //server_url not provided or empty
            {
                method: 'get',
                auth: true,
                status: 400,
                server: ''
            }, {
                method: 'post',
                auth: true,
                status: 400,
                server: ''
            }, {
                method: 'put',
                auth: true,
                status: 400,
                server: ''
            }, {
                method: 'delete',
                auth: true,
                status: 400,
                server: ''
            }
        ].forEach( function( test ) {
            var authDesc = test.auth === true ? 'valid' : ( test.auth === false ? 'invalid' : 'empty' ),
                auth = test.auth === true ? validAuth : ( test.auth === false ? invalidAuth : {} ),
                server = ( typeof test.server !== 'undefined' ) ? test.server : validServer;

            it( test.method.toUpperCase() + ' /survey with ' + authDesc + ' authentication and ' + server +
                ' responds with ' + test.status, function( done ) {
                    request( app )[ test.method ]( '/api/v1/survey' )
                        .set( auth )
                        .send( {
                            server_url: server,
                            form_id: validFormId
                        } )
                        .expect( test.status, done );
                } );
        } );
        // TODO: add some tests for other survey/* endpoints

        [
            // valid token
            {
                method: 'post',
                auth: true,
                status: 201
            },
            // already being edited
            {
                method: 'post',
                auth: true,
                status: 405
            },
            // invalid parameters
            {
                method: 'post',
                auth: true,
                id: '',
                status: 400
            }, {
                method: 'post',
                auth: true,
                instance: '',
                status: 400
            }, {
                method: 'post',
                auth: true,
                instanceId: '',
                status: 400
            }, {
                method: 'post',
                auth: true,
                ret: '',
                status: 400
            }, {
                method: 'post',
                auth: true,
                server: '',
                status: 400
            },
            // different methods, valid token
            {
                method: 'get',
                auth: true,
                status: 405
            }, {
                method: 'put',
                auth: true,
                status: 405
            },
            // removes instance from db
            {
                method: 'delete',
                auth: true,
                status: 204
            },
            // no account 
            {
                method: 'post',
                auth: true,
                status: 403,
                server: 'https://testserver.com/notexist'
            }
        ].forEach( function( test ) {
            var authDesc = test.auth === true ? 'valid' : ( test.auth === false ? 'invalid' : 'empty' ),
                auth = test.auth === true ? validAuth : ( test.auth === false ? invalidAuth : {} ),
                server = typeof test.server !== 'undefined' ? test.server : validServer,
                id = typeof test.id !== 'undefined' ? test.id : validFormId,
                ret = typeof test.ret !== 'undefined' ? test.ret : 'http://example.com',
                instance = typeof test.instance !== 'undefined' ? test.instance : '<data></data>',
                instanceId = typeof test.instanceId !== 'undefined' ? test.instanceId : 'someUUID';

            it( test.method.toUpperCase() + ' /instance with ' + authDesc + ' authentication and ' + server + ', ' + id +
                ', ' + ret + ', ' + instance + ', ' + instanceId + ' responds with ' + test.status, function( done ) {
                    request( app )[ test.method ]( '/api/v1/instance' )
                        .set( auth )
                        .send( {
                            server_url: server,
                            form_id: id,
                            instance: instance,
                            instance_id: instanceId,
                            return_url: ret
                        } )
                        .expect( test.status, done );
                } );
        } );
    } );
} );
