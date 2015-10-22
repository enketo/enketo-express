/* global describe, require, it */
'use strict';

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var chai = require( 'chai' );
var expect = chai.expect;
var Auth = require( 'request/lib/auth' ).Auth;

describe( 'Communicator Library', function() {

    describe( 'getAuthHeader function', function() {
        it( 'has not broken due to a request library update', function() {
            var auth = new Auth();
            expect( auth ).to.have.property( 'onResponse' );
            expect( auth.onResponse ).to.be.a( 'function' );
        } );
    } );

} );
