// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

/*
 * Some of these tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */
const request = require('supertest');
const config = require('../../app/models/config-model').server;

config['base path'] = '';
const app = require('../../config/express');
const surveyModel = require('../../app/models/survey-model');
const instanceModel = require('../../app/models/instance-model');
const cacheModel = require('../../app/models/cache-model');

let v1Survey;
let v1Instance;
let v1Surveys;

describe('api', () => {
    const validApiKey = 'abc';
    const validAuth = {
        Authorization: `Basic ${Buffer.from(`${validApiKey}:`).toString(
            'base64'
        )}`,
    };
    const invalidApiKey = 'def';
    const invalidAuth = {
        Authorization: `Basic ${Buffer.from(`${invalidApiKey}:`).toString(
            'base64'
        )}`,
    };
    const beingEdited = 'beingEdited';
    const validServer = 'https://testserver.com/bob';
    const validFormId = 'something';
    const invalidServer = 'https://someotherserver.com/john';

    beforeEach(async () => {
        const s = {
            openRosaServer: validServer,
            openRosaId: validFormId,
        };

        // add survey if it doesn't exist in the db
        await surveyModel.set(s);

        await cacheModel.set({
            ...s,
            info: {
                hash: 'a',
            },
            form: '<form/>',
            model: '<model/>',
        });

        await instanceModel.set({
            openRosaServer: validServer,
            openRosaId: validFormId,
            instanceId: beingEdited,
            returnUrl: 'https://enketo.org',
            instance: '<data></data>',
        });
    });

    // return error if it fails
    function responseCheck(value, expected) {
        if (typeof expected === 'string' || typeof expected === 'number') {
            if (value !== expected) {
                return new Error(`Response ${value} not equal to ${expected}`);
            }
        } else if (expected instanceof RegExp && typeof value === 'object') {
            if (!expected.test(JSON.stringify(value))) {
                return new Error(
                    `Response ${JSON.stringify(value)} not matching ${expected}`
                );
            }
        } else if (expected instanceof RegExp) {
            if (!expected.test(value)) {
                return new Error(`Response ${value} not matching ${expected}`);
            }
        } else if (expected instanceof Object) {
            // This is where it gets ugly. Strip the port number from URLs...
            const v = JSON.stringify(value).replace(/:[0-9]{5}\//g, '/');
            const e = JSON.stringify(expected).replace(/:[0-9]{5}\//g, '/');
            if (v !== e) {
                return new Error(`Response ${v} not matching ${e}`);
            }
        } else {
            return new Error('This is not a valid expected value');
        }
    }

    function testResponse(test) {
        const authDesc =
            test.auth === true
                ? 'valid'
                : test.auth === false
                ? 'invalid'
                : 'empty';
        const auth =
            test.auth === true
                ? validAuth
                : test.auth === false
                ? invalidAuth
                : {};
        const { version } = test;
        const server =
            typeof test.server !== 'undefined' ? test.server : validServer;
        const id =
            typeof test.id !== 'undefined'
                ? test.id !== '{{random}}'
                    ? test.id
                    : Math.floor(Math.random() * 10000).toString()
                : validFormId;
        const ret = test.ret === true ? 'http://example.com' : test.ret;
        const instance = test.instance === true ? '<data/>' : test.instance;
        const instanceId =
            test.instanceId === true
                ? `UUID:${Math.random()}`
                : test.instanceId;
        const goTo = typeof test.goTo !== 'undefined' ? test.goTo : '';
        const { endpoint } = test;
        const offlineEnabled = !!test.offline;
        const dataSendMethod = test.method === 'get' ? 'query' : 'send';

        it(`${test.method.toUpperCase()} /api/v${version}${endpoint} with ${authDesc} authentication and ${server}, ${id}, ${ret}, ${instance}, ${instanceId}, ${
            test.theme
        }, parentWindowOrigin: ${
            test.parentWindowOrigin
        }, defaults: ${JSON.stringify(test.defaults)} responds with ${
            test.status
        } when offline enabled: ${offlineEnabled}`, (done) => {
            app.set('offline enabled', offlineEnabled);

            request(app)
                [test.method](`/api/v${version}${endpoint}`)
                .set(auth)
                [dataSendMethod]({
                    server_url: server,
                    form_id: id,
                    instance,
                    instance_id: instanceId,
                    return_url: ret,
                    go_to: goTo,
                    format: test.format,
                    margin: test.margin,
                    landscape: test.landscape,
                    defaults: test.defaults,
                    parent_window_origin: test.parentWindowOrigin,
                })
                .expect(test.status)
                .expect((resp) => {
                    if (test.res && test.res.expected) {
                        const valueToTest = test.res.property
                            ? resp.body[test.res.property]
                            : resp.body;

                        return responseCheck(valueToTest, test.res.expected);
                    }
                })
                .end(done);
        });
    }

    describe('v1', () => {
        const version = 1;

        describe('', () => {
            v1Survey = [
                // valid token
                {
                    method: 'get',
                    auth: true,
                    status: 200,
                },
                {
                    method: 'post',
                    auth: true,
                    status: 200,
                },
                {
                    method: 'put',
                    auth: true,
                    status: 405,
                },
                {
                    method: 'delete',
                    auth: true,
                    status: 204,
                },
                // invalid token
                {
                    method: 'get',
                    auth: false,
                    status: 401,
                },
                {
                    method: 'post',
                    auth: false,
                    status: 401,
                },
                {
                    method: 'put',
                    auth: false,
                    status: 401,
                },
                {
                    method: 'delete',
                    auth: false,
                    status: 401,
                },
                // missing token
                {
                    method: 'get',
                    auth: null,
                    status: 401,
                },
                {
                    method: 'post',
                    auth: null,
                    status: 401,
                },
                {
                    method: 'put',
                    auth: null,
                    status: 401,
                },
                {
                    method: 'delete',
                    auth: null,
                    status: 401,
                },
                // non-existing account
                {
                    method: 'get',
                    auth: true,
                    status: 403,
                    server: invalidServer,
                },
                {
                    method: 'post',
                    auth: true,
                    status: 403,
                    server: invalidServer,
                },
                {
                    method: 'put',
                    auth: true,
                    status: 403,
                    server: invalidServer,
                },
                {
                    method: 'delete',
                    auth: true,
                    status: 403,
                    server: invalidServer,
                },
                // server_url not provided or empty
                {
                    method: 'get',
                    auth: true,
                    status: 400,
                    server: '',
                },
                {
                    method: 'post',
                    auth: true,
                    status: 400,
                    server: '',
                },
                {
                    method: 'put',
                    auth: true,
                    status: 400,
                    server: '',
                },
                {
                    method: 'delete',
                    auth: true,
                    status: 400,
                    server: '',
                },
            ];

            v1Survey
                .map((obj) => {
                    obj.version = version;
                    obj.endpoint = '/survey';

                    return obj;
                })
                .forEach(testResponse);
        });

        describe('/survey endpoint offline-enabled and online-only responses (incompatible with v2)', () => {
            // test online responses for /survey endpoint (differs in v2)
            testResponse({
                version,
                endpoint: '/survey',
                method: 'post',
                auth: true,
                status: 200,
                res: {
                    property: 'url',
                    expected: /\/[A-z0-9]{4,31}/,
                },
                offline: false,
            });

            // test online responses for /survey/iframe endpoint (differs in v2)
            testResponse({
                version,
                endpoint: '/survey/iframe',
                method: 'post',
                auth: true,
                status: 200,
                res: {
                    // in api/v1 this returns `url`, in api/v2 this returns `iframe_url`
                    property: 'url',
                    expected: /\/i\/[A-z0-9]{4,31}/,
                },
                offline: false,
            });

            // test offline responses for /survey endpoint (differs in v2)
            testResponse({
                version,
                endpoint: '/survey',
                method: 'post',
                auth: true,
                status: 200,
                res: {
                    property: 'url',
                    expected: /\/x\/[A-z0-9]{4,31}/,
                },
                offline: true,
            });

            // test offline responses for /survey/iframe endpoint (differs in v2)
            testResponse({
                version,
                endpoint: '/survey/iframe',
                method: 'post',
                auth: true,
                status: 200,
                res: {
                    // in api/v1 this returns `url`, in api/v2 this returns `iframe_url`
                    property: 'url',
                    expected: /\/x\/[A-z0-9]{4,31}/,
                },
                offline: true,
            });

            // test offline responses for /survey/offline endpoint (differs in v2)
            testResponse({
                version,
                endpoint: '/survey/offline',
                method: 'post',
                auth: true,
                status: 405,
                offline: true,
            });
        });

        // TODO: add some tests for other /survey/* endpoints

        // /surveys/* endpoints
        describe('', () => {
            v1Surveys = [
                // GET /surveys/number
                {
                    version,
                    endpoint: '/surveys/number',
                    method: 'get',
                    auth: true,
                    server: validServer,
                    status: 200,
                    res: {
                        property: 'number',
                        expected: 1,
                    },
                },
                // POST /surveys/number (same)
                {
                    version,
                    endpoint: '/surveys/number',
                    method: 'post',
                    auth: true,
                    server: validServer,
                    status: 200,
                    res: {
                        property: 'number',
                        expected: 1,
                    },
                },
                // GET /surveys/list
                {
                    version,
                    endpoint: '/surveys/list',
                    method: 'get',
                    auth: true,
                    server: validServer,
                    status: 200,
                    res: {
                        property: 'forms',
                        expected:
                            /"url":"http:\/\/.*\/[A-z0-9]{4,31}".*"form_id":"something"/,
                    },
                },
                // POST /surveys/list (same)
                {
                    version,
                    endpoint: '/surveys/list',
                    method: 'post',
                    auth: true,
                    server: validServer,
                    status: 200,
                    res: {
                        property: 'forms',
                        expected:
                            /"url":"http:\/\/.*\/[A-z0-9]{4,31}".*"form_id":"something"/,
                    },
                },
                // POST /surveys/list - check for server_url property
                {
                    version,
                    endpoint: '/surveys/list',
                    method: 'post',
                    auth: true,
                    server: validServer,
                    status: 200,
                    res: {
                        property: 'forms',
                        expected:
                            /"server_url":"https:\/\/testserver\.com\/bob"/,
                    },
                },
            ];

            v1Surveys.forEach(testResponse);
        });

        describe('', () => {
            v1Instance = [
                // valid token
                {
                    method: 'post',
                    auth: true,
                    instance: true,
                    instanceId: 'AAA',
                    ret: true,
                    status: 201,
                    res: {
                        property: 'edit_url',
                        // includes proper enketoID and not e.g. /null
                        expected: /[A-z0-9]{4,31}/,
                    },
                },
                // valid token and not being edited, but formId doesn't exist in db yet (no enketoId)
                {
                    method: 'post',
                    auth: true,
                    instance: true,
                    instanceId: true,
                    ret: true,
                    id: '{{random}}',
                    status: 201,
                    res: {
                        property: 'edit_url',
                        // includes proper enketoID and not e.g. /null
                        expected: /[A-z0-9]{4,31}/,
                    },
                },
                // already being edited
                {
                    method: 'post',
                    auth: true,
                    instance: true,
                    instanceId: beingEdited,
                    status: 405,
                },
                // test return url in response
                {
                    method: 'post',
                    auth: true,
                    instance: true,
                    instanceId: true,
                    ret: 'http://enke.to',
                    status: 201,
                    res: {
                        property: 'edit_url',
                        expected: /.+\?.*return_url=http%3A%2F%2Fenke.to/,
                    },
                },
                // invalid parameters
                {
                    method: 'post',
                    auth: true,
                    instance: true,
                    instanceId: true,
                    id: '',
                    status: 400,
                },
                {
                    method: 'post',
                    auth: true,
                    instanceId: true,
                    instance: '',
                    status: 400,
                },
                {
                    method: 'post',
                    auth: true,
                    instance: true,
                    instanceId: '',
                    status: 400,
                },
                {
                    method: 'post',
                    auth: true,
                    instance: true,
                    instanceId: true,
                    server: '',
                    status: 400,
                },
                // different methods, valid token
                {
                    method: 'get',
                    auth: true,
                    instance: true,
                    instanceId: true,
                    status: 405,
                },
                {
                    method: 'put',
                    auth: true,
                    instance: true,
                    instanceId: true,
                    status: 405,
                },
                // removes instance from db
                {
                    method: 'delete',
                    auth: true,
                    instanceId: true,
                    status: 204,
                },
                // no account
                {
                    method: 'post',
                    auth: true,
                    instance: true,
                    instanceId: true,
                    status: 403,
                    server: 'https://testserver.com/notexist',
                },
            ];

            v1Instance
                .map((obj) => {
                    obj.version = version;
                    obj.endpoint = '/instance';

                    return obj;
                })
                .forEach(testResponse);
        });
    });

    describe('v2', () => {
        const version = 2;

        describe('v1-compatible ', () => {
            // make sure v2 is backwards-compatible with v1
            v1Survey
                .map((obj) => {
                    obj.version = version;

                    return obj;
                })
                .forEach(testResponse);
        });

        describe('v1-compatible ', () => {
            // make sure v2 is backwards-compatible with v1
            v1Instance
                .map((obj) => {
                    obj.version = version;
                    if (obj.instanceId === 'AAA') {
                        obj.instanceId = 'BBB';
                    }

                    return obj;
                })
                .forEach(testResponse);
        });

        describe('v1-compatible ', () => {
            // make sure v2 is backwards-compatible with v1
            v1Surveys
                .map((obj) => {
                    obj.version = version;

                    return obj;
                })
                .forEach(testResponse);
        });

        [
            {
                endpoint: '/version',
                method: 'get',
                auth: false,
                status: 200,
                res: {
                    property: 'version',
                    expected: /.{5,20}/,
                },
            },
            {
                endpoint: '/version',
                method: 'post',
                auth: false,
                status: 200,
                res: {
                    property: 'version',
                    expected: /.{5,20}/,
                },
            },
            // TESTING THE OFFLINE/ONLINE VIEWS (not compatible with v1)
            // the /survey endpoint always returns the online-only view
            {
                endpoint: '/survey',
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected: /\/[A-z0-9]{4,31}/,
                },
                offline: false,
            },
            {
                endpoint: '/survey/iframe',
                method: 'post',
                status: 200,
                res: {
                    property: 'iframe_url',
                    expected: /\/i\/[A-z0-9]{4,31}/,
                },
                offline: false,
            },
            {
                endpoint: '/survey',
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected: /\/[A-z0-9]{4,31}/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/iframe',
                method: 'post',
                status: 200,
                res: {
                    property: 'iframe_url',
                    expected: /\/i\/[A-z0-9]{4,31}/,
                },
                offline: true,
            },
            // clear survey cache pro-actively
            {
                endpoint: '/survey/cache',
                method: 'delete',
                status: 204,
            },
            {
                endpoint: '/survey/cache',
                method: 'delete',
                server: invalidServer,
                status: 403, // no account
            },
            {
                endpoint: '/survey/cache',
                method: 'delete',
                id: 'invalidID',
                auth: true,
                status: 404, // not found
            },
            // single submission
            {
                endpoint: '/survey/single',
                method: 'get',
                status: 200,
                ret: true,
                res: {
                    property: 'single_url',
                    expected: /\/single\/[A-z0-9]{4,31}\?/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/single/iframe',
                method: 'get',
                ret: true,
                status: 200,
                res: {
                    property: 'single_iframe_url',
                    expected: /\/single\/i\/[A-z0-9]{4,31}\?/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/single',
                method: 'post',
                ret: true,
                status: 200,
                res: {
                    property: 'single_url',
                    expected: /\/single\/[A-z0-9]{4,31}\?/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/single/iframe',
                method: 'post',
                ret: true,
                status: 200,
                res: {
                    property: 'single_iframe_url',
                    expected: /\/single\/i\/[A-z0-9]{4,31}\?/,
                },
                offline: true,
            },

            // /single/once
            {
                endpoint: '/survey/single/once',
                method: 'get',
                ret: true,
                status: 200,
                res: {
                    property: 'single_once_url',
                    expected: /\/single\/[a-fA-F0-9]{32,160}\?/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/single/once/iframe',
                method: 'get',
                ret: true,
                status: 200,
                res: {
                    property: 'single_once_iframe_url',
                    expected: /\/single\/i\/[a-fA-F0-9]{32,160}\?/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/single/once',
                method: 'post',
                ret: true,
                status: 200,
                res: {
                    property: 'single_once_url',
                    expected: /\/single\/[a-fA-F0-9]{32,160}\?/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/single/once/iframe',
                method: 'post',
                ret: true,
                status: 200,
                res: {
                    property: 'single_once_iframe_url',
                    expected: /\/single\/i\/[a-fA-F0-9]{32,160}\?/,
                },
                offline: true,
            },

            // the /survey/offline endpoint always returns the offline-capable view (if enabled)
            {
                endpoint: '/survey/offline',
                method: 'post',
                status: 405,
                offline: false,
            },
            {
                endpoint: '/survey/offline/iframe',
                method: 'post',
                status: 405,
                offline: false,
            },
            {
                endpoint: '/survey/offline',
                method: 'post',
                status: 200,
                res: {
                    property: 'offline_url',
                    expected: /\/x\/[A-z0-9]{4,31}/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/offline/iframe',
                method: 'post',
                status: 405,
                offline: true,
            },
            // TESTING THE DEFAULTS[] PARAMETER
            // defaults are optional
            {
                endpoint: '/survey',
                defaults: null,
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected: /[^?d[\]]+/,
                },
            },
            {
                endpoint: '/survey',
                defaults: '',
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected: /[^?d[\]]/,
                },
            },
            // same for GET
            {
                endpoint: '/survey',
                defaults: null,
                method: 'get',
                status: 200,
                res: {
                    property: 'url',
                    expected: /[^?d[\]]+/,
                },
            },
            {
                endpoint: '/survey',
                defaults: '',
                method: 'get',
                status: 200,
                res: {
                    property: 'url',
                    expected: /[^?d[\]]+/,
                },
            },
            // responses including url-encoded defaults queryparams
            {
                endpoint: '/survey',
                defaults: {
                    '/path/to/node': '2,3',
                    '/path/to/other/node': 5,
                },
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected:
                        /.+\?d%5B%2Fpath%2Fto%2Fnode%5D=2%2C3&d%5B%2Fpath%2Fto%2Fother%2Fnode%5D=5/,
                },
            },
            {
                endpoint: '/survey',
                defaults: {
                    '/path/to/node': '10%25 tax',
                },
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected: /.+\?d%5B%2Fpath%2Fto%2Fnode%5D=10%25%20tax/,
                },
            },
            {
                endpoint: '/survey',
                defaults: {
                    '/path/to/node': '[@]?',
                },
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected: /.+\?d%5B%2Fpath%2Fto%2Fnode%5D=%5B%40%5D%3F/,
                },
            },
            {
                endpoint: '/survey',
                defaults: {
                    '/path/to/node': 'one line\nanother line',
                },
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected:
                        /.+\?d%5B%2Fpath%2Fto%2Fnode%5D=one%20line%0Aanother%20line/,
                },
            },
            {
                endpoint: '/survey/all',
                defaults: {
                    '/path/to/node': 'one line\nanother line',
                },
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected:
                        /.+\?d%5B%2Fpath%2Fto%2Fnode%5D=one%20line%0Aanother%20line/,
                },
            },
            // /instance endpoint will ignore defaults
            {
                endpoint: '/instance',
                instance: true,
                instanceId: true,
                ret: true,
                defaults: {
                    '/path/to/node': '2,3',
                },
                method: 'post',
                status: 201,
                res: {
                    property: 'edit_url',
                    expected: /[^(d[)]+/,
                },
            },
            // TESTING THE PARENT_WINDOW_ORIGIN PARAMETER
            // parentWindowOrigin parameter is optional
            {
                endpoint: '/survey/iframe',
                parentWindowOrigin: null,
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected: /[^parentWindowOrigin[\]]+/,
                },
            },
            {
                endpoint: '/survey',
                parentWindowOrigin: '',
                method: 'post',
                status: 200,
                res: {
                    property: 'url',
                    expected: /[^parentWindowOrigin[\]]/,
                },
            },
            // same for GET
            {
                endpoint: '/survey/iframe',
                parentWindowOrigin: null,
                method: 'get',
                status: 200,
                res: {
                    property: 'iframe_url',
                    expected: /[^parentWindowOrigin[\]]+/,
                },
            },
            {
                endpoint: '/survey/iframe',
                parentWindowOrigin: '',
                method: 'get',
                status: 200,
                res: {
                    property: 'iframe_url',
                    expected: /[^parentWindowOrigin[\]]+/,
                },
            },
            // responses include the url-encoded parentWindowOrigin query parameter
            {
                endpoint: '/survey/iframe',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    property: 'iframe_url',
                    expected:
                        /.+\?.*parent_window_origin=http%3A%2F%2Fexample.com%2F/,
                },
            },
            {
                endpoint: '/survey/offline/iframe',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 405,
            },
            {
                endpoint: '/survey/preview/iframe',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    property: 'preview_iframe_url',
                    expected:
                        /.+\?.*parent_window_origin=http%3A%2F%2Fexample.com%2F/,
                },

                // ADD TESTS that compare allow_multiple=true and false and undefined
            },
            {
                endpoint: '/survey/single/iframe',
                parentWindowOrigin: 'http://example.com/',
                ret: true,
                method: 'post',
                status: 200,
                res: {
                    property: 'single_iframe_url',
                    expected:
                        /.+(&|\?)parent_window_origin=http%3A%2F%2Fexample.com%2F/,
                },
            },
            {
                endpoint: '/survey/all',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    property: 'iframe_url',
                    expected:
                        /.+\?.*parent_window_origin=http%3A%2F%2Fexample.com%2F/,
                },
            },
            {
                endpoint: '/instance/iframe',
                parentWindowOrigin: 'http://example.com/',
                instance: true,
                instanceId: true,
                method: 'post',
                status: 201,
                res: {
                    property: 'edit_url',
                    expected:
                        /.+\?.*parent_window_origin=http%3A%2F%2Fexample.com%2F/,
                },
            },
            // non-iframe endpoints will ignore the parentWindowOrigin parameter
            {
                endpoint: '/survey',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    expected: /[^parentWindowOrigin[\]]/,
                },
            },
            {
                endpoint: '/survey/preview',
                parentWindowOrigin: 'http://example.com/',
                method: 'post',
                status: 200,
                res: {
                    expected: /[^parentWindowOrigin[\]]/,
                },
            },
            {
                endpoint: '/instance',
                instance: true,
                instanceId: true,
                parentWindowOrigin: 'http://example.com/',
                ret: true,
                method: 'post',
                status: 201,
                res: {
                    property: 'edit_url',
                    expected: /[^parentWindowOrigin[\]]/,
                },
            },
            // TESTING THE THEME PARAMETER
            // theme parameter is optional
            {
                endpoint: '/survey',
                theme: 'gorgeous',
                method: 'post',
                status: 200,
            },
            // TESTING THE GO_TO PARAMETER
            // go_to parameter is optional
            {
                endpoint: '/survey/preview',
                method: 'post',
                goTo: '//node',
                status: 200,
                res: {
                    property: 'preview_url',
                    expected: /.+#%2F%2Fnode$/,
                },
            },
            {
                endpoint: '/survey/preview/iframe',
                method: 'post',
                goTo: '//node',
                status: 200,
                res: {
                    property: 'preview_iframe_url',
                    expected: /.+#%2F%2Fnode$/,
                },
            },
            {
                endpoint: '/instance/iframe',
                parentWindowOrigin: 'http://example.com/',
                instance: true,
                instanceId: true,
                ret: true,
                method: 'post',
                goTo: '//node',
                status: 201,
                res: {
                    property: 'edit_url',
                    expected: /#%2F%2Fnode$/,
                },
            },
            {
                endpoint: '/survey',
                method: 'post',
                goTo: '//node',
                status: 200,
                res: {
                    property: 'url',
                    expected: /[A-z0-9]{4,16}$/,
                },
            },
            // TESTING /SURVEYS/LIST RESPONSES THAT DEVIATE FROM V1
            // GET /surveys/list
            {
                endpoint: '/surveys/list',
                method: 'get',
                server: validServer,
                status: 200,
                res: {
                    property: 'forms',
                    expected:
                        /"offline_url":"http:\/\/.*\/[A-z0-9]{4,31}".*"form_id":"something"/,
                },
            },
            // POST /surveys/list (same)
            {
                endpoint: '/surveys/list',
                method: 'post',
                server: validServer,
                status: 200,
                res: {
                    property: 'forms',
                    expected:
                        /"offline_url":"http:\/\/.*\/[A-z0-9]{4,31}".*"form_id":"something"/,
                },
            },
            // GET /surveys/all)
            // To easily notice regressions.
            /* {
                endpoint: '/survey/all',
                method: 'get',
                auth: true,
                server: validServer,
                status: 200,
                res: {
                    expected: {
                        'url': 'http://127.0.0.1:58395/YYYp',
                        'single_url': 'http://127.0.0.1:58395/single/YYYp',
                        'single_once_url': 'http://127.0.0.1:58395/single/8fc769a601c9f283e8149e68ba4f5d09',
                        'offline_url': 'http://127.0.0.1:58395/x/YYYp',
                        'preview_url': 'http://127.0.0.1:58395/preview/YYYp',
                        'iframe_url': 'http://127.0.0.1:58395/i/YYYp',
                        'single_iframe_url': 'http://127.0.0.1:58395/single/i/YYYp',
                        'single_once_iframe_url': 'http://127.0.0.1:58395/single/i/8fc769a601c9f283e8149e68ba4f5d09',
                        'preview_iframe_url': 'http://127.0.0.1:58395/preview/i/YYYp',
                        'enketo_id': 'YYYp',
                        'code': 200
                    }
                }
            }, */
            // /survey/view
            {
                endpoint: '/survey/view',
                method: 'get',
                instance: false,
                status: 200,
                res: {
                    property: 'view_url',
                    expected: /\/view\/[a-fA-F0-9]{32,160}$/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/view/iframe',
                method: 'get',
                instance: false,
                status: 200,
                res: {
                    property: 'view_iframe_url',
                    expected: /\/view\/i\/[a-fA-F0-9]{32,160}$/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/view',
                method: 'post',
                instance: false,
                status: 200,
                res: {
                    property: 'view_url',
                    expected: /\/view\/[a-fA-F0-9]{32,160}$/,
                },
                offline: true,
            },
            {
                endpoint: '/survey/view/iframe',
                method: 'post',
                instance: false,
                status: 200,
                res: {
                    property: 'view_iframe_url',
                    expected: /\/view\/i\/[a-fA-F0-9]{32,160}$/,
                },
                offline: true,
            },
            // with goto
            {
                endpoint: '/survey/view',
                method: 'post',
                instance: false,
                goTo: '//node',
                status: 200,
                res: {
                    property: 'view_url',
                    expected: /\/view\/[a-fA-F0-9]{32,160}#%2F%2Fnode$/,
                },
                offline: true,
            },
            // survey/view/pdf
            {
                endpoint: '/survey/view/pdf',
                method: 'get',
                id: 'invalidID',
                instance: false,
                status: 404,
                offline: true,
            },
            {
                endpoint: '/survey/view/pdf',
                method: 'post',
                auth: true,
                margin: '10px',
                instance: false,
                status: 400,
                offline: true,
            },
            {
                endpoint: '/survey/view/pdf',
                method: 'post',
                margin: '10',
                instance: false,
                status: 400,
                offline: true,
                res: {
                    property: 'message',
                    expected: /Margin/,
                },
            },
            {
                endpoint: '/survey/view/pdf',
                method: 'post',
                margin: '1in',
                format: 'fake',
                instance: false,
                status: 400,
                offline: true,
                res: {
                    property: 'message',
                    expected: /Format/,
                },
            },
            {
                endpoint: '/survey/view/pdf',
                method: 'post',
                margin: '1.1cm',
                format: 'A4',
                landscape: 'yes',
                instance: false,
                status: 400,
                offline: true,
                res: {
                    property: 'message',
                    expected: /Landscape/,
                },
            },
            // instance/view
            {
                endpoint: '/instance/view',
                method: 'post',
                ret: true,
                status: 400,
                offline: true,
            },
            {
                endpoint: '/instance/view',
                method: 'post',
                instance: true,
                ret: true,
                status: 400,
                offline: true,
            },
            {
                endpoint: '/instance/view',
                method: 'post',
                instance_id: true,
                ret: true,
                status: 400,
                offline: true,
            },
            {
                endpoint: '/instance/view',
                method: 'post',
                instance: true,
                status: 201,
                instanceId: 'A',
                res: {
                    property: 'view_url',
                    expected: /\/view\/[a-fA-F0-9]{32,160}\?instance_id=A$/,
                },
                offline: true,
            },
            // /instance/view/pdf
            {
                endpoint: '/instance/view/pdf',
                method: 'post',
                instance: false,
                status: 400,
                offline: true,
                res: {
                    property: 'message',
                    expected: /Survey/,
                },
            },
            {
                endpoint: '/instance/view/pdf',
                method: 'post',
                auth: true,
                margin: '10px',
                instance: true,
                status: 400,
                offline: true,
                res: {
                    property: 'message',
                    expected: /Margin/,
                },
            },
            // return_url
            {
                endpoint: '/instance/view',
                method: 'post',
                instance: true,
                ret: true,
                status: 201,
                instanceId: 'A',
                res: {
                    property: 'view_url',
                    expected:
                        /\/view\/[a-fA-F0-9]{32,160}\?instance_id=A&return_url=/,
                },
                offline: true,
            },
            // check parent window origin
            {
                endpoint: '/instance/view/iframe',
                method: 'post',
                instance: true,
                status: 201,
                instanceId: 'A',
                parentWindowOrigin: 'http://example.com/',
                ret: true,
                res: {
                    property: 'view_iframe_url',
                    expected:
                        /\/view\/i\/[a-fA-F0-9]{32,160}\?instance_id=A&parent_window_origin=http%3A%2F%2Fexample.com%2F/,
                },
                offline: true,
            },
            {
                endpoint: '/instance/view',
                method: 'post',
                instance: true,
                goTo: '//node',
                status: 201,
                instanceId: 'A',
                res: {
                    property: 'view_url',
                    expected:
                        /\/view\/[a-fA-F0-9]{32,160}\?instance_id=A#%2F%2Fnode$/,
                },
                offline: true,
            },
            // check parent window origin
            {
                endpoint: '/instance/view/iframe',
                method: 'post',
                instance: true,
                goTo: '//node',
                parentWindowOrigin: 'http://example.com/',
                status: 201,
                instanceId: 'A',
                res: {
                    property: 'view_iframe_url',
                    expected:
                        /.+\?.*parent_window_origin=http%3A%2F%2Fexample.com%2F/,
                },
                offline: true,
            },
        ]
            .map((obj) => {
                obj.auth = typeof obj.auth === 'undefined' ? true : obj.auth;
                obj.version = version;

                return obj;
            })
            .forEach(testResponse);
    });

    describe('re-activating forms', () => {
        function test(version) {
            it('works if the quota allows it but returns 403 if quota is insufficient', () => {
                const endpoint = `/api/v${version}/survey`;
                const server = 'https://example.org/enketo';
                const linkedServer = app.get('linked form and data server');
                linkedServer['server url'] = 'example.org/enketo';
                linkedServer['api key'] = 'abc';
                linkedServer.quota = 1;
                app.set('linked form and data server', linkedServer);
                app.set('account lib', '../path/to/something');
                // TODO: teardown?

                return request(app)
                    .post(endpoint)
                    .set(validAuth)
                    .send({
                        server_url: server,
                        form_id: validFormId,
                    })
                    .expect(201)
                    .then(() =>
                        request(app)
                            .delete(endpoint)
                            .set(validAuth)
                            .send({
                                server_url: server,
                                form_id: validFormId,
                            })
                            .expect(204)
                    )
                    .then(() =>
                        request(app)
                            .post(endpoint)
                            .set(validAuth)
                            .send({
                                server_url: server,
                                form_id: `${validFormId}a`,
                            })
                            .expect(201)
                    )
                    .then(() =>
                        request(app)
                            .post(endpoint)
                            .set(validAuth)
                            .send({
                                server_url: server,
                                form_id: validFormId,
                            })
                            .expect(403)
                    )
                    .then(() =>
                        request(app)
                            .post(endpoint)
                            .set(validAuth)
                            .send({
                                server_url: server,
                                form_id: `${validFormId}b`,
                            })
                            .expect(403)
                    );
            });
        }

        test('1');
        test('2');
    });
});
