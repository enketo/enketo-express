/* global describe, require, it */
'use strict';

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

var Promise = require( 'lie' );
var chai = require( 'chai' );
var expect = chai.expect;
var chaiAsPromised = require( 'chai-as-promised' );
var config = require( '../../app/models/config-model' ).server;
config[ 'account lib' ] = undefined;
var model = require( '../../app/models/account-model' );
var app = require( '../../config/express' );

chai.use( chaiAsPromised );

describe( 'Account Model', function() {

    afterEach( function( done ) {
        // remove the test accounts
        Promise.all( [
                model.remove( {
                    linkedServer: 'https://octest1.com/client1'
                } ),
                model.remove( {
                    linkedServer: 'https://octest1.com/client2'
                } ),
                model.remove( {
                    linkedServer: 'https://octest1.com/client3'
                } ),
                model.remove( {
                    linkedServer: 'https://octest1.com/client4'
                } ),
                model.remove( {
                    linkedServer: 'https://octest1.com/client5'
                } )
            ] )
            .then( done )
            .catch( function() {
                done();
            } );
    } );

    describe( 'Some setup checks', function() {
        it( 'We are in the "test" environment', function() {
            expect( app.get( 'env' ) ).to.equal( 'test' );
        } );
    } );

    describe( 'set: when attempting to store new accounts', function() {

        var account;

        beforeEach( function() {
            account = {
                linkedServer: 'https://octest1.com/client2',
                key: 'abcde'
            };
        } );

        it( 'returns an error if the linked Server is missing', function() {
            delete account.linkedServer;
            return expect( model.set( account ) ).to.eventually.be.rejected;
        } );

        it( 'returns an error if the OpenRosa Form ID is missing', function() {
            delete account.key;
            return expect( model.set( account ) ).to.eventually.be.rejected;
        } );

        it( 'returns an error if the OpenRosa Form ID is an empty string', function() {
            account.key = '';
            return expect( model.set( account ) ).to.eventually.be.rejected;
        } );

        it( 'returns an error if the OpenRosa Server is an empty string', function() {
            account.linkedServer = '';
            return expect( model.set( account ) ).to.eventually.be.rejected;
        } );

        it( 'returns an object with api key if succesful', function() {
            return expect( model.set( account ) ).to.eventually.have.property( 'key' ).and.to.equal( 'abcde' );
        } );

        it( 'drops nearly simultaneous set requests to avoid db corruption', function() {
            return Promise.all( [
                expect( model.set( account ) ).to.eventually.have.property( 'key' ).and.to.equal( 'abcde' ),
                expect( model.set( account ) ).to.eventually.be.rejected,
                expect( model.set( account ) ).to.eventually.be.rejected
            ] );
        } );

    } );

    describe( 'get: when attempting to obtain an account', function() {

        it( 'returns the account object when the account exists in db', function() {
            var account = {
                    key: '2342',
                    linkedServer: 'https://octest1.com/client2'
                },
                getAccountPromise = model.set( account ).then( model.get );
            return Promise.all( [
                expect( getAccountPromise ).to.eventually.have.property( 'key' ).and.to.equal( account.key ),
                expect( getAccountPromise ).to.eventually.have.property( 'linkedServer' ).and.to.equal( account.linkedServer )
            ] );
        } );

    } );

    describe( 'update: when updating an existing account', function() {

        it( 'it returns an error when the parameters are incorrect', function() {
            var account = {
                    key: 'test',
                    linkedServer: 'https://octest1.com/client3'
                },
                promise = model.set( account ).then( function( acc ) {
                    acc.key = '';
                    return model.update( acc );
                } );
            return Promise.all( [
                expect( promise ).to.eventually.be.rejected
            ] );
        } );

        it( 'returns the edited account object when succesful', function() {
            var account = {
                    key: 'test',
                    linkedServer: 'https://octest1.com/client4'
                },
                promise = model.set( account ).then( function() {
                    //change to http
                    account.linkedServer = 'http://octest1.com/client4';
                    return model.update( account );
                } ).then( model.get );
            return Promise.all( [
                expect( promise ).to.eventually.have.property( 'key' ).and.to.equal( 'test' ),
                expect( promise ).to.eventually.have.property( 'linkedServer' ).and.to.equal( 'http://octest1.com/client4' )
            ] );
        } );

        it( 'returns the edited account object when succesful and called via update()', function() {
            var account = {
                    key: 'test',
                    linkedServer: 'https://octest1.com/client5'
                },
                promise = model.set( account ).then( function() {
                    // change key
                    account.key = 'something else';
                    // set again
                    return model.update( account );
                } ).then( model.get );
            return Promise.all( [
                expect( promise ).to.eventually.have.property( 'key' ).and.to.equal( 'something else' ),
                expect( promise ).to.eventually.have.property( 'linkedServer' ).and.to.equal( 'https://octest1.com/client5' )
            ] );
        } );

    } );

    describe( 'delete: when deleting an account', function() {

        it( 'it returns an error when the parameters are incorrect', function() {
            var account = {
                    key: 'test',
                    linkedServer: 'https://octest1/client3'
                },
                promise = model.remove( account );
            return Promise.all( [
                expect( promise ).to.eventually.be.rejected
            ] );
        } );

        it( 'returns the account object when succesful', function() {
            var account = {
                    key: 'test',
                    linkedServer: 'https://octest1.com/client4'
                },
                promise1 = model.set( account ).then( model.remove ),
                promise2 = model.get( account );
            return Promise.all( [
                expect( promise1 ).to.eventually.have.property( 'key' ).and.to.equal( 'test' ),
                expect( promise1 ).to.eventually.have.property( 'linkedServer' ).and.to.equal( 'https://octest1.com/client4' ),
                expect( promise2 ).to.eventually.be.rejected
            ] );
        } );

        it( 'it returns an error if the account does not exist', function() {
            var account = {
                    key: 'test',
                    linkedServer: 'https://octest1.com/nonexisting'
                },
                promise = model.remove( account );
            return Promise.all( [
                expect( promise ).to.eventually.be.rejected
            ] );
        } );

    } );

    describe( 'getList: getting a list of all accounts', function() {

        it( 'it returns the list correctly', function() {
            var account = {
                    key: 'test',
                    linkedServer: 'https://octest1.com/client3'
                },
                hardcodedAccounts = [ config[ 'linked form and data server' ] ],
                promise = model.set( account ).then( model.getList );

            return Promise.all( [
                expect( hardcodedAccounts ).to.have.length( 1 ),
                expect( promise ).to.eventually.have.length( hardcodedAccounts.length + 1 ),
                expect( promise ).to.eventually.satisfy( function( accounts ) {
                    return accounts.every( function( account ) {
                        return account.linkedServer && account.key;
                    } );
                } )
            ] );
        } );

    } );

} );
