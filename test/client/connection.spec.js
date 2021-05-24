import connection from '../../public/js/src/module/connection';
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
                {
                    size: 100000,
                    type: 'image/jpeg',
                }
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

        connection.uploadRecord( record, true )
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
} );
