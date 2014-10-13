/* global describe, require, it, beforeEach, afterEach */
"use strict";

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

/* 
 * Some of these tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */

var Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" ),
    request = require( 'supertest' ),
    app = require( '../config/express' ),
    surveyModel = require( '../app/models/survey-model' );

chai.use( chaiAsPromised );

describe( 'api', function() {
    var validApiKey = 'abc',
        validAuth = {
            'Authorization': 'Basic ' + new Buffer( validApiKey + ':' ).toString( 'base64' )
        },
        invalidApiKey = 'def',
        invalidAuth = {
            'Authorization': 'Basic ' + new Buffer( invalidApiKey + ':' ).toString( 'base64' )
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

    // return string or error if it fails
    function responseCheck( value, expected ) {
        if ( typeof expected === 'string' ) {
            if ( value !== expected ) {
                return 'Response ' + value + ' not equal to ' + expected;
            }
        } else if ( expected instanceof RegExp ) {
            if ( !expected.test( value ) ) {
                return 'Response ' + value + ' not matching ' + expected;
            }
        } else {
            return 'This is not a valid expected value';
        }
    }

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
                ' responds with ' + test.status,
                function( done ) {
                    request( app )[ test.method ]( '/api/v2/survey' )
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
                ', ' + ret + ', ' + instance + ', ' + instanceId + ' responds with ' + test.status,
                function( done ) {
                    request( app )[ test.method ]( '/api/v2/instance' )
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


        // test the defaults functionality
        [
            // defaults are optional
            {
                endpoint: '/survey',
                defaults: null,
                method: 'post',
                status: 200,
                res: {
                    expected: /[^?d\[\]]+/
                }
            }, {
                endpoint: '/survey',
                defaults: '',
                method: 'post',
                status: 200,
                res: {
                    expected: /[^?d\[\]]/
                }
            },
            // same for GET
            {
                endpoint: '/survey',
                defaults: null,
                method: 'get',
                status: 200,
                res: {
                    expected: /[^?d\[\]]+/
                }
            }, {
                endpoint: '/survey',
                defaults: '',
                method: 'get',
                status: 200,
                res: {
                    expected: /[^?d\[\]]+/
                }
            },
            // responses including url-encoded defaults queryparams
            {
                endpoint: '/survey',
                defaults: {
                    '/path/to/node': '2,3',
                    '/path/to/other/node': 5
                },
                method: 'post',
                status: 200,
                res: {
                    expected: /.+\?d\[%2Fpath%2Fto%2Fnode\]=2%2C3&d\[%2Fpath%2Fto%2Fother%2Fnode\]=5/
                }
            }, {
                endpoint: '/survey',
                defaults: {
                    '/path/to/node': '[@]?'
                },
                method: 'post',
                status: 200,
                res: {
                    expected: /.+\?d\[%2Fpath%2Fto%2Fnode\]=%5B%40%5D%3F/
                }
            }, {
                endpoint: '/survey',
                defaults: {
                    '/path/to/node': 'one line\nanother line'
                },
                method: 'post',
                status: 200,
                res: {
                    expected: /.+\?d\[%2Fpath%2Fto%2Fnode\]=one%20line%0Aanother%20line/
                }
            },
            // /instance endpoint will ignore defaults
            {
                endpoint: '/instance',
                defaults: {
                    '/path/to/node': '2,3',
                },
                method: 'post',
                status: 201,
                res: {
                    property: 'edit_url',
                    expected: /[^(d\[)]+/
                }
            }
        ].forEach( function( test ) {
            it( test.method.toUpperCase() + ' ' + test.endpoint + ' default: ' + JSON.stringify( test.defaults ) +
                ' responds with ' + test.status + ' and expected response',
                function( done ) {
                    var resProp = test.res.property || 'url',
                        body = {
                            server_url: validServer,
                            form_id: validFormId,
                            defaults: test.defaults
                        };
                    if ( test.endpoint === '/instance' ) {
                        body.instance = '<data></data>';
                        body.instance_id = 'someUUID';
                        body.return_url = 'http://example.com';
                    }
                    request( app )[ test.method ]( '/api/v2/' + test.endpoint )
                        .set( validAuth )
                        .send( body )
                        .expect( test.status )
                        .expect( function( resp ) {
                            return responseCheck( resp.body[ resProp ], test.res.expected );
                        } )
                        .end( done );
                } );
        } );

    } );
} );
