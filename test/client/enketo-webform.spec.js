import i18next from 'i18next';
import lodash from 'lodash';
import applicationCache from '../../public/js/src/module/application-cache';
import connection from '../../public/js/src/module/connection';
import controller from '../../public/js/src/module/controller-webform';
import event from '../../public/js/src/module/event';
import formCache from '../../public/js/src/module/form-cache';
import gui from '../../public/js/src/module/gui';
import settings from '../../public/js/src/module/settings';
import store from '../../public/js/src/module/store';

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

/** @type {Record<string, any> | null} */
let webformPrivate = null;

describe( 'Enketo webform app', () => {

    /** @type {string} */
    let enketoId;

    /** @type {Record<string, string>} */
    let defaults;

    /** @type {Sandbox} */
    let sandbox;

    beforeEach( async () => {
        sandbox = sinon.createSandbox();

        enketoId = 'surveyA';
        defaults = {};

        if ( webformPrivate == null ) {
            const domParser = new DOMParser();
            const formDOM = domParser.parseFromString( `
                <div class="main">
                    <div class="paper">
                        <div class="form-header"></div>
                    </div>
                </div>
            `, 'text/html' );

            document.body.appendChild( formDOM.documentElement.querySelector( '.main' ) );

            const { _PRIVATE_TEST_ONLY_ } = await import( '../../public/js/src/enketo-webform' );

            webformPrivate = _PRIVATE_TEST_ONLY_;
        }
    } );

    afterEach( () => {
        sandbox.restore();
    } );

    describe( 'initialization steps', () => {
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

        /** @typedef {MockGetter | ExpectSetter | MockExpectedCall} InitStepOptions */

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

        /** @type {Partial<Survey>} */
        let surveyInitData;

        /** @type {Map<object, Record<PropertyKey, PreparedStepCache>>} */
        let preparedStepsCache;

        /** @type {InitStep[]} */
        let performedSteps;

        class ParameterPredicate {
            constructor( predicate ) {
                this.predicate = predicate;
            }

            check( actual ) {
                expect( actual ).to.satisfy( this.predicate );
            }
        }

        /**
         * Creates a predicate to determine whether a value is of the
         * specified type.
         *
         * @param {string} expected
         */
        const expectTypeof = ( expected ) => (
            new ParameterPredicate( ( actual => typeof actual === expected ) )
        );

        const expectFunction = expectTypeof( 'function' );
        const expectObject = expectTypeof( 'object' );

        /**
         * Creates a predicate to determine that a callback was provided,
         * and call it when provided.
         */
        const expectCallback = new ParameterPredicate( ( callback ) => {
            if ( typeof callback === 'function' ) {
                callback();

                return true;
            }

            return false;
        } );

        /**
         * Creates a predicate to determine if a translator URL was provided.
         *
         * @param {string} expected
         */
        const expectLanguage = ( expected ) => (
            new ParameterPredicate( lang => lang.includes( `/${expected}/` ) )
        );

        /**
         * @param {object} object
         * @param {PropertyKey} key
         * @return {PreparedStepCache}
         */
        const getPreparedStep = ( object, key ) => {
            let objectCache = preparedStepsCache.get( object );

            if ( objectCache == null ) {
                objectCache = {};

                preparedStepsCache.set( object, objectCache );
            }

            let cache = objectCache[key];

            if ( cache == null ) {
                cache = {
                    queue: [],
                    stub: sandbox.stub( object, key ),
                };

                Object.assign( objectCache, {
                    [key]: cache,
                } );
            }

            return cache;
        };

        const debugLog = ( ...args ) => {
            if ( DEBUG ) {
                console.log( ...args );
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
        const prepareInitStep = ( options ) => {
            const {
                description,
                stubMethod,
                object,
                key,
            } = options;

            let { queue, stub } = getPreparedStep( object, key );

            debugLog( 'Initializing:', description );

            const initStep = {
                options,
                resolveStep( ...args ) {
                    const {
                        description,
                        stubMethod,
                        propertyValue,
                        expectedValue,
                        expectedArgs,
                        returnValue,
                    } = this.options;

                    debugLog( 'Performing:', description );

                    performedSteps.push( this );

                    if ( stubMethod === 'get' ) {
                        return propertyValue;
                    }

                    if ( stubMethod === 'set' ) {
                        return expect( args ).to.deep.equal( [ expectedValue ] );
                    }

                    expect( args.length ).to.equal( expectedArgs.length );

                    for ( const [ index, arg ] of args.entries() ) {
                        const expected = expectedArgs[index];

                        if ( expected instanceof ParameterPredicate ) {
                            expected.check( arg );
                        } else {
                            expect( arg ).to.deep.equal( expected );
                        }
                    }

                    return returnValue;
                },
            };

            queue.push( initStep );

            stub[stubMethod]( ( ...args ) => {
                let step = queue.shift();

                expect( step ).not.to.be.undefined;

                return step.resolveStep( ...args );
            } );

            debugLog( 'Initialized:', description );

            return initStep;
        };


        beforeEach( async () => {
            performedSteps = [];
            preparedStepsCache = new Map();

            enketoId = 'surveyA';
            defaults = {};

            surveyInitData = {
                get enketoId() { return enketoId; },
                get defaults() { return defaults; },
            };

            sandbox.stub( lodash, 'memoize' ).callsFake( fn => fn );
        } );

        describe( 'offline', () => {
            /** @type {import('sinon').SinonFakeTimers} */
            let timers;

            beforeEach( () => {
                sandbox.stub( settings, 'offline' ).get( () => true );

                timers = sinon.useFakeTimers();
            } );

            afterEach( () => {
                timers.clearInterval();
                timers.clearTimeout();
                timers.restore();
            } );

            it( 'initializes offline forms', async () => {
                enketoId = 'offlineA';

                const xformUrl = 'https://example.com/form.xml';
                const surveyInit = {
                    ...surveyInitData,

                    xformUrl,
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

                const webformInitializedSurvey = {
                    ...maxSizeSurvey,

                    languages: [ 'ar', 'fa' ],
                };

                const updatedMediaSurvey = {
                    ...webformInitializedSurvey,
                    media: [],
                };

                const formElement = document.createElement( 'form' );

                sandbox.stub( i18next, 'use' ).returns( i18next );

                const steps = [
                    prepareInitStep( {
                        description: 'Offline-capable event listener',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'addEventListener',
                        expectedArgs: [ event.OfflineLaunchCapable().type, expectFunction ],
                    } ),
                    prepareInitStep( {
                        description: 'Application update event listener',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'addEventListener',
                        expectedArgs: [ event.ApplicationUpdated().type, expectFunction ],
                    } ),
                    prepareInitStep( {
                        description: 'Initialize application cache',
                        stubMethod: 'callsFake',
                        object: applicationCache,
                        key: 'init',
                        expectedArgs: [ surveyInit ],
                        returnValue: Promise.resolve( surveyInit ),
                    } ),
                    prepareInitStep( {
                        description: 'Translator: initialize i18next',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 'init',
                        expectedArgs: [ expectObject, expectCallback ],
                    } ),
                    prepareInitStep( {
                        description: 'Initialize form cache',
                        stubMethod: 'callsFake',
                        object: formCache,
                        key: 'init',
                        expectedArgs: [ surveyInit ],
                        returnValue: Promise.resolve( offlineSurvey ),
                    } ),

                    // While there is currently a truthiness check on the query result,
                    // there is a subsequent access outside that check.
                    prepareInitStep( {
                        description: 'Add branding: Ensure a brand image query resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.form-header__branding img' ],
                        returnValue: document.createElement( 'img' ),
                    } ),

                    prepareInitStep( {
                        description: 'Swap theme',
                        stubMethod: 'callsFake',
                        object: gui,
                        key: 'swapTheme',
                        expectedArgs: [ offlineSurvey ],
                        returnValue: Promise.resolve( offlineSurvey ),
                    } ),
                    prepareInitStep( {
                        description: 'Get/update max submission size',
                        stubMethod: 'callsFake',
                        object: formCache,
                        key: 'updateMaxSubmissionSize',
                        expectedArgs: [ offlineSurvey ],
                        returnValue: Promise.resolve( maxSizeSurvey ),
                    } ),
                    prepareInitStep( {
                        description: 'Assign max submission size to settings',
                        stubMethod: 'set',
                        object: settings,
                        key: 'maxSize',
                        expectedValue: maxSize,
                    } ),
                    prepareInitStep( {
                        description: 'Ensure a query for the page\'s form resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ 'form.or' ],
                        returnValue: formElement,
                    } ),
                    prepareInitStep( {
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
                        returnValue: Promise.resolve( webformInitializedSurvey ),
                    } ),
                    prepareInitStep( {
                        description: 'Get page title',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ 'head>title' ],
                        returnValue: document.createElement( 'title' ),
                    } ),
                    prepareInitStep( {
                        description: 'Load Arabic translation',
                        stubMethod: 'callsFake',
                        object: globalThis,
                        key: 'fetch',
                        expectedArgs: [ expectLanguage( 'ar' ) ],
                        returnValue: Promise.resolve(),
                    } ),
                    prepareInitStep( {
                        description: 'Load Farsi translation',
                        stubMethod: 'callsFake',
                        object: globalThis,
                        key: 'fetch',
                        expectedArgs: [ expectLanguage( 'fa' ) ],
                        returnValue: Promise.resolve(),
                    } ),
                    prepareInitStep( {
                        description: 'Update form cache media',
                        stubMethod: 'callsFake',
                        object: formCache,
                        key: 'updateMedia',
                        expectedArgs: [ webformInitializedSurvey ],
                        returnValue: Promise.resolve( updatedMediaSurvey ),
                    } ),
                    prepareInitStep( {
                        description: 'Set cache event handlers',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'addEventListener',
                        expectedArgs: [ event.FormUpdated().type, expectTypeof( 'function' ) ],
                    } ),
                ];

                /** @type {Promise} */
                let offlineInitialization = webformPrivate._initOffline( surveyInit );

                expect( 'xformUrl' in surveyInit ).to.equal( false );

                await offlineInitialization;

                for ( const [ expectedIndex, expectedStep ] of steps.entries() ) {
                    const step = performedSteps.find( performedStep => {
                        return performedStep === expectedStep;
                    } );
                    const index = performedSteps.indexOf( expectedStep );

                    expect( step ).to.equal( expectedStep );
                    expect( index, `Unexpected order of step ${expectedStep.options.description}` )
                        .to.equal( expectedIndex );
                }

                expect( performedSteps.length ).to.equal( steps.length );
            } );
        } );

        describe( 'online', () => {
            beforeEach( () => {
                sandbox.stub( settings, 'offline' ).get( () => false );
            } );

            it( 'initializes online forms', async () => {
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

                const webformInitializedSurvey = {
                    ...maxSize,

                    languages: [ 'ar', 'fa' ],
                };

                const formElement = document.createElement( 'form' );

                const steps = [
                    prepareInitStep( {
                        description: 'Initialize IndexedDB store (used for last-saved instances)',
                        stubMethod: 'callsFake',
                        object: store,
                        key: 'init',
                        expectedArgs: [ { failSilently: true } ],
                        returnValue: Promise.resolve(),
                    } ),
                    prepareInitStep( {
                        description: 'Translator: initialize i18next',
                        stubMethod: 'callsFake',
                        object: i18next,
                        key: 'init',
                        expectedArgs: [ expectObject, expectCallback ],
                    } ),

                    prepareInitStep( {
                        description: 'Get form parts',
                        stubMethod: 'callsFake',
                        object: connection,
                        key: 'getFormParts',
                        expectedArgs: [ surveyInit ],
                        returnValue: Promise.resolve( onlineSurvey ),
                    } ),

                    // While there is currently a truthiness check on the query result,
                    // there is a subsequent access outside that check.
                    prepareInitStep( {
                        description: 'Add branding: Ensure a brand image query resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ '.form-header__branding img' ],
                        returnValue: document.createElement( 'img' ),
                    } ),

                    prepareInitStep( {
                        description: 'Swap theme',
                        stubMethod: 'callsFake',
                        object: gui,
                        key: 'swapTheme',
                        expectedArgs: [ onlineSurvey ],
                        returnValue: Promise.resolve( onlineSurvey ),
                    } ),
                    prepareInitStep( {
                        description: 'Get max submission size',
                        stubMethod: 'callsFake',
                        object: connection,
                        key: 'getMaximumSubmissionSize',
                        expectedArgs: [ onlineSurvey ],
                        returnValue: Promise.resolve( maxSizeSurvey ),
                    } ),
                    prepareInitStep( {
                        description: 'Assign max submission size to settings',
                        stubMethod: 'set',
                        object: settings,
                        key: 'maxSize',
                        expectedValue: maxSize,
                    } ),
                    prepareInitStep( {
                        description: 'Ensure a query for the page\'s form resolves to an element',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ 'form.or' ],
                        returnValue: formElement,
                    } ),
                    prepareInitStep( {
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
                        returnValue: Promise.resolve( webformInitializedSurvey ),
                    } ),
                    prepareInitStep( {
                        description: 'Get page title',
                        stubMethod: 'callsFake',
                        object: document,
                        key: 'querySelector',
                        expectedArgs: [ 'head>title' ],
                        returnValue: document.createElement( 'title' ),
                    } ),
                ];

                /** @type {Promise} */
                let onlineInitialization = webformPrivate._initOnline( surveyInit );

                await onlineInitialization;

                for ( const [ expectedIndex, expectedStep ] of steps.entries() ) {
                    const step = performedSteps.find( performedStep => {
                        return performedStep === expectedStep;
                    } );
                    const index = performedSteps.indexOf( expectedStep );

                    expect( step ).to.equal( expectedStep );
                    expect( index, `Unexpected order of step ${expectedStep.options.description}` )
                        .to.equal( expectedIndex );
                }

                expect( performedSteps.length ).to.equal( steps.length );
            } );
        } );
    } );
} );
