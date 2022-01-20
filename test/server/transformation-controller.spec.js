const expect = require( 'chai' ).expect;
const transformer = require( 'enketo-transformer' );
const request = require( 'supertest' );
const sinon = require( 'sinon' );
const communicator = require( '../../app/lib/communicator' );
const accountModel = require( '../../app/models/account-model' );
const config = require( '../../app/models/config-model' ).server;
const cacheModel = require( '../../app/models/cache-model' );
const surveyModel = require( '../../app/models/survey-model' );
const userModel = require( '../../app/models/user-model' );

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

describe( 'Transformation Controller', () => {
    const basePath = '';
    const bearer = 'fozzie';
    const enketoId = 'surveyZ';
    const openRosaServer = 'http://example.com';
    const openRosaId = 'formZ';
    const manifestPath = '/manifest';
    const manifestUrl = `${openRosaServer}${manifestPath}`;

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

    /** @type {string} */
    let hash;

    beforeEach( done => {
        sandbox = sinon.createSandbox();

        sandbox.stub( config, 'base path' ).get( () => basePath );

        // Stub `_getSurveyParams`
        survey = {
            openRosaServer,
            openRosaId,
        };

        hash = 'md5:b4dd34d';

        sandbox.stub( surveyModel, 'get' ).callsFake( () => (
            Promise.resolve( { ...survey } )
        ) );

        account = {};

        sandbox.stub( accountModel, 'check' ).callsFake( survey => (
            Promise.resolve( {
                ...survey,
                account,
            } )
        ) );

        // No-op `_checkQuota`
        sandbox.stub( config, 'account lib' ).get( () => null );

        sandbox.stub( userModel, 'getCredentials' ).callsFake( async () => (
            { bearer }
        ) );

        app = require( '../../config/express' );

        server = app.listen( () => done() );
    } );

    afterEach( async () => {
        sandbox.restore();

        await Promise.all( [
            cacheModel.flushAll(),
            new Promise( ( resolve, reject ) => (
                server.close( error => error ? reject( error ) : resolve() )
            ) ),
        ] );
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

    /**
     * @typedef {import('../../app/lib/url').ManifestItem} ManifestItem
     */

    /** @type {ManifestItem[]} */
    let manifest;

    /**
     * @param {string} url
     * @param {object} payload
     * @return {import('enketo-transformer/src/transformer').TransformedSurvey}
     */
    const getTransormResult = async ( url, payload ) => {
        const { body } = await request( app )
            .post( url )
            .send( payload )
            .expect( 200 );

        return body;
    };

    describe( 'jr: media URLs', () => {
        beforeEach( async () => {
            sandbox.stub( communicator, 'authenticate' ).callsFake( survey => (
                Promise.resolve( survey )
            ) );

            sandbox.stub( communicator, 'getXFormInfo' ).callsFake( survey => (
                Promise.resolve( {
                    ...survey,
                    info: {
                        hash,
                        manifestUrl,
                    },
                } )
            ) );

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

            sandbox.stub( communicator, 'getXForm' ).callsFake( survey => (
                Promise.resolve( {
                    ...survey,
                    xform,
                } )
            ) );

            // Stub getManifest
            manifest = [
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

            sandbox.stub( communicator, 'getManifest' ).callsFake( survey => (
                Promise.resolve( {
                    ...survey,
                    manifest,
                } )
            ) );
        } );

        requests.forEach( ( { description, url, body } ) => {
            describe( description, () => {
                it( 'escapes media in labels', async () => {
                    const result = await getTransormResult( url, body );

                    return Promise.all( [
                        expect( result ).to.have.property( 'form' ).and.to.not.contain( 'jr://images/first image.jpg' ),
                        expect( result ).to.have.property( 'form' ).and.to.not.contain( 'jr://audio/a song.mp3' ),
                        expect( result ).to.have.property( 'form' ).and.to.not.contain( 'jr://video/some video.mp4' ),

                        expect( result ).to.have.property( 'form' ).and.to.contain( 'hallo%20spaceboy/spiders%20from%20mars.jpg' ),
                        expect( result ).to.have.property( 'form' ).and.to.contain( 'hallo%20spaceboy/space%20oddity.mp3' ),
                        expect( result ).to.have.property( 'form' ).and.to.contain( 'hallo%20spaceboy/a%20small%20plot%20of%20land.mp4' ),
                    ] );
                } );

                it( 'escapes binary defaults', async () => {
                    const result = await getTransormResult( url, body );

                    return Promise.all( [
                        expect( result ).to.have.property( 'model' ).and.to.not.contain( 'jr://images/another image.png' ),

                        expect( result ).to.have.property( 'model' ).and.to.contain( 'hallo%20spaceboy/under%20pressure.png' ),
                    ] );
                } );

                it( 'escapes external instance URLs', async () => {
                    const result = await getTransormResult( url, body );

                    return Promise.all( [
                        expect( result ).to.have.property( 'model' ).and.to.not.contain( 'jr://file/an instance.xml' ),
                        expect( result ).to.have.property( 'model' ).and.to.not.contain( 'jr://file-csv/a spreadsheet.csv' ),

                        expect( result ).to.have.property( 'model' ).and.to.contain( 'hallo%20spaceboy/golden%20years.xml' ),
                        expect( result ).to.have.property( 'model' ).and.to.contain( 'hallo%20spaceboy/little%20wonder.csv' ),
                    ] );
                } );


                it( 'escapes media URLs in markdown links', async () => {
                    const result = await getTransormResult( url, body );

                    return Promise.all( [
                        expect( result ).to.have.property( 'form' ).and.to.not.contain( 'jr://file/a link.xml' ),

                        expect( result ).to.have.property( 'form' ).and.to.contain( 'hallo%20spaceboy/wishful%20beginnings.xml' ),
                    ] );
                } );

                it( 'escapes html entities in mapped URLs', async () => {
                    // Stub getManifest
                    manifest = [
                        {
                            filename: 'first image.jpg',
                            hash: 'irrelevant',
                            downloadUrl: 'hallo spaceboy/<.jpg',
                        },
                        {
                            filename: 'a song.mp3',
                            hash: 'irrelevant',
                            downloadUrl: 'hallo spaceboy/>.mp3',
                        },
                        {
                            filename: 'some video.mp4',
                            hash: 'irrelevant',
                            downloadUrl: 'hallo spaceboy/&.mp4',
                        },
                        {
                            filename: 'another image.png',
                            hash: 'irrelevant',
                            downloadUrl: 'hallo spaceboy/".png',
                        },
                    ];

                    const result = await getTransormResult( url, body );

                    expect( result.form ).not.to.contain( '<.jpg' );
                    expect( result.form ).not.to.contain( '>.mp3' );
                    expect( result.form ).not.to.contain( '&.mp4' );
                    expect( result.model ).not.to.contain( '".png' );

                    expect( result.form ).to.contain( 'hallo%20spaceboy/%3C.jpg' );
                    expect( result.form ).to.contain( 'hallo%20spaceboy/%3E.mp3' );
                    expect( result.form ).to.contain( 'hallo%20spaceboy/&amp;.mp4' );
                    expect( result.model ).to.contain( 'hallo%20spaceboy/%22.png' );
                } );

                // This *shouldn't* happen but better safe than sorry
                it( 'escapes html entities which were not escaped as entities', async () => {
                    // Stub getManifest
                    manifest = [
                        {
                            filename: 'first image.jpg',
                            hash: 'irrelevant',
                            downloadUrl: 'hallo spaceboy/<.jpg',
                        },
                        {
                            filename: 'a song.mp3',
                            hash: 'irrelevant',
                            downloadUrl: 'hallo spaceboy/>.mp3',
                        },
                        {
                            filename: 'some video.mp4',
                            hash: 'irrelevant',
                            downloadUrl: 'hallo spaceboy/&.mp4',
                        },
                        {
                            filename: 'another image.png',
                            hash: 'irrelevant',
                            downloadUrl: 'hallo spaceboy/".png',
                        },
                    ];

                    const escapeURLPath = transformer.escapeURLPath;

                    sandbox.stub( transformer, 'escapeURLPath' ).callsFake( ( str ) => {
                        const escaped = escapeURLPath( str );

                        const unescapedEntities = {
                            '%3C': '<',
                            '%3E': '>',
                            '%22': '"',
                        };

                        /**
                         * @param {string} str
                         */
                        const unescapeEntities = ( str ) => (
                            str.replace( /(%3C|%3E|%22)/g, escaped => unescapedEntities[ escaped ]
                            )
                        );

                        return unescapeEntities( escaped );
                    } );

                    const result = await getTransormResult( url, body );

                    expect( result.form ).not.to.contain( '<.jpg' );
                    expect( result.form ).not.to.contain( '>.mp3' );
                    expect( result.form ).not.to.contain( '&.mp4' );
                    expect( result.model ).not.to.contain( '".png' );

                    expect( result.form ).to.contain( 'hallo%20spaceboy/&lt;.jpg' );
                    expect( result.form ).to.contain( 'hallo%20spaceboy/&gt;.mp3' );
                    expect( result.form ).to.contain( 'hallo%20spaceboy/&amp;.mp4' );
                    expect( result.model ).to.contain( 'hallo%20spaceboy/&quot;.png' );
                } );

                it( 'includes form_logo.png when present in the media mapping', async () => {
                    manifest = [
                        {
                            filename: 'form_logo.png',
                            hash: 'irrelevant',
                            downloadUrl: 'form_logo.png',
                        },
                    ];

                    const result = await getTransormResult( url, body );

                    expect( result.form ).to.contain(
                        `<section class="form-logo"><img src="${basePath}/media/get/form_logo.png" alt="form logo"></section>`
                    );
                } );

                it( 'escapes the form_logo.png downloadUrl base bath', async () => {
                    manifest = [
                        {
                            filename: 'form_logo.png',
                            hash: 'irrelevant',
                            downloadUrl: 'hallo spaceboy/form_logo.png',
                        },
                    ];

                    const result = await getTransormResult( url, body );

                    expect( result.form ).to.contain(
                        `<section class="form-logo"><img src="${basePath}/media/get/hallo%20spaceboy/form_logo.png" alt="form logo"></section>`
                    );
                } );
            } );
        } );

        it( 'maps media with a new manifest without re-transforming the cached survey', async () => {
            const initialCache = await cacheModel.get( {
                openRosaServer,
                openRosaId,
            } );

            expect( initialCache ).to.be.null;

            const { url, body } = requests[1];
            const transformSpy = sandbox.spy( transformer, 'transform' );
            const cacheSetSpy = sandbox.spy( cacheModel, 'set' );

            const initialResult = await getTransormResult( url, body );

            expect( initialResult.model ).to.contain( 'hallo%20spaceboy/under%20pressure.png' );

            expect( transformSpy.calledOnce ).to.be.true;
            expect( cacheSetSpy.calledOnce ).to.be.true;

            const firstCache = await cacheModel.get( {
                openRosaServer,
                openRosaId,
            } );

            expect( firstCache.model ).to.contain( 'another%20image.png' );

            // Stub getManifest
            manifest = [
                {
                    filename: 'another image.png',
                    hash: 'irrelevant',
                    downloadUrl: 'hallo spaceboy/the jean genie.png',
                },
            ];

            const result = await getTransormResult( url, body );

            expect( result.model ).not.to.contain( 'hallo%20spaceboy/under%20pressure.png' );
            expect( result.model ).to.contain( 'hallo%20spaceboy/the%20jean%20genie.png' );

            const finalCache = await cacheModel.get( {
                openRosaServer,
                openRosaId,
            } );

            expect( finalCache ).to.deep.equal( firstCache );

            expect( transformSpy.calledOnce ).to.be.true;
            expect( cacheSetSpy.calledOnce ).to.be.true;
        } );
    } );
} );
