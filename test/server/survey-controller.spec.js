/* global describe, require, it, beforeEach, afterEach */
"use strict";

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var
    Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" ),
    request = require( 'supertest' ),
    app = require( '../../config/express' );

chai.use( chaiAsPromised );

describe( 'Survey Controller', function() {

    describe( 'meta data: ', function() {
        var endpoints = [ '/_/#abcd', '/::abcd', '/preview', '/preview/::abcd', '/edit/::abcd?instance_id=a' ];

        endpoints.forEach( function( endpoint ) {
            it( 'endpoint ' + endpoint + ' adds a __enketo_meta_deviceid cookie when absent', function( done ) {
                app.set( 'offline enabled', true );
                request( app ).get( endpoint )
                    .expect( 200 )
                    .expect( 'set-cookie', /__enketo_meta_deviceid/ )
                    .end( done );
            } );
        } );
    } );
} );
