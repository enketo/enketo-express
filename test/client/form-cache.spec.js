import encryptor from '../../public/js/src/module/encryptor';
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
            return formCache.getLastSavedRecord( survey.enketoId )
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

                    if ( encryptor.isEncryptionEnabled( survey ) ) {
                        return encryptor.setEncryptionEnabled( formParts );
                    }

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

    describe( 'last-saved records', () => {
        const enketoId = 'surveyA';

        /** @type {EnketoRecord} */
        let record;

        beforeEach( done => {
            record = {
                draft: false,
                enketoId,
                instanceId: 'recordA',
                name: 'name A',
                xml: '<data id="modelA"><item>initial</item><meta><instanceID/></meta></data>',
            };

            survey = {
                openRosaId: 'formA',
                openRosaServer: 'http://localhost:3000',
                enketoId,
                theme: '',
            };

            sandbox.stub( settings, 'enketoId' ).get( () => survey.enketoId );

            store.init().then( done, done );
        } );

        afterEach( done => {
            store.survey.removeAll().then( done, done );
        } );

        it( 'sets the survey\'s last saved record', done => {
            const originalRecord = Object.assign( {}, record );

            formCache.init( survey )
                .then( () => {
                    return formCache.setLastSavedRecord( enketoId, record );
                } )
                .then( survey => {
                    Object.entries( originalRecord ).forEach( ( [ key, value ] ) => {
                        expect( survey.lastSavedRecord[ key ] ).to.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'preserves the last saved record when a form is updated', done => {
            const originalRecord = Object.assign( {}, record );
            const updates = {
                model: `${model1}<!-- updated -->`,
                hash: '123456',
            };

            // Ensure `_updateCache` receives a new hash indicating it should perform an update
            sinon.stub( connection, 'getFormPartsHash' ).callsFake( () => {
                return Promise.resolve( updates.hash );
            } );

            let updatePromise = new Promise( resolve => {
                setTimeout( resolve, formCache.CACHE_UPDATE_INITIAL_DELAY + 1 );
            } );

            const originalStoreUpdate = store.survey.update.bind( store.survey );

            sinon.stub( store.survey, 'update' ).callsFake( update => {
                return originalStoreUpdate( update ).then( result => {
                    if ( update.model === updates.model ) {
                        timers.tick( 1 );
                    }

                    return result;
                } );
            } );

            formCache.init( survey )
                .then( () => {
                    return formCache.setLastSavedRecord( enketoId, record );
                } )
                .then( () => {
                    getFormPartsStubResult = Object.assign( {}, getFormPartsStubResult, updates );

                    timers.tick( formCache.CACHE_UPDATE_INITIAL_DELAY );

                    // Wait for `_updateCache` to resolve
                    return updatePromise;
                } ).then( () => formCache.get( survey ) )
                .then( survey => {
                    Object.entries( updates ).forEach( ( [ key, value ] ) => {
                        expect( survey[key] ).to.equal( value );
                    } );

                    Object.entries( originalRecord ).forEach( ( [ key, value ] ) => {
                        expect( survey.lastSavedRecord[ key ] ).to.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'updates last-saved externalData when the last saved record is updated', done => {
            const updatedItemValue = 'populated';
            const update = Object.assign( {}, record, {
                xml: `<data id="surveyA"><item>${updatedItemValue}</item><meta><instanceID>uuid:ea3baa91-74b5-4892-af6f-96267f7fe12e</instanceID></meta></data>`,
            } );

            formCache.init( survey )
                .then( () => formCache.setLastSavedRecord( enketoId, update ) )
                .then( () => formCache.get( survey ) )
                .then( survey => {
                    expect( Array.isArray( survey.externalData ) ).to.equal( true );
                    expect( survey.externalData.length ).to.equal( 1 );

                    const data = survey.externalData[0];

                    expect( data.id ).to.equal( lastSavedExternalData.id );
                    expect( data.src ).to.equal( lastSavedExternalData.src );

                    /** @type {Element} */
                    const xmlDocument = data.xml.documentElement;

                    const dataItemValue = xmlDocument.querySelector( 'item' ).innerHTML;

                    expect( dataItemValue ).to.equal( updatedItemValue );
                } )
                .then( done, done );
        } );

        it( 'does not set the survey\'s last saved record when encryption is enabled', done => {
            encryptor.setEncryptionEnabled( survey );

            const form = { id: 'abc', version: '2', encryptionKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5s9p+VdyX1ikG8nnoXLCC9hKfivAp/e1sHr3O15UQ+a8CjR/QV29+cO8zjS/KKgXZiOWvX+gDs2+5k9Kn4eQm5KhoZVw5Xla2PZtJESAd7dM9O5QrqVJ5Ukrq+kG/uV0nf6X8dxyIluNeCK1jE55J5trQMWT2SjDcj+OVoTdNGJ1H6FL+Horz2UqkIObW5/elItYF8zUZcO1meCtGwaPHxAxlvODe8JdKs3eMiIo9eTT4WbH1X+7nJ21E/FBd8EmnK/91UGOx2AayNxM0RN7pAcj47a434LzeM+XCnBztd+mtt1PSflF2CFE116ikEgLcXCj4aklfoON9TwDIQSp0wIDAQAB' };

            formCache.init( survey )
                .then( () => encryptor.encryptRecord( form, record ) )
                .then( encryptedRecord => {
                    return formCache.setLastSavedRecord( enketoId, encryptedRecord );
                } )
                .then( survey => {
                    expect( survey.lastSavedRecord ).to.equal( undefined );
                } )
                .then( done, done );
        } );

        it( 'does not set the survey\'s last saved unencrypted draft record when encryption is enabled', done => {
            encryptor.setEncryptionEnabled( survey );

            record.draft = true;

            formCache.init( survey )
                .then( () => {
                    return formCache.setLastSavedRecord( enketoId, record );
                } )
                .then( survey => {
                    expect( survey.lastSavedRecord ).to.equal( undefined );
                } )
                .then( done, done );
        } );

        it( 'gets the survey\'s last saved record', done => {
            const originalRecord = Object.assign( {}, record );

            formCache.init( survey )
                .then( survey => {
                    return formCache.setLastSavedRecord( survey.enketoId, record );
                } )
                .then( survey => {
                    return formCache.getLastSavedRecord( survey.enketoId );
                } )
                .then( lastSavedRecord => {
                    Object.entries( originalRecord ).forEach( ( [ key, value ] ) => {
                        expect( lastSavedRecord[ key ] ).to.equal( value );
                    } );
                } )
                .then( done, done );
        } );
    } );
} );
