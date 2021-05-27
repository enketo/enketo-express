import connection from '../../public/js/src/module/connection';
import encryptor from '../../public/js/src/module/encryptor';
import settings from '../../public/js/src/module/settings';
import shared from '../../public/js/src/module/records-shared';

/**
 * @typedef Record { import('./store').Record }
 */

/**
 * @typedef SinonSandbox { import('sinon').SinonSandbox }
 */

/**
 * @typedef StubbedRequest
 * @property { string } url
 * @property { window.RequestInit } init
 */

describe( 'Uploading records', () => {
    const enketoId = 'surveyA';
    const instanceId = 'recordA';

    /** @type { SinonSandbox } */
    let sandbox;

    /** @type { Record } */
    let record;

    /** @type { StubbedRequest[] } */
    let requests;

    /** @type { window.Response } */
    let response = {
        status: 500,
        text() {
            return Promise.resolve( '<error>No stub response designated by test</error>' );
        },
    };

    const stubSuccessRespopnse = () => {
        response = {
            status: 201,
            text() {
                return Promise.resolve( `
                    <OpenRosaResponse xmlns="http://openrosa.org/http/response">
                        <message nature="submit_success">Success</message>
                    </OpenRosaResponse>
                ` );
            },
        };
    };

    beforeEach( () => {
        requests = [];

        record = {
            enketoId,
            instanceId,
            name: 'name A',
            xml: '<model><something>a</something></model>',
            files: [
                new Blob( [ 'not a real image' ], {
                    size: 100000,
                    type: 'image/jpeg',
                } ),
            ],
        };

        sandbox = sinon.createSandbox();

        sandbox.stub( settings, 'enketoId' ).get( () => enketoId );

        sandbox.stub( window, 'fetch' ).callsFake( ( url, init ) => {
            requests.push( { url, init } );

            return Promise.resolve( response );
        } );
    } );

    afterEach( () => {
        sandbox.restore();
    } );

    it( 'uploads a record', done => {
        stubSuccessRespopnse();

        connection.uploadRecord( record )
            .then( result => {
                expect( result.status ).to.equal( 201 );
                expect( requests.length ).to.equal( 1 );

                const request = requests[0];
                const body = Object.fromEntries( request.init.body.entries() );
                const instanceId = request.init.headers['X-OpenRosa-Instance-Id'];
                const submission = body.xml_submission_file;

                expect( instanceId ).to.equal( record.instanceId );
                expect( submission instanceof File ).to.equal( true );

                return submission.text();
            } )
            .then( submission => {
                expect( submission ).to.equal( record.xml );
            } )
            .then( done, done );
    } );

    it( 'uploads a last-saved record', done => {
        stubSuccessRespopnse();

        connection.uploadRecord( record, { isLastSavedRecord: true } )
            .then( result => {
                expect( result.status ).to.equal( 201 );
                expect( requests.length ).to.equal( 2 );

                const request = requests[1];
                const body = Object.fromEntries( request.init.body.entries() );
                const instanceId = request.init.headers['X-OpenRosa-Instance-Id'];
                const submission = body.xml_submission_file;

                expect( instanceId ).to.equal( shared.getLastSavedKey() );
                expect( submission instanceof File ).to.equal( true );

                return submission.text();
            } )
            .then( submission => {
                expect( submission ).to.equal( record.xml );
            } )
            .then( done, done );
    } );

    it( 'does not upload a last-saved record if the record encrypted', done => {
        stubSuccessRespopnse();

        const form = { id: 'abc', version: '2', encryptionKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5s9p+VdyX1ikG8nnoXLCC9hKfivAp/e1sHr3O15UQ+a8CjR/QV29+cO8zjS/KKgXZiOWvX+gDs2+5k9Kn4eQm5KhoZVw5Xla2PZtJESAd7dM9O5QrqVJ5Ukrq+kG/uV0nf6X8dxyIluNeCK1jE55J5trQMWT2SjDcj+OVoTdNGJ1H6FL+Horz2UqkIObW5/elItYF8zUZcO1meCtGwaPHxAxlvODe8JdKs3eMiIo9eTT4WbH1X+7nJ21E/FBd8EmnK/91UGOx2AayNxM0RN7pAcj47a434LzeM+XCnBztd+mtt1PSflF2CFE116ikEgLcXCj4aklfoON9TwDIQSp0wIDAQAB' };

        encryptor.encryptRecord( form, record )
            .then( encryptedRecord => {
                return connection.uploadRecord( encryptedRecord, { isLastSavedRecord: true } );
            } )
            .then( result => {
                expect( result.status ).to.equal( 201 );
                expect( requests.length ).to.equal( 1 );

                const request = requests[0];
                const instanceId = request.init.headers['X-OpenRosa-Instance-Id'];

                expect( instanceId ).to.equal( record.instanceId );
            } )
            .then( done, done );
    } );
} );
