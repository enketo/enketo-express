const { expect } = require( 'chai' );
const sinon = require( 'sinon' );
const config = require( '../../app/models/config-model' ).server;
const { toLocalMediaUrl, toMediaMap } = require( '../../app/lib/url' );


describe( 'URL functionality', () => {
    describe( 'toLocalMediaUrl function', () => {
        /** @type {import('sinon').SinonSandbox} */
        let sandbox;

        beforeEach( () => {
            sandbox = sinon.createSandbox();

            sandbox.stub( config, 'base path' ).get( () => 'http://enke.to' );
        } );

        afterEach( () => {
            sandbox.restore();
        } );

        it( 'should return proxied url', () => {
            expect( toLocalMediaUrl( 'http://foo.bar/fum/baz' ) ).to.equal( 'http://enke.to/media/get/http/foo.bar/fum/baz' );
        } );

        it( 'escapes spaces in the path', () => {
            expect( toLocalMediaUrl( 'http://foo.bar/fum baz' ) ).to.equal( 'http://enke.to/media/get/http/foo.bar/fum%20baz' );
        } );
    } );

    describe( 'toMediaMap', () => {
        /** @type {import('sinon').SinonSandbox} */
        let sandbox;

        beforeEach( () => {
            sandbox = sinon.createSandbox();

            sandbox.stub( config, 'base path' ).get( () => 'http://enke.to' );
        } );

        afterEach( () => {
            sandbox.restore();
        } );

        it( 'creates a media map', () => {
            const filenames = [ 'a.jpg', 'b.mp4', 'cd.mp3' ];
            const manifest = filenames.map( filename => ( {
                filename,
                hash: 'irrelevant',
                downloadUrl: `https://example.com/${filename}`,
            } ) );

            expect( toMediaMap( manifest ) ).to.deep.equal( {
                'a.jpg': 'http://enke.to/media/get/https/example.com/a.jpg',
                'b.mp4': 'http://enke.to/media/get/https/example.com/b.mp4',
                'cd.mp3': 'http://enke.to/media/get/https/example.com/cd.mp3',
            } );
        } );

        it( 'escapes spaces in mapped paths', () => {
            const filenames = [ 'an image.jpg', 'beastie boys.mp4', 'cd rip.mp3' ];
            const manifest = filenames.map( filename => ( {
                filename,
                hash: 'irrelevant',
                downloadUrl: `https://example.com/${filename}`,
            } ) );

            expect( toMediaMap( manifest ) ).to.deep.equal( {
                'an%20image.jpg':     'http://enke.to/media/get/https/example.com/an%20image.jpg',
                'beastie%20boys.mp4': 'http://enke.to/media/get/https/example.com/beastie%20boys.mp4',
                'cd%20rip.mp3':       'http://enke.to/media/get/https/example.com/cd%20rip.mp3',
            } );
        } );
    } );
} );
