/**
 * @module connection.spec.js
 * @description Tests for online mode network requests and related business logic.
 * @see {LastSavedFeatureSpec}
 */

import connection from '../../public/js/src/module/connection';
import settings from '../../public/js/src/module/settings';

/**
 * @see {@link https://github.com/enketo/enketo-express/pull/269#issuecomment-861887583}
 * TODO [2021-07-16]: remove this polyfill when CI is able to use a newer version of Chrome
 */
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch';

/**
 * @typedef {import('../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef SinonSandbox { import('sinon').SinonSandbox }
 */

/**
 * @typedef StubbedRequest
 * @property { string } url
 * @property { window.RequestInit } init
 */

describe( 'Connection', () => {
    const enketoId = 'surveyA';
    const instanceId = 'recordA';

    describe( 'Uploading records', () => {

        /** @type { SinonSandbox } */
        let sandbox;

        /** @type { EnketoRecord } */
        let record;

        /** @type { StubbedRequest[] } */
        let requests;

        beforeEach( () => {
            requests = [];

            record = {
                enketoId,
                instanceId,
                name: 'name A',
                xml: '<model><something>a</something></model>',
                files: [],
            };

            sandbox = sinon.createSandbox();
            sandbox.stub( settings, 'enketoId' ).get( () => enketoId );

            sandbox.stub( window, 'fetch' ).callsFake( ( url, init ) => {
                requests.push( { url, init } );

                return Promise.resolve( {
                    ok: true,
                    status: 201,
                    text() {
                        return Promise.resolve( `
                            <OpenRosaResponse xmlns="http://openrosa.org/http/response">
                                <message nature="submit_success">Success</message>
                            </OpenRosaResponse>
                        ` );
                    },
                } );
            } );
        } );

        afterEach( () => {
            sandbox.restore();
        } );

        it( 'uploads a record', done => {
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
    } );
} );
