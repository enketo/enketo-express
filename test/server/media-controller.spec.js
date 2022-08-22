const request = require('supertest');
const http = require('http');
const nock = require('nock');
const sinon = require('sinon');
const communicator = require('../../app/lib/communicator');
const mediaLib = require('../../app/lib/media');
const app = require('../../config/express');

const testHTMLBody = 'im in.';
const portHTML = 1234;
const testHTMLURL = `http://localhost:${portHTML}/`;
const testHTMLMetaURL = `http://0.0.0.0:${portHTML}/`;
const testHTMLValidHTTPSURL =
    'https://www.w3.org/People/mimasa/test/imgformat/img/w3c_home_2.jpg';
const localhost = '127.0.0.1';

describe('Media controller', () => {
    const enketoId = 'surveyA';
    const hostURLs = [testHTMLURL, testHTMLMetaURL, testHTMLValidHTTPSURL];

    // Default everything disabled
    const allowPrivateIPAddress = false;
    const allowMetaIPAddress = false;
    const allowIPAddressList = [];
    const denyIPAddressList = [];

    /** @type {sinon.SinonSandbox} */
    let sandbox;

    /** @type {sinon.SinonFakeTimers} */
    let timers;

    /** @type {string} */
    let requestURL;

    /** @type {string} */
    let requestMetaURL;

    /** @type {string} */
    let requestValidHTTPSURL;

    /** @type {string[]} */
    let mediaURLs;

    /** @type {http.Server} */
    let server;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        timers = sinon.useFakeTimers({
            toFake: ['setTimeout'],
        });

        sandbox.stub(mediaLib, 'getHostURLOptions').callsFake((req) => ({
            basePath: app.get('base path'),
            deviceId: 'fake',
            requestPath: req.url,
        }));

        const manifest = [
            {
                filename: 'request.html',
                downloadUrl: testHTMLURL,
            },
            {
                filename: 'meta.html',
                downloadUrl: testHTMLMetaURL,
            },
            {
                filename: 'https.jpg',
                downloadUrl: testHTMLValidHTTPSURL,
            },
        ];

        sandbox.stub(communicator, 'getManifest').resolves({ manifest });

        const mediaMap = await mediaLib.getMediaMap(
            enketoId,
            manifest,
            mediaLib.getHostURLOptions({
                url: `${app.get('base path')}transform/xform/${enketoId}`,
                headers: {},
            })
        );

        requestURL = mediaMap['request.html'];
        requestMetaURL = mediaMap['meta.html'];
        requestValidHTTPSURL = mediaMap['https.jpg'];

        mediaURLs = [requestURL, requestMetaURL, requestValidHTTPSURL];

        const { origin, pathname } = new URL(testHTMLValidHTTPSURL);

        nock(origin)
            .get(pathname)
            .reply(200, { hostURL: testHTMLValidHTTPSURL });

        server = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(testHTMLBody);
        });

        await new Promise((resolve, reject) => {
            server.on('error', reject);
            server.listen(portHTML, () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
    });

    afterEach(async () => {
        timers.runAll();
        timers.restore();

        let caught;

        try {
            await new Promise((resolve, reject) => {
                if (server == null) {
                    reject();
                }

                server.close((error) => {
                    if (error != null) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            caught = error;
        }

        nock.cleanAll();
        sandbox.restore();

        if (caught != null) {
            throw caught;
        }
    });

    it('requests the URL in a cached media map', async () => {
        for await (const [index, mediaURL] of mediaURLs.entries()) {
            const hostURL = hostURLs[index];
            const { origin, pathname } = new URL(hostURL);

            nock(origin).get(pathname).reply(200, { hostURL });

            await request(app).get(mediaURL).expect(200, { hostURL });
        }
    });

    // Tests WITH Referers

    // Tests with allowPrivateIPAddress FALSE
    it('for a private IP address WITH a Referer with allowPrivateIPAddress=false', (done) => {
        // Don't change any default IP filtering setting
        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestURL)
            .set('Referer', 'https://google.com?print=true')
            .expect(
                500,
                /DNS lookup .* is not allowed. Because, It is private IP address/
            )
            .end(done);
    });
    it('for a private IP address WITH a Referer with allowPrivateIPAddress=false and allowMetaIPAddress=true', (done) => {
        // Only change one setting
        const allowMetaIPAddress = true;

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestMetaURL)
            .set('Referer', 'https://google.com?print=true')
            .expect(
                500,
                /DNS lookup .* is not allowed. Because, It is private IP address/
            )
            .end(done);
    });
    it('for a private IP address WITH a Referer with allowPrivateIPAddress=false but allowIPAddressList=[`127.0.0.1`]', (done) => {
        // Only change one setting
        const allowIPAddressList = [localhost];

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestURL)
            .set('Referer', 'https://google.com?print=true')
            .expect(200, testHTMLBody)
            .end(done);
    });
    it('for a private IP address WITH a Referer with allowPrivateIPAddress=false and denyIPAddressList=[`127.0.0.1`]', (done) => {
        // Only change one setting
        const denyIPAddressList = [localhost];

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestURL)
            .set('Referer', 'https://google.com?print=true')
            .expect(
                500,
                /DNS lookup .* is not allowed. Because, It is private IP address/
            )
            .end(done);
    });

    // Tests with allowPrivateIPAddress TRUE
    it('for a private IP address WITH a Referer with allowPrivateIPAddress=true', (done) => {
        // Only change one setting
        const allowPrivateIPAddress = true;

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestURL)
            .set('Referer', 'https://google.com?print=true')
            .expect(200, testHTMLBody)
            .end(done);
    });
    it('for a private IP address WITH a Referer with allowPrivateIPAddress=true and allowMetaIPAddress=true', (done) => {
        // Change two settings
        const allowPrivateIPAddress = true;
        const allowMetaIPAddress = true;

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestMetaURL)
            .set('Referer', 'https://google.com?print=true')
            .expect(200, testHTMLBody)
            .end(done);
    });
    it('for a private IP address WITH a Referer with allowPrivateIPAddress=true and allowIPAddressList=[`127.0.0.1`]', (done) => {
        // Change two settings
        const allowPrivateIPAddress = true;
        const allowIPAddressList = [localhost];

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestURL)
            .set('Referer', 'https://google.com?print=true')
            .expect(200, testHTMLBody)
            .end(done);
    });
    it('for a private IP address WITH a Referer with allowPrivateIPAddress=true and denyIPAddressList=[`127.0.0.1`]', (done) => {
        // Change two settings
        const allowPrivateIPAddress = true;
        const denyIPAddressList = [localhost];

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestURL)
            .set('Referer', 'https://google.com?print=true')
            .expect(
                500,
                /DNS lookup .* is not allowed. Because It is defined in denyIPAddressList./
            )
            .end(done);
    });

    // Tests WITHOUT Referers

    // Tests with allowPrivateIPAddress FALSE
    it('for a private IP address WITHOUT a Referer with allowPrivateIPAddress=false', (done) => {
        // Don't change any default IP filtering setting
        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestURL)
            .expect(
                500,
                /DNS lookup .* is not allowed. Because, It is private IP address./
            )
            .end(done);
    });
    it('for a private IP address WITHOUT a Referer with allowPrivateIPAddress=false and allowMetaIPAddress=true', (done) => {
        // Only change one setting
        const allowMetaIPAddress = true;

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestMetaURL)
            .expect(
                500,
                /DNS lookup .* is not allowed. Because, It is private IP address/
            )
            .end(done);
    });
    it('for a private IP address WITHOUT a Referer with allowPrivateIPAddress=false but allowIPAddressList=[`127.0.0.1`]', (done) => {
        // Only change one setting
        const allowIPAddressList = [localhost];

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app).get(requestURL).expect(200, testHTMLBody).end(done);
    });
    it('for a private IP address WITHOUT a Referer with allowPrivateIPAddress=false and denyIPAddressList=[`127.0.0.1`]', (done) => {
        // Only change one setting
        const denyIPAddressList = [localhost];

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestURL)
            .expect(
                500,
                /DNS lookup .* is not allowed. Because, It is private IP address/
            )
            .end(done);
    });

    // Tests with allowPrivateIPAddress TRUE
    it('for a private IP address WITHOUT a Referer with allowPrivateIPAddress=true', (done) => {
        // Only change one setting
        const allowPrivateIPAddress = true;

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app).get(requestURL).expect(200, testHTMLBody).end(done);
    });
    it('for a private IP address WITHOUT a Referer with allowPrivateIPAddress=true and allowMetaIPAddress=true', (done) => {
        // Change two settings
        const allowPrivateIPAddress = true;
        const allowMetaIPAddress = true;

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app).get(requestMetaURL).expect(200, testHTMLBody).end(done);
    });
    it('for a private IP address WITHOUT a Referer with allowPrivateIPAddress=true and allowIPAddressList=[`127.0.0.1`]', (done) => {
        // Change two settings
        const allowPrivateIPAddress = true;
        const allowIPAddressList = [localhost];

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app).get(requestURL).expect(200, testHTMLBody).end(done);
    });
    it('for a private IP address WITHOUT a Referer with allowPrivateIPAddress=true and denyIPAddressList=[`127.0.0.1`]', (done) => {
        // Change two settings
        const allowPrivateIPAddress = true;
        const denyIPAddressList = [localhost];

        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app)
            .get(requestURL)
            .expect(
                500,
                /DNS lookup .* is not allowed. Because It is defined in denyIPAddressList./
            )
            .end(done);
    });

    // Testing valid https resource
    it('for a valid https resouce: https://www.w3.org/People/mimasa/test/imgformat/img/w3c_home_2.jpg', (done) => {
        // Default Settings
        app.set('ip filtering', {
            allowPrivateIPAddress,
            allowMetaIPAddress,
            allowIPAddressList,
            denyIPAddressList,
        });

        request(app).get(requestValidHTTPSURL).expect(200).end(done);
    });
});
