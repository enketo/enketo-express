/* global describe, require, it, beforeEach, afterEach */
'use strict';

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

/* 
 * Some of these tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */
var request = require( 'supertest' );
var config = require( '../../app/models/config-model' ).server;
config[ 'base path' ] = '';
var app = require( '../../config/express' );
var surveyModel = require( '../../app/models/survey-model' );
var instanceModel = require( '../../app/models/instance-model' );
var redis = require( 'redis' );
var client = redis.createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );


describe( 'api', function() {
    var validApiKey = 'abc';
    var validAuth = {
        'Authorization': 'Basic ' + new Buffer( validApiKey + ':' ).toString( 'base64' )
    };
    var invalidApiKey = 'def';
    var invalidAuth = {
        'Authorization': 'Basic ' + new Buffer( invalidApiKey + ':' ).toString( 'base64' )
    };
    var beingEdited = 'beingEdited';
    var validServer = 'https://testserver.com/bob';
    var validFormId = 'something';
    var invalidServer = 'https://someotherserver.com/john';

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
        /// select test database and flush it
        client.select( 15, function( err ) {
            if ( err ) {
                return done( err );
            }
            client.flushdb( function( err ) {
                if ( err ) {
                    return done( err );
                }
                return instanceModel.set( {
                    openRosaServer: validServer,
                    openRosaId: validFormId,
                    instanceId: beingEdited,
                    returnUrl: 'https://enketo.org',
                    instance: '<data></data>'
                } ).then( function() {
                    done();
                } );
            } );
        } );

    } );

    // return error if it fails
    function responseCheck( value, expected ) {
        if ( typeof expected === 'string' || typeof expected === 'number' ) {
            if ( value !== expected ) {
                return new Error( 'Response ' + value + ' not equal to ' + expected );
            }
        } else if ( expected instanceof RegExp && typeof value === 'object' ) {
            if ( !expected.test( JSON.stringify( value ) ) ) {
                return new Error( 'Response ' + JSON.stringify( value ) + ' not matching ' + expected );
            }
        } else if ( expected instanceof RegExp ) {
            if ( !expected.test( value ) ) {
                return new Error( 'Response ' + value + ' not matching ' + expected );
            }
        } else {
            return new Error( 'This is not a valid expected value' );
        }
    }

    function testResponse( test ) {
        var authDesc = test.auth === true ? 'valid' : ( test.auth === false ? 'invalid' : 'empty' );
        var auth = test.auth === true ? validAuth : ( test.auth === false ? invalidAuth : {} );
        var version = test.version;
        var server = ( typeof test.server !== 'undefined' ) ? test.server : validServer;
        var id = typeof test.id !== 'undefined' ? ( test.id !== '{{random}}' ? test.id : Math.floor( Math.random() * 10000 ).toString() ) : validFormId;
        var ret = typeof test.ret !== 'undefined' ? test.ret : 'http://example.com';
        var instance = typeof test.instance !== 'undefined' ? test.instance : '<data></data>';
        var instanceId = typeof test.instanceId !== 'undefined' ? test.instanceId : 'someUUID:' + Math.random();
        var endpoint = test.endpoint;
        var resProp = ( test.res && test.res.property ) ? test.res.property : 'url';
        var offlineEnabled = !!test.offline;
        var dataSendMethod = ( test.method === 'get' ) ? 'query' : 'send';

        it( test.method.toUpperCase() + ' /api/v' + version + endpoint + ' with ' + authDesc + ' authentication and ' + server + ', ' +
            id + ', ' + ret + ', ' + instance + ', ' + instanceId + ', ' + test.theme +
            ', parentWindowOrigin: ' + test.parentWindowOrigin + ', defaults: ' + JSON.stringify( test.defaults ) +
            ' responds with ' + test.status + ' when offline enabled: ' + offlineEnabled,
            function( done ) {
                app.set( 'offline enabled', offlineEnabled );

                request( app )[ test.method ]( '/api/v' + version + endpoint )
                    .set( auth )[ dataSendMethod ]( {
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

    describe( 'v2 fieldsubmission endpoints', function() {
        var version = '2';

        describe( '', function() {
            // GET /survey/single/fieldsubmission
            testResponse( {
                version: version,
                endpoint: '/survey/single/fieldsubmission',
                method: 'get',
                auth: true,
                status: 200,
                res: {
                    property: 'single_fieldsubmission_url',
                    expected: /\/single\/fs\/::[A-z0-9]{4}/
                },
                offline: false
            } );

            // POST /survey/single/fieldsubmission
            testResponse( {
                version: version,
                endpoint: '/survey/single/fieldsubmission',
                method: 'post',
                auth: true,
                status: 200,
                res: {
                    property: 'single_fieldsubmission_url',
                    expected: /\/single\/fs\/::[A-z0-9]{4}/
                },
                offline: false
            } );

            // GET /survey/single/fieldsubmission/iframe
            testResponse( {
                version: version,
                endpoint: '/survey/single/fieldsubmission/iframe',
                method: 'get',
                auth: true,
                status: 200,
                res: {
                    property: 'single_fieldsubmission_iframe_url',
                    expected: /\/single\/fs\/i\/::[A-z0-9]{4}/
                },
                offline: false
            } );

            // POST /survey/single/fieldsubmission/iframe
            testResponse( {
                version: version,
                endpoint: '/survey/single/fieldsubmission/iframe',
                method: 'post',
                auth: true,
                status: 200,
                res: {
                    property: 'single_fieldsubmission_iframe_url',
                    expected: /\/single\/fs\/i\/::[A-z0-9]{4}/
                },
                offline: false
            } );

        } );

        describe( '', function() {
            [
                // valid token
                {
                    method: 'post',
                    auth: true,
                    instanceId: 'AAA',
                    status: 201,
                    res: {
                        property: 'edit_url',
                        // includes proper enketoID and not e.g. ::null 
                        expected: /::YYY/
                    }
                },
                // valid token and not being edited, but formId doesn't exist in db yet (no enketoId)
                {
                    method: 'post',
                    auth: true,
                    id: '{{random}}',
                    status: 201,
                    res: {
                        property: 'edit_url',
                        // includes proper enketoID and not e.g. ::null 
                        expected: /::YYY/
                    }
                },
                // already being edited
                {
                    method: 'post',
                    auth: true,
                    instanceId: beingEdited,
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
                }
            ].map( function( obj ) {
                obj.version = version;
                obj.endpoint = '/instance/fieldsubmission';
                return obj;
            } ).forEach( testResponse );
        } );
    } );
} );
