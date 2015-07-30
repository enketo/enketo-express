/* global describe, require, it, beforeEach, afterEach */
"use strict";

var utils = require( '../../app/lib/utils' ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" );

chai.use( chaiAsPromised );

describe( 'Utilities', function() {

    describe( 'helper to clean openRosaServer URLs', function() {
        [
            "https://ona.io/enketo",
            " https://ona.io/enketo",
            "https://ona.io/enketo/",
            "http://ona.io/enketo",
            "https://www.ona.io/enketo",
            " https://www.ona.io/enketo",
            "https://www.ona.io/enketo/",
            "http://www.ona.io/enketo",
            "https://ona.io/enketo ",
            " https://ona.io/enketo ",
            "https://ona.io/enketo/ ",
            "http://ona.io/enketo ",
            "https://www.ona.io/enketo ",
            " https://www.ona.io/enketo ",
            "https://www.ona.io/enketo/ ",
            "http://www.ona.io/enketo "
        ].forEach( function( url ) {
            it( 'returns clean url for ' + url, function() {
                expect( utils.cleanUrl( url ) ).to.equal( 'ona.io/enketo' );
            } );
        } );

        [
            "https://enketo.surveycto.com",
            " https://enketo.surveycto.com",
            "https://enketo.surveycto.com/",
            "http://enketo.surveycto.com",
            "https://www.enketo.surveycto.com",
            " https://www.enketo.surveycto.com",
            "https://www.enketo.surveycto.com/",
            "http://www.enketo.surveycto.com",
            "https://enketo.surveycto.com ",
            " https://enketo.surveycto.com ",
            "https://enketo.surveycto.com/ ",
            "http://enketo.surveycto.com ",
            "https://www.enketo.surveycto.com ",
            " https://www.enketo.surveycto.com ",
            "https://www.enketo.surveycto.com ",
            "http://www.enketo.surveycto.com "
        ].forEach( function( url ) {
            it( 'returns clean url for ' + url, function() {
                expect( utils.cleanUrl( url ) ).to.equal( 'enketo.surveycto.com' );
            } );
        } );

        [
            "https://ENKETO.surveycto.com/PaTH",
            " https://ENKETO.surveycto.com/PaTH",
            "https://ENKETO.surveycto.com/PaTH",
            "http://ENKETO.surveycto.com/PaTH/",
            "https://www.ENKETO.surveycto.com/PaTH",
            " https://www.ENKETO.surveycto.com/PaTH",
            "https://www.ENKETO.surveycto.com/PaTH/",
            "http://www.ENKETO.surveycto.com/PaTH",
            "https://ENKETO.surveycto.com/PaTH ",
            " https://ENKETO.surveycto.com/PaTH ",
            "https://ENKETO.surveycto.com/PaTH/ ",
            "http://ENKETO.surveycto.com/PaTH ",
            "https://www.ENKETO.surveycto.com/PaTH ",
            " https://www.ENKETO.surveycto.com/PaTH ",
            "https://www.ENKETO.surveycto.com/PaTH/ ",
            "http://www.ENKETO.surveycto.com/PaTH "
        ].forEach( function( url ) {
            it( 'returns clean url with lowercased domain and path for ' + url, function() {
                expect( utils.cleanUrl( url ) ).to.equal( 'enketo.surveycto.com/path' );
            } );
        } );

        [
            "https://255.255.255.255/AGGREGATE",
            " https://255.255.255.255/AGGREGATE",
            "https://255.255.255.255/AGGREGATE/",
            "http://255.255.255.255/AGGREGATE",
            "https://255.255.255.255/AGGREGATE ",
            " https://255.255.255.255/AGGREGATE ",
            "https://255.255.255.255/AGGREGATE/ ",
            "http://255.255.255.255/AGGREGATE "
        ].forEach( function( url ) {
            it( 'returns clean IP url with lowercased path for ' + url, function() {
                expect( utils.cleanUrl( url ) ).to.equal( '255.255.255.255/aggregate' );
            } );
        } );
    } );


    describe( 'helper to test equality of 1-level deep object properties', function() {
        [
            [ null, undefined, null ],
            [ null, null, true ],
            [ "", "a", null ],
            [ "", "", null ],
            [ {
                    a: 2,
                    b: 3
                }, {
                    b: 3,
                    a: 2
                },
                true
            ],
            [ {
                    a: 2,
                    b: 3
                }, {
                    b: 3,
                    a: 2,
                    c: "a"
                },
                false
            ]
        ].forEach( function( pair ) {
            it( 'returns ' + pair[ 2 ] + ' when comparing ' + JSON.stringify( pair[ 0 ] ) +
                ' with ' + JSON.stringify( pair[ 1 ] ),
                function() {
                    expect( utils.areOwnPropertiesEqual( pair[ 0 ], pair[ 1 ] ) ).to.equal( pair[ 2 ] );
                    expect( utils.areOwnPropertiesEqual( pair[ 1 ], pair[ 0 ] ) ).to.equal( pair[ 2 ] );
                } );
        } );
    } );

    describe( 'helper to test validity of URLs', function() {
        [
            'http://example.org',
            'http://example.org:8000',
            'https://example.org',
            'https://example.org:8080',
            'http://example.org/_-?',
            'http://www.example.org',
            'http://sub.example.org',
            'http://23.21.114.69/xlsform/tmp/tmp20lcND/or_other.xml',
            'http://localhost',
            'https://localhost:8001'
        ].forEach( function( validUrl ) {
            it( 'returns true when checking url: ' + validUrl, function() {
                expect( utils.isValidUrl( validUrl ) ).to.equal( true );
            } );
        } );

        [
            'htt://example.org',
            ' http://example.org',
            'example.org',
            'www.example.org',
            'http://example.o',
            'http://example.o/ d',
        ].forEach( function( invalidUrl ) {
            it( 'returns false when checking url: ' + invalidUrl, function() {
                expect( utils.isValidUrl( invalidUrl ) ).to.equal( false );
            } );
        } );
    } );
} );
