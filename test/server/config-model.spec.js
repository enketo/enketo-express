/* global describe, require, it, before, after */
// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const chai = require( 'chai' );
const expect = chai.expect;
const fs = require( 'fs' );
const path = require( 'path' );
const unCache = require( './require-uncache-helper' );
const configModulePath = '../../app/models/config-model';
let config = require( configModulePath );

describe( 'Config Model', () => {
    const themes = [ 'formhub', 'grid', 'kobo', 'plain' ];

    it( 'should return default list of themes', () => {
        expect( config.getThemesSupported() ).to.deep.equal( themes );
    } );

    it( 'should return only specified themes if given a list of themes', () => {
        const themeList = [ 'formhub', 'grid' ];
        expect( config.getThemesSupported( themeList ) ).to.deep.equal( themeList );
    } );

    it( 'should return only valid theme list if given a list containing a wrong theme name', () => {
        const themeList = [ 'grid', 'plain', 'doesnotexist' ];
        expect( config.getThemesSupported( themeList ) ).to.deep.equal( [ 'grid', 'plain' ] );
    } );


    describe( 'can be set using flat environment variables instead of config.json', () => {
        const testStringValue = 'test';

        before( () => {
            try {
                fs.renameSync( path.join( __dirname, '../../config/config.json' ), path.join( __dirname, '../../config/config.disabled.json' ) );
            } catch ( e ) {
                console.error(e);
            }
        } );

        after( () => {
            try {
                fs.renameSync( path.join( __dirname, '../../config/config.disabled.json' ), path.join( __dirname, '../../config/config.json' ) );

            } catch ( e ) {
                console.error(e);
            }
        } );

        it( 'for string values in a top level config item', () => {
            config = require( configModulePath );
            process.env.ENKETO_APP_NAME = testStringValue;
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server[ 'app name' ] ).to.equal( testStringValue );
        } );

        it( 'for boolean values in a top level config item', () => {
            config = require( configModulePath );
            expect( config.server[ 'offline enabled' ] ).to.equal( true );
            process.env.ENKETO_OFFLINE_ENABLED = 'false'; // string!
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server[ 'offline enabled' ] ).to.equal( false );
        } );

        it( 'for boolean values in a nested config item', () => {
            config = require( configModulePath );
            expect( config.server[ 'linked form and data server' ][ 'legacy formhub' ] ).to.equal( false );
            process.env.ENKETO_LINKED_FORM_AND_DATA_SERVER_LEGACY_FORMHUB = 'true'; // string!
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server[ 'linked form and data server' ][ 'legacy formhub' ] ).to.equal( true );
        } );

        it( 'for null values', () => {
            config = require( configModulePath );
            expect( config.server.support.email ).to.be.a( 'string' );
            process.env.ENKETO_SUPPORT_EMAIL = 'null'; // string!
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server.support.email ).to.deep.equal( null );
        } );

        it( 'for a config item that has a default value of null', () => {
            config = require( configModulePath );
            expect( config.server.redis.main.password ).to.deep.equal( null );
            process.env.ENKETO_REDIS_MAIN_PASSWORD = testStringValue;
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server.redis.main.password ).to.deep.equal( testStringValue );
        } );

        it( 'for a config item that has a default value of ""', () => {
            config = require( configModulePath );
            expect( config.server.google.analytics.ua ).to.deep.equal( '' );
            process.env.ENKETO_GOOGLE_ANALYTICS_UA = testStringValue;
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server.google.analytics.ua ).to.deep.equal( testStringValue );
        } );

        it( 'for array values that have default value of []', () => {
            process.env.ENKETO_THEMES_SUPPORTED_0 = 'grid';
            process.env.ENKETO_THEMES_SUPPORTED_1 = 'formhub';
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server[ 'themes supported' ] ).to.deep.equal( [ 'formhub', 'grid' ] );
        } );

        it( 'for array values that have a default first item only', () => {
            config = require( configModulePath );
            expect( config.server.maps[ 0 ].name ).to.deep.equal( 'streets' );
            expect( config.server.maps.length ).to.deep.equal( 1 );
            process.env.ENKETO_MAPS_0_NAME = 'a';
            process.env.ENKETO_MAPS_1_NAME = 'b';
            process.env.ENKETO_MAPS_2_NAME = 'c';
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server.maps.length ).to.deep.equal( 3 );
            expect( config.server.maps[ 0 ].name ).to.deep.equal( 'a' );
            expect( config.server.maps[ 1 ].name ).to.deep.equal( 'b' );
            expect( config.server.maps[ 1 ].attribution ).to.deep.equal( '' );
            expect( config.server.maps[ 2 ].name ).to.deep.equal( 'c' );
        } );

        it( 'for nested array values that have a default first item only', () => {
            config = require( configModulePath );
            expect( config.server.maps[ 0 ].tiles.length ).to.equal( 1 );
            process.env.ENKETO_MAPS_0_TILES_0 = 'a';
            process.env.ENKETO_MAPS_0_TILES_1 = 'b';
            process.env.ENKETO_MAPS_1_TILES_0 = 'c';
            process.env.ENKETO_MAPS_2_TILES_0 = 'd';
            process.env.ENKETO_MAPS_2_TILES_1 = 'e';
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server.maps.length ).to.deep.equal( 3 );
            expect( config.server.maps[ 0 ].tiles ).to.deep.equal( [ 'a', 'b' ] );
            expect( config.server.maps[ 1 ].tiles ).to.deep.equal( [ 'c' ] );
            expect( config.server.maps[ 2 ].tiles ).to.deep.equal( [ 'd', 'e' ] );
        } );

        it( 'parses a redis url to its components', () => {
            process.env.ENKETO_REDIS_MAIN_URL = 'redis://h:pwd@ec2-54-221-230-53.compute-1.amazonaws.com:6869';
            unCache( configModulePath );
            config = require( configModulePath );
            expect( config.server.redis.main.host ).to.equal( 'ec2-54-221-230-53.compute-1.amazonaws.com' );
            expect( config.server.redis.main.port ).to.equal( '6869' );
            expect( config.server.redis.main.password ).to.equal( 'pwd' );
        } );

    } );

} );
