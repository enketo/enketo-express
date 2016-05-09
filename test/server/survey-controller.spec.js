/* global describe, require, it */
'use strict';

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var request = require( 'supertest' );
var config = require( '../../app/models/config-model' ).server;
config[ 'base path' ] = '';
var app = require( '../../config/express' );

describe( 'Survey Controller', function() {

    describe( 'meta data: ', function() {
        var endpoints = [ '/_/#abcd', '/x/#abcd', '/::abcd', '/preview', '/preview/::abcd', '/edit/::abcd?instance_id=a' ];

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
