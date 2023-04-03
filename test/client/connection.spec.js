/**
 * @module connection.spec.js
 * @description Tests for online mode network requests and related business logic.
 * @see {LastSavedFeatureSpec}
 */

import { transform } from 'enketo-transformer/web';
import utils from '../../public/js/src/module/utils';
import connection from '../../public/js/src/module/connection';
import settings from '../../public/js/src/module/settings';
import store from '../../public/js/src/module/store';

/**
 * @typedef {import('../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef SinonSandbox { import('sinon').SinonSandbox }
 */

/**
 * @typedef StubbedRequest
 * @property { string } url
 * @property { window.RequestInit } init
 */

describe('Connection', () => {
    const enketoId = 'surveyA';
    const instanceId = 'recordA';

    /** @type { SinonSandbox } */
    let sandbox;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();

        sandbox.stub(settings, 'enketoId').get(() => enketoId);

        await store.init();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Uploading records', () => {
        /** @type { EnketoRecord } */
        let record;

        /** @type { Survey } */
        let survey;

        /** @type { StubbedRequest[] } */
        let requests;

        beforeEach((done) => {
            requests = [];

            record = {
                enketoId,
                instanceId,
                name: 'name A',
                xml: '<model><something>a</something></model>',
                files: [],
            };

            survey = { enketoId };

            sandbox.stub(window, 'fetch').callsFake((url, init) => {
                requests.push({ url, init });

                return Promise.resolve({
                    ok: true,
                    status: 201,
                    text() {
                        return Promise.resolve(`
                            <OpenRosaResponse xmlns="http://openrosa.org/http/response">
                                <message nature="submit_success">Success</message>
                            </OpenRosaResponse>
                        `);
                    },
                });
            });

            store.record.removeAll().then(() => done(), done);
        });

        it('uploads a record', (done) => {
            connection
                .uploadRecord(survey, record)
                .then((result) => {
                    expect(result.status).to.equal(201);
                    expect(requests.length).to.equal(1);

                    const request = requests[0];
                    const body = Object.fromEntries(
                        request.init.body.entries()
                    );
                    const instanceId =
                        request.init.headers['X-OpenRosa-Instance-Id'];
                    const submission = body.xml_submission_file;

                    expect(instanceId).to.equal(record.instanceId);
                    expect(submission instanceof File).to.equal(true);

                    return new Response(submission).text();
                })
                .then((submission) => {
                    expect(submission).to.equal(record.xml);
                })
                .then(done, done);
        });
    });

    describe('Surveys / getFormParts', () => {
        // These fixtures were based on a form used to validate transformation of spaces
        // in `jr:` URLs, and a regression introduced during last-saved work related to
        // populating binary defaults in online mode. While most of these tests are not
        // related to that regression, the fixtures were suitable to backfill more
        // thorough tests for the rest of `getFormParts` functionality.

        const externalInstanceId = 'external-inst';
        const externalInstanceURL = 'https://example.com/external.xml';
        const externalInstanceXML = '<a/>';

        const form = /* html */ `
            <form autocomplete="off" novalidate="novalidate" class="or clearfix" dir="ltr" data-form-id="media-spaces">
                <!--This form was created by transforming an ODK/OpenRosa-flavored (X)Form using an XSL stylesheet created by Enketo LLC.--><section class="form-logo"></section><h3 dir="auto" id="form-title">media-spaces</h3><select id="form-languages" style="display:none;" data-default-lang="default"><option value="default" data-dir="ltr">default</option> </select>
                <label class="question non-select "><span lang="" class="question-label active">Last saved...: <span class="or-output" data-value="instance('last-saved')/image-default/item"> </span></span><input type="text" name="/image-default/item" data-type-xml="string" data-setvalue="instance('last-saved')/image-default/item" data-event="odk-instance-first-load"></label>
                <label class="question non-select or-appearance-annotate "><span lang="" class="question-label active">annotate question with default image</span><input type="file" name="/image-default/ann" data-type-xml="binary" accept="image/*"></label>
                <label class="question non-select or-appearance-annotate "><span lang="" class="question-label active">annotate question with default image</span><input type="file" name="/image-default/dra" data-type-xml="binary" accept="image/*"></label>
                <label class="question non-select or-appearance-draw "><span lang="" class="question-label active">drawing question with default image</span><input type="file" name="/image-default/dra" data-type-xml="binary" accept="image/*"></label>
                <label class="question non-select "><span lang="default" class="question-label active" data-itext-id="/image-default/happy:label">label with image</span><img lang="default" class="active" src="/-/media/get/http/localhost:8989/v1/projects/2/forms/media-spaces/attachments/happy2.png" data-itext-id="/image-default/happy:label" alt="image"><input type="text" name="/image-default/happy" data-type-xml="string"></label>
                <label class="question non-select "><span lang="default" class="question-label active" data-itext-id="/image-default/unhappy:label">label with image</span><img lang="default" class="active" src="jr://images/un%20happy%202%20v2.png" data-itext-id="/image-default/unhappy:label" alt="image"><input type="text" name="/image-default/unhappy" data-type-xml="string"></label>
                <fieldset id="or-preload-items" style="display:none;"><label class="calculation non-select "><input type="hidden" name="/image-default/meta/instanceID" data-preload="uid" data-preload-params="" data-type-xml="string"></label></fieldset><fieldset id="or-setvalue-items" style="display:none;"></fieldset>
            </form>
        `;

        const model = /* xml */ `
            <model>
                <instance>
                    <image-default xmlns:jr="http://openrosa.org/javarosa" xmlns:odk="http://www.opendatakit.org/xforms" xmlns:orx="http://openrosa.org/xforms" id="media-spaces" version="8">
                        <item>initial</item>
                        <ann src="/-/media/get/http/localhost:8989/v1/projects/2/forms/media-spaces/attachments/un%20happy%20v2.png">jr://images/un happy v2.png</ann>
                        <dra src="/-/media/get/http/localhost:8989/v1/projects/2/forms/media-spaces/attachments/indifferent.png">jr://images/indifferent.png</dra>
                        <happy/>
                        <unhappy/>
                        <meta>
                            <instanceID/>
                        </meta>
                    </image-default>
                </instance>
                <instance id="last-saved" src="jr://instance/last-saved"/>
                <instance id="${externalInstanceId}" src="${externalInstanceURL}" />
            </model>
        `;

        const hash =
            'md5:0aef088ebda239d644130e6bf2255bcf-311fab58efa4fa65318450bf93b70214-7b69544085c4c49cbb77be3890a23995---1';

        const basePath = '-';

        const xformUrl = '/base/test/fixtures/connection/preview.xml';

        /** @type {string} */
        let expectedURL;

        /** @type {string} */
        let theme;

        /** @type {boolean} */
        let resolveExternalInstance;

        beforeEach(async () => {
            if (!Object.prototype.hasOwnProperty.call(settings, 'basePath')) {
                settings.basePath = undefined;
            }

            sandbox.stub(settings, 'basePath').get(() => basePath);

            theme = '';

            expectedURL = `${basePath}/transform/xform/${enketoId}`;

            resolveExternalInstance = true;

            const nativeFetch = window.fetch;

            sandbox.stub(window, 'fetch').callsFake(async (url, options) => {
                if (url === xformUrl) {
                    return nativeFetch(url, options);
                }

                if (expectedURL === xformUrl) {
                    return {
                        ok: false,
                        status: 500,
                    };
                }

                if (url === externalInstanceURL) {
                    expect(options).to.equal(undefined);

                    if (resolveExternalInstance) {
                        return {
                            ok: true,
                            status: 200,
                            headers: {
                                get(header) {
                                    if (header === 'Content-Type') {
                                        return 'text/xml';
                                    }
                                },
                            },
                            text() {
                                return Promise.resolve(externalInstanceXML);
                            },
                        };
                    }
                    return {
                        ok: false,
                        status: 404,
                    };
                }

                try {
                    expect(url).to.equal(expectedURL);
                    expect(options).to.deep.equal({
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: '',
                    });
                } catch (error) {
                    return {
                        ok: false,
                        status: 500,
                        json() {
                            return Promise.resolve(error.toJSON());
                        },
                    };
                }

                return {
                    ok: true,
                    status: 200,
                    json() {
                        return Promise.resolve({
                            form,
                            hash,
                            languageMap: {},
                            model,
                            theme,
                        });
                    },
                };
            });
        });

        // Note: last-saved and encryption functionality are tested under ./feature/*,
        // so are not redundantly tested here

        it('requests the provided xformUrl', async () => {
            expectedURL = xformUrl;

            const xformResponse = await fetch(xformUrl);
            const xform = await xformResponse.text();
            const expected = await transform({ xform });

            const actual = await connection.getFormParts({
                xformUrl,
                isPreview: true,
            });

            expect(typeof actual.form).to.equal('string');
            expect(typeof actual.model).to.equal('string');
            expect(actual.form).to.deep.equal(expected.form);
            expect(actual.model).to.deep.equal(expected.model);
        });

        it('fails to load XForms by URL outside of preview mode', async () => {
            expectedURL = xformUrl;

            /** @type {Error | null} */
            let caught = null;

            try {
                await connection.getFormParts({
                    enketoId,
                    xformUrl,
                });
            } catch (error) {
                caught = error;
            }

            expect(caught).to.be.an('error');
        });

        it('populates the enketoId and theme passed in', async () => {
            theme = 'any';

            const survey = await connection.getFormParts({
                enketoId,
                theme,
            });

            expect(survey.enketoId).to.equal(enketoId);
            expect(survey.theme).to.equal(theme);
        });

        it('falls back to the theme specified in the form', async () => {
            theme = 'form';

            sandbox.stub(utils, 'getThemeFromFormStr').callsFake((formStr) => {
                if (formStr === form) {
                    return theme;
                }
            });

            const survey = await connection.getFormParts({
                enketoId,
            });

            expect(survey.enketoId).to.equal(enketoId);
            expect(survey.theme).to.equal(theme);
        });

        it('falls back to the configured default theme', async () => {
            theme = 'configured';

            if (
                !Object.prototype.hasOwnProperty.call(settings, 'defaultTheme')
            ) {
                settings.defaultTheme = undefined;
            }

            sandbox.stub(settings, 'defaultTheme').get(() => theme);

            const survey = await connection.getFormParts({
                enketoId,
            });

            expect(survey.enketoId).to.equal(enketoId);
            expect(survey.theme).to.equal(theme);
        });

        // This tests a fix for a regression between the initial introduction of last-saved
        // which incorrectly cached forms in online-mode, and the refactor of that feature
        // which removed that caching. Previously, `getFormParts` was converting binary
        // defaults with relative paths in `survey.model` to absolute URLs to satisfy
        // behavior in `form-cache.js`. When caching in online mode was removed, this caused
        // binary defaults to be broken again.
        it('does not change the model', async () => {
            const survey = await connection.getFormParts({
                enketoId,
            });

            expect(survey.model).to.equal(model);
        });

        it('populates external data from external secondary instances', async () => {
            const { externalData } = await connection.getFormParts({
                enketoId,
            });

            expect(externalData.length).to.equal(2);

            const [lastSavedInstance, externalInstance] = externalData;

            // Sanity check
            expect(lastSavedInstance.src).to.equal('jr://instance/last-saved');

            expect(externalInstance.id).to.equal(externalInstanceId);
            expect(externalInstance.src).to.equal(externalInstanceURL);

            const { xml } = externalInstance;
            const xmlString = new XMLSerializer().serializeToString(xml);

            expect(xml instanceof XMLDocument).to.equal(true);
            expect(xmlString).to.equal(externalInstanceXML);
        });

        it('fails to load when external data is missing', async () => {
            resolveExternalInstance = false;

            /** @type {Error | null} */
            let caught = null;

            try {
                await connection.getFormParts({
                    enketoId,
                });
            } catch (error) {
                caught = error;
            }

            expect(caught instanceof Error).to.equal(true);
        });

        it('loads in preview mode when external data is missing', async () => {
            resolveExternalInstance = false;

            const survey = await connection.getFormParts({
                enketoId,
                isPreview: true,
            });

            expect(survey.externalData[1]).to.deep.equal(undefined);
        });
    });
});
