/* global describe, require, it */
// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const chai = require( 'chai' );
const expect = chai.expect;
const Auth = require( 'request/lib/auth' ).Auth;

describe( 'Communicator Library', () => {

    describe( 'getAuthHeader function', () => {
        it( 'has not broken due to a request library update', () => {
            const auth = new Auth();
            expect( auth ).to.have.property( 'onResponse' );
            expect( auth.onResponse ).to.be.a( 'function' );
        } );
    } );

} );
