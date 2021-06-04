import encryptor from '../../public/js/src/module/encryptor';
import formCache from '../../public/js/src/module/form-cache';
import connection from '../../public/js/src/module/connection';
import store from '../../public/js/src/module/store';

/**
 * @typedef {import('../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

const url1 = '/path/to/source.png';
const form1 = `<form class="or"><img src="${url1}"/></form>`;
const model1 = '<model/>';
const hash1 = '12345';

describe( 'Client Form Cache', () => {
    let survey, sandbox, getFormPartsSpy, getFileSpy;

    beforeEach( done => {
        survey = {};
        sandbox = sinon.createSandbox();
        getFormPartsSpy = sandbox.stub( connection, 'getFormParts' ).callsFake( survey => Promise.resolve( {
            enketoId: survey.enketoId,
            form: form1,
            model: model1,
            hash: hash1
        } ) );
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
                    result.htmlView = document.createRange().createContextualFragment( result.form );

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

        /** @type {Survey} */
        let survey;

        beforeEach( done => {
            record = {
                draft: false,
                enketoId,
                instanceId: 'recordA',
                name: 'name A',
                xml: '<model><something>a</something></model>',
            };

            survey = {
                openRosaId: 'formA',
                openRosaServer: 'http://localhost:3000',
                enketoId,
                theme: '',
            };

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

        it( 'does not set the survey\'s last saved record when encrypted', done => {
            /**
             * @param { Record } record - the record to encrypt
             * @return { Promise<Record> } - the encrypted record
             */
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
