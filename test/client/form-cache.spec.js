import formCache from '../../public/js/src/module/form-cache';
import connection from '../../public/js/src/module/connection';
import $ from 'jquery';

const url1 = '/path/to/source.png';
const form1 = `<form class="or"><img src="${url1}"/></form>`;
const model1 = '<model></model>';
const hash1 = '12345';

describe( 'Client Form Cache', () => {
    let survey, sandbox, getFormPartsSpy, getFileSpy;

    beforeEach( () => {
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
    } );

    afterEach( () => {
        sandbox.restore();
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
                    result.$form = $( result.form );
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

    /*
    describe( 'in cached state', function() {
        
        it( 'initializes succesfully', function( done ) {
            survey = {
                enketoId: 'TESt',
                form: '<form class="or"></form>',
                model: '<model></model>',
                hash: '12345'
            };
            
            formCache.set( survey )
                .then( function() {
                    return formCache.init( survey );
                } )
                .then( function( result ) {
                    expect( result ).to.deep.equal( survey );
                } )
                .then( done, done );
                
        } );

    } );

        
    describe( 'in outdated cached state', function() {

        it( 'initializes (the outdated survey) succesfully', function() {

        } );

        it( 'updates automatically', function() {

        } );
    } );
    */
} );
