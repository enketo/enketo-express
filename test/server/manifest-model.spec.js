/* global describe, require, it, before, after, beforeEach, afterEach */
"use strict";

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var model = require( '../../app/models/manifest-model' ),
    Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect;

describe( 'Manifest Model', function() {

    describe( 'creating a manifest', function() {
        var result,
            dataUri = 'data:image/svg+xml;base64,PD94bW==',
            localLink = '#LOCAL',
            html = '<html>' +
            '<head><link href="/css/theme-kobo.css"/></head>' +
            '<body><script src="/js/src/module/gui.js"></script><img src="' + dataUri + '" /><img src="' + localLink + '" /></body>' +
            '</html>';

        beforeEach( function( done ) {
            model.get( html )
                .then( function( manifest ) {
                    result = manifest;

                } )
                .then( done, done );
        } );

        it( 'includes the relevant manifest sections', function() {
            expect( result ).to.contain( 'CACHE MANIFEST' );
            expect( result ).to.contain( 'CACHE:' );
            expect( result ).to.contain( 'FALLBACK:\n/ /offline' );
            expect( result ).to.contain( 'NETWORK:\n*' );
        } );

        it( 'includes the expected resources', function() {
            expect( result ).to.contain( '/css/theme-kobo.css' );
            expect( result ).to.contain( '/css/theme-formhub.css' );
            expect( result ).to.contain( '/css/theme-grid.css' );
            expect( result ).to.contain( '/fonts/fontawesome-webfont.woff' );
            expect( result ).to.contain( '/fonts/fontawesome-webfont.svg' );
            expect( result ).to.contain( '/fonts/OpenSans-Regular-webfont.woff' );
            expect( result ).to.contain( '/fonts/OpenSans-Regular-webfont.ttf' );
            expect( result ).to.contain( '/fonts/OpenSans-Regular-webfont.svg' );
            expect( result ).to.contain( '/fonts/OpenSans-Bold-webfont.woff' );
            expect( result ).to.contain( '/fonts/OpenSans-Bold-webfont.svg' );
            expect( result ).to.contain( '/lib/enketo-core/build/fonts/enketo-icons-v2.woff' );
            expect( result ).to.contain( '/lib/enketo-core/build/fonts/enketo-icons-v2.ttf' );
            expect( result ).to.contain( 'lib/enketo-core/build/fonts/enketo-icons-v2.svg' );
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
