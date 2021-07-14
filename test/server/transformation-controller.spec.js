const expect = require( 'chai' ).expect;
const request = require( 'supertest' );
const sinon = require( 'sinon' );
const communicator = require( '../../app/lib/communicator' );
const accountModel = require( '../../app/models/account-model' );
const config = require( '../../app/models/config-model' ).server;
const surveyModel = require( '../../app/models/survey-model' );
const userModel = require( '../../app/models/user-model' );

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

describe( 'Transformation Controller', () => {
    const basePath = '';
    const bearer = 'fozzie';
    const credentials = { bearer };
    const enketoId = 'surveyZ';
    const manifestHost = 'http://example.com';
    const manifestPath = '/manifest';
    const manifestUrl = `${manifestHost}${manifestPath}`;

    /** @type {import('sinon').SinonSandbox} */
    let sandbox;

    /** @type {import('express').Application} */
    let app;

    /** @type {import('http').Server} */
    let server;

    /** @type {import('../../app/models/account-model').AccountObj */
    let account;

    /** @type {Survey} */
    let survey;

    /** @type {Survey} */
    let surveyWithAccount;

    beforeEach( done => {
        sandbox = sinon.createSandbox();

        sandbox.stub( config, 'base path' ).get( () => basePath );

        // Stub `_getSurveyParams`
        survey = {
            info: {
                manifestUrl,
            },
        };

        sandbox.stub( surveyModel, 'get' ).resolves( survey );

        account = {};

        surveyWithAccount = Object.assign( {}, survey, { account } );

        sandbox.stub( accountModel, 'check' ).resolves( surveyWithAccount );

        // No-op `_checkQuota`
        sandbox.stub( config, 'account lib' ).get( () => null );

        sandbox.stub( userModel, 'getCredentials' ).resolves( credentials );

        app = require( '../../config/express' );

        server = app.listen( () => done() );
    } );

    afterEach( done => {
        sandbox.restore();
        server.close( done );
    } );

    const requests = [
        {
            description: 'new survey',
            url: '/transform/xform',
            body: { xformUrl: 'http://example.com/qwerty' },
        },
        {
            description: 'existing survey',
            url: `/transform/xform/${enketoId}`,
        },
    ];

    requests.forEach( ( { description, url, body } ) => {
        describe( `jr: media URLs ${description}`, () => {
            /** @type {import('enketo-transformer/src/transformer').TransformedSurvey} */
            let result;

            beforeEach( done => {
                // Stub getXForm
                const xform = `
                    <?xml version="1.0"?>
                    <h:html xmlns="http://www.w3.org/2002/xforms"
                        xmlns:ev="http://www.w3.org/2001/xml-events"
                        xmlns:h="http://www.w3.org/1999/xhtml"
                        xmlns:jr="http://openrosa.org/javarosa"
                        xmlns:odk="http://www.opendatakit.org/xforms"
                        xmlns:orx="http://openrosa.org/xforms"
                        xmlns:xsd="http://www.w3.org/2001/XMLSchema">
                        <h:head>
                            <h:title>jr-url-space</h:title>
                            <model>
                                <itext>
                                    <translation default="true()" lang="English">
                                        <text id="/outside/l1:label">
                                            <value form="image">jr://images/first image.jpg</value>
                                        </text>
                                        <text id="/outside/l2:label">
                                            <value form="audio">jr://audio/a song.mp3</value>
                                        </text>
                                        <text id="/outside/l3:label">
                                            <value form="video">jr://video/some video.mp4</value>
                                        </text>
                                    </translation>
                                </itext>
                                <instance>
                                    <outside>
                                        <a/>
                                        <b/>
                                        <c>jr://images/another image.png</c>
                                        <d/>
                                        <l1/>
                                        <l2/>
                                        <l2/>
                                        <meta>
                                            <instanceID/>
                                        </meta>
                                    </outside>
                                </instance>
                                <instance id="file" src="jr://file/an instance.xml" />
                                <instance id="file-csv" src="jr://file-csv/a spreadsheet.csv" />
                                <bind nodeset="/outside/a" type="string"/>
                                <bind nodeset="/outside/b" type="string"/>
                                <bind nodeset="/outside/c" type="binary"/>
                                <bind nodeset="/outside/d" type="string"/>
                            </model>
                        </h:head>
                        <h:body>
                            <input ref="/a">
                                <label ref="jr:itext('/outside/l1:label')"/>
                            </input>
                            <input ref="/b">
                                <label ref="jr:itext('/outside/l2:label')"/>
                            </input>
                            <upload appearance="annotate" mediatype="image/*" ref="/outside/c">
                                <label ref="jr:itext('/outside/l3:label')"/>
                            </upload>
                            <input> ref="/d">
                                <label>
                                    [markdown](jr://file/a link.xml)
                                </label>
                            </input>
                        </h:body>
                    </h:html>
                `.trim();

                const surveyWithXForm = Object.assign( {}, surveyWithAccount, { xform } );

                sandbox.stub( communicator, 'getXForm' ).resolves( surveyWithXForm );

                // Stub getManifest
                const manifest = [
                    {
                        filename: 'first image.jpg',
                        hash: 'irrelevant',
                        downloadUrl: 'hallo spaceboy/spiders from mars.jpg',
                    },
                    {
                        filename: 'a song.mp3',
                        hash: 'irrelevant',
                        downloadUrl: 'hallo spaceboy/space oddity.mp3',
                    },
                    {
                        filename: 'some video.mp4',
                        hash: 'irrelevant',
                        downloadUrl: 'hallo spaceboy/a small plot of land.mp4',
                    },
                    {
                        filename: 'another image.png',
                        hash: 'irrelevant',
                        downloadUrl: 'hallo spaceboy/under pressure.png',
                    },
                    {
                        filename: 'an instance.xml',
                        hash: 'irrelevant',
                        downloadUrl: 'hallo spaceboy/golden years.xml',
                    },
                    {
                        filename: 'a spreadsheet.csv',
                        hash: 'irrelevant',
                        downloadUrl: 'hallo spaceboy/little wonder.csv',
                    },
                    {
                        filename: 'a link.xml',
                        hash: 'irrelevant',
                        downloadUrl: 'hallo spaceboy/wishful beginnings.xml',
                    },
                ];

                const surveyWithManifest = Object.assign( {}, surveyWithXForm, { manifest } );

                sandbox.stub( communicator, 'getManifest' ).resolves( surveyWithManifest );

                request( app )
                    .post( url )
                    .send( body )
                    .expect( 200 )
                    .then( ( { body } ) => {
                        result = body;
                    } )
                    .then( done, done );
            } );

            it( 'escapes media in labels', () => {
                return Promise.all( [
                    expect( result ).to.have.property( 'form' ).and.to.not.contain( 'jr://images/first image.jpg' ),
                    expect( result ).to.have.property( 'form' ).and.to.not.contain( 'jr://audio/a song.mp3' ),
                    expect( result ).to.have.property( 'form' ).and.to.not.contain( 'jr://video/some video.mp4' ),

                    expect( result ).to.have.property( 'form' ).and.to.contain( 'hallo%20spaceboy/spiders%20from%20mars.jpg' ),
                    expect( result ).to.have.property( 'form' ).and.to.contain( 'hallo%20spaceboy/space%20oddity.mp3' ),
                    expect( result ).to.have.property( 'form' ).and.to.contain( 'hallo%20spaceboy/a%20small%20plot%20of%20land.mp4' ),
                ] );
            } );

            it( 'escapes binary defaults', () => {
                return Promise.all( [
                    expect( result ).to.have.property( 'model' ).and.to.not.contain( 'jr://images/another image.png' ),

                    expect( result ).to.have.property( 'model' ).and.to.contain( 'hallo%20spaceboy/under%20pressure.png' ),
                ] );
            } );

            it( 'escapes external instance URLs', () => {
                return Promise.all( [
                    expect( result ).to.have.property( 'model' ).and.to.not.contain( 'jr://file/an instance.xml' ),
                    expect( result ).to.have.property( 'model' ).and.to.not.contain( 'jr://file-csv/a spreadsheet.csv' ),

                    expect( result ).to.have.property( 'model' ).and.to.contain( 'hallo%20spaceboy/golden%20years.xml' ),
                    expect( result ).to.have.property( 'model' ).and.to.contain( 'hallo%20spaceboy/little%20wonder.csv' ),
                ] );
            } );


            it( 'escapes media URLs in markdown linkes', () => {
                return Promise.all( [
                    expect( result ).to.have.property( 'form' ).and.to.not.contain( 'jr://file/a link.xml' ),

                    expect( result ).to.have.property( 'form' ).and.to.contain( 'hallo%20spaceboy/wishful%20beginnings.xml' ),
                ] );
            } );
        } );
    } );
} );
