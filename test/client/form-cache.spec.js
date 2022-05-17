import formCache from '../../public/js/src/module/form-cache';
import connection from '../../public/js/src/module/connection';
import store from '../../public/js/src/module/store';
import { getLastSavedRecord } from '../../public/js/src/module/last-saved';

/**
 * @typedef { import('sinon').SinonSandbox } SinonSandbox
 */

/**
 * @typedef { import('sinon').SinonFakeTimers } SinonFakeTimers
 */

/**
 * @typedef { import('sinon').SinonStub } SinonStub
 */

/**
 * @typedef {import('../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyExternalData} SurveyExternalData
 */

/**
 * @typedef GetFormPartsStubResult
 * @property { string } enketoId
 * @property { string } form
 * @property { string } model
 * @property { string } hash
 */

const parser = new DOMParser();

const url1 = '/path/to/source.png';
const form1 = `<form class="or"><img src="${url1}"/></form>`;
const defaultInstanceData =
    '<data id="modelA"><item>initial</item><meta><instanceID/></meta></data>';
const model1 = `<model><instance>${defaultInstanceData}</instance><instance id="last-saved" src="jr://instance/last-saved"/></model>`;
const hash1 = '12345';

describe('Client Form Cache', () => {
    /** @type {Survey} */
    let survey;

    /** @type {SurveyExternalData} */
    let lastSavedExternalData;

    /** @type {SinonSandbox} */
    let sandbox;

    /** @type {SinonStub} */
    let getFormPartsSpy;

    /** @type {GetFormPartsStubResult} */
    let getFormPartsStubResult;

    /** @type {SinonStub} */
    let getFileSpy;

    /** @type {SinonFakeTimers} */
    let timers;

    beforeEach((done) => {
        const formElement = document.createElement('form');

        formElement.className = 'or';
        document.body.appendChild(formElement);

        survey = {};
        sandbox = sinon.createSandbox();

        // Prevent calls to `_updateCache` after tests complete/stubs are restored
        timers = sandbox.useFakeTimers();

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

        getFormPartsSpy = sandbox
            .stub(connection, 'getFormParts')
            .callsFake((survey) =>
                Promise.resolve(survey.enketoId)
                    .then((enketoId) => {
                        if (enketoId != null) {
                            return getLastSavedRecord(survey.enketoId);
                        }
                    })
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

                        return formParts;
                    })
            );

        getFileSpy = sandbox.stub(connection, 'getMediaFile').callsFake((url) =>
            Promise.resolve({
                url,
                item: new Blob(['babdf'], {
                    type: 'image/png',
                }),
            })
        );

        store.init().then(done, done);
    });

    afterEach((done) => {
        timers.clearTimeout();
        timers.clearInterval();
        timers.restore();
        sandbox.restore();

        document.body.removeChild(document.querySelector('form.or'));

        store.survey.removeAll().then(done, done);
    });

    it('is loaded', () => {
        expect(formCache).to.be.an('object');
    });

    describe('in empty state', () => {
        it('will call connection.getFormParts to obtain the form parts', (done) => {
            survey.enketoId = '10';
            formCache
                .init(survey)
                .then(() => {
                    expect(getFormPartsSpy).to.have.been.calledWith(survey);
                })
                .then(done, done);
        });

        it('will call connection.getMediaFile to obtain form resources', (done) => {
            survey.enketoId = '20';
            formCache
                .init(survey)
                .then((result) => {
                    const currentForm = document.querySelector('form.or');
                    const form = document
                        .createRange()
                        .createContextualFragment(result.form);

                    currentForm.parentNode.replaceChild(form, currentForm);

                    return formCache.updateMedia(result);
                })
                .then(() => {
                    expect(getFileSpy).to.have.been.calledWith(url1);
                })
                .then(done, done);
        });

        it('will populate the cache upon initialization', (done) => {
            survey.enketoId = '30';
            formCache
                .get(survey)
                .then((result) => {
                    expect(result).to.equal(undefined);

                    return formCache.init(survey);
                })
                .then(() =>
                    // we could also leave this out as formCache.init will return the survey object
                    formCache.get(survey)
                )
                .then((result) => {
                    expect(result.model).to.equal(model1);
                    expect(result.hash).to.equal(hash1);
                    expect(result.enketoId).to.equal(survey.enketoId);
                })
                .then(done, done);
        });

        it('will empty src attributes and copy the original value to a data-offline-src attribute ', (done) => {
            survey.enketoId = '40';
            formCache
                .init(survey)
                .then((result) => {
                    expect(result.form)
                        .to.contain('src=""')
                        .and.to.contain(`data-offline-src="${url1}"`);
                })
                .then(done, done);
        });
    });

    describe('form cache updates', () => {
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

        it('updates the survey when the form cache is out of date', (done) => {
            Object.assign(survey, {
                enketoId: '60',
                hash: '1234',
                model: model1,
            });

            const originalSurvey = { ...survey };
            const update = {
                ...survey,
                hash: '123456',
                model: `${model1}<!-- updated -->`,
            };

            formCache
                .init(survey)
                .then(() => updateSurvey(update))
                .then((result) => {
                    Object.entries(originalSurvey).forEach(([key, value]) => {
                        if (key in update) {
                            expect(result[key]).to.equal(update[key]);
                        } else {
                            expect(result[key]).to.equal(value);
                        }
                    });

                    expect(result.hash).to.equal(update.hash);
                    expect(result.model).to.equal(update.model);
                })
                .then(done, done);
        });

        describe('form media (only) cache updates', () => {
            let resultSurvey;

            /** @type {SinonSpy} */
            let storeSurveyUpdateSpy;

            beforeEach((done) => {
                getFileSpy.restore();
                getFileSpy = sandbox
                    .stub(connection, 'getMediaFile')
                    .callsFake(() => Promise.reject(new Error('Fail!')));

                storeSurveyUpdateSpy = sandbox.spy(store.survey, 'update');

                survey.enketoId = '200';
                formCache
                    .init(survey)
                    .then((result) => {
                        const currentForm = document.querySelector('form.or');
                        const form = document
                            .createRange()
                            .createContextualFragment(result.form);

                        currentForm.parentNode.replaceChild(form, currentForm);

                        resultSurvey = result;
                        return formCache.updateMedia(result);
                    })
                    .then(() => {
                        getFileSpy.restore();
                        getFileSpy = sandbox
                            .stub(connection, 'getMediaFile')
                            .callsFake((url) =>
                                Promise.resolve({
                                    url,
                                    item: new Blob(['babdf'], {
                                        type: 'image/png',
                                    }),
                                })
                            );
                    })
                    .then(done, done);
            });

            afterEach(() => {
                storeSurveyUpdateSpy.restore();
                getFileSpy.restore();
            });

            it('will re-attempt to download failed media files (at next load) and update the cache', (done) => {
                expect(getFileSpy).to.not.have.been.called;
                expect(storeSurveyUpdateSpy).to.not.have.been.called;

                // simulate re-opening a cached form by calling updateMedia again
                formCache
                    .updateMedia(resultSurvey)
                    .then(() => {
                        // another attempt is made to download the previously-failed media file
                        expect(getFileSpy).to.have.been.calledOnce;
                        expect(getFileSpy).to.have.been.calledWith(url1);
                        // and to cache it when successful
                        expect(storeSurveyUpdateSpy).to.have.been.calledOnce;
                    })
                    .then(done, done);
            });

            it('will not re-attempt to download and update again after the cache is complete', (done) => {
                // simulate re-opening a cached form by calling updateMedia again
                formCache
                    .updateMedia(resultSurvey)
                    .then(formCache.updateMedia)
                    .then(formCache.updateMedia)
                    .then(() => {
                        // Despite 3 calls the media file was only downloaded once,
                        // and the cache was updated only once.
                        expect(getFileSpy).to.have.been.calledOnce;
                        expect(storeSurveyUpdateSpy).to.have.been.calledOnce;
                    })
                    .then(done, done);
            });
        });
    });
});
