/* global describe, require, it, before, after, beforeEach, afterEach */
"use strict";

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var model,
    Q = require( "q" ),
    chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" ),
    app = require( '../../config/express' ),
    model = require( '../../app/models/account-model' ),
    config = require( "../../config/config" );

chai.use( chaiAsPromised );

describe( 'Account Model', function() {

    describe( 'get: when attempting to obtain an account', function() {

        it( 'returns an error when the account does not exist', function() {
            return expect( model.get( 'nonexisting' ) ).to.eventually.be.rejected;
        } );

        // the test below assumes the config.json server url does not have the http:// prefix
        it( 'returns the hardcoded account object', function() {
            var account, getAccountPromise;

            config[ 'linked form and data server' ][ 'server url' ] = 'example.com';

            account = {
                key: config[ 'linked form and data server' ][ 'api key' ],
                openRosaServer: 'http://' + config[ 'linked form and data server' ][ 'server url' ]
            };
            getAccountPromise = model.get( account );

            return Q.all( [
                expect( getAccountPromise ).to.eventually.have.property( 'key' ).and.to.equal( account.key ),
                expect( getAccountPromise ).to.eventually.have.property( 'openRosaServer' ).and.to.equal( account.openRosaServer )
            ] );
        } );
    } );

} );
