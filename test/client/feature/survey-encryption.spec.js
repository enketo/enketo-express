/**
 * @module survey-encryption.spec.js
 * @description Tests functionality around encryption-enabled surveys
 * @see {ConnectionSpec}
 * @see {EncryptorSpec}
 * @see {LastSavedFeatureSpec}
 */

import encryptor from '../../../public/js/src/module/encryptor';
import { getLastSavedRecord } from '../../../public/js/src/module/last-saved';
import records from '../../../public/js/src/module/records-queue';
import settings from '../../../public/js/src/module/settings';
import store from '../../../public/js/src/module/store';

/**
 * @typedef {import('../connection.spec.js')} ConnectionSpec
 */

/**
 * @typedef {import('../encryptor.spec.js')} EncryptorSpec
 */

/**
 * @typedef {import('./last-saved.spec.js')} LastSavedFeatureSpec
 */

/**
 * @typedef {import('../../../app/models/survey-model').SurveyObject} Survey
 */

describe('Encryption-enabled surveys', () => {
    const enketoId = 'surveyA';

    /** @type { SinonSandbox } */
    let sandbox;

    /** @type {Survey} */
    let survey;

    beforeEach((done) => {
        sandbox = sinon.createSandbox();
        sandbox.stub(settings, 'enketoId').get(() => enketoId);

        survey = {
            openRosaId: 'formA',
            openRosaServer: 'http://localhost:3000',
            enketoId,
            theme: '',
            form: `<form class="or"><img src="/path/to/${enketoId}.jpg"/></form>`,
            model: '<model><foo/></model>',
            hash: '12345',
        };

        store.init().then(() => done(), done);
    });

    afterEach((done) => {
        sandbox.restore();

        Promise.all([store.record.removeAll(), store.survey.removeAll()]).then(
            () => done(),
            done
        );
    });

    describe('runtime state', () => {
        it('is not enabled by default', () => {
            expect(encryptor.isEncryptionEnabled(survey)).to.equal(false);
        });

        it('is enabled when set', () => {
            const result = encryptor.setEncryptionEnabled(survey);

            expect(encryptor.isEncryptionEnabled(result)).to.equal(true);
        });
    });

    describe('client storage', () => {
        it('creates an encryption-enabled survey', (done) => {
            const encryptedSurvey = encryptor.setEncryptionEnabled(survey);

            store.survey
                .set(encryptedSurvey)
                .then((result) => {
                    expect(encryptor.isEncryptionEnabled(result)).to.equal(
                        true
                    );
                })
                .then(done, done);
        });

        it('gets an encryption-enabled survey', (done) => {
            const encryptedSurvey = encryptor.setEncryptionEnabled(survey);

            store.survey
                .set(encryptedSurvey)
                .then(() => store.survey.get(survey.enketoId))
                .then((result) => {
                    expect(encryptor.isEncryptionEnabled(result)).to.equal(
                        true
                    );
                })
                .then(done, done);
        });

        it('updates an encryption-enabled survey', (done) => {
            const encryptedSurvey = encryptor.setEncryptionEnabled(survey);
            const model = '<model><updated/></model>';
            const update = Object.assign(encryptedSurvey, {
                model,
            });

            store.survey
                .set(encryptedSurvey)
                .then(() => store.survey.update(update))
                .then((result) => {
                    expect(encryptor.isEncryptionEnabled(result)).to.equal(
                        true
                    );
                    expect(result.model).to.equal(model);
                })
                .then(done, done);
        });

        it('does not create a last-saved record when creating a record for an encrypted survey', (done) => {
            const form = {
                id: 'abc',
                version: '2',
                encryptionKey:
                    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5s9p+VdyX1ikG8nnoXLCC9hKfivAp/e1sHr3O15UQ+a8CjR/QV29+cO8zjS/KKgXZiOWvX+gDs2+5k9Kn4eQm5KhoZVw5Xla2PZtJESAd7dM9O5QrqVJ5Ukrq+kG/uV0nf6X8dxyIluNeCK1jE55J5trQMWT2SjDcj+OVoTdNGJ1H6FL+Horz2UqkIObW5/elItYF8zUZcO1meCtGwaPHxAxlvODe8JdKs3eMiIo9eTT4WbH1X+7nJ21E/FBd8EmnK/91UGOx2AayNxM0RN7pAcj47a434LzeM+XCnBztd+mtt1PSflF2CFE116ikEgLcXCj4aklfoON9TwDIQSp0wIDAQAB',
            };

            const survey = encryptor.setEncryptionEnabled({
                openRosaId: 'formC',
                openRosaServer: 'http://localhost:3000',
                enketoId,
                theme: '',
                form: `<form class="or"><img src="/path/to/${enketoId}.jpg"/></form>`,
                model: '<model><foo/></model>',
                hash: '12345',
            });
            const recordA = {
                draft: false,
                enketoId,
                files: [],
                instanceId: 'a',
                name: 'name A',
                xml: '<model><something>a</something></model>',
            };
            const recordB = {
                draft: true,
                enketoId,
                files: [],
                instanceId: 'b',
                name: 'name B',
                xml: '<model><something>b</something></model>',
            };

            records
                .init()
                .then(() => store.survey.set(survey))
                .then(() => encryptor.encryptRecord(form, recordA))
                .then((encryptedRecordA) =>
                    records.save('set', encryptedRecordA)
                )
                .then(() => getLastSavedRecord(enketoId))
                .then(() => encryptor.encryptRecord(form, recordB))
                .then((encryptedRecordB) =>
                    records.save('set', encryptedRecordB)
                )
                .then(() => getLastSavedRecord(enketoId))
                .then((record) => {
                    expect(record).to.equal(undefined);
                })
                .then(done, done);
        });
    });
});
