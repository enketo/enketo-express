// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const nock = require('nock');
const chai = require('chai');
const express = require('express');
const request = require('supertest');

const { expect } = chai;
const { Auth } = require('request/lib/auth');
const communicator = require('../../app/lib/communicator');
const config = require('../../app/models/config-model').server;
const sinon = require('sinon');
const { requestContextMiddleware } = require('../../app/lib/context');

describe('Communicator Library', () => {
    /** @type {string} */
    let version;

    /** @type {sinon.SinonSandbox} */
    let sandbox;

    /** @type {string} */
    let customQueryParameter;

    beforeEach(() => {
        version = '8.6.7-r';

        sandbox = sinon.createSandbox();

        customQueryParameter = 'foo';

        sandbox
            .stub(config, 'query parameter to pass to submission')
            .get(() => customQueryParameter);
        sandbox.stub(config, 'version').get(() => version);
    });

    describe('getXFormInfo function', () => {
        it('should throw when getting wrong input', () => {
            const fail = () => {
                communicator.getXFormInfo({});
            };
            expect(fail).to.throw();
        });

        it('should resolve with survey with added info', (done) => {
            const survey = {
                openRosaServer: 'https://testserver.com/bob',
                openRosaId: 'foo',
                credentials: { bearer: 'qwerty' },
                cookie: 'abc',
                form: '<form>some form</form>',
                model: '<data>some model</data>',
            };
            const formListXML = `
                <xforms xmlns="http://openrosa.org/xforms/xformsList">
                    <xform>
                        <formID>foo</formID>
                        <name>Form with zero or more additional files</name>
                        <version>1.1</version>
                        <hash>md5:c28fc778a9291672badee04ac880a05d</hash>
                        <descriptionText>A possibly very long description of the form</descriptionText>
                        <downloadUrl>http://myhost.com/app/path/getMe/formIdA</downloadUrl>
                        <manifestUrl>http://myothehost.com/app/path/getOtherStuff?formId=formIdA</manifestUrl>
                    </xform>
                    <xform>
                        <formID>http://mydomain.org/uniqueFormXmlns</formID>
                        <name>Form without additional files</name>
                        <version>v50 alpha</version>
                        <hash>md5:c28fc778a9291672badee04ac770a05d</hash>
                        <descriptionUrl>http://mysecondhost.com/a/description/getMe@formId=uniqueKey</descriptionUrl>
                        <downloadUrl>http://mysecondhost.com/a/different/path/getMe@formId=uniqueKey</downloadUrl>
                    </xform>
                    <xforms-group>
                        <groupID>someId</groupID>
                        <name>Short name of grouping</name>
                        <listUrl>http://whateverhost.com/other/path/forDownload?group=fido</listUrl>
                        <descriptionText>Longer description of what is here</descriptionText>
                        <descriptionUrl>http://morehost.com/description/link</descriptionUrl>
                    </xforms-group>
                </xforms>
            `;
            nock('https://testserver.com')
                .get('/bob/formList')
                .query({ formID: 'foo' })
                .reply(200, formListXML);

            const updatedSurvey = JSON.parse(JSON.stringify(survey));
            updatedSurvey.info = {
                formID: 'foo',
                name: 'Form with zero or more additional files',
                version: '1.1',
                hash: 'md5:c28fc778a9291672badee04ac880a05d',
                descriptionText: 'A possibly very long description of the form',
                downloadUrl: 'http://myhost.com/app/path/getMe/formIdA',
                manifestUrl:
                    'http://myothehost.com/app/path/getOtherStuff?formId=formIdA',
            };

            communicator.getXFormInfo(survey).then((response) => {
                expect(response).to.deep.equal(updatedSurvey);
                done();
            });
        });
    });

    describe('getXForm function', () => {
        it('should resolve with survey with added xform', (done) => {
            const survey = {
                info: {
                    downloadUrl: 'https://testserver.com/foo',
                },
                credentials: { bearer: 'qwerty' },
                cookie: 'abc',
            };
            const formXML = '<xform>foo</xform>';
            nock('https://testserver.com').get('/foo').reply(200, formXML);

            const updatedSurvey = JSON.parse(JSON.stringify(survey));
            updatedSurvey.xform = formXML;

            communicator.getXForm(survey).then((response) => {
                expect(response).to.deep.equal(updatedSurvey);
                done();
            });
        });

        it('should reject with error if no downloadUrl', (done) => {
            const survey = {
                info: {},
                credentials: { bearer: 'qwerty' },
                cookie: 'abc',
            };

            communicator.getXForm(survey).then(null, (err) => {
                expect(err instanceof Error).to.equal(true);
                done();
            });
        });
    });

    describe('getMaxSize function', () => {
        it('should resolve with maximum accepted submission size', (done) => {
            const survey = {
                info: {
                    downloadUrl: 'https://testserver.com/foo',
                },
                credentials: { bearer: 'qwerty' },
                cookie: 'abc',
            };
            nock('https://testserver.com')
                .intercept('/foo', 'head')
                .reply(200, {}, { 'x-openrosa-accept-content-length': '1024' });

            communicator.getMaxSize(survey).then((response) => {
                expect(response).to.equal('1024');
                done();
            });
        });
    });

    describe('authenticate function', () => {
        before(() => {
            config['linked form and data server']['legacy formhub'] = true;
        });

        after(() => {
            config['linked form and data server']['legacy formhub'] = false;
        });

        it('should use GET for legacy call and respond with unchanged survey object', (done) => {
            const survey = {
                openRosaServer: 'https://testserver.com/foo',
                openRosaId: 'bar',
                credentials: { bearer: 'qwerty' },
                cookie: 'abc',
            };
            nock('https://testserver.com')
                .intercept('/foo/formList?formID=bar', 'get')
                .reply(200, {});

            communicator.authenticate(survey).then((response) => {
                expect(response).to.deep.equal(survey);
                done();
            });
        });
    });

    describe('getAuthHeader function', () => {
        it('has not broken due to a request library update', () => {
            const auth = new Auth();
            expect(auth).to.have.property('onResponse');
            expect(auth.onResponse).to.be.a('function');
        });

        it('should resolve with Bearer credentials if provided', (done) => {
            const url = 'https://my.openrosa.server';
            const creds = {
                user: 'johndoe',
                pass: 'qwerty',
                bearer: 'AbCdEf123456',
            };
            const scope = nock('https://my.openrosa.server')
                .get('/')
                .reply(401);

            communicator.getAuthHeader(url, creds).then((response) => {
                expect(response).to.equal(`Bearer ${creds.bearer}`);
                // server should not have been called
                expect(scope.isDone()).to.equal(false);
                nock.cleanAll();
                done();
            });
        });

        it('should resolve with Auth onResponse output', (done) => {
            const url = 'https://my.openrosa.server';
            const creds = {
                user: 'johndoe',
                pass: 'qwerty',
            };
            const scope = nock('https://my.openrosa.server')
                .intercept('/', 'head')
                .reply(
                    401,
                    {},
                    {
                        'WWW-Authenticate': 'Basic',
                    }
                );

            communicator.getAuthHeader(url, creds).then((response) => {
                expect(response.startsWith('Basic ')).to.equal(true);
                expect(response.length).to.equal(26);
                expect(scope.isDone()).to.equal(true);
                done();
            });
        });
    });

    describe('getManifest function', () => {
        it('should assign manifest to survey object', (done) => {
            const survey = {
                openRosaServer: 'https://testserver.com/bob',
                openRosaId: 'widgets',
                info: {
                    manifestUrl: 'https://my.openrosa.server/manifest1',
                },
                form: '<form>some form</form>',
                model: '<data>some model</data>',
            };
            const manifestXML = `
                <manifest xmlns="http://openrosa.org/xforms/xformsManifest">
                    <mediaFile>
                        <filename>dyn.xml</filename>
                        <hash>md5:3c13dacb1b36c210b996ae307030c684</hash>
                        <downloadUrl>https://example.com/johndoe/formmedia/dyn.xml</downloadUrl>
                    </mediaFile>
                </manifest>
            `;
            nock('https://my.openrosa.server')
                .get('/manifest1')
                .reply(200, manifestXML);

            const updatedSurvey = JSON.parse(JSON.stringify(survey));
            updatedSurvey.manifest = [
                {
                    filename: 'dyn.xml',
                    hash: 'md5:3c13dacb1b36c210b996ae307030c684',
                    downloadUrl:
                        'https://example.com/johndoe/formmedia/dyn.xml',
                },
            ];

            communicator.getManifest(survey).then((response) => {
                expect(response).to.deep.equal(updatedSurvey);
                done();
            });
        });

        it('should resolve a survey with an empty manifest if no manifest url is specified', (done) => {
            const survey = {
                openRosaServer: 'https://testserver.com/bob',
                openRosaId: 'widgets',
                info: {},
                form: '<form>some form</form>',
                model: '<data>some model</data>',
            };

            const scope = nock('https://my.openrosa.server')
                .get('/manifest1')
                .reply(200, 'abc');

            communicator
                .getManifest(survey)
                .then((response) => {
                    expect(response).to.deep.equal({
                        ...survey,
                        manifest: [],
                    });
                    // server should not have been called
                    expect(scope.isDone()).to.equal(false);
                    nock.cleanAll();
                    done();
                })
                .catch(done);
        });
    });

    describe('getFormListUrl function', () => {
        [
            // server, id, customParam, expected output
            [
                'https://ona.io/enketo',
                '123',
                undefined,
                'https://ona.io/enketo/formList?formID=123',
            ],
            [
                'https://ona.io/enketo',
                '123',
                'bar',
                'https://ona.io/enketo/formList?formID=123&foo=bar',
            ],
            [
                'https://ona.io/enketo',
                undefined,
                'bar',
                'https://ona.io/enketo/formList?foo=bar',
            ],
            [
                'https://ona.io/enketo',
                undefined,
                undefined,
                'https://ona.io/enketo/formList',
            ],
            [
                'https://ona.io/enketo',
                '123',
                undefined,
                'https://ona.io/enketo/formList?formID=123',
            ],
        ].forEach((test) => {
            it('should return proper formList url', () => {
                expect(
                    communicator.getFormListUrl(test[0], test[1], test[2])
                ).to.equal(test[3]);
            });
        });

        it('escapes the form id', () => {
            const serverURL = 'https://example.com/-/';
            const formId = '123&?%ϕ';
            const result = communicator.getFormListUrl(serverURL, formId);

            expect(result).to.equal(
                'https://example.com/-/formList?formID=123%26%3F%25%CF%95'
            );
        });

        it('escapes a custom query parameter name', () => {
            customQueryParameter = '456&?%λ';

            const serverURL = 'https://example.com/-/';
            const formId = '123';
            const customParam = '789';
            const result = communicator.getFormListUrl(
                serverURL,
                formId,
                customParam
            );

            expect(result).to.equal(
                'https://example.com/-/formList?formID=123&456%26%3F%25%CE%BB=789'
            );
        });

        it('escapes a custom query parameter value', () => {
            customQueryParameter = '456';

            const serverURL = 'https://example.com/-/';
            const formId = '123';
            const customParam = '789&?%»';
            const result = communicator.getFormListUrl(
                serverURL,
                formId,
                customParam
            );

            expect(result).to.equal(
                'https://example.com/-/formList?formID=123&456=789%26%3F%25%C2%BB'
            );
        });
    });

    describe('getSubmissionUrl function', () => {
        [
            ['ona.io/enketo', 'ona.io/enketo/submission'],
            ['ona.io/enketo/', 'ona.io/enketo/submission'],
            ['enketo.surveycto.com', 'enketo.surveycto.com/submission'],
            [
                'enketo.surveycto.com/path',
                'enketo.surveycto.com/path/submission',
            ],
            [
                '255.255.255.255/aggregate',
                '255.255.255.255/aggregate/submission',
            ],
        ].forEach((test) => {
            it('should return proper submission url', () => {
                expect(communicator.getSubmissionUrl(test[0])).to.equal(
                    test[1]
                );
            });
        });
    });

    describe('getUpdatedRequestOptions function', () => {
        it('should fill up missing properties', () => {
            expect(communicator.getUpdatedRequestOptions({})).to.deep.equal({
                method: 'get',
                headers: {
                    'X-OpenRosa-Version': '1.0',
                    Date: new Date().toUTCString(),
                    'User-Agent': `Enketo/${version}`,
                },
                timeout: config.timeout,
            });
        });

        it('should clear empty cookie', () => {
            expect(
                communicator.getUpdatedRequestOptions({
                    headers: {
                        cookie: '',
                    },
                })
            ).to.deep.equal({
                method: 'get',
                headers: {
                    'X-OpenRosa-Version': '1.0',
                    Date: new Date().toUTCString(),
                    'User-Agent': `Enketo/${version}`,
                },
                timeout: config.timeout,
            });
        });

        it('should cleanup auth', () => {
            expect(
                communicator.getUpdatedRequestOptions({
                    auth: '',
                })
            ).to.deep.equal({
                method: 'get',
                headers: {
                    'X-OpenRosa-Version': '1.0',
                    Date: new Date().toUTCString(),
                    'User-Agent': `Enketo/${version}`,
                },
                timeout: config.timeout,
            });
        });

        it('should set sendImmediately to false if no bearer provided', () => {
            expect(
                communicator.getUpdatedRequestOptions({
                    auth: {},
                })
            ).to.deep.equal({
                method: 'get',
                headers: {
                    'X-OpenRosa-Version': '1.0',
                    Date: new Date().toUTCString(),
                    'User-Agent': `Enketo/${version}`,
                },
                auth: {
                    sendImmediately: false,
                },
                timeout: config.timeout,
            });
        });
    });

    describe('User-agent headers', () => {
        const clientUserAgent =
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36 Lolium/1.0 (The rest is real, this is made up, I kid you not)';

        it('includes the client and server user-agent strings in headers when present in a request context', async () => {
            const testApp = express();
            const handler = (req, res) => {
                res.send({
                    result: communicator.getUpdatedRequestHeaders(),
                });
            };

            const route = '/does-not-matter';

            testApp.use(requestContextMiddleware);
            testApp.get(route, handler);

            const { body } = await request(testApp)
                .get(route)
                .set('User-Agent', clientUserAgent)
                .expect(200);

            expect(body.result['User-Agent']).to.equal(
                `Enketo/${version} ${clientUserAgent}`
            );
        });

        describe('sanitization', () => {
            const sanitizationFixtures = [
                {
                    description: 'trims whitespace',
                    unescapedVersion: '8.6.7-r\n ',
                    expectedVersion: '8.6.7-r',
                },
                {
                    description:
                        'escapes multiple whitespace characters with a single space',
                    unescapedVersion: '8\n\t .6.7\n\t -r',
                    expectedVersion: '8 .6.7 -r',
                },
                {
                    description:
                        'escapes invalid HTTP header characters in URL encoding',
                    unescapedVersion: 'مطهر',
                    expectedVersion: '%D9%85%D8%B7%D9%87%D8%B1',
                },
            ];

            sanitizationFixtures.forEach(
                ({ description, unescapedVersion, expectedVersion }) => {
                    it(description, async () => {
                        version = unescapedVersion;

                        const testApp = express();
                        const handler = (req, res) => {
                            res.send({
                                result: communicator.getUpdatedRequestHeaders(),
                            });
                        };

                        const route = '/does-not-matter';

                        testApp.use(requestContextMiddleware);
                        testApp.get(route, handler);

                        const { body } = await request(testApp)
                            .get(route)
                            .set('User-Agent', clientUserAgent)
                            .expect(200);

                        expect(body.result['User-Agent']).to.equal(
                            `Enketo/${expectedVersion} ${clientUserAgent}`
                        );
                    });
                }
            );
        });
    });
});
