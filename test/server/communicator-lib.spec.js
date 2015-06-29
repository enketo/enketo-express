/* global describe, require, it, before, after, beforeEach, afterEach */
"use strict";

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    Auth = require( 'request/lib/auth' ).Auth,
    chaiAsPromised = require( "chai-as-promised" );

chai.use( chaiAsPromised );

describe( 'Communicator Library', function() {

    describe( 'getAuthHeader function', function() {
        it( 'has not broken due to a request library update', function() {
            var auth = new Auth();
            expect( auth ).to.have.property( 'onResponse' );
            expect( auth.onResponse ).to.be.a( 'function' );
        } );
    } );

} );
