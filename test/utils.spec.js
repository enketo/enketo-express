/* global describe, require, it, beforeEach, afterEach */
"use strict";

var utils = require( '../lib/utils' ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" );

chai.use( chaiAsPromised );

describe( 'Utilities', function() {

    describe( 'helper to clean openRosaServer URLs', function() {
        var urls1 = [
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
        ];
        urls1.forEach( function( url ) {
            it( 'returns clean url for ' + url, function() {
                expect( utils.cleanUrl( url ) ).to.equal( 'ona.io/enketo' );
            } );
        } );
        var urls2 = [
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
        ];
        urls2.forEach( function( url ) {
            it( 'returns clean url for ' + url, function() {
                expect( utils.cleanUrl( url ) ).to.equal( 'enketo.surveycto.com' );
            } );
        } );
        var urls3 = [
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
        ];
        urls3.forEach( function( url ) {
            it( 'returns clean url with lowercased domain and path for ' + url, function() {
                expect( utils.cleanUrl( url ) ).to.equal( 'enketo.surveycto.com/path' );
            } );
        } );
        var urls4 = [
            "https://255.255.255.255/AGGREGATE",
            " https://255.255.255.255/AGGREGATE",
            "https://255.255.255.255/AGGREGATE/",
            "http://255.255.255.255/AGGREGATE",
            "https://255.255.255.255/AGGREGATE ",
            " https://255.255.255.255/AGGREGATE ",
            "https://255.255.255.255/AGGREGATE/ ",
            "http://255.255.255.255/AGGREGATE "
        ];
        urls4.forEach( function( url ) {
            it( 'returns clean IP url with lowercased path for ' + url, function() {
                expect( utils.cleanUrl( url ) ).to.equal( '255.255.255.255/aggregate' );
            } );
        } );
    } );
} );
