/*
 * These tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const chai = require('chai');
const request = require('supertest');
const sinon = require('sinon');
const app = require('../../config/express');
const mediaLib = require('../../app/lib/media');
const surveyModel = require('../../app/models/survey-model');
const instanceModel = require('../../app/models/instance-model');

const { expect } = chai;

describe('Submissions', () => {
    /** @type {import('sinon').SinonSandbox} */
    let sandbox;

    // TODO remove this check and test for escaping/media URL replacement instead
    /** @type {import('sinon').SinonStub} */
    let getMediaMapStub;

    /** @type {string} */
    let enketoId;

    const nonExistingEnketoId = 'nope';
    const validServer = 'https://testserver.com/bob';
    const validFormId = 'something';

    beforeEach((done) => {
        sandbox = sinon.createSandbox();

        getMediaMapStub = sandbox.stub(mediaLib, 'getMediaMap');

        // add survey if it doesn't exist in the db
        surveyModel
            .set({
                openRosaServer: validServer,
                openRosaId: validFormId,
            })
            .then((id) => {
                enketoId = id;
                done();
            });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('for active/existing Enketo IDs', () => {
        [
            // invalid methods
            {
                method: 'put',
                data: '<data></data>',
                status: 405,
            },
            {
                method: 'delete',
                data: '<data></data>',
                status: 405,
            },
        ].forEach((test) => {
            it(`using ${test.method.toUpperCase()} of ${
                test.data
            } responds with ${test.status}`, (done) => {
                request(app)
                    [test.method](`/submission/${enketoId}`)
                    .field('xml_submission_file', Buffer.from([test.data]))
                    .expect(test.status, done);
            });
        });
    });

    describe('for inactive or non-existing Enketo IDs', () => {
        beforeEach((done) => {
            // de-activate survey
            surveyModel
                .update({
                    openRosaServer: validServer,
                    openRosaId: validFormId,
                    active: false,
                })
                .then((id) => {
                    enketoId = id;
                    done();
                });
        });

        it('using POST of <data></data> to inactive ID responds with 404', (done) => {
            request(app)
                .post(`/submission/${enketoId}`)
                .field('xml_submission_file', '<data></data>')
                .expect(404, done);
        });

        it('using POST of <data></data> to non-existing ID responds with 404', (done) => {
            request(app)
                .post(`/submission/${nonExistingEnketoId}`)
                .field('xml_submission_file', '<data></data>')
                .expect(404, done);
        });
    });

    describe('submission content types', () => {
        it('responds with 400 if content type is not specified', async () => {
            await request(app)
                .post(`/submission/${enketoId}`)
                .send('foo=bar')
                .expect(400);
        });

        it('responds with 400 if content type is not multipart/form-data', async () => {
            await request(app)
                .post(`/submission/${enketoId}`)
                .set('Content-Type', 'application/json')
                .send({ foo: 'bar' })
                .expect(400);
        });
    });

    describe('using GET (existing submissions) for an existing/active Enketo IDs', () => {
        it('responds with 400 if no instanceID provided', (done) => {
            request(app).get(`/submission/${enketoId}`).expect(400, done);
        });

        it('responds with 400 if instanceID is empty', (done) => {
            request(app)
                .get(`/submission/${enketoId}?instanceId=`)
                .expect(400, done);
        });

        it('responds with 404 if instanceID requested is not found', (done) => {
            request(app)
                .get(`/submission/${enketoId}?instanceId=a`)
                .expect(404, done);
        });

        describe('for a valid and existing instanceID that does not belong to the current form', () => {
            beforeEach((done) => {
                // add survey if it doesn't exist in the db
                instanceModel
                    .set({
                        openRosaServer: validServer,
                        openRosaId: 'differentId',
                        instanceId: 'b',
                        returnUrl: 'example.com',
                        instance: '<data></data>',
                        instanceAttachments: {
                            'test.jpg': 'https://example.com',
                        },
                    })
                    .then(() => {
                        done();
                    });
            });

            it('responds with 400', (done) => {
                request(app)
                    .get(`/submission/${enketoId}?instanceId=b`)
                    .expect(400, done);
            });
        });

        describe('for a valid and existing instanceID that belongs to the current form', () => {
            beforeEach((done) => {
                // add survey if it doesn't exist in the db
                instanceModel
                    .set({
                        openRosaServer: validServer,
                        openRosaId: validFormId,
                        instanceId: 'c',
                        returnUrl: 'example.com',
                        instance: '<data></data>',
                    })
                    .then(() => {
                        done();
                    });

                const mediaOptions = {
                    deviceId: 'fake',
                };

                sandbox
                    .stub(mediaLib, 'getHostURLOptions')
                    .callsFake(() => mediaOptions);
            });

            it('responds with 200', (done) => {
                request(app)
                    .get(`/submission/${enketoId}?instanceId=c`)
                    .expect(200, done);
            });

            it('attaches cached mapping of instance attachments', async () => {
                const cachedAttachments = {
                    'attached-file.jpg': '/media/get/attached-file.jpg',
                };

                getMediaMapStub.returns(cachedAttachments);

                const { body } = await request(app)
                    .get(`/submission/${enketoId}?instanceId=c`)
                    .expect(200);

                expect(body.instanceAttachments).to.deep.equal(
                    cachedAttachments
                );
            });
        });
    });
});
