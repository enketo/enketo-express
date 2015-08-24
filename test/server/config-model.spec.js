/* global describe, require, it, before, after, beforeEach, afterEach */
"use strict";

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var survey,
    chai = require( "chai" ),
    expect = chai.expect,
    config = require( "../../app/models/config-model" );

describe( 'Config Model', function() {
    var themes = [ 'formhub', 'grid', 'kobo', 'plain' ];

    it( 'should return default list of themes', function() {
        expect( config.getThemesSupported() ).to.deep.equal( themes );
    } );

    it( 'should return only specified themes if given a list of themes', function() {
        var themeList = [ 'formhub' , 'grid' ];
        expect( config.getThemesSupported( themeList ) ).to.deep.equal( themeList );
    } );

    it( 'should return only valid theme list if given a list containing a wrong theme name', function() {
        var themeList = [ 'grid', 'plain', 'doesnotexist' ];
        expect( config.getThemesSupported( themeList ) ).to.deep.equal( [ 'grid', 'plain' ] );
    } );
} );
