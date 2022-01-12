import i18next from 'i18next';
import lodash from 'lodash';
import calcModule from 'enketo-core/src/js/calculate';
import { FormModel } from 'enketo-core/src/js/form-model';
import preloadModule from 'enketo-core/src/js/preload';
import applicationCache from '../../public/js/src/module/application-cache';
import connection from '../../public/js/src/module/connection';
import controller from '../../public/js/src/module/controller-webform';
import events from '../../public/js/src/module/event';
import formCache from '../../public/js/src/module/form-cache';
import gui from '../../public/js/src/module/gui';
import settings from '../../public/js/src/module/settings';
import store from '../../public/js/src/module/store';
import * as enketoWebform from '../../public/js/src/enketo-webform';
import * as enketoWebformEdit from '../../public/js/src/enketo-webform-edit';
import * as enketoWebformView from '../../public/js/src/enketo-webform-view';

/**
 * @typedef {import('sinon').SinonStub<Args, Return>} Stub
 * @template Args
 * @template Return
 */

/**
 * @typedef {import('sinon').SinonSandbox} Sandbox
 */

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef {import('../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/** @type {Record<string, any> | null} */
let webformPrivate = null;

describe('Enketo webform app entrypoints', () => {
    /**
     * @typedef MockGetter
     * @property {string} description
     * @property {'get'} stubMethod
     * @property {object} object
     * @property {PropertyKey} key
     * @property {any} propertyValue
     */

    /**
     * @typedef ExpectSetter
     * @property {string} description
     * @property {'set'} stubMethod
     * @property {object} object
     * @property {PropertyKey} key
     * @property {any} expectedValue
     */

    /**
     * @typedef MockExpectedCall
     * @property {string} description
     * @property {'callsFake'} stubMethod
     * @property {object} object
     * @property {PropertyKey} key
     * @property {any[]} expectedArgs
     * @property {any} returnValue
     */

    /**
     * @typedef MockErrorCondition
     * @property {string} description
     * @property {'throws'} stubMethod
     * @property {object} object
     * @property {PropertyKey} key
     * @property {Error | Promise<Error>} errorCondition
     */

    /** @typedef {MockGetter | ExpectSetter | MockExpectedCall | MockErrorCondition} InitStepOptions */

    /** @typedef {InitStepOptions['stubMethod']} InitStepStubMethod */

    /**
     * @typedef Resolvable
     * @property {() => Promise<void>} resolveStep
     * @property {(error: Error) => Promise<void>} rejectStep
     */

    /**
     * @typedef {InitStepOptions & Resolvable} InitStep
     */

    /**
     * @typedef PreparedStepCache
     * @property {Stub<any, any>} stub
     * @property {InitStep[]} queue
     */

    /** @type {Map<object, Record<PropertyKey, PreparedStepCache>>} */
    let preparedStepsCache;

    /** @type {InitStep[]} */
    let performedSteps;

    class ParameterPredicate {
        constructor(predicate) {
            this.predicate = predicate;
        }

        check(actual) {
            expect(actual).to.satisfy(this.predicate);
        }
    }

    /**
     * Creates a predicate to determine whether a value is of the
     * specified type.
     *
     * @param {string} expected
     */
    const expectTypeof = (expected) => (
        new ParameterPredicate((actual => typeof actual === expected))
    );

    const expectFunction = expectTypeof('function');
    const expectObject = expectTypeof('object');

    /**
     * Creates a predicate to determine that a callback was provided,
     * and call it when provided.
     */
    const expectCallback = new ParameterPredicate((callback) => {
        if (typeof callback === 'function') {
            callback();

            return true;
        }

        return false;
    });

    /**
     * Creates a predicate to determine if a translator URL was provided.
     *
     * @param {string} expected
     */
    const expectLanguage = (expected) => (
        new ParameterPredicate(lang => lang.includes(`/${expected}/`))
    );

    /**
     * @param {object} object
     * @param {PropertyKey} key
     * @return {PreparedStepCache}
     */
    const getPreparedStep = (object, key) => {
        let objectCache = preparedStepsCache.get(object);

        if (objectCache == null) {
            objectCache = {};

            preparedStepsCache.set(object, objectCache);
        }

        let cache = objectCache[key];

        if (cache == null) {
            cache = {
                queue: [],
                stub: sandbox.stub(object, key),
            };

            Object.assign(objectCache, {
                [key]: cache,
            });
        }

        return cache;
    };

    const debugLog = (...args) => {
        if (DEBUG) {
            console.log(...args);
        }
    };

    /**
     * Prepares a mocked initialization step which is expected to be performed.
     * Once performed, the step is appeneded to `performedSteps` so that each
     * step, and its order, can be verified.
     *
     * Behavior based on `options.stubMethod`:
     *
     * - 'get': the provided `options.propertyValue` is returned.
     * - 'set': actual set value is compared to the `options.expectedValue`.
     * - 'callsFake': actual arguments are compared to `options.expectedArgs`,
     *   and `options.returnValue` is returned.
     *
     * `options.expectedArgs` items may be:
     *
     * - an instance of `ParameterPredicate`: its predicate will be performed
     *   against the corresponding argument.
     * - any other value: will be compared for deep equality.
     *
     * @param {InitStepOptions} options
     * @return {InitStep}
     */
    const prepareInitStep = (options) => {
        const {
            description,
            stubMethod,
            object,
            key,
        } = options;

        let { queue, stub } = getPreparedStep(object, key);

        debugLog('Initializing:', description);

        const initStep = {
            options,
            resolveStep(...args) {
                const {
                    description,
                    stubMethod,
                    propertyValue,
                    expectedValue,
                    expectedArgs,
                    returnValue,
                    errorCondition,
                } = this.options;

                debugLog('Performing:', description);

                performedSteps.push(this);

                if (stubMethod === 'get') {
                    return propertyValue;
                }

                if (stubMethod === 'set') {
                    expect(args.length).to.equal(1);

                    if (expectedValue instanceof ParameterPredicate) {
                        return expectedValue.check(args[0]);
                    }
                    else {
                        return expect(args[0]).to.deep.equal(expectedValue);
                    }
                }

                if (stubMethod === 'throws') {
                    return errorCondition;
                }

                expect(args.length).to.equal(expectedArgs.length);

                for (const [ index, arg ] of args.entries()) {
                    const expected = expectedArgs[index];

                    if (expected instanceof ParameterPredicate) {
                        expected.check(arg);
                    } else {
                        expect(arg).to.deep.equal(expected);
                    }
                }

                return returnValue;
            },
        };

        queue.push(initStep);

        stub[stubMethod]((...args) => {
            let step = queue.shift();

            expect(step).not.to.be.undefined;

            return step.resolveStep(...args);
        });

        debugLog('Initialized:', description);

        return initStep;
    };

    /** @type {string} */
    let enketoId;

    /** @type {Record<string, string>} */
    let defaults;

    /** @type {Sandbox} */
    let sandbox;

    /** @type {import('sinon').SinonFakeTimers} */
    let timers;

    /** @type {HTMLElement} */
    let mainElement = null;

    /** @type {HTMLElement} */
    let loaderElement = null;

    /** @type {HTMLElement} */
    let formHeaderElement;

    /** @type {HTMLButtonElement} */
    let flushButton;

    before(async () => {
        const domParser = new DOMParser();
        const formDOM = domParser.parseFromString(`
            <div class="main">
                <div class="paper">
                    <div class="form-header"></div>
                </div>
            </div>
            <div class="main-loader"></div>
        `, 'text/html');

        mainElement = formDOM.documentElement.querySelector('.main');
        loaderElement = formDOM.documentElement.querySelector('.main-loader');
        formHeaderElement = formDOM.documentElement.querySelector('.form-header');

        document.body.append(mainElement, loaderElement);

        webformPrivate = enketoWebform._PRIVATE_TEST_ONLY_;
    });

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        timers = sinon.useFakeTimers();

        defaults = {};

        performedSteps = [];
        preparedStepsCache = new Map();

        enketoId = 'surveyA';
        defaults = {};

        flushButton = document.createElement('button');
    });

    afterEach(() => {
        sandbox.restore();
        timers.clearInterval();
        timers.clearTimeout();
        timers.restore();
    });

    after(() => {
        if (mainElement != null) {
            document.body.removeChild(mainElement);
        }
        if (loaderElement != null) {
            document.body.removeChild(loaderElement);
        }
    });

    describe('enketo-webform.js initialization steps', () => {
        /** @type {Partial<Survey>} */
        let surveyInitData;

        beforeEach(() => {
            surveyInitData = {
                get enketoId() { return enketoId; },
                get defaults() { return defaults; },
            };

            sandbox.stub(lodash, 'memoize').callsFake(fn => fn);
        });

        describe('offline', () => {
            beforeEach(() => {
                sandbox.stub(settings, 'offline').get(() => true);
            });

            it('initializes offline forms', async () => {
                enketoId = 'offlineA';

                const initOptions = {
                    ...surveyInitData,
                    isOffline: true,
                };

                const offlineSurvey = {
                    ...surveyInitData,

                    externalData: [],
                    form: '<form></form>',
                    model: '<a/>',
                    theme: 'kobo',
                };

                const maxSize = 8675309;

                const maxSizeSurvey = {
                    ...offlineSurvey,

                    maxSize,
                };

                const controllerInitResult = {
                    languages: [ 'ar', 'fa' ],
                };

                const updatedMediaSurvey = {
                    ...maxSizeSurvey,
                    media: [],
                };

                const formElement = document.createElement('form');

                sandbox.stub(i18next, 'use').returns(i18next);

                const steps = [
                    prepareInitStep({
                        description: 'Setting emergency handlers: ensure an element is returned for flushBtn',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.side-slider__advanced__button.flush-db' ],
                        returnValue: flushButton,
                    }),
                    prepareInitStep({
                        description: 'Offline-capable event listener',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'addEventListener',
                        expectedArgs: [ events.OfflineLaunchCapable().type, expectFunction ],
                    }),
                    prepareInitStep({
                        description: 'Application update event listener',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'addEventListener',
                        expectedArgs: [ events.ApplicationUpdated().type, expectFunction ],
                    }),
                    prepareInitStep({
                        description: 'Initialize application cache',
                        stubMethod: 'callsFake',
                        object: applicationCache,
                        key: 'init',
                        expectedArgs: [ { enketoId } ],
                        returnValue: Promise.resolve({ enketoId }),
                    }),
                    prepareInitStep({
                        description: 'Translator: initialize i18next',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 'init',
                        expectedArgs: [ expectObject, expectCallback ],
                    }),
                    prepareInitStep({
                        description: 'Initialize form cache',
                        stubMethod: 'callsFake',
                        object: formCache,
                        key: 'init',
                        expectedArgs: [ { enketoId } ],
                        returnValue: Promise.resolve(offlineSurvey),
                    }),

                    // While there is currently a truthiness check on the query result,
                    // there is a subsequent access outside that check.
                    prepareInitStep({
                        description: 'Add branding: Ensure a brand image query resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ webformPrivate.BRAND_IMAGE_SELECTOR ],
                        returnValue: document.createElement('img'),
                    }),

                    prepareInitStep({
                        description: 'Swap theme',
                        stubMethod: 'callsFake',
                        object: gui,
                        key: 'swapTheme',
                        expectedArgs: [ offlineSurvey ],
                        returnValue: Promise.resolve(offlineSurvey),
                    }),
                    prepareInitStep({
                        description: 'Get/update max submission size',
                        stubMethod: 'callsFake',
                        object: formCache,
                        key: 'updateMaxSubmissionSize',
                        expectedArgs: [ offlineSurvey ],
                        returnValue: Promise.resolve(maxSizeSurvey),
                    }),
                    prepareInitStep({
                        description: 'Assign max submission size to settings',
                        stubMethod: 'set',
                        object: settings,
                        key: 'maxSize',
                        expectedValue: maxSize,
                    }),
                    prepareInitStep({
                        description: 'Ensure a query for the form\'s header resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.main > .paper > .form-header' ],
                        returnValue: formHeaderElement,
                    }),
                    prepareInitStep({
                        description: 'Ensure a query for the page\'s form resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ 'form.or' ],
                        returnValue: formElement,
                    }),
                    prepareInitStep({
                        description: 'Initialize controller-webform',
                        stubMethod: 'callsFake',
                        object: controller,
                        key: 'init',
                        expectedArgs: [
                            formElement,
                            {
                                modelStr: maxSizeSurvey.model,
                                instanceStr: null,
                                external: maxSizeSurvey.externalData,
                                survey: maxSizeSurvey,
                            },
                        ],
                        returnValue: Promise.resolve(controllerInitResult),
                    }),
                    prepareInitStep({
                        description: 'Get page title',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ 'head > title' ],
                        returnValue: document.createElement('title'),
                    }),
                    prepareInitStep({
                        description: 'Load Arabic translation',
                        stubMethod: 'callsFake',
                        object: globalThis,
                        key: 'fetch',
                        expectedArgs: [ expectLanguage('ar') ],
                        returnValue: Promise.resolve(),
                    }),
                    prepareInitStep({
                        description: 'Load Farsi translation',
                        stubMethod: 'callsFake',
                        object: globalThis,
                        key: 'fetch',
                        expectedArgs: [ expectLanguage('fa') ],
                        returnValue: Promise.resolve(),
                    }),
                    prepareInitStep({
                        description: 'Update form cache media',
                        stubMethod: 'callsFake',
                        object: formCache,
                        key: 'updateMedia',
                        expectedArgs: [ maxSizeSurvey ],
                        returnValue: Promise.resolve(updatedMediaSurvey),
                    }),
                    prepareInitStep({
                        description: 'Set cache event handlers',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'addEventListener',
                        expectedArgs: [ events.FormUpdated().type, expectTypeof('function') ],
                    }),
                ];

                /** @type {Promise} */
                let offlineInitialization = enketoWebform.initApp(initOptions);

                await offlineInitialization;

                for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                    const step = performedSteps.find(performedStep => {
                        return performedStep === expectedStep;
                    });
                    const index = performedSteps.indexOf(expectedStep);

                    expect(step).to.equal(expectedStep);
                    expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                        .to.equal(expectedIndex);
                }

                expect(performedSteps.length).to.equal(steps.length);
            });

            it('reports offline initialization failure (synchronous)', async () => {
                enketoId = 'offlineA';

                const initOptions = {
                    ...surveyInitData,
                    isOffline: true,
                };

                const error = new Error('Something failed in the DOM.');
                const translatedErrorAdvice = 'Translated error advice';

                const steps = [
                    prepareInitStep({
                        description: 'Setting emergency handlers: ensure an element is returned for flushBtn',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.side-slider__advanced__button.flush-db' ],
                        returnValue: flushButton,
                    }),
                    prepareInitStep({
                        description: 'Offline-capable event listener',
                        stubMethod: 'throws',
                        object: document,
                        key: 'addEventListener',
                        errorCondition: error,
                    }),
                    prepareInitStep({
                        description: 'Reporting failure: ensure query for loader returns element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.main-loader' ],
                        returnValue: loaderElement,
                    }),
                    prepareInitStep({
                        description: 'Set error class',
                        stubMethod: 'callsFake',
                        object: loaderElement.classList,
                        key: 'add',
                        expectedArgs: [ webformPrivate.LOAD_ERROR_CLASS ],
                    }),
                    prepareInitStep({
                        description: 'Translate error advice',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 't',
                        expectedArgs: [ 'alert.loaderror.entryadvice', undefined ],
                        returnValue: translatedErrorAdvice,
                    }),
                    prepareInitStep({
                        description: 'Alert load errors',
                        stubMethod: 'callsFake',
                        object: gui,
                        key: 'alertLoadErrors',
                        expectedArgs: [ [ error.message ], translatedErrorAdvice ]
                    }),
                ];
                /** @type {Promise} */
                let offlineInitialization = enketoWebform.initApp(initOptions);

                await offlineInitialization;

                for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                    const step = performedSteps.find(performedStep => {
                        return performedStep === expectedStep;
                    });
                    const index = performedSteps.indexOf(expectedStep);

                    expect(step).to.equal(expectedStep);
                    expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                        .to.equal(expectedIndex);
                }

                expect(performedSteps.length).to.equal(steps.length);
            });

            it('reports offline initialization failure (asynchronous)', async () => {
                enketoId = 'offlineA';

                const initOptions = {
                    ...surveyInitData,
                    isOffline: true,
                };

                const error = new Error('Application cache initialization failed.');
                const translatedErrorAdvice = 'Translated error advice';

                const steps = [
                    prepareInitStep({
                        description: 'Setting emergency handlers: ensure an element is returned for flushBtn',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.side-slider__advanced__button.flush-db' ],
                        returnValue: flushButton,
                    }),
                    prepareInitStep({
                        description: 'Offline-capable event listener',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'addEventListener',
                        expectedArgs: [ events.OfflineLaunchCapable().type, expectFunction ],
                    }),
                    prepareInitStep({
                        description: 'Application update event listener',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'addEventListener',
                        expectedArgs: [ events.ApplicationUpdated().type, expectFunction ],
                    }),
                    prepareInitStep({
                        description: 'Initialize application cache',
                        stubMethod: 'callsFake',
                        object: applicationCache,
                        key: 'init',
                        expectedArgs: [ { enketoId } ],
                        returnValue: Promise.reject(error),
                    }),
                    prepareInitStep({
                        description: 'Reporting failure: ensure query for loader returns element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.main-loader' ],
                        returnValue: loaderElement,
                    }),
                    prepareInitStep({
                        description: 'Set error class',
                        stubMethod: 'callsFake',
                        object: loaderElement.classList,
                        key: 'add',
                        expectedArgs: [ webformPrivate.LOAD_ERROR_CLASS ],
                    }),
                    prepareInitStep({
                        description: 'Translate error advice',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 't',
                        expectedArgs: [ 'alert.loaderror.entryadvice', undefined ],
                        returnValue: translatedErrorAdvice,
                    }),
                    prepareInitStep({
                        description: 'Alert load errors',
                        stubMethod: 'callsFake',
                        object: gui,
                        key: 'alertLoadErrors',
                        expectedArgs: [ [ error.message ], translatedErrorAdvice ]
                    }),
                ];
                /** @type {Promise} */
                let offlineInitialization = enketoWebform.initApp(initOptions);

                await offlineInitialization;

                for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                    const step = performedSteps.find(performedStep => {
                        return performedStep === expectedStep;
                    });
                    const index = performedSteps.indexOf(expectedStep);

                    expect(step).to.equal(expectedStep);
                    expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                        .to.equal(expectedIndex);
                }

                expect(performedSteps.length).to.equal(steps.length);
            });
        });

        describe('online', () => {
            beforeEach(() => {
                sandbox.stub(settings, 'offline').get(() => false);
            });

            it('initializes online forms', async () => {
                enketoId = 'onlineA';

                const xformUrl = 'https://example.com/form.xml';

                const surveyInit = {
                    ...surveyInitData,
                    xformUrl,
                };

                const onlineSurvey = {
                    ...surveyInitData,

                    externalData: [],
                    form: '<form></form>',
                    model: '<a/>',
                    theme: 'kobo',
                };

                const maxSize = 90120;

                const maxSizeSurvey = {
                    ...onlineSurvey,

                    maxSize,
                };

                const controllerInitResult = {
                    languages: [ 'ar', 'fa' ],
                };

                const formElement = document.createElement('form');

                const steps = [
                    prepareInitStep({
                        description: 'Setting emergency handlers: ensure an element is returned for flushBtn',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.side-slider__advanced__button.flush-db' ],
                        returnValue: flushButton,
                    }),
                    prepareInitStep({
                        description: 'Initialize IndexedDB store (used for last-saved instances)',
                        stubMethod: 'callsFake',
                        object: store,
                        key: 'init',
                        expectedArgs: [ { failSilently: true } ],
                        returnValue: Promise.resolve(),
                    }),
                    prepareInitStep({
                        description: 'Translator: initialize i18next',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 'init',
                        expectedArgs: [ expectObject, expectCallback ],
                    } ),

                    prepareInitStep({
                        description: 'Get form parts',
                        stubMethod: 'callsFake',
                        object: connection,
                        key: 'getFormParts',
                        expectedArgs: [ { enketoId, xformUrl } ],
                        returnValue: Promise.resolve(onlineSurvey),
                    }),

                    // While there is currently a truthiness check on the query result,
                    // there is a subsequent access outside that check.
                    prepareInitStep({
                        description: 'Add branding: Ensure a brand image query resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ webformPrivate.BRAND_IMAGE_SELECTOR ],
                        returnValue: document.createElement('img'),
                    }),

                    prepareInitStep({
                        description: 'Swap theme',
                        stubMethod: 'callsFake',
                        object: gui,
                        key: 'swapTheme',
                        expectedArgs: [ onlineSurvey ],
                        returnValue: Promise.resolve(onlineSurvey),
                    }),
                    prepareInitStep({
                        description: 'Get max submission size',
                        stubMethod: 'callsFake',
                        object: connection,
                        key: 'getMaximumSubmissionSize',
                        expectedArgs: [ onlineSurvey ],
                        returnValue: Promise.resolve(maxSizeSurvey),
                    }),
                    prepareInitStep({
                        description: 'Assign max submission size to settings',
                        stubMethod: 'set',
                        object: settings,
                        key: 'maxSize',
                        expectedValue: maxSize,
                    }),
                    prepareInitStep({
                        description: 'Ensure a query for the form\'s header resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.main > .paper > .form-header' ],
                        returnValue: formHeaderElement,
                    }),
                    prepareInitStep({
                        description: 'Ensure a query for the page\'s form resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ 'form.or' ],
                        returnValue: formElement,
                    }),
                    prepareInitStep({
                        description: 'Initialize controller-webform',
                        stubMethod: 'callsFake',
                        object: controller,
                        key: 'init',
                        expectedArgs: [
                            formElement,
                            {
                                modelStr: maxSizeSurvey.model,
                                instanceStr: null,
                                external: maxSizeSurvey.externalData,
                                survey: maxSizeSurvey,
                            },
                        ],
                        returnValue: Promise.resolve(controllerInitResult),
                    }),
                    prepareInitStep({
                        description: 'Get page title',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ 'head > title' ],
                        returnValue: document.createElement('title'),
                    }),
                ];

                /** @type {Promise} */
                let onlineInitialization = enketoWebform.initApp(surveyInit);

                await onlineInitialization;

                for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                    const step = performedSteps.find(performedStep => {
                        return performedStep === expectedStep;
                    });
                    const index = performedSteps.indexOf(expectedStep);

                    expect(step).to.equal(expectedStep);
                    expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                        .to.equal(expectedIndex);
                }

                expect(performedSteps.length).to.equal(steps.length);
            });

            it('reports online initialization failure', async () => {
                enketoId = 'offlineA';

                const xformUrl = 'https://example.com/form.xml';
                const surveyInit = {
                    ...surveyInitData,

                    xformUrl,
                };

                const error = new Error('IndexedDB store initialization failed.');
                const translatedErrorAdvice = 'Translated error advice';

                const steps = [
                    prepareInitStep({
                        description: 'Setting emergency handlers: ensure an element is returned for flushBtn',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.side-slider__advanced__button.flush-db' ],
                        returnValue: flushButton,
                    }),
                    prepareInitStep({
                        description: 'Initialize IndexedDB store (used for last-saved instances)',
                        stubMethod: 'callsFake',
                        object: store,
                        key: 'init',
                        expectedArgs: [ { failSilently: true } ],
                        returnValue: Promise.reject(error),
                    }),
                    prepareInitStep({
                        description: 'Reporting failure: ensure query for loader returns element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.main-loader' ],
                        returnValue: loaderElement,
                    }),
                    prepareInitStep({
                        description: 'Set error class',
                        stubMethod: 'callsFake',
                        object: loaderElement.classList,
                        key: 'add',
                        expectedArgs: [ webformPrivate.LOAD_ERROR_CLASS ],
                    }),
                    prepareInitStep({
                        description: 'Translate error advice',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 't',
                        expectedArgs: [ 'alert.loaderror.entryadvice', undefined ],
                        returnValue: translatedErrorAdvice,
                    }),
                    prepareInitStep({
                        description: 'Alert load errors',
                        stubMethod: 'callsFake',
                        object: gui,
                        key: 'alertLoadErrors',
                        expectedArgs: [ [ error.message ], translatedErrorAdvice ]
                    }),
                ];

                /** @type {Promise} */
                let onlineInitialization = enketoWebform.initApp(surveyInit);

                await onlineInitialization;

                for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                    const step = performedSteps.find(performedStep => {
                        return performedStep === expectedStep;
                    });
                    const index = performedSteps.indexOf(expectedStep);

                    expect(step).to.equal(expectedStep);
                    expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                        .to.equal(expectedIndex);
                }

                expect(performedSteps.length).to.equal(steps.length);
            });
        });
    });

    describe('enketo-webform.js initialization behavior', () => {
        /** @type {Survey} */
        let baseSurvey;

        beforeEach(() => {
            enketoId = 'surveyA';

            baseSurvey = {
                get enketoId() { return enketoId; },

                defaults: {},
                externalData: [],
                form: '<form></form>',
                model: '<a/>',
                theme: 'kobo',
                xformUrl: 'https://example.com/form.xml',
            };

            sandbox.stub(i18next, 't').returnsArg(0);
        });

        describe('location wrapper', () => {
            it('aliases location.href', () => {
                expect(webformPrivate._location.href).to.equal(location.href);
            });

            it('assigns location.href', () => {
                const newLocation = `${location.href.replace(/#.*$/, '')}#new-hash`;

                webformPrivate._location.href = newLocation;

                expect(location.href).to.equal(newLocation);
            });
        });

        describe('emergency handlers', () => {
            /**
             * @param {number} timeoutMs
             */
            const timeoutRejectionPromise = (timeoutMs) => {
                // Defined here to get a reliable stack trace
                const error = new Error(`Promise not resolved in ${timeoutMs} milliseconds`);

                /** @type {Function} */
                let resolver;

                const promise = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(error);
                    }, timeoutMs);

                    resolver = (value) => {
                        clearTimeout(timeout);
                        resolve(value);
                    };
                });

                return {
                    promise,
                    resolver,
                };
            };

            /** @type {boolean} */
            let isConfirmed;

            /** @type {Promise<boolean> | null} */
            let confirmPromise;

            /** @type {Stub} */
            let confirmStub;

            /** @type {Promise<void> | null} */
            let flushPromise;

            /** @type {Stub} */
            let flushStub;

            /** @type {Promise<void>} */
            let reloadPromise;

            /** @type {Stub} */
            let reloadStub;

            /** @type {Function} */
            let resolveReload;

            beforeEach(() => {
                const querySelector = document.querySelector.bind(document);

                sandbox.stub(document, 'querySelector').callsFake(selector => {
                    if (selector === webformPrivate.FLUSH_BUTTON_SELECTOR) {
                        return flushButton;
                    }

                    return querySelector(selector);
                });

                const {
                    resolver: resolveConfirm,
                    promise: confirm,
                } = timeoutRejectionPromise(100);

                confirmPromise = confirm;

                confirmStub = sandbox.stub(gui, 'confirm').callsFake(() => {
                    resolveConfirm(isConfirmed);

                    return confirmPromise;
                });

                const {
                    resolver: reloadResolver,
                    promise: reload,
                } = timeoutRejectionPromise(102);

                resolveReload = reloadResolver;
                reloadPromise = reload;

                reloadStub = sandbox.stub(webformPrivate._location, 'reload').callsFake(() => {
                    resolveReload(true);

                    return reloadPromise;
                });

                const {
                    resolver: resolveFlush,
                    promise: flush,
                } = timeoutRejectionPromise(101);

                flushPromise = flush;

                flushStub = sandbox.stub(store, 'flush').callsFake(() => {
                    resolveFlush(true);

                    return flushPromise;
                });

                webformPrivate._setEmergencyHandlers();
            });

            it('flushes the store when confirmed', async () => {
                isConfirmed = true;

                flushButton.dispatchEvent(new Event('click'));

                expect(confirmStub).to.have.been.calledWith({
                    msg: 'confirm.deleteall.msg',
                    heading: 'confirm.deleteall.heading',
                }, {
                    posButton: 'confirm.deleteall.posButton',
                });

                await Promise.all([ confirmPromise, timers.tickAsync(100) ]);

                expect(flushStub).to.have.been.called;

                await Promise.all([ flushPromise, timers.tickAsync(101) ]);

                await Promise.all([ reloadPromise, timers.tickAsync(102) ]);

                expect(reloadStub).to.have.been.called;
            });

            it('does not flush the store when not confirmed', async () => {
                isConfirmed = false;

                flushButton.dispatchEvent(new Event('click'));

                expect(confirmStub).to.have.been.calledWith({
                    msg: 'confirm.deleteall.msg',
                    heading: 'confirm.deleteall.heading',
                }, {
                    posButton: 'confirm.deleteall.posButton',
                });

                await Promise.all([ confirmPromise, timers.tickAsync(100) ]);

                expect(flushStub).not.to.have.been.called;

                await Promise.all([
                    flushPromise.catch(() => {}),
                    reloadPromise.catch(() => {}),
                    timers.tickAsync(203),
                ]);

                expect(reloadStub).not.to.have.been.called;
            });
        });

        describe('branding', () => {
            /** @see {@link https://stackoverflow.com/a/13139830} */
            const defaultBrandImageURL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

            /** @see {@link https://stackoverflow.com/a/12483396} */
            const brandImageURL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

            /** @type {HTMLImageElement | null} */
            let brandImage = null;

            /** @type {boolean} */
            let isOffline;

            /** @type {Survey} */
            let brandedSurvey;

            beforeEach(() => {
                brandImage = document.createElement('img');
                brandImage.setAttribute('src', defaultBrandImageURL);
                brandImage.classList.add('hide');

                isOffline = false;

                brandedSurvey = {
                    ...baseSurvey,

                    branding: { source: brandImageURL },
                };

                sandbox.stub(settings, 'offline').get(() => isOffline);

                sandbox.stub(document, 'querySelector').callsFake(selector => {
                    if (selector === webformPrivate.BRAND_IMAGE_SELECTOR) {
                        return brandImage;
                    }

                    throw new Error(`Unexpected selector: ${selector}`);
                });
            });

            it('sets the brand image source to the survey brand source', () => {
                webformPrivate._addBranding(brandedSurvey);

                expect(brandImage.src).to.equal(brandImageURL);
            });

            it('sets the brand image data-offline-source to the offline survey brand source', () => {
                isOffline = true;

                webformPrivate._addBranding(brandedSurvey);

                expect(brandImage.getAttribute('data-offline-src')).to.equal(brandImageURL);
            });

            it('unsets the brand image src on the offline survey brand source', () => {
                isOffline = true;

                webformPrivate._addBranding(brandedSurvey);

                expect(brandImage.src).to.equal('');
            });

            it('does not set the source if a survey does not have branding', () => {
                webformPrivate._addBranding(baseSurvey);

                expect(brandImage.src).to.equal(defaultBrandImageURL);
            });

            it('unhides the brand image for a branded survey', () => {
                webformPrivate._addBranding(brandedSurvey);

                expect(brandImage.classList.contains('hide')).to.equal(false);
            });

            it('unhides the default brand image for an unbranded survey', () => {
                webformPrivate._addBranding(baseSurvey);

                expect(brandImage.classList.contains('hide')).to.equal(false);
            });

            it('does not error when a brand image is not found', () => {
                /** @type {Error | null} */
                let caught = null;

                brandImage = null;

                try {
                    webformPrivate._addBranding(brandImage);
                } catch (error) {
                    caught = error;
                }

                expect(caught).to.equal(null);
            });
        });

        describe('swapping themes', () => {
            const guiResult = Symbol('GUI result');

            /** @type {Stub} */
            let swapThemeStub;

            beforeEach(() => {
                swapThemeStub = sandbox.stub(gui, 'swapTheme').callsFake(() => (
                    Promise.resolve(guiResult)
                ));
            });

            it('swaps themes with a valid form', async () => {
                const result = await webformPrivate._swapTheme(baseSurvey);

                expect(swapThemeStub).to.have.been.calledWith(baseSurvey);
                expect(result).to.equal(guiResult);
            });

            it('fails to swap themes when the form is not present on the survey', async () => {
                const { form, ...invalidSurvey } = baseSurvey;

                /** @type {Error | null} */
                let caught = null;

                try {
                    await webformPrivate._swapTheme(invalidSurvey);
                } catch (error) {
                    caught = error;
                }

                const expectedMessage = webformPrivate.SWAP_THEME_ERROR_MESSAGE;

                expect(swapThemeStub).not.to.have.been.called;
                expect(caught).to.be.an.instanceof(Error).and.to.have.property('message', expectedMessage);
            });

            it('fails to swap themes when the model is not present on the survey', async () => {
                const { model, ...invalidSurvey } = baseSurvey;

                /** @type {Error | null} */
                let caught = null;

                try {
                    await webformPrivate._swapTheme(invalidSurvey);
                } catch (error) {
                    caught = error;
                }

                const expectedMessage = webformPrivate.SWAP_THEME_ERROR_MESSAGE;

                expect(swapThemeStub).not.to.have.been.called;
                expect(caught).to.be.an.instanceof(Error).and.to.have.property('message', expectedMessage);
            });
        });

        describe('maximum submission size', () => {
            it('sets the survey\'s maximum submission size on settings', () => {
                let maxSizeSetting = 4;

                sandbox.stub(settings, 'maxSize').get(() => maxSizeSetting);
                sandbox.stub(settings, 'maxSize').set((maxSize) => {
                    maxSizeSetting = maxSize;
                });

                webformPrivate._updateMaxSizeSetting({
                    ...baseSurvey,
                    maxSize: 5,
                });

                expect(maxSizeSetting).to.equal(5);
            });

            it('preserves existing max size setting when survey does not specify a max size', () => {
                let maxSizeSetting = 4;

                sandbox.stub(settings, 'maxSize').get(() => maxSizeSetting);
                sandbox.stub(settings, 'maxSize').set((maxSize) => {
                    maxSizeSetting = maxSize;
                });

                webformPrivate._updateMaxSizeSetting(baseSurvey);

                expect(maxSizeSetting).to.equal(4);
            });
        });

        describe('preparing an existing instance', () => {
            const model = '<instance><data><el1/><el2>default</el2></data><meta><instanceID/></meta></instance>';

            it('populates an instance string with provided defaults', () => {
                const result = webformPrivate._prepareInstance(model, {
                    '//instance/data/el1': 'v1',
                    '//instance/data/el2': 'v2',
                });
                const expected = '<data><el1>v1</el1><el2>v2</el2></data>';

                expect(result).to.equal(expected);
            });

            it('preserves the model default when no instance default is provided', () => {
                const result = webformPrivate._prepareInstance(model, {
                    '//instance/data/el1': 'v1',
                });
                const expected = '<data><el1>v1</el1><el2>default</el2></data>';

                expect(result).to.equal(expected);
            });

            it('does not return an instance string when no defaults are defined', () => {
                const result = webformPrivate._prepareInstance(model, {});

                expect(result).to.equal(null);
            });

            it('does not return an instance string when no defaults object is provided', () => {
                const result = webformPrivate._prepareInstance(model);

                expect(result).to.equal(null);
            });

            it('does not populate inherited properties from defaults', () => {
                const proto = {
                    '//instance/data/el2': 'v2',
                };
                const defaults = Object.create(proto, {
                    '//instance/data/el1': {
                        enumerable: true,
                        value: 'v1',
                    },
                });

                const result = webformPrivate._prepareInstance(model, defaults);
                const expected = '<data><el1>v1</el1><el2>default</el2></data>';

                expect(result).to.equal(expected);
            });
        });

        describe('controller initialization', () => {
            const formTitle = 'Controller init form';
            const form = `<form autocomplete="off" novalidate="novalidate" class="or clearfix" dir="ltr" data-form-id="last-saved">\n<!--This form was created by transforming an ODK/OpenRosa-flavored (X)Form using an XSL stylesheet created by Enketo LLC.--><section class="form-logo"></section><h3 dir="auto" id="form-title">${formTitle}</h3>\n  \n\n  \n    <label class="question non-select "><span lang="" class="question-label active">Last saved...: <span class="or-output" data-value="instance('last-saved')/data/item"> </span></span><input type="text" name="/data/item" data-type-xml="string" data-setvalue="instance('last-saved')/data/item" data-event="odk-instance-first-load"></label>\n  \n<fieldset id="or-setvalue-items" style="display:none;"></fieldset></form>`;
            const model = '<instance><data><el1/><el2>default</el2></data><meta><instanceID/></meta></instance>';

            /** @type {import('../../app/models/survey-model').SurveyExternalData} */
            let externalData;

            /** @type {Survey} */
            let survey;

            /** @type {string[]} */
            let controllerFormLanguages;

            /** @type {Stub} */
            let controllerInitStub;

            beforeEach(() => {
                controllerFormLanguages = [];

                controllerInitStub = sandbox.stub(controller, 'init').callsFake((formElement) => {
                    return Promise.resolve({
                        languages: controllerFormLanguages,
                        view: {
                            html: formElement,
                        },
                    });
                });

                externalData = [
                    {
                        id: 'any',
                        src: 'https://example.com/any.xml',
                        xml: '<any/>',
                    },
                ];

                survey = {
                    ...baseSurvey,
                    form,
                    model,
                    externalData,
                };

                // Sinon cannot stub nonexistent properties
                if (!('print' in settings)) {
                    settings['print'] = false;
                }
            });

            it('appends the DOM representation of the survey\'s form after the page\'s form header', async () => {
                const result = await enketoWebform.initSurveyController(survey);
                const { html: formElement } = result.form.view;

                expect(formHeaderElement.nextSibling).to.equal(formElement);
                expect(formElement.outerHTML).to.deep.equal(form);
            });

            it('initializes the controller with the form element and survey data', async () => {
                await enketoWebform.initSurveyController(survey);

                const formElement = formHeaderElement.nextSibling;

                expect(controllerInitStub).to.have.been.calledWith(formElement, {
                    modelStr: model,
                    instanceStr: null,
                    external: externalData,
                    survey,
                });
            });

            it('initializes the controller with instance data with defaults from settings', async () => {
                const defaults = {
                    '//instance/data/el1': 'v1',
                };

                await enketoWebform.initSurveyController(survey, { defaults });

                const formElement = formHeaderElement.nextSibling;

                expect(controllerInitStub).to.have.been.calledWith(formElement, {
                    modelStr: model,
                    instanceStr: '<data><el1>v1</el1><el2>default</el2></data>',
                    external: externalData,
                    survey,
                });
            });

            it('sets the page title with the title from the form', async () => {
                await enketoWebform.initSurveyController(survey);

                const title = document.querySelector('title');

                expect(title.textContent).to.equal(formTitle);
            });

            it('applies print styles if print is enabled in settings', async () => {
                const applyPrintStyleStub = sandbox.stub(gui, 'applyPrintStyle').returns();

                await enketoWebform.initSurveyController(survey, { print: true });

                expect(applyPrintStyleStub).to.have.been.called;
            });

            it('does not apply print styles if print is not enabled in settings', async () => {
                const applyPrintStyleStub = sandbox.stub(gui, 'applyPrintStyle').returns();

                await enketoWebform.initSurveyController(survey, { print: false });

                expect(applyPrintStyleStub).not.to.have.been.called;
            });

            it('localizes the form element', async () => {
                /** @type {Stub} */
                let queryStub;

                controllerInitStub.callsFake(async (formElement) => {
                    // Tests that `localize` from `translator.js` was called by inference
                    // without testing that entire functionality.
                    queryStub = sandbox.stub(formElement, 'querySelectorAll').returns([]);

                    return survey;
                });


                await enketoWebform.initSurveyController(survey);

                expect(queryStub).to.have.been.calledWith('[data-i18n]');
            });

            it('returns a survey with ', async () => {
                controllerFormLanguages = [ 'ar', 'fa' ];

                const result = await enketoWebform.initSurveyController(survey);

                expect(result.form.languages).to.deep.equal(controllerFormLanguages);
            });
        });

        describe('application cache event handlers', () => {
            describe('offline launch capable events', () => {
                const serviceWorkerVersion = '1.2.3-d34db33-b4dfac3';

                /** @type {string | null} */
                let serviceWorkerScriptUrl;

                /** @type {Stub} */
                let updateOfflineCapableStub;

                /** @type {Stub} */
                let getServiceWorkerVersionStub;

                /** @type {Promise<string> | null} */
                let getServiceWorkerVersionPromise;

                /** @type {Stub} */
                let updateApplicationVersionStub;

                /** @type {Promise<any> | null} */
                let updateApplicationVersionPromise;

                beforeEach(() => {
                    serviceWorkerScriptUrl = null;

                    updateOfflineCapableStub = sandbox.stub(gui.updateStatus, 'offlineCapable').returns(null);

                    sandbox.stub(applicationCache, 'serviceWorkerScriptUrl').get(() => {
                        return serviceWorkerScriptUrl;
                    });

                    getServiceWorkerVersionPromise = null;

                    getServiceWorkerVersionStub = sandbox.stub(connection, 'getServiceWorkerVersion')
                        .callsFake(() => {
                            getServiceWorkerVersionPromise = Promise.resolve(
                                serviceWorkerVersion
                            );

                            return getServiceWorkerVersionPromise;
                        });

                    updateApplicationVersionPromise = null;

                    updateApplicationVersionStub = sandbox.stub(gui.updateStatus, 'applicationVersion')
                        .callsFake(() => {
                            updateApplicationVersionPromise = Promise.resolve();
                        });
                });

                afterEach(async () => {
                    await getServiceWorkerVersionPromise;
                    await updateApplicationVersionPromise;
                });

                it('updates the GUI to reflect that offline launch is available', async () => {
                    webformPrivate._setAppCacheEventHandlers();

                    const event = events.OfflineLaunchCapable({
                        capable: true,
                    });

                    document.dispatchEvent(event);

                    expect(updateOfflineCapableStub).to.have.been.calledWith(true);
                });

                it('updates the GUI to reflect that offline launch is not available', async () => {
                    webformPrivate._setAppCacheEventHandlers();

                    const event = events.OfflineLaunchCapable({
                        capable: false,
                    });

                    document.dispatchEvent(event);

                    expect(updateOfflineCapableStub).to.have.been.calledWith(false);
                });

                it('updates the GUI to reflect the service worker version', async () => {
                    serviceWorkerScriptUrl = 'https://example.com/worker.js';

                    webformPrivate._setAppCacheEventHandlers();

                    const event = events.OfflineLaunchCapable({
                        capable: false,
                    });

                    document.dispatchEvent(event);

                    await getServiceWorkerVersionPromise;
                    await updateApplicationVersionPromise;

                    expect(updateApplicationVersionStub).to.have.been.calledWith(serviceWorkerVersion);
                });

                it('does not updates the GUI to reflect the service worker version if no service worker script is available', async () => {
                    webformPrivate._setAppCacheEventHandlers();

                    const event = events.OfflineLaunchCapable({
                        capable: false,
                    });

                    document.dispatchEvent(event);

                    await getServiceWorkerVersionPromise;
                    await updateApplicationVersionPromise;

                    expect(getServiceWorkerVersionStub).not.to.have.been.called;
                    expect(updateApplicationVersionStub).not.to.have.been.called;
                });
            });

            describe('application updated events', () => {
                it('provides GUI feedback when the application has been updated', () => {
                    const feedbackStub = sandbox.stub(gui, 'feedback').returns();

                    const event = events.ApplicationUpdated();

                    document.dispatchEvent(event);

                    expect(feedbackStub).to.have.been.calledWith(
                        'alert.appupdated.msg',
                        20,
                        'alert.appupdated.heading'
                    );
                });
            });
        });

        describe('form cache event handlers', () => {
            it('provides GUI feedback when the form has been updated', () => {
                const feedbackStub = sandbox.stub(gui, 'feedback').returns();

                webformPrivate._setFormCacheEventHandlers();

                const event = events.FormUpdated();

                document.dispatchEvent(event);

                expect(feedbackStub).to.have.been.calledWith(
                    'alert.formupdated.msg',
                    20,
                    'alert.formupdated.heading'
                );
            });
        });

        describe('error handling', () => {
            class StatusError extends Error {
                /**
                 * @param {number} status
                 */
                constructor(status) {
                    super(`HTTP Error: ${status}`);

                    this.status = status;
                }
            }

            const loginURL = 'https://example.com/login';
            const initialURL = 'https://example.com/-/x/f33db33f';

            /** @type {Stub} */
            let addLoaderClassStub;

            /** @type {string} */
            let currentURL;

            /** @type {Stub} */
            let redirectStub;

            /** @type {loadErrorsStub} */
            let loadErrorsStub;

            beforeEach(() => {
                sandbox.stub(settings, 'loginUrl').get(() => loginURL);

                addLoaderClassStub = sandbox.stub(loaderElement.classList, 'add').returns();

                currentURL = 'https://example.com/-/x/f33db33f';
                redirectStub = sandbox.stub(webformPrivate._location, 'href');

                redirectStub.get(() => currentURL);

                redirectStub.set(redirectLocation => {
                    currentURL = redirectLocation;
                });


                loadErrorsStub = sandbox.stub(gui, 'alertLoadErrors').returns();
            });

            it('alerts multiple loading error messages', () => {
                const errors = [ 'really', 'not', 'good!' ];

                enketoWebform.showErrorOrAuthenticate(loaderElement, errors);

                expect(loadErrorsStub).to.have.been.calledWith(
                    errors,
                    'alert.loaderror.entryadvice'
                );
            });

            it('indicates failure on the loading indicator', () => {
                const error = new Error('bummer');

                enketoWebform.showErrorOrAuthenticate(loaderElement, error);

                expect(addLoaderClassStub).to.have.been.calledWith(webformPrivate.LOAD_ERROR_CLASS);
            });

            it('redirects to a login page on authorization failure', () => {
                const error = new StatusError(401);

                enketoWebform.showErrorOrAuthenticate(loaderElement, error);

                expect(currentURL).to.equal(`${loginURL}?return_url=${encodeURIComponent(initialURL)}`);
                expect(loadErrorsStub).not.to.have.been.called;
            });

            it('does not redirect to a login page for other network errors', () => {
                const error = new StatusError(404);

                enketoWebform.showErrorOrAuthenticate(loaderElement, error);

                expect(currentURL).to.equal(initialURL);
            });

            it('alerts a loading error message', () => {
                const error = new Error('oops!');

                enketoWebform.showErrorOrAuthenticate(loaderElement, error);

                expect(loadErrorsStub).to.have.been.calledWith(
                    [ error.message ],
                    'alert.loaderror.entryadvice'
                );
            });

            it('alerts a loading error message string', () => {
                const message = 'oops!';

                enketoWebform.showErrorOrAuthenticate(loaderElement, message);

                expect(loadErrorsStub).to.have.been.calledWith(
                    [ message ],
                    'alert.loaderror.entryadvice'
                );
            });

            it('alerts an unknown error message', () => {
                const error = new Error();

                enketoWebform.showErrorOrAuthenticate(loaderElement, error);

                expect(loadErrorsStub).to.have.been.calledWith(
                    [ 'error.unknown' ],
                    'alert.loaderror.entryadvice'
                );
            });

            it('alerts multiple loading error messages', () => {
                const errors = [ 'really', 'not', 'good!' ];

                enketoWebform.showErrorOrAuthenticate(loaderElement, errors);

                expect(loadErrorsStub).to.have.been.calledWith(
                    errors,
                    'alert.loaderror.entryadvice'
                );
            });
        });
    });

    describe('enketo-webform-edit.js initialization steps', () => {
        /** @type {Record<string, any> | null} */
        let webformEditPrivate = null;

        /** @type {string} */
        let instanceId;

        /** @type {string | null} */
        let existingInstance;

        /** @type {Partial<Survey>} */
        let surveyInitData;

        /** @type {HTMLElement} */
        let formHeader;

        before(async () => {
            webformEditPrivate = enketoWebformEdit._PRIVATE_TEST_ONLY_;
        });

        beforeEach(() => {
            sandbox.stub(lodash, 'memoize').callsFake(fn => fn);

            instanceId = 'instance1';

            existingInstance = null;

            surveyInitData = {
                get enketoId() { return enketoId; },
                get instanceId() { return instanceId; },
            };

            formHeader = document.querySelector('.form-header');
        });

        it('initializes a form to edit an existing instance/record', async () => {
            existingInstance = '<a>value</a>';

            const formTitle = 'Title of form';
            const form = `<form>
                <h3 id="form-title">${formTitle}</h3>
            </form>`;

            const formParts = {
                ...surveyInitData,

                externalData: [],
                form,
                languages: [],
                model: '<a/>',
                theme: 'kobo',
            };

            const instanceAttachments = {
                'a.jpg': 'https://example.com/a.jpg',
            };

            const instanceResult = {
                instance: existingInstance,
                instanceAttachments,
                ignoreMe: true,
            };

            const formPartsWithInstanceData = {
                ...formParts,

                instance: existingInstance,
                instanceAttachments,
            };

            const swappedThemeSurvey = {
                ...formPartsWithInstanceData,
                theme: 'swapped',
            };

            const maxSize = 8675309;

            const maxSizeSurvey = {
                ...formPartsWithInstanceData,

                maxSize,
            };

            const initializedForm = {
                languages: [ 'ar', 'fa' ],
            };

            const formElement = document.createElement('form');
            const artificialTitleElement = {
                textContent: 'Not title of form',
            };

            sandbox.stub(i18next, 'use').returns(i18next);

            const steps = [
                prepareInitStep({
                    description: 'Translator: initialize i18next',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 'init',
                    expectedArgs: [ expectObject, expectCallback ],
                }),
                prepareInitStep({
                    description: 'Get form parts',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getFormParts',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.resolve(formParts),
                }),
                prepareInitStep({
                    description: 'Get existing instance',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getExistingInstance',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.resolve(instanceResult),
                }),
                prepareInitStep({
                    description: 'Swap theme',
                    stubMethod: 'callsFake',
                    object: gui,
                    key: 'swapTheme',
                    expectedArgs: [ formPartsWithInstanceData ],
                    returnValue: Promise.resolve(swappedThemeSurvey),
                }),
                prepareInitStep({
                    description: 'Get max submission size',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getMaximumSubmissionSize',
                    expectedArgs: [ swappedThemeSurvey ],
                    returnValue: Promise.resolve(maxSizeSurvey),
                }),
                prepareInitStep({
                    description: 'Assign max submission size to settings',
                    stubMethod: 'set',
                    object: settings,
                    key: 'maxSize',
                    expectedValue: maxSize,
                }),
                prepareInitStep({
                    description: 'Creating a form element from the form\'s HTML resolves a referenceable DOM element',
                    stubMethod: 'callsFake',
                    object: Range.prototype,
                    key: 'createContextualFragment',
                    expectedArgs: [ maxSizeSurvey.form ],
                    returnValue: formElement,
                }),
                prepareInitStep({
                    description: 'Resolve appended form element',
                    stubMethod: 'callsFake',
                    object: document,
                    key: 'querySelector',
                    expectedArgs: [ '.main > .paper > .form-header' ],
                    returnValue: formHeaderElement,
                }),
                prepareInitStep({
                    description: 'Append form element after header',
                    stubMethod: 'callsFake',
                    object: formHeader,
                    key: 'after',
                    expectedArgs: [ formElement ],
                }),
                prepareInitStep({
                    description: 'Resolve appended form element',
                    stubMethod: 'callsFake',
                    object: document,
                    key: 'querySelector',
                    expectedArgs: [ 'form.or' ],
                    returnValue: formElement,
                }),
                prepareInitStep({
                    description: 'Initialize controller-webform',
                    stubMethod: 'callsFake',
                    object: controller,
                    key: 'init',
                    expectedArgs: [
                        formElement,
                        {
                            modelStr: maxSizeSurvey.model,
                            instanceStr: existingInstance,
                            external: maxSizeSurvey.externalData,
                            instanceAttachments,
                            isEditing: true,
                            survey: maxSizeSurvey,
                        },
                    ],
                    returnValue: Promise.resolve(initializedForm),
                }),
                prepareInitStep({
                    description: 'Assign languages',
                    stubMethod: 'set',
                    object: maxSizeSurvey,
                    key: 'languages',
                    expectedValue: initializedForm.languages,
                }),
                prepareInitStep({
                    description: 'Get title element',
                    stubMethod: 'callsFake',
                    object: document,
                    key: 'querySelector',
                    expectedArgs: [ 'head>title' ],
                    returnValue: artificialTitleElement,
                }),
                prepareInitStep({
                    description: 'Set page title',
                    stubMethod: 'set',
                    object: artificialTitleElement,
                    key: 'textContent',
                    expectedValue: formTitle,
                }),
                prepareInitStep({
                    description: 'Localization',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 'dir',
                    expectedArgs: [],
                }),
            ];

            /** @type {Promise} */
            let editInitialization = webformEditPrivate._init(surveyInitData);

            await editInitialization;

            for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                const performedStep = performedSteps.find(performedStep => {
                    return performedStep === expectedStep;
                });
                const index = performedSteps.indexOf(expectedStep);

                expect(performedStep).to.equal(expectedStep);
                expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                    .to.equal(expectedIndex);
            }

            expect(performedSteps.length).to.equal(steps.length);
        });

        it('reports edit initialization failure', async () => {
            enketoId = 'editA';

            const formTitle = 'Title of form';
            const form = `<form>
                <h3 id="form-title">${formTitle}</h3>
            </form>`;

            const formParts = {
                ...surveyInitData,

                externalData: [],
                form,
                languages: [],
                model: '<a/>',
                theme: 'kobo',
            };

            const error = new Error('No network connection.');
            const translatedErrorAdvice = 'Translated error advice';

            const steps = [
                prepareInitStep({
                    description: 'Translator: initialize i18next',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 'init',
                    expectedArgs: [ expectObject, expectCallback ],
                }),
                prepareInitStep({
                    description: 'Get form parts',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getFormParts',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.resolve(formParts),
                }),
                prepareInitStep({
                    description: 'Get existing instance',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getExistingInstance',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.reject(error),
                }),
                prepareInitStep({
                    description: 'Set error class',
                    stubMethod: 'callsFake',
                    object: loaderElement.classList,
                    key: 'add',
                    expectedArgs: [ 'fail' ],
                }),
                prepareInitStep({
                    description: 'Translate error advice',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 't',
                    expectedArgs: [ 'alert.loaderror.editadvice', undefined ],
                    returnValue: translatedErrorAdvice,
                }),
                prepareInitStep({
                    description: 'Alert load errors',
                    stubMethod: 'callsFake',
                    object: gui,
                    key: 'alertLoadErrors',
                    expectedArgs: [ [ error.message ], translatedErrorAdvice ]
                }),
            ];

            /** @type {Promise} */
            let editInitialization = webformEditPrivate._init(surveyInitData);

            await editInitialization;

            for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                const step = performedSteps.find(performedStep => {
                    return performedStep === expectedStep;
                });
                const index = performedSteps.indexOf(expectedStep);

                expect(step).to.equal(expectedStep);
                expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                    .to.equal(expectedIndex);
            }

            expect(performedSteps.length).to.equal(steps.length);
        });

        const invalidForms = [
            { form: '<form></form>' },
            { model: '<any />' },
        ];

        invalidForms.forEach((formData) => {
            it('reports edit initialization failure when fetched form data is invalid', async () => {
                enketoId = 'editA';

                const formParts = {
                    ...surveyInitData,
                    ...formData,

                    externalData: [],
                    languages: [],
                    theme: 'kobo',
                };

                existingInstance = '<a>value</a>';

                const instanceAttachments = {
                    'a.jpg': 'https://example.com/a.jpg',
                };

                const instanceResult = {
                    instance: existingInstance,
                    instanceAttachments,
                    ignoreMe: true,
                };

                const translatedErrorMessage = 'Translated error advice';
                const translatedErrorAdvice = 'Translated error advice';

                const steps = [
                    prepareInitStep({
                        description: 'Translator: initialize i18next',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 'init',
                        expectedArgs: [ expectObject, expectCallback ],
                    }),
                    prepareInitStep({
                        description: 'Get form parts',
                        stubMethod: 'callsFake',
                        object: connection,
                        key: 'getFormParts',
                        expectedArgs: [ surveyInitData ],
                        returnValue: Promise.resolve(formParts),
                    }),
                    prepareInitStep({
                        description: 'Get existing instance',
                        stubMethod: 'callsFake',
                        object: connection,
                        key: 'getExistingInstance',
                        expectedArgs: [ surveyInitData ],
                        returnValue: Promise.resolve(instanceResult),
                    }),
                    prepareInitStep({
                        description: 'Translate error message',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 't',
                        expectedArgs: [ 'error.unknown', undefined ],
                        returnValue: translatedErrorMessage,
                    }),
                    prepareInitStep({
                        description: 'Set error class',
                        stubMethod: 'callsFake',
                        object: loaderElement.classList,
                        key: 'add',
                        expectedArgs: [ 'fail' ],
                    }),
                    prepareInitStep({
                        description: 'Translate error advice',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 't',
                        expectedArgs: [ 'alert.loaderror.editadvice', undefined ],
                        returnValue: translatedErrorAdvice,
                    }),
                    prepareInitStep({
                        description: 'Alert load errors',
                        stubMethod: 'callsFake',
                        object: gui,
                        key: 'alertLoadErrors',
                        expectedArgs: [ [ translatedErrorMessage ], translatedErrorAdvice ]
                    }),
                ];

                /** @type {Promise} */
                let editInitialization = webformEditPrivate._init(surveyInitData);

                await editInitialization;

                for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                    const step = performedSteps.find(performedStep => {
                        return performedStep === expectedStep;
                    });
                    const index = performedSteps.indexOf(expectedStep);

                    expect(step).to.equal(expectedStep);
                    expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                        .to.equal(expectedIndex);
                }

                expect(performedSteps.length).to.equal(steps.length);
            });
        });

        it('reports edit initialization failure when fetched instance data is invalid', async () => {
            enketoId = 'editA';

            const formParts = {
                ...surveyInitData,

                form: '<form></form>',
                model: '<any />',
                externalData: [],
                languages: [],
                theme: 'kobo',
            };

            existingInstance = '<a>value</a>';

            const instanceAttachments = {
                'a.jpg': 'https://example.com/a.jpg',
            };

            const instanceResult = {
                instanceAttachments,
                ignoreMe: true,
            };

            const translatedErrorMessage = 'Translated error advice';
            const translatedErrorAdvice = 'Translated error advice';

            const steps = [
                prepareInitStep({
                    description: 'Translator: initialize i18next',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 'init',
                    expectedArgs: [ expectObject, expectCallback ],
                }),
                prepareInitStep({
                    description: 'Get form parts',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getFormParts',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.resolve(formParts),
                }),
                prepareInitStep({
                    description: 'Get existing instance',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getExistingInstance',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.resolve(instanceResult),
                }),
                prepareInitStep({
                    description: 'Translate error message',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 't',
                    expectedArgs: [ 'error.unknown', undefined ],
                    returnValue: translatedErrorMessage,
                }),
                prepareInitStep({
                    description: 'Set error class',
                    stubMethod: 'callsFake',
                    object: loaderElement.classList,
                    key: 'add',
                    expectedArgs: [ 'fail' ],
                }),
                prepareInitStep({
                    description: 'Translate error advice',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 't',
                    expectedArgs: [ 'alert.loaderror.editadvice', undefined ],
                    returnValue: translatedErrorAdvice,
                }),
                prepareInitStep({
                    description: 'Alert load errors',
                    stubMethod: 'callsFake',
                    object: gui,
                    key: 'alertLoadErrors',
                    expectedArgs: [ [ translatedErrorMessage ], translatedErrorAdvice ]
                }),
            ];

            /** @type {Promise} */
            let editInitialization = webformEditPrivate._init(surveyInitData);

            await editInitialization;

            for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                const step = performedSteps.find(performedStep => {
                    return performedStep === expectedStep;
                });
                const index = performedSteps.indexOf(expectedStep);

                expect(step).to.equal(expectedStep);
                expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                    .to.equal(expectedIndex);
            }

            expect(performedSteps.length).to.equal(steps.length);
        });
    });

    describe('enketo-webform-edit.js initialization behavior', () => {
        /** @type {Record<string, any> | null} */
        let webformEditPrivate = null;

        /** @type {Survey} */
        let baseSurvey;

        before(async () => {
            webformEditPrivate = enketoWebformEdit._PRIVATE_TEST_ONLY_;
        });

        beforeEach(() => {
            enketoId = 'surveyA';

            baseSurvey = {
                get enketoId() { return enketoId; },

                defaults: {},
                externalData: [],
                form: '<form></form>',
                model: '<a/>',
                theme: 'kobo',
                xformUrl: 'https://example.com/form.xml',
            };

            sandbox.stub(i18next, 't').returnsArg(0);
        });

        describe('maximum submission size', () => {
            it('sets the survey\'s maximum submission size on settings', () => {
                let maxSizeSetting = 4;

                sandbox.stub(settings, 'maxSize').get(() => maxSizeSetting);
                sandbox.stub(settings, 'maxSize').set((maxSize) => {
                    maxSizeSetting = maxSize;
                });

                webformEditPrivate._updateMaxSizeSetting({
                    ...baseSurvey,
                    maxSize: 5,
                });

                expect(maxSizeSetting).to.equal(5);
            });

            it('preserves existing max size setting when survey does not specify a max size', () => {
                let maxSizeSetting = 4;

                sandbox.stub(settings, 'maxSize').get(() => maxSizeSetting);
                sandbox.stub(settings, 'maxSize').set((maxSize) => {
                    maxSizeSetting = maxSize;
                });

                webformEditPrivate._updateMaxSizeSetting(baseSurvey);

                expect(maxSizeSetting).to.equal(4);
            });
        });

        describe('error handling', () => {
            class StatusError extends Error {
                /**
                 * @param {number} status
                 */
                constructor(status) {
                    super(`HTTP Error: ${status}`);

                    this.status = status;
                }
            }

            const loginURL = 'https://example.com/login';
            const initialURL = 'https://example.com/-/x/f33db33f';

            /** @type {Stub} */
            let addLoaderClassStub;

            /** @type {string} */
            let currentURL;

            /** @type {Stub} */
            let redirectStub;

            /** @type {loadErrorsStub} */
            let loadErrorsStub;

            beforeEach(() => {
                sandbox.stub(settings, 'loginUrl').get(() => loginURL);

                addLoaderClassStub = sandbox.stub(loaderElement.classList, 'add').returns();

                currentURL = 'https://example.com/-/x/f33db33f';
                redirectStub = sandbox.stub(webformEditPrivate._location, 'href');

                redirectStub.get(() => currentURL);

                redirectStub.set(redirectLocation => {
                    currentURL = redirectLocation;
                });


                loadErrorsStub = sandbox.stub(gui, 'alertLoadErrors').returns();
            });

            it('indicates failure on the loading indicator', () => {
                const error = new Error('bummer');

                enketoWebformEdit.showErrorOrAuthenticate(error);

                expect(addLoaderClassStub).to.have.been.calledWith('fail');
            });

            it('redirects to a login page on authorization failure', () => {
                const error = new StatusError(401);

                enketoWebformEdit.showErrorOrAuthenticate(error);

                expect(currentURL).to.equal(`${loginURL}?return_url=${encodeURIComponent(initialURL)}`);
                expect(loadErrorsStub).not.to.have.been.called;
            });

            it('does not redirect to a login page for other network errors', () => {
                const error = new StatusError(404);

                enketoWebformEdit.showErrorOrAuthenticate(error);

                expect(currentURL).to.equal(initialURL);
            });

            it('alerts a loading error message', () => {
                const error = new Error('oops!');

                enketoWebformEdit.showErrorOrAuthenticate(error);

                expect(loadErrorsStub).to.have.been.calledWith(
                    [ error.message ],
                    'alert.loaderror.editadvice'
                );
            });

            it('alerts an unknown error message', () => {
                const error = new Error();

                enketoWebformEdit.showErrorOrAuthenticate(error);

                expect(loadErrorsStub).to.have.been.calledWith(
                    [ 'error.unknown' ],
                    'alert.loaderror.editadvice'
                );
            });

            it('alerts multiple loading error messages', () => {
                const errors = [ 'really', 'not', 'good!' ];

                enketoWebformEdit.showErrorOrAuthenticate(errors);

                expect(loadErrorsStub).to.have.been.calledWith(
                    errors,
                    'alert.loaderror.editadvice'
                );
            });
        });
    });

    const viewFormTitle = 'Title of form';
    const viewForm = /* html */`<form class="or">
        <h3 id="form-title">${viewFormTitle}</h3>


        <!-- Outside of .question, will not be marked readonly -->
        <input id="input-1">
        <textarea id="textarea-1"></textarea>
        <select id="select-1">
            <!-- All options outside of a languages select will be marked readonly -->
            <option class="writeable" selected></option>
        </select>
        <select id="form-languages">
            <!-- Inside languages select, will not be marked readonly -->
            <option></option>
        </select>

        <!-- All repeats will be marked fixed -->
        <div class="or-repeat-info"></div>

        <div class="question">
            <!-- Already readonly, will not be marked readonly -->
            <input id="input-2" readonly="readonly">
            <textarea id="textarea-2" readonly="readonly"></textarea>
            <select id="select-2" readonly="readonly">
                <option class="writeable" selected></option>
            </select>

            <!-- Will be marked readonly -->
            <input class="writeable-by-default" id="input-3">
            <textarea class="writeable-by-default" id="textarea-3"></textarea>
            <select class="writeable-by-default" id="select-3">
                <option class="writeable" selected></option>
            </select>
            <div class="or-repeat-info"></div>
        </div>
    </form>`;

    const calcModuleUpdate = calcModule.update.bind(calcModule);
    const formModelPrototypeSetInstanceIdAndDeprecatedId = FormModel.prototype.setInstanceIdAndDeprecatedId.bind(FormModel.prototype);
    const preloadModuleInit = preloadModule.init.bind(preloadModule);

    describe('enketo-webform-view.js initialization steps', () => {

        /** @type {Range} */
        let documentRange;

        /** @type {Record<string, any> | null} */
        let webformViewPrivate = null;

        /** @type {string} */
        let instanceId;

        /** @type {string | null} */
        let existingInstance;

        /** @type {Partial<Survey>} */
        let surveyInitData;

        /** @type {HTMLElement} */
        let formHeader;

        before(async () => {
            webformViewPrivate = enketoWebformView._PRIVATE_TEST_ONLY_;
        });

        beforeEach(() => {
            documentRange = document.createRange();

            sandbox.stub(document, 'createRange').returns(documentRange);

            sandbox.stub(lodash, 'memoize').callsFake(fn => fn);

            if (!Object.prototype.hasOwnProperty.call(settings, 'print')) {
                settings.print = undefined;
            }

            instanceId = 'instance1';

            existingInstance = null;

            surveyInitData = {
                get enketoId() { return enketoId; },
                get instanceId() { return instanceId; },
            };

            formHeader = document.querySelector('.form-header');
        });

        afterEach(() => {
            sandbox.restore();

            calcModule.update = calcModuleUpdate;
            FormModel.prototype.setInstanceIdAndDeprecatedId = formModelPrototypeSetInstanceIdAndDeprecatedId;
            preloadModule.init = preloadModuleInit;
        });

        it('initializes a form to view an existing instance/record', async () => {
            sandbox.stub(gui, 'alertLoadErrors')
                .callsFake(errors => {
                    const item = Array.isArray(errors) ? errors[0] : errors;
                    const error = typeof item === 'string' ? new Error(item) : item;

                    throw error;
                });

            existingInstance = '<a>value</a>';

            const formFragment = documentRange.createContextualFragment(viewForm);

            const writeableQuestionElements = {
                input: formFragment.getElementById('input-3'),
                textarea: formFragment.getElementById('textarea-3'),
                select: formFragment.getElementById('select-3'),
                options: [ ...formFragment.querySelectorAll('option.writeable') ],
                repeats: [ ...formFragment.querySelectorAll('.or-repeat-info') ],
            };

            const formParts = {
                ...surveyInitData,

                externalData: [],
                form: viewForm,
                languages: [],
                model: '<a/>',
                theme: 'kobo',
            };

            const instanceAttachments = {
                'a.jpg': 'https://example.com/a.jpg',
            };

            const instanceResult = {
                instance: existingInstance,
                instanceAttachments,
                ignoreMe: true,
            };

            const formPartsWithInstanceData = {
                ...formParts,

                instance: existingInstance,
                instanceAttachments,
            };

            const swappedThemeSurvey = {
                ...formPartsWithInstanceData,
                theme: 'swapped',
            };

            const initializedForm = {
                languages: [ 'ar', 'fa' ],
            };

            const formElement = formFragment.querySelector('form');

            const artificialTitleElement = {
                textContent: 'Not title of form',
            };

            const titleHeading = formElement.querySelector('#form-title');

            sandbox.stub(i18next, 'use').returns(i18next);

            const steps = [
                prepareInitStep({
                    description: 'Overriding enketo-core state management',
                    stubMethod: 'set',
                    object: calcModule,
                    key: 'update',
                    expectedValue: expectFunction,
                }),
                prepareInitStep({
                    description: 'Overriding enketo-core state management',
                    stubMethod: 'set',
                    object: FormModel.prototype,
                    key: 'setInstanceIdAndDeprecatedId',
                    expectedValue: expectFunction,
                }),
                prepareInitStep({
                    description: 'Overriding enketo-core state management',
                    stubMethod: 'set',
                    object: preloadModule,
                    key: 'init',
                    expectedValue: expectFunction,
                }),
                prepareInitStep({
                    description: 'Translator: initialize i18next',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 'init',
                    expectedArgs: [ expectObject, expectCallback ],
                }),
                prepareInitStep({
                    description: 'Get form parts',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getFormParts',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.resolve(formParts),
                }),
                prepareInitStep({
                    description: 'Get existing instance',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getExistingInstance',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.resolve(instanceResult),
                }),
                prepareInitStep({
                    description: 'Swap theme',
                    stubMethod: 'callsFake',
                    object: gui,
                    key: 'swapTheme',
                    expectedArgs: [ formPartsWithInstanceData ],
                    returnValue: Promise.resolve(swappedThemeSurvey),
                }),
                prepareInitStep({
                    description: 'Create DOM representation of form HTML',
                    stubMethod: 'callsFake',
                    object: documentRange,
                    key: 'createContextualFragment',
                    expectedArgs: [ viewForm ],
                    returnValue: formFragment,
                }),
                prepareInitStep({
                    description: 'Set input readonly',
                    stubMethod: 'callsFake',
                    object: writeableQuestionElements.input,
                    key: 'setAttribute',
                    expectedArgs: [ 'readonly', 'readonly' ],
                    returnValue: null,
                }),
                prepareInitStep({
                    description: 'Set input readonly-forced class',
                    stubMethod: 'callsFake',
                    object: writeableQuestionElements.input.classList,
                    key: 'add',
                    expectedArgs: [ 'readonly-forced' ],
                    returnValue: null,
                }),
                prepareInitStep({
                    description: 'Set textarea readonly',
                    stubMethod: 'callsFake',
                    object: writeableQuestionElements.textarea,
                    key: 'setAttribute',
                    expectedArgs: [ 'readonly', 'readonly' ],
                    returnValue: null,
                }),
                prepareInitStep({
                    description: 'Set textarea readonly-forced class',
                    stubMethod: 'callsFake',
                    object: writeableQuestionElements.textarea.classList,
                    key: 'add',
                    expectedArgs: [ 'readonly-forced' ],
                    returnValue: null,
                }),
                prepareInitStep({
                    description: 'Set select readonly',
                    stubMethod: 'callsFake',
                    object: writeableQuestionElements.select,
                    key: 'setAttribute',
                    expectedArgs: [ 'readonly', 'readonly' ],
                    returnValue: null,
                }),
                prepareInitStep({
                    description: 'Set select readonly-forced class',
                    stubMethod: 'callsFake',
                    object: writeableQuestionElements.select.classList,
                    key: 'add',
                    expectedArgs: [ 'readonly-forced' ],
                    returnValue: null,
                }),

                ...writeableQuestionElements.options.map((option, index) => {
                    return prepareInitStep({
                        description: `Set option ${index} disabled`,
                        stubMethod: 'set',
                        object: option,
                        key: 'disabled',
                        expectedValue: true,
                    });
                }),

                ...writeableQuestionElements.repeats.map((repeat, index) => {
                    return prepareInitStep({
                        description: `Set repeat ${index} data-repeat-fixed attribute`,
                        stubMethod: 'callsFake',
                        object: repeat,
                        key: 'setAttribute',
                        expectedArgs: [ 'data-repeat-fixed', 'fixed' ],
                        returnValue: null,
                    });
                }),

                prepareInitStep({
                    description: 'Resolve form-header',
                    stubMethod: 'callsFake',
                    object: document,
                    key: 'querySelector',
                    expectedArgs: [ '.main > .paper > .form-header' ],
                    returnValue: formHeaderElement,
                }),
                prepareInitStep({
                    description: 'Append form element after header',
                    stubMethod: 'callsFake',
                    object: formHeader,
                    key: 'after',
                    expectedArgs: [ formFragment ],
                }),
                prepareInitStep({
                    description: 'Resolve appended form element',
                    stubMethod: 'callsFake',
                    object: document,
                    key: 'querySelector',
                    expectedArgs: [ 'form.or' ],
                    returnValue: formElement,
                }),
                prepareInitStep({
                    description: 'Initialize controller-webform',
                    stubMethod: 'callsFake',
                    object: controller,
                    key: 'init',
                    expectedArgs: [
                        formElement,
                        {
                            modelStr: swappedThemeSurvey.model,
                            instanceStr: existingInstance,
                            external: swappedThemeSurvey.externalData,
                            instanceAttachments,
                            survey: swappedThemeSurvey,
                        },
                    ],
                    returnValue: Promise.resolve(initializedForm),
                }),
                prepareInitStep({
                    description: 'Assign languages',
                    stubMethod: 'set',
                    object: swappedThemeSurvey,
                    key: 'languages',
                    expectedValue: initializedForm.languages,
                }),
                prepareInitStep({
                    description: 'Get title element',
                    stubMethod: 'callsFake',
                    object: document,
                    key: 'querySelector',
                    expectedArgs: [ 'head>title' ],
                    returnValue: artificialTitleElement,
                }),
                prepareInitStep({
                    description: 'Resolve form title heading element',
                    stubMethod: 'callsFake',
                    object: document,
                    key: 'querySelector',
                    expectedArgs: [ '#form-title' ],
                    returnValue: titleHeading,
                }),
                prepareInitStep({
                    description: 'Set page title',
                    stubMethod: 'set',
                    object: artificialTitleElement,
                    key: 'textContent',
                    expectedValue: viewFormTitle,
                }),
                prepareInitStep({
                    description: 'Check if print styles should be applied',
                    stubMethod: 'get',
                    object: settings,
                    key: 'print',
                    propertyValue: true,
                }),
                prepareInitStep({
                    description: 'Apply print styles',
                    stubMethod: 'callsFake',
                    object: gui,
                    key: 'applyPrintStyle',
                    expectedArgs: [],
                }),
                prepareInitStep({
                    description: 'Localization',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 'dir',
                    expectedArgs: [],
                }),
            ];

            /** @type {Promise} */
            let viewInitialization = webformViewPrivate._init(surveyInitData);

            await viewInitialization;


            for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                const performedStep = performedSteps.find(performedStep => {
                    return performedStep === expectedStep;
                });
                const index = performedSteps.indexOf(expectedStep);

                expect(performedStep).to.equal(expectedStep);
                expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                    .to.equal(expectedIndex);
            }

            expect(performedSteps.length).to.equal(steps.length);
        });

        it('reports view initialization failure', async () => {
            enketoId = 'viewA';

            const formTitle = 'Title of form';
            const form = `<form>
                <h3 id="form-title">${formTitle}</h3>
            </form>`;

            const formParts = {
                ...surveyInitData,

                externalData: [],
                form,
                languages: [],
                model: '<a/>',
                theme: 'kobo',
            };

            const error = new Error('No network connection.');

            const steps = [
                prepareInitStep({
                    description: 'Overriding enketo-core state management',
                    stubMethod: 'set',
                    object: calcModule,
                    key: 'update',
                    expectedValue: expectFunction,
                }),
                prepareInitStep({
                    description: 'Overriding enketo-core state management',
                    stubMethod: 'set',
                    object: FormModel.prototype,
                    key: 'setInstanceIdAndDeprecatedId',
                    expectedValue: expectFunction,
                }),
                prepareInitStep({
                    description: 'Overriding enketo-core state management',
                    stubMethod: 'set',
                    object: preloadModule,
                    key: 'init',
                    expectedValue: expectFunction,
                }),
                prepareInitStep({
                    description: 'Translator: initialize i18next',
                    stubMethod: 'callsFake',
                    object: i18next,
                    key: 'init',
                    expectedArgs: [ expectObject, expectCallback ],
                }),
                prepareInitStep({
                    description: 'Get form parts',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getFormParts',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.resolve(formParts),
                }),
                prepareInitStep({
                    description: 'Get existing instance',
                    stubMethod: 'callsFake',
                    object: connection,
                    key: 'getExistingInstance',
                    expectedArgs: [ surveyInitData ],
                    returnValue: Promise.reject(error),
                }),
                prepareInitStep({
                    description: 'Set error class',
                    stubMethod: 'callsFake',
                    object: loaderElement.classList,
                    key: 'add',
                    expectedArgs: [ 'fail' ],
                }),
                prepareInitStep({
                    description: 'Alert load errors',
                    stubMethod: 'callsFake',
                    object: gui,
                    key: 'alertLoadErrors',
                    expectedArgs: [ [ error.message ] ]
                }),
            ];

            /** @type {Promise} */
            let viewInitialization = webformViewPrivate._init(surveyInitData);

            await viewInitialization;

            for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                const step = performedSteps.find(performedStep => {
                    return performedStep === expectedStep;
                });
                const index = performedSteps.indexOf(expectedStep);

                expect(step).to.equal(expectedStep);
                expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                    .to.equal(expectedIndex);
            }

            expect(performedSteps.length).to.equal(steps.length);
        });

        const invalidForms = [
            { form: '<form></form>' },
            { model: '<any />' },
        ];

        invalidForms.forEach((formData) => {
            it('reports view initialization failure when fetched form data is invalid', async () => {
                enketoId = 'viewA';

                const formParts = {
                    ...surveyInitData,
                    ...formData,

                    externalData: [],
                    languages: [],
                    theme: 'kobo',
                };

                existingInstance = '<a>value</a>';

                const instanceAttachments = {
                    'a.jpg': 'https://example.com/a.jpg',
                };

                const instanceResult = {
                    instance: existingInstance,
                    instanceAttachments,
                    ignoreMe: true,
                };

                const translatedErrorMessage = 'Unknown error';

                const steps = [
                    prepareInitStep({
                        description: 'Overriding enketo-core state management',
                        stubMethod: 'set',
                        object: calcModule,
                        key: 'update',
                        expectedValue: expectFunction,
                    }),
                    prepareInitStep({
                        description: 'Overriding enketo-core state management',
                        stubMethod: 'set',
                        object: FormModel.prototype,
                        key: 'setInstanceIdAndDeprecatedId',
                        expectedValue: expectFunction,
                    }),
                    prepareInitStep({
                        description: 'Overriding enketo-core state management',
                        stubMethod: 'set',
                        object: preloadModule,
                        key: 'init',
                        expectedValue: expectFunction,
                    }),
                    prepareInitStep({
                        description: 'Translator: initialize i18next',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 'init',
                        expectedArgs: [ expectObject, expectCallback ],
                    }),
                    prepareInitStep({
                        description: 'Get form parts',
                        stubMethod: 'callsFake',
                        object: connection,
                        key: 'getFormParts',
                        expectedArgs: [ surveyInitData ],
                        returnValue: Promise.resolve(formParts),
                    }),
                    prepareInitStep({
                        description: 'Get existing instance',
                        stubMethod: 'callsFake',
                        object: connection,
                        key: 'getExistingInstance',
                        expectedArgs: [ surveyInitData ],
                        returnValue: Promise.resolve(instanceResult),
                    }),
                    prepareInitStep({
                        description: 'Translate error message',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 't',
                        expectedArgs: [ 'error.unknown', undefined ],
                        returnValue: translatedErrorMessage,
                    }),
                    prepareInitStep({
                        description: 'Set error class',
                        stubMethod: 'callsFake',
                        object: loaderElement.classList,
                        key: 'add',
                        expectedArgs: [ 'fail' ],
                    }),
                    prepareInitStep({
                        description: 'Alert load errors',
                        stubMethod: 'callsFake',
                        object: gui,
                        key: 'alertLoadErrors',
                        expectedArgs: [ [ translatedErrorMessage ] ]
                    }),
                ];

                /** @type {Promise} */
                let viewInitialization = webformViewPrivate._init(surveyInitData);

                await viewInitialization;

                for (const [ expectedIndex, expectedStep ] of steps.entries()) {
                    const step = performedSteps.find(performedStep => {
                        return performedStep === expectedStep;
                    });
                    const index = performedSteps.indexOf(expectedStep);

                    expect(step).to.equal(expectedStep);
                    expect(index, `Unexpected order of step ${expectedStep.options.description}`)
                        .to.equal(expectedIndex);
                }

                expect(performedSteps.length).to.equal(steps.length);
            });
        });
    });

    describe('enketo-webform-view.js initialization behavior', () => {
        /** @type {DocumentFragment} */
        let formFragment;

        /** @type {Record<string, any> | null} */
        let webformViewPrivate = null;

        /** @type {Stub} */
        let calcModuleUpdateStub;

        /** @type {Function | null} */
        let calcModuleUpdate;

        /** @type {Stub} */
        let formModelPrototypeSetInstanceIdAndDeprecatedIdStub;

        /** @type {Function | null} */
        let formModelPrototypeSetInstanceIdAndDeprecatedId;

        /** @type {Stub} */
        let preloadModuleInitStub;

        /** @type {Function | null} */
        let preloadModuleInit;

        before(async () => {
            webformViewPrivate = enketoWebformView._PRIVATE_TEST_ONLY_;

            formFragment = webformViewPrivate._convertToReadonly({ form: viewForm }).formFragment;


            calcModuleUpdate = null;
            formModelPrototypeSetInstanceIdAndDeprecatedId = null;
            preloadModuleInit = null;

            calcModuleUpdateStub = sandbox.stub(calcModule, 'update').set((value) => {
                calcModuleUpdate = value;
            }).callsFake(() => {});

            formModelPrototypeSetInstanceIdAndDeprecatedIdStub = sandbox.stub(FormModel.prototype, 'setInstanceIdAndDeprecatedId').set((value) => {
                formModelPrototypeSetInstanceIdAndDeprecatedId = value;
            }).callsFake(() => {});

            preloadModuleInitStub = sandbox.stub(preloadModule, 'init').set((value) => {
                preloadModuleInit = value;
            }).callsFake(() => {});
        });

        beforeEach(() => {
            enketoId = 'surveyA';

            sandbox.stub(i18next, 't').returnsArg(0);
        });

        afterEach(() => {
            expect(calcModuleUpdateStub).not.to.have.been.called;
            expect(formModelPrototypeSetInstanceIdAndDeprecatedIdStub).not.to.have.been.called;
            expect(preloadModuleInitStub).not.to.have.been.called;

            sandbox.restore();

            calcModule.update = calcModuleUpdate;
            FormModel.prototype.setInstanceIdAndDeprecatedId = formModelPrototypeSetInstanceIdAndDeprecatedId;
            preloadModule.init = preloadModuleInit;
        });

        describe('readonly conversion', () => {
            it('creates a document fragment from the provided form HTML', () => {
                expect(formFragment).to.be.an.instanceof(DocumentFragment);
            });

            const questionFieldTypes = [
                'input',
                'textarea',
                'select',
            ];

            questionFieldTypes.forEach(questionFieldType => {
                it(`ensures all ${questionFieldType} within a question are readonly`, () => {
                    const fields = formFragment.querySelectorAll(
                        `.question ${questionFieldType}`
                    );

                    fields.forEach(field => {
                        expect(field.getAttribute('readonly')).to.equal('readonly');
                    });
                });

                it(`ensures all ${questionFieldType}s within a question which were not previously readonly are forced to be readonly`, () => {
                    const fields = formFragment.querySelectorAll(
                        `.question ${questionFieldType}.writeable-by-default`
                    );

                    fields.forEach(field => {
                        expect(field.classList.contains('readonly-forced')).to.equal(true);
                    });
                });
            });

            it('does not disable options within the form languages menu', () => {
                const options = formFragment.querySelectorAll('#form-languages option');

                options.forEach(option => {
                    expect(option.disabled).to.equal(false);
                });
            });

            it('disables all other menu options', () => {
                const options = formFragment.querySelectorAll('select:not(#form-languages) option');

                options.forEach(option => {
                    expect(option.disabled).to.equal(true);
                });
            });

            it('prevents adding or removing repeats', () => {
                const repeats = formFragment.querySelectorAll('.or-repeat-info');

                repeats.forEach(repeat => {
                    expect(repeat.dataset.repeatFixed).to.equal('fixed');

                    const addRemoveButtons = repeat.querySelectorAll(
                        '.repeat-buttons, .add-repeat-button'
                    );

                    expect(addRemoveButtons.length).to.equal(0);
                });
            });
        });

        describe('error handling', () => {
            class StatusError extends Error {
                /**
                 * @param {number} status
                 */
                constructor(status) {
                    super(`HTTP Error: ${status}`);

                    this.status = status;
                }
            }

            const loginURL = 'https://example.com/login';
            const initialURL = 'https://example.com/-/x/f33db33f';

            /** @type {Stub} */
            let addLoaderClassStub;

            /** @type {string} */
            let currentURL;

            /** @type {Stub} */
            let redirectStub;

            /** @type {loadErrorsStub} */
            let loadErrorsStub;

            beforeEach(() => {
                sandbox.stub(settings, 'loginUrl').get(() => loginURL);

                addLoaderClassStub = sandbox.stub(loaderElement.classList, 'add').returns();

                currentURL = 'https://example.com/-/x/f33db33f';
                redirectStub = sandbox.stub(webformViewPrivate._location, 'href');

                redirectStub.get(() => currentURL);

                redirectStub.set(redirectLocation => {
                    currentURL = redirectLocation;
                });


                loadErrorsStub = sandbox.stub(gui, 'alertLoadErrors').returns();
            });

            it('indicates failure on the loading indicator', () => {
                const error = new Error('bummer');

                enketoWebformView.showErrorOrAuthenticate(error);

                expect(addLoaderClassStub).to.have.been.calledWith('fail');
            });

            it('redirects to a login page on authorization failure', () => {
                const error = new StatusError(401);

                enketoWebformView.showErrorOrAuthenticate(error);

                expect(currentURL).to.equal(`${loginURL}?return_url=${encodeURIComponent(initialURL)}`);
                expect(loadErrorsStub).not.to.have.been.called;
            });

            it('does not redirect to a login page for other network errors', () => {
                const error = new StatusError(404);

                enketoWebformView.showErrorOrAuthenticate(error);

                expect(currentURL).to.equal(initialURL);
            });

            it('alerts a loading error message', () => {
                const error = new Error('oops!');

                enketoWebformView.showErrorOrAuthenticate(error);

                expect(loadErrorsStub).to.have.been.calledWith([ error.message ]);
            });

            it('alerts an unknown error message', () => {
                const error = new Error();

                enketoWebformView.showErrorOrAuthenticate(error);

                expect(loadErrorsStub).to.have.been.calledWith([ 'error.unknown' ]);
            });

            it('alerts multiple loading error messages', () => {
                const errors = [ 'really', 'not', 'good!' ];

                enketoWebformView.showErrorOrAuthenticate(errors);

                expect(loadErrorsStub).to.have.been.calledWith(errors);
            });
        });

        describe('preventing writes in enketo-core', () => {
            beforeEach(() => {
                sandbox.stub(console, 'log');
            });

            it('prevents calculations', () => {
                enketoWebformView.overrideEnketoCoreStateManagement();

                expect(typeof calcModuleUpdate).to.equal('function');

                calcModuleUpdate();

                expect(console.log).to.have.been.called;
            });

            it('prevents populating formID and instanceID', () => {
                enketoWebformView.overrideEnketoCoreStateManagement();

                expect(typeof formModelPrototypeSetInstanceIdAndDeprecatedId).to.equal('function');

                formModelPrototypeSetInstanceIdAndDeprecatedId();

                expect(console.log).to.have.been.called;
            });

            it('prevents preloading items', () => {
                enketoWebformView.overrideEnketoCoreStateManagement();

                expect(typeof preloadModuleInit).to.equal('function');

                preloadModuleInit();

                expect(console.log).to.have.been.called;
            });
        });
    });
});