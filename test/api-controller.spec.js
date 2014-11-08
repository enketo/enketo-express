/* global describe, require, it, beforeEach, afterEach */
"use strict";

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

/* 
 * Some of these tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */

var v1Survey, v1Instance,
    Q = require( "q" ),
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

    function testResponse( test ) {
        var authDesc = test.auth === true ? 'valid' : ( test.auth === false ? 'invalid' : 'empty' ),
            auth = test.auth === true ? validAuth : ( test.auth === false ? invalidAuth : {} ),
            version = test.version,
            server = ( typeof test.server !== 'undefined' ) ? test.server : validServer,
            id = typeof test.id !== 'undefined' ? test.id : validFormId,
            ret = typeof test.ret !== 'undefined' ? test.ret : 'http://example.com',
            instance = typeof test.instance !== 'undefined' ? test.instance : '<data></data>',
            instanceId = typeof test.instanceId !== 'undefined' ? test.instanceId : 'someUUID:' + Math.random(),
            endpoint = test.endpoint,
            resProp = ( test.res && test.res.property ) ? test.res.property : 'url';

        it( test.method.toUpperCase() + ' /api/v' + version + endpoint + ' with ' + authDesc + ' authentication and ' + server + ', ' +
            id + ', ' + ret + ', ' + instance + ', ' + instanceId +
            ' parentWindowOrigin: ' + test.parentWindowOrigin + ', ' + ' defaults: ' + JSON.stringify( test.defaults ) +
            ' responds with ' + test.status,
            function( done ) {
                request( app )[ test.method ]( '/api/v' + version + endpoint )
                    .set( auth )
                    .send( {
                        server_url: server,
                        form_id: id,
                        instance: instance,
                        instance_id: instanceId,
                        return_url: ret,
                        defaults: test.defaults,
                        parent_window_origin: test.parentWindowOrigin
                    } )
                    .expect( test.status )
                    .expect( function( resp ) {
                        if ( test.res && test.res.expected ) {
                            return responseCheck( resp.body[ resProp ], test.res.expected );
                        }
                    } )
                    .end( done );
            } );
    }

    describe( 'v1', function() {
        var version = 1;

        v1Survey = [
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
        ];

        v1Survey.map( function( obj ) {
            obj.version = version;
            obj.endpoint = '/survey';
            return obj;
        } ).forEach( testResponse );

        // TODO: add some tests for other survey/* endpoints

        v1Instance = [
            // valid token
            {
                method: 'post',
                auth: true,
                instanceId: 'AAA',
                status: 201
            },
            // already being edited
            {
                method: 'post',
                auth: true,
                instanceId: 'AAA',
                status: 405
            },
            // test return url in response
            {
                method: 'post',
                auth: true,
                ret: 'http://enke.to',
                status: 201,
                res: {
                    property: 'edit_url',
                    expected: /.+\?.*returnUrl=http%3A%2F%2Fenke.to/
                }
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
        ];

        v1Instance.map( function( obj ) {
            obj.version = version;
            obj.endpoint = '/instance';
            return obj;
        } ).forEach( testResponse );
    } );


    describe( 'v2', function() {
        var version = 2;

        // make sure v2 is backwards-compatible with v1
        v1Survey.map( function( obj ) {
            obj.version = version;
            return obj;
        } ).forEach( testResponse );

        // make sure v2 is backwards-compatible with v1
        v1Instance.map( function( obj ) {
            obj.version = version;
            if ( obj.instanceId === 'AAA' ) {
                obj.instanceId = 'BBB';
            }
            return obj;
        } ).forEach( testResponse );

        [
            // TESTING THE DEFAULTS PARAMETER
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
            }, {
                endpoint: '/survey/all',
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
            },
            // TESTING THE PARENTWINDOWORIGIN PARAMETER
            // parentWindowOrigin parameter is optional
            {
                endpoint: '/survey/iframe',
                parentWindowOrigin: null,
                method: 'post',
                status: 200,
                res: {
                    expected: /[^parentWindowOrigin\[\]]+/
                }
            }, {
                endpoint: '/survey',
                parentWindowOrigin: '',
                method: 'post',
                status: 200,
                res: {
                    expected: /[^parentWindowOrigin\[\]]/
                }
            },
            // same for GET
            {
                endpoint: '/survey/iframe',
                parentWindowOrigin: null,
                method: 'get',
                status: 200,
                res: {
                    expected: /[^parentWindowOrigin\[\]]+/
                }
            }, {
                endpoint: '/survey/iframe',
                parentWindowOrigin: '',
                method: 'get',
                status: 200,
                res: {
                    expected: /[^parentWindowOrigin\[\]]+/
                }
            },
            // responses include the url-encoded parentWindowOrigin query parameter
            {
                endpoint: '/survey/iframe',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    expected: /.+\?.*parentWindowOrigin=http%3A%2F%2Fexample.com%2F/
                }
            }, {
                endpoint: '/survey/preview/iframe',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    property: 'preview_url',
                    expected: /.+\?.*parentWindowOrigin=http%3A%2F%2Fexample.com%2F/
                }
            },
            /*{
                endpoint: '/survey/single/iframe',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    property: 'single_url',
                    expected: /.+\?parentWindowOrigin=http%3A%2F%2Fexample.com%2F/
                }
            },*/
            {
                endpoint: '/survey/all',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    property: 'iframe_url',
                    expected: /.+\?.*parentWindowOrigin=http%3A%2F%2Fexample.com%2F/
                }
            }, {
                endpoint: '/instance/iframe',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 201,
                res: {
                    property: 'edit_url',
                    expected: /.+\?.*parentWindowOrigin=http%3A%2F%2Fexample.com%2F/
                }
            },
            // non-iframe endpoints will ignore the parentWindowOrigin parameter
            {
                endpoint: '/survey',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    expected: /[^parentWindowOrigin\[\]]/
                }
            }, {
                endpoint: '/survey/preview',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    expected: /[^parentWindowOrigin\[\]]/
                }
            }, {
                endpoint: '/instance',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 201,
                res: {
                    property: 'edit_url',
                    expected: /[^parentWindowOrigin\[\]]/
                }
            },
        ].map( function( obj ) {
            obj.auth = true;
            obj.version = version;
            return obj;
        } ).forEach( testResponse );

    } );
} );
