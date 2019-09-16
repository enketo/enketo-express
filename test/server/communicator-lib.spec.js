/* global describe, it */
// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const chai = require( 'chai' );
const expect = chai.expect;
const Auth = require( 'request/lib/auth' ).Auth;
const communicator = require( '../../app/lib/communicator/communicator' );
const config = require( '../../app/models/config-model' ).server;
config[ 'query parameter to pass to submission' ] = 'foo';

describe( 'Communicator Library', () => {

    describe( 'getAuthHeader function', () => {
        it( 'has not broken due to a request library update', () => {
            const auth = new Auth();
            expect( auth ).to.have.property( 'onResponse' );
            expect( auth.onResponse ).to.be.a( 'function' );
        } );
    } );

    describe( 'getXFormInfo function', () => {
        it( 'should throw when getting wrong input', () => {
            const fail = () => {
                communicator.getXFormInfo({});
            };
            expect( fail ).to.throw();
        } );
    } );

    describe( 'getFormListUrl function', () => {
        [
            // server, id, customParam, expected output
            [ 'ona.io/enketo', '123', undefined, 'ona.io/enketo/formList?formID=123' ],
            [ 'ona.io/enketo', '123', 'bar', 'ona.io/enketo/formList?formID=123&foo=bar' ],
            [ 'ona.io/enketo', undefined, 'bar', 'ona.io/enketo/formList?foo=bar' ],
            [ 'ona.io/enketo', undefined, undefined, 'ona.io/enketo/formList' ],
        ].forEach( test => {
            it( 'should return proper formList url', () => {
                expect( communicator.getFormListUrl( test[ 0 ], test[ 1 ], test[ 2 ] ) ).to.equal( test[ 3 ] );
            } );
        } );
    } );

    describe( 'getSubmissionUrl function', () => {
        [
            [ 'ona.io/enketo', 'ona.io/enketo/submission'],
            [ 'enketo.surveycto.com', 'enketo.surveycto.com/submission'],
            [ 'enketo.surveycto.com/path', 'enketo.surveycto.com/path/submission'],
            [ '255.255.255.255/aggregate', '255.255.255.255/aggregate/submission'],
        ].forEach( test => {
            it( 'should return proper submission url', () => {
                expect( communicator.getSubmissionUrl( test[ 0 ] ) ).to.equal( test[ 1 ] );
            } );
        } );
    } );

    describe( 'getUpdatedRequestOptions function', () => {
        it( 'should fill up missing properties', () => {
            expect( communicator.getUpdatedRequestOptions( {} ) ).to.deep.equal( {
                method: 'get',
                headers: {
                    'X-OpenRosa-Version': '1.0',
                    Date: new Date().toUTCString()
                },
                timeout: config.timeout
            } );
        } );

        it( 'should clear empty cookie', () => {
            expect( communicator.getUpdatedRequestOptions( {
                headers: {
                    cookie: ''
                }
            } ) ).to.deep.equal( {
                method: 'get',
                headers: {
                    'X-OpenRosa-Version': '1.0',
                    Date: new Date().toUTCString()
                },
                timeout: config.timeout
            } );
        } );

        it( 'should cleanup auth', () => {
            expect( communicator.getUpdatedRequestOptions( {
                auth: ''
            } ) ).to.deep.equal( {
                method: 'get',
                headers: {
                    'X-OpenRosa-Version': '1.0',
                    Date: new Date().toUTCString()
                },
                timeout: config.timeout
            } );
        } );

        it( 'should set sendImmediately to false if no bearer provided', () => {
            expect( communicator.getUpdatedRequestOptions( {
                auth: {}
            } ) ).to.deep.equal( {
                method: 'get',
                headers: {
                    'X-OpenRosa-Version': '1.0',
                    Date: new Date().toUTCString()
                },
                auth: {
                    sendImmediately: false
                },
                timeout: config.timeout
            } );
        } );
    } );

} );
