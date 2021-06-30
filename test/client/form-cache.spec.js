import formCache from '../../public/js/src/module/form-cache';
import connection from '../../public/js/src/module/connection';
import store from '../../public/js/src/module/store';
import settings from '../../public/js/src/module/settings';

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
const defaultInstanceData = '<data id="modelA"><item>initial</item><meta><instanceID/></meta></data>';
const model1 = `<model><instance>${defaultInstanceData}</instance><instance id="last-saved" src="jr://instance/last-saved"/></model>`;
const hash1 = '12345';

describe( 'Client Form Cache', () => {
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

    beforeEach( done => {
        const formElement = document.createElement( 'form' );

        formElement.className = 'or';
        document.body.appendChild( formElement );

        survey = {};
        sandbox = sinon.createSandbox();

        // Prevent calls to `_updateCache` after tests complete/stubs are restored
        timers = sinon.useFakeTimers();

        lastSavedExternalData = {
            id: 'last-saved',
            src: 'jr://instance/last-saved',
            xml: parser.parseFromString( defaultInstanceData, 'text/xml' ),
        };

        getFormPartsStubResult = {
            externalData: [
                lastSavedExternalData,
            ],
            form: form1,
            model: model1,
            hash: hash1
        };

        getFormPartsSpy = sandbox.stub( connection, 'getFormParts' ).callsFake( survey => {
            return Promise.resolve( survey.enketoId )
                .then( enketoId => {
                    if ( enketoId != null ) {
                        return formCache.getLastSavedRecord( survey.enketoId );
                    }
                } )
                .then( lastSavedRecord => {
                    if ( lastSavedRecord != null ) {
                        return { lastSavedRecord };
                    }

                    return {};
                } )
                .then( lastSavedData => {
                    const formParts = Object.assign( {
                        enketoId: survey.enketoId,
                    }, getFormPartsStubResult, lastSavedData );

                    return formParts;
                } );
        } );

        getFileSpy = sandbox.stub( connection, 'getMediaFile' ).callsFake( url => Promise.resolve( {
            url,
            item: new Blob( [ 'babdf' ], {
                type: 'image/png'
            } )
        } ) );

        store.init().then( done, done );
    } );

    afterEach( done => {
        sandbox.restore();
        timers.clearTimeout();
        timers.clearInterval();
        timers.restore();

        document.body.removeChild( document.querySelector( 'form.or' ) );

        store.survey.removeAll().then( done, done );
    } );

    it( 'is loaded', () => {
        expect( formCache ).to.be.an( 'object' );
    } );

    describe( 'in empty state', () => {
        it( 'will call connection.getFormParts to obtain the form parts', done => {
            survey.enketoId = '10';
            formCache.init( survey )
                .then( () => {
                    expect( getFormPartsSpy ).to.have.been.calledWith( survey );
                } )
                .then( done, done );
        } );

        it( 'will call connection.getMediaFile to obtain form resources', done => {
            survey.enketoId = '20';
            formCache.init( survey )
                .then( result => {
                    const currentForm = document.querySelector( 'form.or' );
                    const form = document.createRange().createContextualFragment( result.form );

                    currentForm.parentNode.replaceChild( form, currentForm );

                    return formCache.updateMedia( result );
                } )
                .then( () => {
                    expect( getFileSpy ).to.have.been.calledWith( url1 );
                } )
                .then( done, done );
        } );

        it( 'will populate the cache upon initialization', done => {
            survey.enketoId = '30';
            formCache.get( survey )
                .then( result => {
                    expect( result ).to.equal( undefined );

                    return formCache.init( survey );
                } )
                .then( () => // we could also leave this out as formCache.init will return the survey object
                    formCache.get( survey ) )
                .then( result => {
                    expect( result.model ).to.equal( model1 );
                    expect( result.hash ).to.equal( hash1 );
                    expect( result.enketoId ).to.equal( survey.enketoId );
                } )
                .then( done, done );
        } );

        it( 'will empty src attributes and copy the original value to a data-offline-src attribute ', done => {
            survey.enketoId = '40';
            formCache.init( survey )
                .then( result => {
                    expect( result.form ).to.contain( 'src=""' ).and.to.contain( `data-offline-src="${url1}"` );
                } )
                .then( done, done );
        } );

    } );

    describe( 'access types', () => {
        /** @type {import('sinon').SinonStub} */
        let getSpy;

        /** @type {import('sinon').SinonStub} */
        let setSpy;

        beforeEach( () => {
            getSpy = sandbox.stub( store.survey, 'get' );
            setSpy = sandbox.stub( store.survey, 'set' );
        } );

        it( 'bypasses the store when initializing a form in preview mode', done => {
            sandbox.stub( settings, 'type' ).get( () => 'preview' );

            const previewSurvey = {
                enketoId: null,
                xformUrl: 'https://xlsform.getodk.org/downloads/b0x0gdti/Range%20test.xml',
                defaults: {}
            };

            let initResult;

            formCache.init( previewSurvey )
                .then( survey => {
                    initResult = survey;

                    return getFormPartsSpy.getCall( 0 ).returnValue;
                } )
                .then( formParts => {
                    expect( getSpy.called ).to.equal( false );
                    expect( setSpy.called ).to.equal( false );
                    expect( initResult ).to.deep.equal( formParts );
                } )
                .then( done, done );
        } );

        it( 'bypasses the store when initializing a form in single mode', done => {
            sandbox.stub( settings, 'type' ).get( () => 'single' );

            const singleSurvey = {
                enketoId: 'surveyA',
            };

            let initResult;

            formCache.init( singleSurvey )
                .then( survey => {
                    initResult = survey;

                    return getFormPartsSpy.getCall( 0 ).returnValue;
                } )
                .then( formParts => {
                    expect( getSpy.called ).to.equal( false );
                    expect( setSpy.called ).to.equal( false );
                    expect( initResult ).to.deep.equal( formParts );
                } )
                .then( done, done );
        } );

        it( 'bypasses the store when initializing a form in edit mode', done => {
            sandbox.stub( settings, 'type' ).get( () => 'edit' );

            const editSurvey = {
                enketoId: 'surveyA',
                instanceId: 'instance',
            };

            let initResult;

            formCache.init( editSurvey )
                .then( survey => {
                    initResult = survey;

                    return getFormPartsSpy.getCall( 0 ).returnValue;
                } )
                .then( formParts => {
                    expect( getSpy.called ).to.equal( false );
                    expect( setSpy.called ).to.equal( false );
                    expect( initResult ).to.deep.equal( formParts );
                } )
                .then( done, done );
        } );

        it( 'bypasses the store when initializing a form in view mode', done => {
            sandbox.stub( settings, 'type' ).get( () => 'view' );

            const viewSurvey = {
                enketoId: 'surveyA',
                instanceId: 'instance',
            };

            let initResult;

            formCache.init( viewSurvey )
                .then( survey => {
                    initResult = survey;

                    return getFormPartsSpy.getCall( 0 ).returnValue;
                } )
                .then( formParts => {
                    expect( getSpy.called ).to.equal( false );
                    expect( setSpy.called ).to.equal( false );
                    expect( initResult ).to.deep.equal( formParts );
                } )
                .then( done, done );
        } );
    } );
} );
