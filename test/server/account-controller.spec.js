/* global describe, require, it, beforeEach, afterEach */
"use strict";

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" ),
    request = require( 'supertest' ),
    app = require( '../../config/express' ),
    config = require( "../../app/models/config-model" ).server,
    accountModel = require( '../../app/models/account-model' );

chai.use( chaiAsPromised );

describe( 'Account manager API', function() {
    var validAccountManagerApiKey = config[ 'account manager api key' ],
        invalidAccountManagerApiKey = 'bad',
        validAuth = {
            'Authorization': 'Basic ' + new Buffer( validAccountManagerApiKey + ':' ).toString( 'base64' )
        },
        invalidAuth = {
            'Authorization': 'Basic ' + new Buffer( invalidAccountManagerApiKey + ':' ).toString( 'base64' )
        },
        validServer1 = 'https://octestserver1.com',
        validServer2 = 'https://octestserver2.com',
        invalidServer = 'octestserver1.com',
        validApiKey1 = 'abcde',
        validApiKey2 = '12345',
        invalidApiKey = 'bad';

    beforeEach( function( done ) {
        // add survey if it doesn't exist in the db
        accountModel.set( {
            openRosaServer: validServer1,
            key: validApiKey1,
        } ).then( function() {
            done();
        } );
    } );

    afterEach( function( done ) {
        // remove the test accounts
        Q.all( [
            accountModel.remove( {
                openRosaServer: validServer1
            } ),
            accountModel.remove( {
                openRosaServer: validServer2
            } )
        ] ).then( function() {
            done();
        } ).catch( function() {
            done();
        } );
    } );

    describe( 'Some setup checks', function() {
        it( 'We are in the "test" environment', function() {
            expect( app.get( 'env' ) ).to.equal( 'test' );
        } );
    } );

    describe( '', function() {
        [
            // valid key, existing account
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
                status: 200
            }, {
                method: 'delete',
                auth: true,
                status: 204
            },
            // valid key, non-existing account
            {
                method: 'get',
                server: validServer2,
                auth: true,
                status: 403
            }, {
                method: 'post',
                server: validServer2,
                auth: true,
                status: 201
            }, {
                method: 'put',
                server: validServer2,
                auth: true,
                status: 404
            }, {
                method: 'delete',
                server: validServer2,
                auth: true,
                status: 404
            },
            // valid key, change existing account
            {
                method: 'put',
                server: validServer1,
                key: validServer2,
                auth: true,
                status: 201
            },
            // invalid key
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
            // missing key
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
            // server_url malformed
            {
                method: 'get',
                auth: true,
                status: 400,
                server: invalidServer
            }, {
                method: 'post',
                auth: true,
                status: 400,
                server: invalidServer
            }, {
                method: 'put',
                auth: true,
                status: 400,
                server: invalidServer
            }, {
                method: 'delete',
                auth: true,
                status: 400,
                server: invalidServer
            },
            // server_url not provided or empty
            {
                method: 'get',
                auth: true,
                status: 400,
                server: ''
            }, {
                method: 'get',
                auth: true,
                status: 400,
                server: null
            }, {
                method: 'get',
                auth: true,
                status: 400,
                server: false
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
            },
            // api_key not provided or empty
            {
                method: 'get',
                auth: true,
                status: 200,
                key: ''
            }, {
                method: 'post',
                auth: true,
                status: 400,
                key: ''
            }, {
                method: 'post',
                auth: true,
                server: validServer2,
                status: 400,
                key: null
            }, {
                method: 'post',
                auth: true,
                server: validServer2,
                status: 400,
                key: false
            }, {
                method: 'put',
                auth: true,
                status: 400,
                key: ''
            }, {
                method: 'delete',
                auth: true,
                status: 204,
                key: ''
            }
        ].forEach( function( test ) {
            var authDesc = test.auth === true ? 'valid' : ( test.auth === false ? 'invalid' : 'empty' ),
                auth = test.auth === true ? validAuth : ( test.auth === false ? invalidAuth : {} ),
                account_server = ( typeof test.server !== 'undefined' ) ? test.server : validServer1,
                account_key = ( typeof test.key !== 'undefined' ) ? test.key : validApiKey1;

            it( test.method.toUpperCase() + ' /accounts/api/v1/account with ' + authDesc + ' authentication and ' + account_server +
                ', ' + account_key + ' responds with ' + test.status,
                function( done ) {
                    request( app )[ test.method ]( '/accounts/api/v1/account' )
                        .set( auth )
                        .send( {
                            server_url: account_server,
                            api_key: account_key
                        } )
                        .expect( test.status, done );
                } );
        } );

    } );
} );
