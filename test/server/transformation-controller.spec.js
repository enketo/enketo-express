const { expect } = require('chai');
const request = require('supertest');
const sinon = require('sinon');
const communicator = require('../../app/lib/communicator');
const mediaLib = require('../../app/lib/media');
const accountModel = require('../../app/models/account-model');
const config = require('../../app/models/config-model').server;
const surveyModel = require('../../app/models/survey-model');
const userModel = require('../../app/models/user-model');

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

describe('Transformation Controller', () => {
    const bearer = 'fozzie';
    const enketoId = 'surveyZ';
    const openRosaServer = 'http://example.com';
    const openRosaId = 'formZ';
    const manifestPath = '/manifest';
    const manifestUrl = `${openRosaServer}${manifestPath}`;

    /** @type {import('sinon').SinonSandbox} */
    let sandbox;

    /** @type {import('express').Application} */
    let app;

    /** @type {string} */
    let basePath;

    /** @type {import('http').Server} */
    let server;

    /** @type {import('../../app/models/account-model').AccountObj */
    let account;

    /** @type {Survey} */
    let survey;

    /** @type {string} */
    let hash;

    /** @type {sinon.SinonStub} */
    let authenticateStub;

    /** @type {import('sinon').SinonStub} */
    let getManifestStub;

    /** @type {import('sinon').SinonStub} */
    let getMediaMapStub;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();

        // Stub `_getSurveyParams`
        survey = {
            openRosaServer,
            openRosaId,
        };

        hash = 'md5:b4dd34d';

        sandbox
            .stub(surveyModel, 'get')
            .callsFake(() => Promise.resolve({ ...survey, enketoId }));

        account = {};

        sandbox.stub(accountModel, 'check').callsFake((survey) =>
            Promise.resolve({
                ...survey,
                account,
            })
        );

        // No-op `_checkQuota`
        sandbox.stub(config, 'account lib').get(() => null);

        sandbox.stub(userModel, 'getCredentials').callsFake(() => ({ bearer }));

        app = require('../../config/express');
        basePath = app.get('base path');

        // console.log('app?', app);

        await new Promise((resolve) => {
            server = app.listen(resolve);
        });

        authenticateStub = sandbox
            .stub(communicator, 'authenticate')
            .callsFake((survey) => Promise.resolve(survey));

        sandbox.stub(communicator, 'getXForm').callsFake((survey) =>
            Promise.resolve({
                ...survey,
                xform,
            })
        );
    });

    afterEach(async () => {
        sandbox.restore();

        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    /** @type {string} */
    let transformRequestURL;

    /** @type {object | undefined} */
    let transformRequestBody;

    /** @type {string} */
    let xform;

    /**
     * @typedef {import('../../app/lib/url').ManifestItem} ManifestItem
     */

    /** @type {ManifestItem[]} */
    let manifest;

    /**
     * @return {import('enketo-transformer/src/transformer').TransformedSurvey}
     */
    const getTransformResult = async (expectedStatus = 200) => {
        const { body } = await request(app)
            .post(`${basePath}${transformRequestURL}`)
            .send(transformRequestBody)
            .expect(expectedStatus);

        return body;
    };

    describe('authorization', () => {
        it('responds with 404 for unauthorized requests for cacheable forms', async () => {
            transformRequestURL = `/transform/xform/${enketoId}`;
            transformRequestBody = undefined;

            const error = new Error('Unauthorized');

            error.status = 403;

            authenticateStub.rejects(error);

            const message = app.i18next.t('error.notfoundinformlist', {
                formId: openRosaId,
            });
            const actual = await getTransformResult(404);

            expect(actual).to.deep.equal({
                code: 404,
                message,
            });
        });

        // Direct requests are now performed client side. This failure is now
        // the same as any other incomplete transformation API request.
        it('responds with 400 for no longer supported direct requests for forms', async () => {
            transformRequestURL = `/transform/xform`;
            transformRequestBody = {
                xformUrl: 'http://example.com/qwerty.xml',
            };

            const actual = await getTransformResult(400);

            expect(actual).to.deep.equal({
                code: 400,
                message: 'Bad Request. Survey information not complete.',
            });
        });
    });

    describe('media attachments', () => {
        beforeEach(async () => {
            sandbox.stub(communicator, 'getXFormInfo').callsFake((survey) =>
                Promise.resolve({
                    ...survey,
                    info: {
                        hash,
                        manifestUrl,
                    },
                })
            );

            const mediaOptions = {
                deviceId: 'fake',
            };

            sandbox
                .stub(mediaLib, 'getHostURLOptions')
                .callsFake(() => mediaOptions);

            getMediaMapStub = sandbox.stub(mediaLib, 'getMediaMap');

            // Stub getXForm
            xform = `
                <?xml version="1.0"?>
                <h:html xmlns="http://www.w3.org/2002/xforms"
                    xmlns:ev="http://www.w3.org/2001/xml-events"
                    xmlns:h="http://www.w3.org/1999/xhtml"
                    xmlns:jr="http://openrosa.org/javarosa"
                    xmlns:odk="http://www.opendatakit.org/xforms"
                    xmlns:orx="http://openrosa.org/xforms"
                    xmlns:xsd="http://www.w3.org/2001/XMLSchema">
                    <h:head>
                        <h:title>jr-url-space</h:title>
                        <model>
                            <itext>
                                <translation default="true()" lang="English">
                                    <text id="/outside/l1:label">
                                        <value form="image">jr://images/first image.jpg</value>
                                    </text>
                                    <text id="/outside/l2:label">
                                        <value form="audio">jr://audio/a song.mp3</value>
                                    </text>
                                    <text id="/outside/l3:label">
                                        <value form="video">jr://video/some video.mp4</value>
                                    </text>
                                </translation>
                            </itext>
                            <instance>
                                <outside>
                                    <a/>
                                    <b/>
                                    <c>jr://images/another image.png</c>
                                    <d/>
                                    <l1/>
                                    <l2/>
                                    <l2/>
                                    <meta>
                                        <instanceID/>
                                    </meta>
                                </outside>
                            </instance>
                            <instance id="file" src="jr://file/an instance.xml" />
                            <instance id="file-csv" src="jr://file-csv/a spreadsheet.csv" />
                            <bind nodeset="/outside/a" type="string"/>
                            <bind nodeset="/outside/b" type="string"/>
                            <bind nodeset="/outside/c" type="binary"/>
                            <bind nodeset="/outside/d" type="string"/>
                        </model>
                    </h:head>
                    <h:body>
                        <input ref="/a">
                            <label ref="jr:itext('/outside/l1:label')"/>
                        </input>
                        <input ref="/b">
                            <label ref="jr:itext('/outside/l2:label')"/>
                        </input>
                        <upload appearance="annotate" mediatype="image/*" ref="/outside/c">
                            <label ref="jr:itext('/outside/l3:label')"/>
                        </upload>
                        <input> ref="/d">
                            <label>
                                [markdown](jr://file/a link.xml)
                            </label>
                        </input>
                    </h:body>
                </h:html>
            `.trim();

            // Stub getManifest
            manifest = [
                {
                    filename: 'first image.jpg',
                    hash: 'irrelevant',
                    downloadUrl: 'hallo spaceboy/spiders from mars.jpg',
                },
                {
                    filename: 'a song.mp3',
                    hash: 'irrelevant',
                    downloadUrl: 'hallo spaceboy/space oddity.mp3',
                },
                {
                    filename: 'some video.mp4',
                    hash: 'irrelevant',
                    downloadUrl: 'hallo spaceboy/a small plot of land.mp4',
                },
                {
                    filename: 'another image.png',
                    hash: 'irrelevant',
                    downloadUrl: 'hallo spaceboy/under pressure.png',
                },
                {
                    filename: 'an instance.xml',
                    hash: 'irrelevant',
                    downloadUrl: 'hallo spaceboy/golden years.xml',
                },
                {
                    filename: 'a spreadsheet.csv',
                    hash: 'irrelevant',
                    downloadUrl: 'hallo spaceboy/little wonder.csv',
                },
                {
                    filename: 'a link.xml',
                    hash: 'irrelevant',
                    downloadUrl: 'hallo spaceboy/wishful beginnings.xml',
                },
            ];

            getManifestStub = sandbox
                .stub(communicator, 'getManifest')
                .callsFake((survey) =>
                    Promise.resolve({
                        ...survey,
                        manifest,
                    })
                );
        });

        describe('cached forms', () => {
            beforeEach(() => {
                transformRequestURL = `/transform/xform/${enketoId}`;
                transformRequestBody = undefined;
            });

            // Note: this test previously failed with `getManifest`
            // being redundantly called twice
            it('gets the manifest', async () => {
                await getTransformResult();

                expect(getManifestStub.getCalls().length).to.equal(1);
            });

            it('caches media sources', async () => {
                await getTransformResult();

                expect(getMediaMapStub.getCalls().length).to.equal(1);
            });
        });
    });
});
