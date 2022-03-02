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
import encryptor from '../../../public/js/src/module/encryptor';
import formCache from '../../../public/js/src/module/form-cache';
import {
    getLastSavedRecord,
    isLastSaveEnabled,
    LAST_SAVED_VIRTUAL_ENDPOINT,
    populateLastSavedInstances,
    removeLastSavedRecord,
    setLastSavedRecord,
} from '../../../public/js/src/module/last-saved';
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

describe('Support for jr://instance/last-saved endpoint', () => {
    const nativeDateNow = Date.now.bind(Date);
    const enketoIdA = 'surveyA';
    const instanceIdA = 'recordA';
    const enketoIdB = 'surveyB';
    const instanceIdB = 'recordB';
    const encryptionKey =
        'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5s9p+VdyX1ikG8nnoXLCC9hKfivAp/e1sHr3O15UQ+a8CjR/QV29+cO8zjS/KKgXZiOWvX+gDs2+5k9Kn4eQm5KhoZVw5Xla2PZtJESAd7dM9O5QrqVJ5Ukrq+kG/uV0nf6X8dxyIluNeCK1jE55J5trQMWT2SjDcj+OVoTdNGJ1H6FL+Horz2UqkIObW5/elItYF8zUZcO1meCtGwaPHxAxlvODe8JdKs3eMiIo9eTT4WbH1X+7nJ21E/FBd8EmnK/91UGOx2AayNxM0RN7pAcj47a434LzeM+XCnBztd+mtt1PSflF2CFE116ikEgLcXCj4aklfoON9TwDIQSp0wIDAQAB';

    /** @type {string} */
    let autoSavedKey;

    /** @type { string } */
    let enketoId;

    /** @type { SinonSandbox } */
    let sandbox;

    /** @type {SinonFakeTimers} */
    let timers;

    /** @type { Survey } */
    let surveyA;

    /** @type { Survey } */
    let surveyB;

    /** @type { EnketoRecord } */
    let recordA;

    /** @type { EnketoRecord } */
    let recordB;

    /** @type {boolean} */
    let skipStoreInitForSuite;

    before(() => {
        skipStoreInitForSuite = false;
    });

    beforeEach((done) => {
        enketoId = enketoIdA;

        sandbox = sinon.createSandbox();

        // Prevent calls to `_updateCache` after tests complete/stubs are restored
        timers = sandbox.useFakeTimers();

        sandbox.stub(settings, 'enketoId').get(() => enketoId);

        autoSavedKey = records.getAutoSavedKey();

        surveyA = {
            openRosaId: 'formA',
            openRosaServer: 'http://localhost:3000',
            enketoId: enketoIdA,
            externalData: [
                {
                    id: 'last-saved',
                    src: 'jr://instance/last-saved',
                },
            ],
            theme: '',
            form: `<form class="or"><img src="/path/to/${enketoIdA}.jpg"/></form>`,
            model: `<model><instance><data id="${enketoIdA}"><foo/></data></instance></model>`,
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
                },
            ],
            theme: '',
            form: `<form class="or"><img src="/path/to/${enketoIdB}.jpg"/></form>`,
            model: `<model><instance><data id="${enketoIdB}"><bar/></data></instance></model>`,
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

        if (skipStoreInitForSuite) {
            sandbox.stub(store, 'available').value(false);

            return done();
        }

        store
            .init()
            .then(records.init)
            .then(() =>
                store.record.set({
                    draft: true,
                    instanceId: autoSavedKey,
                    enketoId,
                    name: `__autoSave_${nativeDateNow()}`,
                    xml: '<model><autosaved/></model>',
                    files: [],
                })
            )
            .then(() => store.survey.set(surveyA))
            .then(() => store.survey.set(surveyB))
            .then(() => done(), done);
    });

    afterEach((done) => {
        timers.clearTimeout();
        timers.clearInterval();
        timers.restore();
        sandbox.restore();

        if (skipStoreInitForSuite) {
            return done();
        }

        Promise.all([
            store.property.removeAll(),
            store.record.removeAll(),
            store.survey.removeAll(),
            store.lastSavedRecords.clear(),
        ]).then(() => done(), done);
    });

    after(() => {
        skipStoreInitForSuite = false;
    });

    describe('surveys', () => {
        /**
         * @param {Partial<GetFormPartsStubResult>} updates
         */
        const updateSurvey = (updates) => {
            // Ensure `_updateCache` receives a new hash indicating it should perform an update
            sandbox
                .stub(connection, 'getFormPartsHash')
                .callsFake(() => Promise.resolve(updates.hash));

            const updatePromise = new Promise((resolve) => {
                setTimeout(resolve, formCache.CACHE_UPDATE_INITIAL_DELAY + 1);
            });

            const originalStoreUpdate = store.survey.update.bind(store.survey);

            sandbox.stub(store.survey, 'update').callsFake((update) =>
                originalStoreUpdate(update).then((result) => {
                    if (update.model === updates.model) {
                        timers.tick(1);
                    }

                    return result;
                })
            );

            timers.tick(formCache.CACHE_UPDATE_INITIAL_DELAY);

            getFormPartsStubResult = { ...getFormPartsStubResult, ...updates };

            // Wait for `_updateCache` to resolve
            return updatePromise.then(() => formCache.get(survey));
        };

        const url1 = '/path/to/source.png';
        const form1 = `<form class="or"><img src="${url1}"/></form>`;
        const defaultInstanceData =
            '<data id="modelA"><item>initial</item><meta><instanceID/></meta></data>';
        const model1 = `<model><instance>${defaultInstanceData}</instance><instance id="last-saved" src="jr://instance/last-saved"/></model>`;
        const hash1 = '12345';

        const parser = new DOMParser();

        /** @type { Survey } */
        let survey;

        /** @type {SurveyExternalData} */
        let lastSavedExternalData;

        /** @type {GetFormPartsStubResult} */
        let getFormPartsStubResult;

        /** @type {EnketoRecord} */
        let record;

        beforeEach((done) => {
            enketoId = 'surveyC';

            record = {
                draft: false,
                enketoId,
                instanceId: 'recordA',
                name: 'name A',
                xml: '<data id="modelA"><item>initial</item><meta><instanceID/></meta></data>',
            };

            survey = {
                openRosaId: 'formC',
                openRosaServer: 'http://localhost:3000',
                enketoId,
                theme: '',
            };

            sandbox.stub(settings, 'enketoId').get(() => enketoId);

            lastSavedExternalData = {
                id: 'last-saved',
                src: 'jr://instance/last-saved',
                xml: parser.parseFromString(defaultInstanceData, 'text/xml'),
            };

            getFormPartsStubResult = {
                externalData: [lastSavedExternalData],
                form: form1,
                model: model1,
                hash: hash1,
            };

            sandbox.stub(connection, 'getFormParts').callsFake((survey) =>
                getLastSavedRecord(survey.enketoId)
                    .then((lastSavedRecord) => {
                        if (lastSavedRecord != null) {
                            return { lastSavedRecord };
                        }

                        return {};
                    })
                    .then((lastSavedData) => {
                        const formParts = {
                            enketoId: survey.enketoId,
                            ...getFormPartsStubResult,
                            ...lastSavedData,
                        };

                        if (encryptor.isEncryptionEnabled(survey)) {
                            return encryptor.setEncryptionEnabled(formParts);
                        }

                        return formParts;
                    })
            );

            store.init().then(done, done);
        });

        afterEach((done) => {
            store.survey.removeAll().then(done, done);
        });

        it("sets the survey's last saved record", (done) => {
            const originalRecord = { ...record };

            formCache
                .init(survey)
                .then((survey) => setLastSavedRecord(survey, record))
                .then(({ lastSavedRecord }) => {
                    Object.entries(originalRecord).forEach(([key, value]) => {
                        expect(lastSavedRecord[key]).to.equal(value);
                    });
                })
                .then(done, done);
        });

        it('preserves the last saved record when a form is updated', (done) => {
            const originalRecord = { ...record };
            const update = {
                ...survey,
                hash: '123456',
                model: `${model1}<!-- updated -->`,
            };

            formCache
                .init(survey)
                .then((survey) => setLastSavedRecord(survey, record))
                .then(() => updateSurvey(update))
                .then(() => getLastSavedRecord(enketoId))
                .then((lastSavedRecord) => {
                    Object.entries(originalRecord).forEach(([key, value]) => {
                        expect(lastSavedRecord[key]).to.equal(value);
                    });
                })
                .then(done, done);
        });

        it('updates last-saved externalData when the last saved record is updated', (done) => {
            const updatedItemValue = 'populated';
            const update = {
                ...record,
                xml: `<data id="surveyA"><item>${updatedItemValue}</item><meta><instanceID>uuid:ea3baa91-74b5-4892-af6f-96267f7fe12e</instanceID></meta></data>`,
            };

            formCache
                .init(survey)
                .then((survey) => setLastSavedRecord(survey, update))
                .then(({ survey }) => {
                    expect(Array.isArray(survey.externalData)).to.equal(true);
                    expect(survey.externalData.length).to.equal(1);

                    const data = survey.externalData[0];

                    expect(data.id).to.equal(lastSavedExternalData.id);
                    expect(data.src).to.equal(lastSavedExternalData.src);

                    /** @type {Element} */
                    const xmlDocument = data.xml.documentElement;

                    const dataItemValue =
                        xmlDocument.querySelector('item').innerHTML;

                    expect(dataItemValue).to.equal(updatedItemValue);
                })
                .then(done, done);
        });

        it("does not set the survey's last saved record when encryption is enabled", (done) => {
            /** @type {Survey} */
            let encryptedSurvey;

            encryptor.setEncryptionEnabled(survey);

            const form = { id: 'abc', version: '2', encryptionKey };

            formCache
                .init(survey)
                .then((survey) => {
                    encryptedSurvey = encryptor.setEncryptionEnabled(survey);
                })
                .then(() => encryptor.encryptRecord(form, record))
                .then((encryptedRecord) =>
                    setLastSavedRecord(encryptedSurvey, encryptedRecord)
                )
                .then(({ lastSavedRecord }) => {
                    expect(lastSavedRecord).to.equal(undefined);
                })
                .then(done, done);
        });

        it("does not set the survey's last saved unencrypted draft record when encryption is enabled", (done) => {
            encryptor.setEncryptionEnabled(survey);

            record.draft = true;

            formCache
                .init(survey)
                .then((survey) => setLastSavedRecord(survey, record))
                .then(({ lastSavedRecord }) => {
                    expect(lastSavedRecord).to.equal(undefined);
                })
                .then(done, done);
        });

        it("does not set the survey's last saved record when the model does not populate a last-saved secondary instance", (done) => {
            getFormPartsStubResult = {
                ...getFormPartsStubResult,
                externalData: [],
            };

            formCache
                .init(survey)
                .then((survey) => setLastSavedRecord(survey, record))
                .then(({ lastSavedRecord }) => {
                    expect(lastSavedRecord).to.equal(undefined);
                })
                .then(done, done);
        });

        it("removes the survey's last saved record when the model no longer populates a last-saved secondary instance", (done) => {
            const update = {
                ...survey,
                hash: '123456',
                model: `${model1}<!-- updated -->`,
                externalData: [],
            };

            formCache
                .init(survey)
                .then((survey) => setLastSavedRecord(survey, record))
                .then(() => updateSurvey(update))
                .then(() => getLastSavedRecord(enketoId))
                .then((lastSavedRecord) => {
                    expect(lastSavedRecord).to.equal(undefined);
                })
                .then(done, done);
        });

        it("gets the survey's last saved record", (done) => {
            const originalRecord = { ...record };

            formCache
                .init(survey)
                .then((survey) => setLastSavedRecord(survey, record))
                .then(({ survey }) => getLastSavedRecord(survey.enketoId))
                .then((lastSavedRecord) => {
                    Object.entries(originalRecord).forEach(([key, value]) => {
                        expect(lastSavedRecord[key]).to.equal(value);
                    });
                })
                .then(done, done);
        });
    });

    describe('storage for offline mode', () => {
        beforeEach((done) => {
            formCache.init(surveyA).then(() => done(), done);
        });

        it('creates a last-saved record when creating a record', (done) => {
            const originalRecord = { ...recordA };

            records
                .save('set', recordA)
                .then(() => getLastSavedRecord(enketoId))
                .then((record) => {
                    Object.entries(originalRecord).forEach(([key, value]) => {
                        expect(record[key]).to.deep.equal(value);
                    });
                })
                .then(done, done);
        });

        it('replaces a last-saved record when creating a newer record', (done) => {
            const originalRecord = { ...recordA };

            records
                .save('set', recordB)
                .then(() => records.save('set', recordA))
                .then(() => getLastSavedRecord(enketoId))
                .then((record) => {
                    Object.entries(originalRecord).forEach(([key, value]) => {
                        expect(record[key]).to.deep.equal(value);
                    });
                })
                .then(done, done);
        });

        it('creates a last-saved record when updating a record', (done) => {
            const originalSurvey = { ...surveyA };

            const update = {
                draft: false,
                enketoId,
                instanceId: instanceIdA,
                name: 'name A updated',
                xml: '<model><updated/></model>',
            };
            const payload = { ...update };

            records
                .save('set', recordA)
                .then(() =>
                    // This would be the condition in cases where a record already
                    // existed before this feature was implemented
                    store.survey.update(originalSurvey)
                )
                .then(() => records.save('update', update))
                .then(() => getLastSavedRecord(enketoId))
                .then((record) => {
                    Object.entries(payload).forEach(([key, value]) => {
                        expect(record[key]).to.deep.equal(value);
                    });
                })
                .then(done, done);
        });

        it('replaces a last-saved record when updating a record', (done) => {
            const update = {
                draft: false,
                enketoId,
                instanceId: instanceIdA,
                name: 'name A updated',
                xml: '<model><updated/></model>',
            };
            const payload = { ...update };

            records
                .save('set', recordA)
                .then(() => records.save('update', update))
                .then(() => getLastSavedRecord(enketoId))
                .then((record) => {
                    Object.entries(payload).forEach(([key, value]) => {
                        expect(record[key]).to.deep.equal(value);
                    });
                })
                .then(done, done);
        });

        it('creates separate last-saved records for different forms', (done) => {
            const originalRecordA = { ...recordA };

            /** @type { EnketoRecord } */
            const recordB = {
                draft: false,
                enketoId: enketoIdB,
                instanceId: instanceIdB,
                name: 'name B',
                xml: `<model><instance><something id="${enketoIdB}">b</something></model>`,
            };

            const originalRecordB = { ...recordB };

            // Create record/last-saved for first form id
            records
                .save('set', recordA)
                // Create autosave record for second form id
                .then(() => {
                    enketoId = enketoIdB;

                    return store.record.set({
                        draft: true,
                        instanceId: records.getAutoSavedKey(),
                        enketoId,
                        name: `__autoSave_${nativeDateNow()}`,
                        xml: `<model><instance><autosaved id="${enketoId}"/></instance></model>`,
                        files: [],
                    });
                })
                // Create record/last-saved for second form id
                .then(() => records.save('set', recordB))
                // Get last-saved record for second form id
                .then(() => getLastSavedRecord(enketoId))
                // Validate last-saved record for second form id
                .then((lastSavedB) => {
                    Object.entries(originalRecordB).forEach(([key, value]) => {
                        expect(lastSavedB[key]).to.deep.equal(value);
                    });
                })
                // Get last-saved record for first form id
                .then(() => {
                    enketoId = enketoIdA;

                    return getLastSavedRecord(enketoId);
                })
                // Validate last-saved record for first form id has not changed
                .then((lastSavedA) => {
                    Object.entries(originalRecordA).forEach(([key, value]) => {
                        expect(lastSavedA[key]).to.deep.equal(value);
                    });
                })
                .then(done, done);
        });
    });

    describe('storage for online mode', () => {
        beforeEach(() => {
            sandbox.stub(settings, 'enketoId').get(() => enketoId);

            sandbox.stub(window, 'fetch').callsFake(() =>
                Promise.resolve({
                    ok: true,
                    status: 201,
                    text() {
                        return Promise.resolve(`
                            <OpenRosaResponse xmlns="http://openrosa.org/http/response">
                                <message nature="submit_success">Success</message>
                            </OpenRosaResponse>
                        `);
                    },
                })
            );
        });

        it('creates a last-saved record when uploading a record', (done) => {
            const originalRecord = { ...recordA };

            connection
                .uploadRecord(surveyA, recordA)
                .then(() => getLastSavedRecord(enketoId))
                .then((record) => {
                    expect(record).to.deep.equal(originalRecord);
                })
                .then(done, done);
        });

        it("does not create the survey's last saved record when editing a record", (done) => {
            const updates = {
                ...recordA,
                xml: `${recordA.model}<-- Updated -->`,
            };

            sandbox.stub(settings, 'type').get(() => 'edit');

            connection
                .uploadRecord(surveyA, updates)
                .then(() => getLastSavedRecord(enketoId))
                .then((lastSavedRecord) => {
                    expect(lastSavedRecord).to.equal(undefined);
                })
                .then(done, done);
        });

        it("does not update the survey's last saved record when editing a record", (done) => {
            const originalXml = recordA.xml;
            const updates = {
                ...recordA,
                xml: `${originalXml}<-- Updated -->`,
            };

            let submissionType = 'other';

            sandbox.stub(settings, 'type').get(() => submissionType);

            setLastSavedRecord(surveyA, recordA)
                .then(() => {
                    submissionType = 'edit';
                })
                .then(() => connection.uploadRecord(surveyA, updates))
                .then(() => {
                    submissionType = 'other';
                })
                .then(() => getLastSavedRecord(enketoId))
                .then((lastSavedRecord) => {
                    expect(lastSavedRecord.xml).to.equal(originalXml);
                })
                .then(done, done);
        });

        it('does not create a last-saved record when uploading a queued record', (done) => {
            connection
                .uploadQueuedRecord(recordA)
                .then(() => getLastSavedRecord(enketoId))
                .then((record) => {
                    expect(record).to.equal(undefined);
                })
                .then(done, done);
        });

        it('does not cache the survey when uploading a record', (done) => {
            const surveySetStub = sandbox.stub(store.survey, 'set');
            const surveyUpdateStub = sandbox.stub(store.survey, 'update');

            store.survey
                .removeAll()
                .then(() => connection.uploadRecord(surveyA, recordA))
                .then(() => {
                    expect(surveySetStub.callCount).to.equal(0);
                    expect(surveyUpdateStub.callCount).to.equal(0);
                })
                .then(done, done);
        });
    });

    describe('populating secondary instances', () => {
        const enketoId = 'surveyA';
        const instanceId = 'recordA';
        const defaultInstanceData =
            '<data id="modelA"><item>initial</item><meta><instanceID/></meta></data>';
        const xmlSerializer = new XMLSerializer();

        /**
         * @typedef FetchFormResponse
         * @property {string} form
         * @property {string} model
         * @property {string} theme
         * @property {string} hash
         * @property {string} languageMap
         */

        /** @type {boolean} */
        let isFormEncrypted;

        /** @type {string} */
        let settingsType;

        beforeEach(() => {
            isFormEncrypted = false;
            settingsType = 'other';

            sandbox.stub(settings, 'type').get(() => settingsType);

            sandbox.stub(settings, 'enketoId').get(() => enketoId);

            sandbox.stub(window, 'fetch').callsFake(() =>
                Promise.resolve({
                    ok: true,
                    status: 201,
                    json() {
                        const submission = isFormEncrypted
                            ? `<submission base64RsaPublicKey="${encryptionKey}"/>`
                            : '';

                        return Promise.resolve({
                            form: '<form autocomplete="off" novalidate="novalidate" class="or clearfix" dir="ltr" id="surveyA"><!--This form was created by transforming an ODK/OpenRosa-flavored (X)Form using an XSL stylesheet created by Enketo LLC.--><section class="form-logo"></section><h3 dir="auto" id="form-title">Form with last-saved instance</h3><label class="question non-select "><span lang="" class="question-label active">Last saved</span><input type="text" name="/data/item" data-type-xml="string" data-setvalue="instance(\'last-saved\')/data/item" data-event="odk-instance-first-load"></label><fieldset id="or-setvalue-items" style="display:none;"></fieldset></form>',
                            model: `<model><instance>${defaultInstanceData}</instance><instance id="last-saved" src="jr://instance/last-saved"/>${submission}</model>`,
                            theme: '',
                            hash: 'md5:1fbbe9738efec026b5a14aa3c3152221--2a8178bb883ae91dfe205c168b54c0cf---1',
                            languageMap: {},
                        });
                    },
                })
            );
        });

        it("populates a last-saved secondary instance from the survey's last-saved record", (done) => {
            const lastSavedRecord = {
                enketoId,
                instanceId,
                name: 'name A',
                xml: '<data id="surveyA"><item>populated</item><meta><instanceID>uuid:ea3baa91-74b5-4892-af6f-96267f7fe12e</instanceID></meta></data>',
                files: [],
            };

            connection
                .getFormParts({ enketoId })
                .then((survey) => setLastSavedRecord(survey, lastSavedRecord))
                .then(() => connection.getFormParts({ enketoId }))
                .then((result) => {
                    expect(Array.isArray(result.externalData)).to.equal(true);
                    expect(result.externalData.length).to.equal(1);

                    const data = result.externalData[0];

                    expect(data.id).to.equal('last-saved');
                    expect(data.src).to.equal('jr://instance/last-saved');

                    const xml = xmlSerializer.serializeToString(
                        data.xml.documentElement,
                        'text/xml'
                    );

                    expect(xml).to.equal(lastSavedRecord.xml);
                })
                .then(done, done);
        });

        it("populates a last-saved secondary instance with the model's defaults when no last-saved record is available", (done) => {
            connection
                .getFormParts({ enketoId })
                .then((result) => {
                    expect(Array.isArray(result.externalData)).to.equal(true);
                    expect(result.externalData.length).to.equal(1);

                    const data = result.externalData[0];

                    expect(data.id).to.equal('last-saved');
                    expect(data.src).to.equal('jr://instance/last-saved');

                    const xml = xmlSerializer.serializeToString(
                        data.xml.documentElement,
                        'text/xml'
                    );

                    expect(xml).to.equal(defaultInstanceData);
                })
                .then(done, done);
        });

        it("populates a last-saved secondary instance with the model's defaults when editing an instance", (done) => {
            settingsType = 'edit';

            const lastSavedRecord = {
                enketoId,
                instanceId,
                name: 'name A',
                xml: '<data id="surveyA"><item>populated</item><meta><instanceID>uuid:ea3baa91-74b5-4892-af6f-96267f7fe12e</instanceID></meta></data>',
                files: [],
            };

            connection
                .getFormParts({ enketoId, instanceId })
                .then((survey) => setLastSavedRecord(survey, lastSavedRecord))
                .then(() => connection.getFormParts({ enketoId, instanceId }))
                .then((result) => {
                    expect(Array.isArray(result.externalData)).to.equal(true);
                    expect(result.externalData.length).to.equal(1);

                    const data = result.externalData[0];

                    expect(data.id).to.equal('last-saved');
                    expect(data.src).to.equal('jr://instance/last-saved');

                    const xml = xmlSerializer.serializeToString(
                        data.xml.documentElement,
                        'text/xml'
                    );

                    expect(xml).to.equal(defaultInstanceData);
                })
                .then(done, done);
        });

        it("populates a last-saved secondary instance with the model's defaults when previewing a form", (done) => {
            settingsType = 'preview';

            connection
                .getFormParts({ enketoId, instanceId })
                .then((result) => {
                    expect(Array.isArray(result.externalData)).to.equal(true);
                    expect(result.externalData.length).to.equal(1);

                    const data = result.externalData[0];

                    expect(data.id).to.equal('last-saved');
                    expect(data.src).to.equal('jr://instance/last-saved');

                    const xml = xmlSerializer.serializeToString(
                        data.xml.documentElement,
                        'text/xml'
                    );

                    expect(xml).to.equal(defaultInstanceData);
                })
                .then(done, done);
        });

        it("updates an existing cached survey's last saved secondary instances when uploading a record", (done) => {
            connection
                .uploadRecord(surveyA, recordA)
                .then(() => formCache.get(surveyA))
                .then((cachedSurvey) => {
                    expect(Array.isArray(cachedSurvey.externalData)).to.equal(
                        true
                    );
                    expect(cachedSurvey.externalData.length).to.equal(1);

                    const data = cachedSurvey.externalData[0];

                    expect(data.id).to.equal('last-saved');
                    expect(data.src).to.equal('jr://instance/last-saved');

                    const xml = xmlSerializer.serializeToString(
                        data.xml.documentElement,
                        'text/xml'
                    );

                    expect(xml).to.equal(recordA.xml);
                })
                .then(done, done);
        });

        it("populates a last-saved secondary instance with the model's defaults when requesting an encrypted form online", async () => {
            const survey = await connection.getFormParts({ enketoId });
            const lastSavedRecord = {
                enketoId,
                instanceId,
                name: 'name A',
                xml: '<data id="surveyA"><item>populated</item><meta><instanceID>uuid:ea3baa91-74b5-4892-af6f-96267f7fe12e</instanceID></meta></data>',
                files: [],
            };

            await setLastSavedRecord(survey, lastSavedRecord);

            isFormEncrypted = true;

            const result = await connection.getFormParts({ enketoId });

            expect(Array.isArray(result.externalData)).to.equal(true);
            expect(result.externalData.length).to.equal(1);

            const data = result.externalData[0];

            expect(data.id).to.equal('last-saved');
            expect(data.src).to.equal('jr://instance/last-saved');

            const xml = xmlSerializer.serializeToString(
                data.xml.documentElement,
                'text/xml'
            );

            expect(xml).not.to.equal(recordA.xml);
            expect(xml).to.equal(defaultInstanceData);
        });

        it("populates a last-saved secondary instance with the model's defaults when encryption is enabled on an offline cached survey with a last-saved instance", async () => {
            const parser = new DOMParser();
            const model = parser.parseFromString(surveyA.model, 'text/xml');
            const defaultInstance =
                model.documentElement.querySelector('instance > *');
            const defaultInstanceData = xmlSerializer.serializeToString(
                defaultInstance,
                'text/xml'
            );

            await setLastSavedRecord(surveyA, recordA);

            const survey = await formCache.init(surveyA);
            const encryptedSurvey = encryptor.setEncryptionEnabled(survey);

            await store.survey.update(encryptedSurvey);
            const result = await formCache.get({ enketoId });

            expect(Array.isArray(result.externalData)).to.equal(true);
            expect(result.externalData.length).to.equal(1);

            const data = result.externalData[0];

            expect(data.id).to.equal('last-saved');
            expect(data.src).to.equal('jr://instance/last-saved');

            const xml = xmlSerializer.serializeToString(
                data.xml.documentElement,
                'text/xml'
            );

            expect(xml).not.to.equal(recordA.xml);
            expect(xml).to.equal(defaultInstanceData);
        });
    });

    describe('IndexedDB initialization failure', () => {
        /**
         * @typedef {import('sinon').SinonStub} Stub
         */

        /** @type {Stub} */
        let getStub;

        /** @type {Stub} */
        let removeStub;

        /** @type {Stub} */
        let updateStub;

        before(() => {
            skipStoreInitForSuite = true;
        });

        beforeEach(() => {
            sandbox.stub(settings, 'type').get(() => 'other');

            getStub = sandbox.stub().resolves();
            removeStub = sandbox.stub().resolves();
            updateStub = sandbox.stub().resolves();

            sandbox.stub(store, 'lastSavedRecords').get(() => ({
                get: getStub,
                remove: removeStub,
                update: updateStub,
            }));
        });

        it('does not enable last-saved', () => {
            const result = isLastSaveEnabled(surveyA);

            expect(result).to.equal(false);
        });

        it('does not get a last saved record', async () => {
            await getLastSavedRecord(enketoId);

            expect(getStub).not.to.have.been.called;
        });

        it('does not attempt to remove a last saved record', async () => {
            await removeLastSavedRecord(enketoId);

            expect(removeStub).not.to.have.been.called;
        });

        it('populates a last saved record with the default model', async () => {
            const defaultValue = 'default value';
            const survey = {
                ...surveyA,
                externalData: [
                    {
                        id: 'last-saved',
                        src: LAST_SAVED_VIRTUAL_ENDPOINT,
                    },
                ],
                model: `<model>
                    <instance>
                        <something>${defaultValue}</something>
                    </instance>
                </model>`,
            };
            const { externalData } = populateLastSavedInstances(
                survey,
                recordA
            );
            const [lastSaved] = externalData;
            const { textContent } = lastSaved.xml.querySelector('something');

            expect(textContent).to.equal(defaultValue);
        });

        it('ignores missing external data', async () => {
            const defaultValue = 'default value';
            const survey = {
                ...surveyA,
                externalData: [
                    {
                        id: 'last-saved',
                        src: LAST_SAVED_VIRTUAL_ENDPOINT,
                    },
                    undefined,
                    null,
                ],
                model: `<model>
                    <instance>
                        <something>${defaultValue}</something>
                    </instance>
                </model>`,
            };
            const { externalData } = populateLastSavedInstances(
                survey,
                recordA
            );
            const [lastSaved] = externalData;
            const { textContent } = lastSaved.xml.querySelector('something');

            expect(textContent).to.equal(defaultValue);
        });

        it('does not attempt to set the last saved record', async () => {
            await setLastSavedRecord(surveyA, recordA);

            expect(updateStub).not.to.have.been.called;
        });

        it('does not attempt to remove the last saved record when setting with no last-saved record', async () => {
            await setLastSavedRecord(surveyA);

            expect(removeStub).not.to.have.been.called;
        });
    });
});
