// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const nock = require( 'nock' );
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

        it( 'should resolve with Bearer credentials if provided', (done) => {
            const url = 'https://my.openrosa.server';
            const creds = {
                user: 'johndoe',
                pass: 'qwerty',
                bearer: 'AbCdEf123456'
            };
            const scope = nock('https://my.openrosa.server')
                .get('/')
                .reply(200, undefined, {
                    statusCode: 401
                });

            communicator.getAuthHeader( url, creds ).then(( response ) => {
                expect(response).to.equal(`Bearer ${creds.bearer}`);
                // server should not have been called
                expect(scope.isDone()).to.equal(false);
                nock.cleanAll();
                done();
            });
        } );
    } );

    describe( 'getManifest function', () => {
        it( 'should assign manifest to survey object', (done) => {
            const survey = {
                openRosaServer: 'https://testserver.com/bob',
                openRosaId: 'widgets',
                info: {
                    manifestUrl: 'https://my.openrosa.server/manifest1'
                },
                form: '<form>some form</form>',
                model: '<data>some model</data>'
            };
            const manifestXML = `
                <manifest xmlns="http://openrosa.org/xforms/xformsManifest">
                    <mediaFile>
                        <filename>dyn.xml</filename>
                        <hash>md5:3c13dacb1b36c210b996ae307030c684</hash>
                        <downloadUrl>https://example.com/johndoe/formmedia/dyn.xml</downloadUrl>
                    </mediaFile>
                </manifest>
            `;
            nock('https://my.openrosa.server')
                .get('/manifest1')
                .reply(200, manifestXML);

            let updatedSurvey = JSON.parse( JSON.stringify( survey ) );
            updatedSurvey.manifest = [
                {
                    filename: 'dyn.xml',
                    hash: 'md5:3c13dacb1b36c210b996ae307030c684',
                    downloadUrl: 'https://example.com/johndoe/formmedia/dyn.xml'
                }
            ];

            communicator.getManifest( survey ).then((response) => {
                expect(response).to.deep.equal(updatedSurvey);
                done();
            });
        } );

        it( 'should resolve with survey if no manifest url', (done) => {
            const survey = {
                openRosaServer: 'https://testserver.com/bob',
                openRosaId: 'widgets',
                info: {},
                form: '<form>some form</form>',
                model: '<data>some model</data>'
            };

            const scope = nock('https://my.openrosa.server')
                .get('/manifest1')
                .reply(200, 'abc');

            communicator.getManifest( survey ).then((response) => {
                expect(response).to.deep.equal(survey);
                // server should not have been called
                expect(scope.isDone()).to.equal(false);
                nock.cleanAll();
                done();
            });
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
            [ 'ona.io/enketo/', undefined, undefined, 'ona.io/enketo/formList' ],
        ].forEach( test => {
            it( 'should return proper formList url', () => {
                expect( communicator.getFormListUrl( test[ 0 ], test[ 1 ], test[ 2 ] ) ).to.equal( test[ 3 ] );
            } );
        } );
    } );

    describe( 'getSubmissionUrl function', () => {
        [
            [ 'ona.io/enketo', 'ona.io/enketo/submission'],
            [ 'ona.io/enketo/', 'ona.io/enketo/submission'],
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
