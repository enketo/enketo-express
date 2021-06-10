import connection from '../../public/js/src/module/connection';
import formCache from '../../public/js/src/module/form-cache';
import records from '../../public/js/src/module/records-queue';
import settings from '../../public/js/src/module/settings';
import store from '../../public/js/src/module/store';

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
    const xmlSerializer = new XMLSerializer();

    const baseSurvey = {
        openRosaId: 'formA',
        openRosaServer: 'http://localhost:3000',
        enketoId,
        theme: '',
    };

    const fullSurvey = Object.assign( {}, baseSurvey, {
        form: '<form class="or"><img src="/path/to/source.png"/></form>',
        model: '<model/>',
        hash: '12345',
    } );

    describe( 'Uploading records', () => {

        /** @type { SinonSandbox } */
        let sandbox;

        /** @type {Survey} */
        let survey;

        /** @type { EnketoRecord } */
        let record;

        /** @type { StubbedRequest[] } */
        let requests;

        /** @type { window.Response } */
        let response;

        const stubSuccessRespopnse = () => {
            response = {
                ok: true,
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
            response = {
                status: 500,
                text() {
                    return Promise.resolve( '<error>No stub response designated by test</error>' );
                },
            };

            requests = [];

            survey = Object.assign( {}, baseSurvey );

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

        describe( 'last-saved records', () => {
            beforeEach( done => {
                const autoSavedKey = records.getAutoSavedKey();

                survey = Object.assign( {}, fullSurvey );

                store.init()
                    .then( records.init )
                    .then( () => store.survey.set( survey ) )
                    .then( () => {
                        return store.record.set( {
                            draft: true,
                            instanceId: autoSavedKey,
                            enketoId,
                            name: `__autoSave_${Date.now()}`,
                            xml: '<model><autosaved/></model>',
                            files: [],
                        } );
                    } )
                    .then( () => done(), done );
            } );

            afterEach( done => {
                store.property.removeAll()
                    .then( () => store.record.removeAll() )
                    .then( () => store.survey.removeAll() )
                    .then( done, done );
            } );

            it( 'creates a last-saved record on upload when specified in options', done => {
                const originalRecord = Object.assign( {}, record );

                stubSuccessRespopnse();

                connection.uploadRecord( record, { isLastSaved: true } )
                    .then( () => {
                        return formCache.getLastSavedRecord( enketoId );
                    } )
                    .then( ( record ) => {
                        expect( record ).to.deep.equal( originalRecord );
                    } )
                    .then( done, done );
            } );

            // Note: this allows records-queue to continue to upload when transitioning
            // from offline to online.
            it( 'does not create a last-saved record on upload by default', done => {
                stubSuccessRespopnse();

                connection.uploadRecord( record )
                    .then( () => {
                        return formCache.getLastSavedRecord( enketoId );
                    } )
                    .then( ( record ) => {
                        expect( record ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );
        } );
    } );

    describe( 'Getting form parts', () => {
        const enketoId = 'surveyA';
        const instanceId = 'recordA';
        const defaultInstanceData = '<data id="modelA"><item>initial</item><meta><instanceID/></meta></data>';

        /** @type { SinonSandbox } */
        let sandbox;

        /** @type {Survey} */
        let survey;

        /** @type { window.Response } */
        let response;

        const stubSuccessRespopnse = () => {
            response = {
                ok: true,
                status: 201,
                json() {
                    return Promise.resolve( {
                        form: '<form autocomplete="off" novalidate="novalidate" class="or clearfix" dir="ltr" id="surveyA"><!--This form was created by transforming an ODK/OpenRosa-flavored (X)Form using an XSL stylesheet created by Enketo LLC.--><section class="form-logo"></section><h3 dir="auto" id="form-title">Form with last-saved instance</h3><label class="question non-select "><span lang="" class="question-label active">Last saved</span><input type="text" name="/data/item" data-type-xml="string" data-setvalue="instance(\'last-saved\')/data/item" data-event="odk-instance-first-load"></label><fieldset id="or-setvalue-items" style="display:none;"></fieldset></form>',
                        model: `<model><instance>${defaultInstanceData}</instance><instance id="last-saved" src="jr://instance/last-saved"/></model>`,
                        theme: '',
                        hash: 'md5:1fbbe9738efec026b5a14aa3c3152221--2a8178bb883ae91dfe205c168b54c0cf---1',
                        languageMap: {},
                    } );
                },
            };
        };

        beforeEach( done => {
            survey = Object.assign( {}, fullSurvey );

            sandbox = sinon.createSandbox();
            sandbox.stub( settings, 'enketoId' ).get( () => enketoId );

            sandbox.stub( window, 'fetch' ).callsFake( () => {
                return Promise.resolve( response );
            } );

            store.init()
                .then( records.init )
                .then( store.survey.set( survey ) )
                .then( () => done(), done );
        } );

        afterEach( done => {
            store.property.removeAll()
                .then( () => store.record.removeAll() )
                .then( () => store.survey.removeAll() )
                .then( () => {
                    sandbox.restore();
                } )
                .then( done, done );
        } );

        it( 'includes the currently stored `lastSavedRecord` top-level property', done => {
            stubSuccessRespopnse();

            const lastSavedRecord = {
                enketoId,
                instanceId,
                name: 'name A',
                xml: '<data id="surveyA"><item>populated</item><meta><instanceID>uuid:ea3baa91-74b5-4892-af6f-96267f7fe12e</instanceID></meta></data>',
                files: [],
            };

            formCache.setLastSavedRecord( enketoId, lastSavedRecord )
                .then( () => connection.getFormParts( { enketoId } ) )
                .then( result => {
                    expect( result.lastSavedRecord ).to.deep.equal( lastSavedRecord );
                } )
                .then( done, done );
        } );

        it( 'populates a last-saved secondary instance from the survey\'s last-saved record', done => {
            stubSuccessRespopnse();

            const lastSavedRecord = {
                enketoId,
                instanceId,
                name: 'name A',
                xml: '<data id="surveyA"><item>populated</item><meta><instanceID>uuid:ea3baa91-74b5-4892-af6f-96267f7fe12e</instanceID></meta></data>',
                files: [],
            };

            formCache.setLastSavedRecord( enketoId, lastSavedRecord )
                .then( () => connection.getFormParts( { enketoId } ) )
                .then( result => {
                    expect( Array.isArray( result.externalData ) ).to.equal( true );
                    expect( result.externalData.length ).to.equal( 1 );

                    const data = result.externalData[0];

                    expect( data.id ).to.equal( 'last-saved' );
                    expect( data.src ).to.equal( 'jr://instance/last-saved' );

                    const xml = xmlSerializer.serializeToString( data.xml.documentElement, 'text/xml' );

                    expect( xml ).to.equal( lastSavedRecord.xml );
                } )
                .then( done, done );
        } );

        it( 'populates a last-saved secondary instance with the model\'s defaults when no last-saved record is available', done => {
            stubSuccessRespopnse();

            connection.getFormParts( { enketoId } )
                .then( result => {
                    expect( Array.isArray( result.externalData ) ).to.equal( true );
                    expect( result.externalData.length ).to.equal( 1 );

                    const data = result.externalData[0];

                    expect( data.id ).to.equal( 'last-saved' );
                    expect( data.src ).to.equal( 'jr://instance/last-saved' );

                    const xml = xmlSerializer.serializeToString( data.xml.documentElement, 'text/xml' );

                    expect( xml ).to.equal( defaultInstanceData );
                } )
                .then( done, done );
        } );
    } );
} );
