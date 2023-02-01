const chai = require('chai');
const nock = require('nock');
const sinon = require('sinon');
const communicator = require('../../app/lib/communicator');
const mediaLib = require('../../app/lib/media');
const cacheModel = require('../../app/models/cache-model');
const instanceModel = require('../../app/models/instance-model');
const surveyModel = require('../../app/models/survey-model');

const { expect } = chai;

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef {import('../../app/models/survey-model').ManifestItem} ManifestItem
 */

/**
 * @typedef GetManifestArg
 * @property {{ manifestUrl: string }} info
 */

/**
 * @typedef GetManifestResult
 * @property {ManifestItem[]} manifest
 */

/**
 * @typedef GetInstanceArg
 * @property {string} instanceId
 */

/**
 * @typedef GetInstanceResult
 * @property {Record<string, string>} [instanceAttachments]
 * @property {string} instanceId
 * @property {string} returnUrl
 * @property {string} openRosaKey
 */

describe('Media library', () => {
    const defaultEnketoId = 'form1';
    const defaultInstanceId = 'submission1';

    const defaultBaseHostURLOptions = {
        basePath: '-',
    };

    const defaultManifest = [
        {
            downloadUrl:
                'https://example.com/an image <with> a description.jpg',
            hash: 'b37732',
            filename: 'an image.jpg',
        },
        {
            downloadUrl: 'https://example.com/a song & a "title".mp3',
            hash: 'b4db33f',
            filename: 'a song.mp3',
        },
    ];

    const defaultCachedSurveyDetails = {
        openRosaServer: 'https://example2.com',
        openRosaId: 'or-form-1',
    };

    const defaultXFormInfo = {
        info: {
            manfiestUrl: 'https://example2.com/or-manifest-1',
        },
    };

    const defaultInstanceAttachments = {
        'a spreadsheet.csv':
            'https://example.com/a directory/a spreadsheet named foo.csv',
        'an instance.xml': 'https://example.com/an instance named bar.xml',
    };

    /** @type {sinon.SinonSandbox} */
    let sandbox;

    /** @type {Date} */
    let now;

    /** @type {sinon.SinonFakeTimers} */
    let timers;

    /** @type {sinon.SinonStub<[string], Promise<Survey>>} */
    let getCachedSurveyDetailsStub;

    /** @type {sinon.SinonStub<[Survey], Promise<Survey>>} */
    let getXFormInfoStub;

    /** @type {sinon.SinonStub<[Survey & GetManifestArg], Promise<Survey & GetManifestResult>>>} */
    let getManifestStub;

    /** @type {sinon.SinonStub<[Survey & GetInstanceArg], Promise<Survey & GetInstanceResult>>} */
    let getInstanceStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        now = new Date();
        timers = sandbox.useFakeTimers(now);
        getCachedSurveyDetailsStub = sandbox.stub(surveyModel, 'get');
        getXFormInfoStub = sandbox.stub(communicator, 'getXFormInfo');
        getManifestStub = sandbox.stub(communicator, 'getManifest');
        getInstanceStub = sandbox.stub(instanceModel, 'get');
    });

    afterEach(() => {
        nock.cleanAll();
        timers.runAll();
        timers.clearTimeout();
        timers.restore();
        sandbox.restore();
    });

    describe('media URLs', () => {
        beforeEach(() => {
            getCachedSurveyDetailsStub.callsFake(
                async () => defaultCachedSurveyDetails
            );
            getXFormInfoStub.callsFake(async () => ({
                ...defaultCachedSurveyDetails,
                ...defaultXFormInfo,
            }));
            getManifestStub.callsFake(async (survey) => ({
                ...survey,
                manifest: defaultManifest,
            }));
            getInstanceStub.callsFake(async (survey) => ({
                ...survey,
                instanceAttachments: defaultInstanceAttachments,
            }));
        });

        [
            {
                type: 'manifest',
                resourceId: defaultEnketoId,
                media: defaultManifest,
                options: defaultBaseHostURLOptions,
                expectedMediaMap: {
                    'an%20image.jpg':
                        '/-/media/get/0/form1/b37732/an%20image.jpg',
                    'a%20song.mp3': '/-/media/get/0/form1/b4db33f/a%20song.mp3',
                },
                expectedHostURLs: [
                    'https://example.com/an%20image%20%3Cwith%3E%20a%20description.jpg',
                    'https://example.com/a%20song%20&%20a%20%22title%22.mp3',
                ],
            },
            {
                type: 'instance attachments',
                resourceId: defaultInstanceId,
                media: defaultInstanceAttachments,
                options: defaultBaseHostURLOptions,
                expectedMediaMap: {
                    'a%20spreadsheet.csv':
                        '/-/media/get/1/submission1/a%20spreadsheet.csv',
                    'an%20instance.xml':
                        '/-/media/get/1/submission1/an%20instance.xml',
                },
                expectedHostURLs: [
                    'https://example.com/a%20directory/a%20spreadsheet%20named%20foo.csv',
                    'https://example.com/an%20instance%20named%20bar.xml',
                ],
            },
        ].forEach(
            ({
                type,
                resourceId,
                media,
                options,
                expectedMediaMap,
                expectedHostURLs,
            }) => {
                const requestPaths = Array.from(
                    Object.values(expectedMediaMap)
                ).map((mediaURL) => mediaURL.replace('/-/media', ''));

                it(`creates a media mapping from ${type}`, async () => {
                    const mediaMap = await mediaLib.getMediaMap(
                        resourceId,
                        media,
                        options
                    );

                    expect(mediaMap).to.deep.equal(expectedMediaMap);
                });

                it(`gets urls from the cached ${type} media mapping`, async () => {
                    await mediaLib.getMediaMap(
                        resourceId,
                        media,
                        defaultBaseHostURLOptions
                    );

                    const actual = await Promise.all(
                        requestPaths.map((requestPath) =>
                            mediaLib.getHostURL({
                                ...options,
                                requestPath,
                            })
                        )
                    );

                    expect(actual).to.deep.equal(expectedHostURLs);

                    if (type === 'manifest') {
                        expect(getManifestStub.getCalls().length).to.equal(0);
                    }
                });

                it(`populates the ${type} media mapping cache from the OpenRosa server when not cached`, async () => {
                    let actual = await Promise.all(
                        requestPaths.map((requestPath) =>
                            mediaLib.getHostURL({
                                ...options,
                                requestPath,
                            })
                        )
                    );

                    expect(actual).to.deep.equal(expectedHostURLs);

                    if (type === 'manifest') {
                        expect(getManifestStub).to.have.been.calledOnceWith({
                            ...defaultCachedSurveyDetails,
                            ...defaultXFormInfo,
                        });
                    }

                    actual = await Promise.all(
                        requestPaths.map((requestPath) =>
                            mediaLib.getHostURL({
                                ...options,
                                requestPath,
                            })
                        )
                    );

                    expect(actual).to.deep.equal(expectedHostURLs);

                    if (type === 'manifest') {
                        expect(getManifestStub.getCalls().length).to.equal(1);
                    }
                });

                it(`populates the ${type} media mapping cache from the OpenRosa server when the cache has expired`, async () => {
                    await mediaLib.getMediaMap(resourceId, media, options);

                    let actual = await Promise.all(
                        requestPaths.map((requestPath) =>
                            mediaLib.getHostURL({
                                ...options,
                                requestPath,
                            })
                        )
                    );

                    expect(actual).to.deep.equal(expectedHostURLs);

                    if (type === 'manifest') {
                        expect(getManifestStub.getCalls().length).to.equal(0);
                    }

                    await cacheModel.flushAll();

                    actual = await Promise.all(
                        requestPaths.map((requestPath) =>
                            mediaLib.getHostURL({
                                ...defaultBaseHostURLOptions,
                                requestPath,
                            })
                        )
                    );

                    expect(actual).to.deep.equal(expectedHostURLs);

                    if (type === 'manifest') {
                        expect(getManifestStub).to.have.been.calledOnceWith({
                            ...defaultCachedSurveyDetails,
                            ...defaultXFormInfo,
                        });
                    }

                    actual = await Promise.all(
                        requestPaths.map((requestPath) =>
                            mediaLib.getHostURL({
                                ...defaultBaseHostURLOptions,
                                requestPath,
                            })
                        )
                    );

                    expect(actual).to.deep.equal(expectedHostURLs);

                    if (type === 'manifest') {
                        expect(getManifestStub.getCalls().length).to.equal(1);
                    }
                });
            }
        );

        it('caches manifest media separately for each hash', async () => {
            await mediaLib.getMediaMap(
                defaultEnketoId,
                defaultManifest,
                defaultBaseHostURLOptions
            );

            const otherSessionManifest = defaultManifest.map(
                ({ downloadUrl, hash, filename }) => ({
                    downloadUrl: downloadUrl.replace(
                        /\.(jpg|mp3)/,
                        '-other-session.$1'
                    ),
                    hash: hash.toUpperCase(),
                    filename,
                })
            );
            getManifestStub.callsFake(async (survey) => ({
                ...survey,
                manifest: otherSessionManifest,
            }));
            const options = {
                ...defaultBaseHostURLOptions,
            };

            const expectedMediaMap = {
                'an%20image.jpg': '/-/media/get/0/form1/B37732/an%20image.jpg',
                'a%20song.mp3': '/-/media/get/0/form1/B4DB33F/a%20song.mp3',
            };
            const requestPaths = Array.from(
                Object.values(expectedMediaMap)
            ).map((mediaURL) => mediaURL.replace('/-/media', ''));

            let actual = await Promise.all(
                requestPaths.map((requestPath) =>
                    mediaLib.getHostURL({
                        ...options,
                        requestPath,
                    })
                )
            );

            const expectedHostURLs = [
                'https://example.com/an%20image%20%3Cwith%3E%20a%20description-other-session.jpg',
                'https://example.com/a%20song%20&%20a%20%22title%22-other-session.mp3',
            ];

            expect(actual).to.deep.equal(expectedHostURLs);
            expect(getManifestStub.getCalls().length).to.equal(1);
            sinon.assert.calledWith(getManifestStub, {
                ...defaultCachedSurveyDetails,
                ...defaultXFormInfo,
            });

            actual = await Promise.all(
                requestPaths.map((requestPath) =>
                    mediaLib.getHostURL({
                        ...options,
                        requestPath,
                    })
                )
            );

            expect(actual).to.deep.equal(expectedHostURLs);
            expect(getManifestStub.getCalls().length).to.equal(1);
        });
    });
});
