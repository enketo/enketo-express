/* global describe, require, it, beforeEach */
'use strict';

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var model = require( '../../app/models/manifest-model' );
var chai = require( 'chai' );
var expect = chai.expect;
var redis = require( 'redis' );
var config = require( '../../app/models/config-model' ).server;
config[ 'base path' ] = '';
var client = redis.createClient( config.redis.cache.port, config.redis.cache.host, {
    auth_pass: config.redis.cache.password
} );

describe( 'Manifest Model', function() {

    beforeEach( function( done ) {
        // select test database and flush it to avoid serving manifest from cache
        client.select( 15, function( err ) {
            if ( err ) {
                return done( err );
            }
            client.flushdb( function( err ) {
                if ( err ) {
                    return done( err );
                }
                done();
            } );
        } );
    } );

    describe( 'creating a manifest', function() {
        var result;
        var dataUri = 'data:image/svg+xml;base64,PD94bW==';
        var localLink = '#LOCAL';
        var html = '<html>' +
            '<head><link href="/css/theme-kobo.css"/></head>' +
            '<body><script src="/js/src/module/gui.js"></script><img src="' + dataUri + '" /><img src="' + localLink + '" /></body>' +
            '</html>';

        beforeEach( function( done ) {
            model.get( html, '<html></html>' )
                .then( function( manifest ) {
                    result = manifest;
                } )
                .then( done, done );
        } );

        it( 'includes the relevant manifest sections', function() {
            expect( result ).to.contain( 'CACHE MANIFEST' );
            expect( result ).to.contain( 'CACHE:' );
            expect( result ).to.contain( 'FALLBACK:\n/x /offline\n/_ /offline' );
            expect( result ).to.contain( 'NETWORK:\n*' );
        } );

        it( 'includes the expected resources', function() {
            expect( result ).to.contain( '/css/theme-kobo.css' );
            expect( result ).to.contain( '/css/theme-formhub.css' );
            expect( result ).to.contain( '/css/theme-grid.css' );
            expect( result ).to.contain( '/fonts/fontawesome-webfont.woff' );
            expect( result ).to.contain( '/fonts/OpenSans-Regular-webfont.woff' );
            expect( result ).to.contain( '/fonts/OpenSans-Bold-webfont.woff' );
            expect( result ).to.contain( '/js/src/module/gui.js' );
        } );

        it( 'excludes dataUri sources', function() {
            expect( result ).not.to.contain( dataUri );
        } );

        it( 'excludes local resources', function() {
            expect( result ).not.to.contain( localLink );
        } );

    } );
} );
