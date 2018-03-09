/* global describe, require, it, beforeEach */
// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const model = require( '../../app/models/manifest-model' );
const chai = require( 'chai' );
const expect = chai.expect;
const redis = require( 'redis' );
const config = require( '../../app/models/config-model' ).server;
config[ 'base path' ] = '';
const client = redis.createClient( config.redis.cache.port, config.redis.cache.host, {
    auth_pass: config.redis.cache.password
} );

describe( 'Manifest Model', () => {

    beforeEach( done => {
        // select test database and flush it to avoid serving manifest from cache
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

    describe( 'creating a manifest', () => {
        let result;
        const dataUri = 'data:image/svg+xml;base64,PD94bW==';
        const localLink = '#LOCAL';
        const html = `<html><head><link href="/css/theme-kobo.css"/></head><body><script src="/js/src/module/gui.js"></script><img src="${dataUri}" /><img src="${localLink}" /></body></html>`;

        beforeEach( done => {
            model.get( html, '<html></html>' )
                .then( manifest => {
                    result = manifest;
                } )
                .then( done, done );
        } );

        it( 'includes the relevant manifest sections', () => {
            expect( result ).to.contain( 'CACHE MANIFEST' );
            expect( result ).to.contain( 'CACHE:' );
            expect( result ).to.contain( 'FALLBACK:\n/x /offline\n/_ /offline' );
            expect( result ).to.contain( 'NETWORK:\n*' );
        } );

        it( 'includes the expected resources', () => {
            expect( result ).to.contain( '/css/theme-kobo.css' );
            expect( result ).to.contain( '/css/theme-formhub.css' );
            expect( result ).to.contain( '/css/theme-grid.css' );
            expect( result ).to.contain( '/fonts/fontawesome-webfont.woff' );
            expect( result ).to.contain( '/fonts/OpenSans-Regular-webfont.woff' );
            expect( result ).to.contain( '/fonts/OpenSans-Bold-webfont.woff' );
            expect( result ).to.contain( '/js/src/module/gui.js' );
        } );

        it( 'excludes dataUri sources', () => {
            expect( result ).not.to.contain( dataUri );
        } );

        it( 'excludes local resources', () => {
            expect( result ).not.to.contain( localLink );
        } );

    } );
} );
