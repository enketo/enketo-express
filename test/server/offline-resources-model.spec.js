// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const model = require( '../../app/models/offline-resources-model' );
const chai = require( 'chai' );
const expect = chai.expect;
const redis = require( 'redis' );
const config = require( '../../app/models/config-model' ).server;
config[ 'base path' ] = '';
const client = redis.createClient( config.redis.cache.port, config.redis.cache.host, {
    auth_pass: config.redis.cache.password
} );

describe( 'Offline Resources Model', () => {

    beforeEach( done => {
        // select test database and flush it to avoid serving offline-resources from cache
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

    describe( 'determining resources', () => {
        let result;
        const dataUri = 'data:image/svg+xml;base64,PD94bW==';
        const localLink = '#LOCAL';
        const html = `<html><head><link href="/x/css/theme-kobo.css"/></head><body><script src="/x/js/src/module/gui.js"></script><img src="${dataUri}" /><img src="${localLink}" /></body></html>`;

        beforeEach( done => {
            model.get( html, '<html></html>' )
                .then( res => {
                    result = res;
                } )
                .then( done, done );
        } );

        it( 'includes the relevant properties', () => {
            expect( result.version.length ).to.equal( 16 ); // this test may need to be tweaked
            expect( result.fallback ).to.equal( '/x/offline/' );
        } );

        it( 'includes the expected resources', () => {
            expect( result.resources ).to.include( '/x/css/theme-kobo.css' );
            expect( result.resources ).to.include( '/x/css/theme-formhub.css' );
            expect( result.resources ).to.include( '/x/css/theme-grid.css' );
            //expect( result.resources ).to.equal( [] );
            expect( result.resources ).to.include( '/x/fonts/fontawesome-webfont.woff?v=4.6.2' );
            expect( result.resources ).to.include( '/x/fonts/OpenSans-Regular-webfont.woff' );
            expect( result.resources ).to.include( '/x/fonts/OpenSans-Bold-webfont.woff' );
            expect( result.resources ).to.include( '/x/js/src/module/gui.js' );
        } );

        it( 'excludes dataUri sources', () => {
            expect( result.resources ).not.to.include( dataUri );
        } );

        it( 'excludes local resources', () => {
            expect( result.resources ).not.to.include( localLink );
        } );

    } );
} );
