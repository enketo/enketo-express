/**
 * @module last-saved.spec.js
 * @description This module tests functionality around the
 * `jr://instance/last-saved` virtual endpoint, including client storage and
 * populating secondary instances.
 * @see {@link https://getodk.github.io/xforms-spec/#virtual-endpoints}
 * @see {@link https://getodk.github.io/xforms-spec/#secondary-instances---external}
 * @see {ConnectionSpec}
 * @see {RecordQueueSpec}
 * @see {SurveyEncryptionFeatureSpec}
 */

import connection from '../../../public/js/src/module/connection';
import formCache from '../../../public/js/src/module/form-cache';
import records from '../../../public/js/src/module/records-queue';
import settings from '../../../public/js/src/module/settings';
import store from '../../../public/js/src/module/store';

/**
 * @typedef {import('../connection.spec.js')} ConnectionSpec
 */

/**
 * @typedef {import('../records-queue.spec.js')} RecordQueueSpec
 */

/**
 * @typedef {import('../store.spec.js')} StoreSpec
 */

/**
 * @typedef {import('./survey-encryption.spec.js')} SurveyEncryptionFeatureSpec
 */

/**
 * @typedef {import('../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef SinonSandbox { import('sinon').SinonSandbox }
 */

describe( 'Support for jr://instance/last-saved endpoint', () => {
    const enketoIdA = 'surveyA';
    const instanceIdA = 'recordA';
    const enketoIdB = 'surveyB';
    const instanceIdB = 'recordB';

    /** @type {string} */
    let autoSavedKey;

    /** @type { string } */
    let enketoId;

    /** @type { SinonSandbox } */
    let sandbox;

    /** @type { Survey } */
    let surveyA;

    /** @type { Survey } */
    let surveyB;

    /** @type { EnketoRecord } */
    let recordA;

    /** @type { EnketoRecord } */
    let recordB;

    beforeEach( done => {
        enketoId = enketoIdA;

        sandbox = sinon.createSandbox();
        sandbox.stub( settings, 'enketoId' ).get( () => enketoId );

        autoSavedKey = records.getAutoSavedKey();

        surveyA = {
            openRosaId: 'formA',
            openRosaServer: 'http://localhost:3000',
            enketoId: enketoIdA,
            externalData: [
                {
                    id: 'last-saved',
                    src: 'jr://instance/last-saved',
                    xml: '<data id="modelA"><foo/></data>',
                },
            ],
            theme: '',
            form: `<form class="or"><img src="/path/to/${enketoIdA}.jpg"/></form>`,
            model: '<model><foo/></model>',
            hash: '12345',
        };

        surveyB = {
            openRosaId: 'formB',
            openRosaServer: 'http://localhost:3000',
            enketoId: enketoIdB,
            externalData: [
                {
                    id: 'last-saved',
                    src: 'jr://instance/last-saved',
                    xml: '<data id="modelB"><foo/></data>',
                },
            ],
            theme: '',
            form: `<form class="or"><img src="/path/to/${enketoIdB}.jpg"/></form>`,
            model: '<model><bar/></model>',
            hash: '67890',
        };

        recordA = {
            draft: false,
            enketoId,
            files: [],
            instanceId: instanceIdA,
            name: 'name A',
            xml: '<model><something>a</something></model>',
        };

        recordB = {
            draft: false,
            enketoId,
            files: [],
            instanceId: 'b',
            name: 'name B',
            xml: '<model><something>b</something></model>',
        };

        store.init()
            .then( records.init )
            .then( () => store.record.set( {
                draft: true,
                instanceId: autoSavedKey,
                enketoId,
                name: `__autoSave_${Date.now()}`,
                xml: '<model><autosaved/></model>',
                files: [],
            } ) )
            .then( () => store.survey.set( surveyA ) )
            .then( () => store.survey.set( surveyB ) )
            .then( () => done(), done );
    } );

    afterEach( done => {
        sandbox.restore();

        Promise.all( [
            store.property.removeAll(),
            store.record.removeAll(),
            store.survey.removeAll(),
        ] ).then( () => done(), done );
    } );

    describe( 'storage for offline mode', () => {
        it( 'creates a last-saved record when creating a record', done => {
            const originalRecord = Object.assign( {}, recordA );

            records.save( 'set', recordA )
                .then( () => {
                    return formCache.getLastSavedRecord( enketoId );
                } )
                .then( record => {
                    Object.entries( originalRecord ).forEach( ( [ key, value ] ) => {
                        expect( record[key] ).to.deep.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'replaces a last-saved record when creating a newer record', done => {
            const originalRecord = Object.assign( {}, recordA );

            records.save( 'set', recordB )
                .then( () => {
                    return records.save( 'set', recordA );
                } )
                .then( () => {
                    return formCache.getLastSavedRecord( enketoId );
                } )
                .then( record => {
                    Object.entries( originalRecord ).forEach( ( [ key, value ] ) => {
                        expect( record[key] ).to.deep.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'creates a last-saved record when updating a record', done => {
            const originalSurvey = Object.assign( {}, surveyA );

            const update = {
                draft: false,
                enketoId,
                instanceId: instanceIdA,
                name: 'name A updated',
                xml: '<model><updated/></model>'
            };
            const payload = Object.assign( {}, update );

            records.save( 'set', recordA )
                .then( () => {
                    // This would be the condition in cases where a record already
                    // existed before this feature was implemented
                    return store.survey.update( originalSurvey );
                } )
                .then( () => {
                    return records.save( 'update', update );
                } )
                .then( () => {
                    return formCache.getLastSavedRecord( enketoId );
                } )
                .then( record => {
                    Object.entries( payload ).forEach( ( [ key, value ] ) => {
                        expect( record[key] ).to.deep.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'replaces a last-saved record when updating a record', done => {
            const update = {
                draft: false,
                enketoId,
                instanceId: instanceIdA,
                name: 'name A updated',
                xml: '<model><updated/></model>'
            };
            const payload = Object.assign( {}, update );

            records.save( 'set', recordA )
                .then( () => {
                    return records.save( 'update', update );
                } )
                .then( () => {
                    return formCache.getLastSavedRecord( enketoId );
                } )
                .then( record => {
                    Object.entries( payload ).forEach( ( [ key, value ] ) => {
                        expect( record[key] ).to.deep.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'creates separate last-saved records for different forms', done => {
            const originalRecordA = Object.assign( {}, recordA );

            /** @type { EnketoRecord } */
            const recordB = {
                draft: false,
                enketoId: enketoIdB,
                instanceId: instanceIdB,
                name: 'name B',
                xml: '<model><something>b</something></model>'
            };

            const originalRecordB = Object.assign( {}, recordB );

            // Create record/last-saved for first form id
            records.save( 'set', recordA )
                // Create autosave record for second form id
                .then( () => {
                    enketoId = enketoIdB;

                    return store.record.set( {
                        draft: true,
                        instanceId: records.getAutoSavedKey(),
                        enketoId,
                        name: `__autoSave_${Date.now()}`,
                        xml: '<model><autosaved/></model>',
                        files: [],
                    } );
                } )
                // Create record/last-saved for second form id
                .then( () => {
                    return records.save( 'set', recordB );
                } )
                // Get last-saved record for second form id
                .then( () => {
                    return formCache.getLastSavedRecord( enketoId );
                } )
                // Validate last-saved record for second form id
                .then( lastSavedB => {
                    Object.entries( originalRecordB ).forEach( ( [ key, value ] ) => {
                        expect( lastSavedB[key] ).to.deep.equal( value );
                    } );
                } )
                // Get last-saved record for first form id
                .then( () => {
                    enketoId = enketoIdA;

                    return formCache.getLastSavedRecord( enketoId );
                } )
                // Validate last-saved record for first form id has not changed
                .then( lastSavedA => {
                    Object.entries( originalRecordA ).forEach( ( [ key, value ] ) => {
                        expect( lastSavedA[key] ).to.deep.equal( value );
                    } );
                } )
                .then( done, done );
        } );
    } );

    describe( 'storage for online mode', () => {
        beforeEach( () => {
            sandbox.stub( settings, 'enketoId' ).get( () => enketoId );

            sandbox.stub( window, 'fetch' ).callsFake( () => {
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

        it( 'creates a last-saved record on upload when specified in options', done => {
            const originalRecord = Object.assign( {}, recordA );

            connection.uploadRecord( recordA, { isLastSaved: true } )
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
            connection.uploadRecord( recordA )
                .then( () => {
                    return formCache.getLastSavedRecord( enketoId );
                } )
                .then( ( record ) => {
                    expect( record ).to.equal( undefined );
                } )
                .then( done, done );
        } );
    } );

    describe( 'populating secondary instances', () => {
        const enketoId = 'surveyA';
        const instanceId = 'recordA';
        const defaultInstanceData = '<data id="modelA"><item>initial</item><meta><instanceID/></meta></data>';
        const xmlSerializer = new XMLSerializer();

        beforeEach( () => {
            sandbox.stub( settings, 'enketoId' ).get( () => enketoId );

            sandbox.stub( window, 'fetch' ).callsFake( () => {
                return Promise.resolve( {
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
                } );
            } );
        } );

        it( 'includes the currently stored `lastSavedRecord` top-level property', done => {
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
