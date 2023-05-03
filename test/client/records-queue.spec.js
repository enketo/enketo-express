/**
 * @module records-queue.spec.js
 * @description While some of this is tested in store.spec.js, this suite tests
 * the additional logic performed in records-queue.js functionality around the
 * client store.
 * @see {LastSavedFeatureSpec}
 * @see {StoreSpec}
 */

import connection from '../../public/js/src/module/connection';
import gui from '../../public/js/src/module/gui';
import records from '../../public/js/src/module/records-queue';
import settings from '../../public/js/src/module/settings';
import store from '../../public/js/src/module/store';
import { t } from '../../public/js/src/module/translator';
import { cancelBackoff } from '../../public/js/src/module/exponential-backoff';

/**
 * @typedef {import('./feature/last-saved.spec.js')} LastSavedFeatureSpec
 */

/**
 * @typedef {import('./store.spec.js')} StoreSpec
 */

/**
 * @typedef {import('../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef {import('sinon').SinonSandbox} SinonSandbox
 */

describe('Records queue', () => {
    const enketoIdA = 'surveyA';
    const instanceIdA = 'a';
    const instanceIdB = 'b';
    const enketoIdB = 'surveyB';

    /** @type {string} */
    let autoSavedKey;

    /** @type { string } */
    let enketoId;

    /** @type { SinonSandbox } */
    let sandbox;

    /** @type {sinon.SinonStub} */
    let guiAlertStub;

    /** @type {sinon.SinonStub} */
    let guiFeedbackStub;

    /** @type {sinon.SinonStub} */
    let guiConfirmLoginStub;

    /** @type {sinon.SinonFakeTimers} */
    let timers;

    /** @type { Survey } */
    let surveyA;

    /** @type { Survey } */
    let surveyB;

    /** @type { EnketoRecord } */
    let recordA;

    /** @type { EnketoRecord } */
    let recordB;

    /** @type { File[] } */
    let files;

    beforeEach((done) => {
        enketoId = enketoIdA;

        sandbox = sinon.createSandbox();
        sandbox.stub(console, 'debug').callsFake(() => {});
        sandbox.stub(settings, 'enketoId').get(() => enketoId);

        guiAlertStub = sandbox.stub(gui, 'alert');
        guiFeedbackStub = sandbox.stub(gui, 'feedback');
        guiConfirmLoginStub = sandbox.stub(gui, 'confirmLogin');

        timers = sandbox.useFakeTimers();
        autoSavedKey = records.getAutoSavedKey();

        surveyA = {
            openRosaId: 'formA',
            openRosaServer: 'http://localhost:3000',
            enketoId: enketoIdA,
            theme: '',
            form: `<form class="or"><img src="/path/to/${enketoIdA}.jpg"/></form>`,
            model: '<model><foo/></model>',
            hash: '12345',
        };

        surveyB = {
            openRosaId: 'formB',
            openRosaServer: 'http://localhost:3000',
            enketoId: enketoIdB,
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
            instanceId: instanceIdB,
            name: 'name B',
            xml: '<model><something>b</something></model>',
        };

        files = [
            {
                name: 'something1.xml',
                item: new Blob(['<html>something1</html>'], {
                    type: 'text/xml',
                }),
            },
            {
                name: 'something2.xml',
                item: new Blob(['<html>something2</html>'], {
                    type: 'text/xml',
                }),
            },
        ];

        store
            .init()
            .then(records.init)
            .then(() =>
                store.record.set({
                    draft: true,
                    instanceId: autoSavedKey,
                    enketoId,
                    name: `__autoSave_${Date.now()}`,
                    xml: '<model><autosaved/></model>',
                    files: [],
                })
            )
            .then(() => store.survey.set(surveyA))
            .then(() => store.survey.set(surveyB))
            .then(() => done(), done);
    });

    afterEach((done) => {
        cancelBackoff();
        timers.reset();
        timers.restore();
        sandbox.restore();

        Promise.all([
            store.property.removeAll(),
            store.record.removeAll(),
            store.survey.removeAll(),
        ]).then(() => done(), done);
    });

    describe('storing records', () => {
        it('creates a record', (done) => {
            const originalRecord = { ...recordA };

            records
                .save('set', recordA)
                .then(() => store.record.get(instanceIdA))
                .then((record) => {
                    Object.entries(originalRecord).forEach(([key, value]) => {
                        expect(record[key]).to.deep.equal(value);
                    });
                })
                .then(done, done);
        });

        it('updates an autosave draft record with files', (done) => {
            recordA.files = files.slice();

            records
                .updateAutoSavedRecord(recordA)
                .then(() => records.getAutoSavedRecord())
                .then((record) => {
                    expect(record.draft).to.equal(true);
                    expect(record.xml).to.equal(record.xml);
                    expect(record.files.length).to.equal(files.length);

                    for (const [index, file] of files.entries()) {
                        const updated = record.files[index];

                        expect(updated.name).to.equal(file.name);
                        expect(updated.item).to.to.be.an.instanceof(Blob);
                    }
                })
                .then(done, done);
        });

        it("creates a record with the current autosaved record's files", (done) => {
            const autoSavedUpdate = { ...recordA, files: files.slice() };

            records
                .updateAutoSavedRecord(autoSavedUpdate)
                .then(() => records.save('set', recordA))
                .then(() => store.record.get(instanceIdA))
                .then((record) => {
                    expect(record.files.length).to.equal(files.length);

                    for (const [index, file] of files.entries()) {
                        const updated = record.files[index];

                        expect(updated.name).to.equal(file.name);
                        expect(updated.item).to.to.be.an.instanceof(Blob);
                    }
                })
                .then(done, done);
        });

        it('updates a record', (done) => {
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
                .then(() => records.save('update', payload))
                .then(() => store.record.get(instanceIdA))
                .then((record) => {
                    Object.entries(update).forEach(([key, value]) => {
                        expect(record[key]).to.deep.equal(value);
                    });
                })
                .then(done, done);
        });
    });

    describe('Retrieving records', () => {
        it('gets the record list, excludes the auto-saved records', (done) => {
            const autoSavedKey = records.getAutoSavedKey();

            const expectedRecordData = [{ ...recordA }, { ...recordB }];

            records
                .save('set', recordA)
                .then(() => records.save('set', recordB))
                .then(() => records.getDisplayableRecordList(enketoId))
                .then((records) => {
                    expect(records.length).to.equal(expectedRecordData.length);

                    records.forEach((record) => {
                        expect(record.instanceId).not.to.equal(autoSavedKey);
                    });

                    expectedRecordData.forEach((recordData, index) => {
                        const record = records[index];

                        Object.entries(recordData).forEach(([key, value]) => {
                            expect(record[key]).to.deep.equal(value);
                        });
                    });
                })
                .then(done, done);
        });

        // This is primarily testing that an empty array is returned as the db.js
        // types indicate, rather than needing to keep using falsy checks.
        it('gets an empty record list', (done) => {
            records
                .getDisplayableRecordList(enketoId)
                .then((records) => {
                    expect(Array.isArray(records)).to.equal(true);
                    expect(records.length).to.equal(0);
                })
                .then(done, done);
        });
    });

    describe('Uploading records', () => {
        /** @type {boolean} */
        let isOnline;

        /** @type {EnketoRecord[]} */
        let uploaded;

        /** @type {sinon.SinonStub} */
        let connectionGetOnlineStatusStub;

        /** @type {sinon.SinonStub} */
        let connectionUploadQueuedRecordStub;

        beforeEach(async () => {
            isOnline = true;

            connectionGetOnlineStatusStub = sandbox
                .stub(connection, 'getOnlineStatus')
                .callsFake(() => Promise.resolve(isOnline));

            uploaded = [];

            connectionUploadQueuedRecordStub = sandbox
                .stub(connection, 'uploadQueuedRecord')
                .callsFake((record) => {
                    uploaded.push(record);
                });

            await records.save('set', recordA);
            await records.save('set', recordB);
        });

        // This (currently, implicitly) allows controller-webform.js to
        // determine whether to display a message indicating that the submission
        // is queued, and will be retried
        it('returns false when upload fails due to being offline', async () => {
            isOnline = false;

            const result = await records.uploadQueue({ isUserTriggered: true });

            expect(guiAlertStub).to.have.been.calledWith(
                `${t('record-list.msg2')}`,
                t('alert.recordsavesuccess.finalmsg'),
                'info',
                10
            );
            expect(result).to.equal(false);
        });

        it('uploads queued submissions', async () => {
            await records.uploadQueue();

            const expectedUploadedData = [{ ...recordA }, { ...recordB }];

            expectedUploadedData.forEach((recordData, index) => {
                const record = uploaded[index];

                Object.entries(recordData).forEach(([key, value]) => {
                    expect(record[key]).to.deep.equal(value);
                });
            });

            expect(guiFeedbackStub).to.have.been.calledWith(
                t('alert.queuesubmissionsuccess.msg', {
                    count: 2,
                    recordNames: `${recordA.name}, ${recordB.name}`,
                }),
                7
            );
        });

        it('does not upload auto-saved records', async () => {
            await records.updateAutoSavedRecord({
                enketoId,
                instanceId: 'c',
                name: 'name C',
                xml: '<model><something>c</something></model>',
            });

            await records.uploadQueue();

            uploaded.forEach((record) => {
                expect(record.instanceId).not.to.equal(autoSavedKey);
            });
        });

        it('does not upload draft records', async () => {
            await store.record.set({
                draft: true,
                enketoId,
                instanceId: 'c',
                name: 'name C',
                xml: '<model><something>c</something></model>',
            });

            await records.uploadQueue();

            uploaded.forEach((record) => {
                expect(record.draft).not.to.equal(true);
            });
        });

        it('uploads submissions which were previously queued before initializing the current session', async () => {
            const expectedUploadedData = [{ ...recordA }, { ...recordB }];

            await records.init();

            // Flush the async event loop. We can't use `timers.runAllAsync()`
            // because it will cause an infinite loop waiting for the
            // `setInterval` to complete
            while (uploaded.length < expectedUploadedData.length) {
                // eslint-disable-next-line no-await-in-loop
                await timers.nextAsync();
            }

            expectedUploadedData.forEach((recordData, index) => {
                const record = uploaded[index];

                Object.entries(recordData).forEach(([key, value]) => {
                    expect(record[key]).to.deep.equal(value);
                });
            });

            expect(guiFeedbackStub).to.have.been.calledWith(
                t('alert.queuesubmissionsuccess.msg', {
                    count: 2,
                    recordNames: `${recordA.name}, ${recordB.name}`,
                }),
                7
            );
        });

        describe('Retrying uploads in failure scenarios', () => {
            /** @type {EnketoRecord[]} */
            let queue;

            /** @type {sinon.SinonStub} */
            let storeRecordGetAllStub;

            // Stub certain prerequisite methods so they don't throw off async timers
            beforeEach(() => {
                queue = [recordA];

                storeRecordGetAllStub = sandbox
                    .stub(store.record, 'getAll')
                    .callsFake(async () => queue);
                sandbox
                    .stub(store.record, 'get')
                    .callsFake(async (instanceId) =>
                        queue.find((item) => item.instanceId === instanceId)
                    );
                sandbox.stub(store.record, 'remove').callsFake(async () => {});
                sandbox
                    .stub(store.property, 'addSubmittedInstanceId')
                    .callsFake(async () => {});
            });

            const retryConditions = [
                {
                    reason: 'offline',
                    resolution: 'connectivity is restored',
                    setup: () => {
                        isOnline = false;

                        return connectionGetOnlineStatusStub;
                    },
                    teardown: () => {
                        isOnline = true;
                    },
                },
                {
                    reason: 'uploading fails',
                    resolution: 'retrying upload succeeds',
                    setup: () => {
                        connectionUploadQueuedRecordStub.callsFake(async () => {
                            throw new TypeError('Failed to fetch');
                        });

                        return connectionUploadQueuedRecordStub;
                    },
                    teardown: () => {
                        connectionUploadQueuedRecordStub.callsFake((record) => {
                            uploaded.push(record);
                        });
                    },
                },
                {
                    reason: 'uploading partially fails',
                    resolution: 'retrying upload succeeds',
                    setup: () => {
                        queue = [recordA, recordB];
                        connectionUploadQueuedRecordStub.callsFake(
                            async (record) => {
                                if (record.instanceId === instanceIdA) {
                                    storeRecordGetAllStub.callsFake(
                                        async () => [recordB]
                                    );
                                    uploaded.push(record);
                                } else {
                                    throw new TypeError('Failed to fetch');
                                }
                            }
                        );

                        return connectionUploadQueuedRecordStub;
                    },
                    teardown: () => {
                        connectionUploadQueuedRecordStub.callsFake(
                            async (record) => {
                                uploaded.push(record);
                            }
                        );
                    },
                },
            ];

            const delays = [
                1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000,
                256_000,
                // 5 minute maximum
                300_000, 300_000,
            ];

            retryConditions.forEach(
                ({ reason, resolution, setup, teardown }) => {
                    it(`retries, backing off exponentially up to a five minute maximum, when ${reason}`, async () => {
                        const stub = setup();

                        await records.uploadQueue();

                        for await (const delay of delays) {
                            stub.resetHistory();

                            await timers.tickAsync(delay);

                            expect(stub.callCount).to.equal(1);
                        }
                    });

                    it(`stops retrying when ${resolution}`, async () => {
                        const stub = setup();

                        await records.uploadQueue();

                        stub.resetHistory();

                        const [firstDelay, ...restDelays] = delays;

                        await timers.tickAsync(firstDelay);

                        expect(stub.callCount).to.equal(1);

                        teardown();
                        stub.resetHistory();

                        for await (const delay of restDelays) {
                            await timers.tickAsync(delay);
                        }

                        expect(stub.callCount).to.equal(1);

                        expect(uploaded).to.deep.equal(queue);

                        expect(guiFeedbackStub).to.have.been.calledWith(
                            t('alert.queuesubmissionsuccess.msg', {
                                count: 2,
                                recordNames: `${recordA.name}, ${recordB.name}`,
                            }),
                            7
                        );
                    });
                }
            );

            it('does not retry for authentication failures', async () => {
                connectionUploadQueuedRecordStub.callsFake(() =>
                    Promise.reject(
                        Object.assign(new Error('Unauthorized Access'), {
                            status: 401,
                        })
                    )
                );

                await records.uploadQueue();

                expect(guiConfirmLoginStub).to.have.been.calledWith(
                    t('confirm.login.queuedMsg')
                );

                connectionUploadQueuedRecordStub.resetHistory();

                for await (const delay of delays) {
                    await timers.tickAsync(delay);

                    expect(connectionUploadQueuedRecordStub.callCount).to.equal(
                        0
                    );
                }
            });
        });
    });
});
