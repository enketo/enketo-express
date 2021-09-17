const app = require( '../../config/express' );
const request = require( 'supertest' );
const http = require( 'http' );

/**
 * Tests the request-filtering-agent to block SSRF attacks
 * change testHTMLBody to the body of an html file that
 * you are testing on. For the default, it says <im in.>
 * and is hosted in testHTMLHost.
 */

const testHTMLBody = 'im in.';
const portHTML = 1234;
const testHTMLHost = `http/localhost:${portHTML}`;
const testHTMLMetaHost = `http/0.0.0.0:${portHTML}`;
const testHTMLValidHTTPSHost = 'https/www.w3.org/People/mimasa/test/imgformat/img/w3c_home_2.jpg';
const localhost = '127.0.0.1';

const requestURL = `/media/get/${testHTMLHost}`;
const requestMetaURL = `/media/get/${testHTMLMetaHost}`;
const requestValidHTTPSURL = `/media/get/${testHTMLValidHTTPSHost}`;
const server = http.createServer( function( req, res ) {
    res.writeHead( 200, { 'Content-Type': 'text/plain' } );
    res.end( testHTMLBody );
} );

describe( 'Testing request-filtering-agent', function() {

    // Default everything disabled
    const allowPrivateIPAddress = false;
    const allowMetaIPAddress = false;
    const allowIPAddressList = [];
    const denyIPAddressList = [];

    before( function() {
        server.listen( portHTML );
    } );

    after( function() {
        server.close();
    } );

    // Tests WITH Referers

    // Tests with allowPrivateIPAddress FALSE
    it( 'for a private IP address WITH a Referer with allowPrivateIPAddress=false', done => {

        // Don't change any default IP filtering setting
        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .set( 'Referer', 'https://google.com?print=true' )
            .expect( 500, /DNS lookup .* is not allowed. Because, It is private IP address/)
            .end( done );
    } );
    it( 'for a private IP address WITH a Referer with allowPrivateIPAddress=false and allowMetaIPAddress=true', done => {

        // Only change one setting
        const allowMetaIPAddress = true;

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestMetaURL  )
            .set( 'Referer', 'https://google.com?print=true' )
            .expect( 500, /DNS lookup .* is not allowed. Because, It is private IP address/ )
            .end( done );
    } );
    it( 'for a private IP address WITH a Referer with allowPrivateIPAddress=false but allowIPAddressList=[`127.0.0.1`]', done => {

        // Only change one setting
        const allowIPAddressList = [localhost];

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .set( 'Referer', 'https://google.com?print=true' )
            .expect( 200, testHTMLBody )
            .end( done );
    } );
    it( 'for a private IP address WITH a Referer with allowPrivateIPAddress=false and denyIPAddressList=[`127.0.0.1`]', done => {

        // Only change one setting
        const denyIPAddressList = [localhost];

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .set( 'Referer', 'https://google.com?print=true' )
            .expect( 500, /DNS lookup .* is not allowed. Because, It is private IP address/ )
            .end( done );
    } );

    // Tests with allowPrivateIPAddress TRUE
    it( 'for a private IP address WITH a Referer with allowPrivateIPAddress=true', done => {

        // Only change one setting
        const allowPrivateIPAddress = true;

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .set( 'Referer', 'https://google.com?print=true' )
            .expect( 200, testHTMLBody )
            .end( done );
    } );
    it( 'for a private IP address WITH a Referer with allowPrivateIPAddress=true and allowMetaIPAddress=true', done => {

        // Change two settings
        const allowPrivateIPAddress = true;
        const allowMetaIPAddress = true;

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestMetaURL )
            .set( 'Referer', 'https://google.com?print=true' )
            .expect( 200, testHTMLBody )
            .end( done );
    } );
    it( 'for a private IP address WITH a Referer with allowPrivateIPAddress=true and allowIPAddressList=[`127.0.0.1`]', done => {

        // Change two settings
        const allowPrivateIPAddress = true;
        const allowIPAddressList = [localhost];

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .set( 'Referer', 'https://google.com?print=true' )
            .expect( 200, testHTMLBody )
            .end( done );
    } );
    it( 'for a private IP address WITH a Referer with allowPrivateIPAddress=true and denyIPAddressList=[`127.0.0.1`]', done => {

        // Change two settings
        const allowPrivateIPAddress = true;
        const denyIPAddressList = [localhost];

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .set( 'Referer', 'https://google.com?print=true' )
            .expect( 500, /DNS lookup .* is not allowed. Because It is defined in denyIPAddressList./ )
            .end( done );
    } );

    // Tests WITHOUT Referers

    // Tests with allowPrivateIPAddress FALSE
    it( 'for a private IP address WITHOUT a Referer with allowPrivateIPAddress=false', ( done ) => {

        // Don't change any default IP filtering setting
        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .expect( 500, /DNS lookup .* is not allowed. Because, It is private IP address./ )
            .end( done );
    } );
    it( 'for a private IP address WITHOUT a Referer with allowPrivateIPAddress=false and allowMetaIPAddress=true', done => {

        // Only change one setting
        const allowMetaIPAddress = true;

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestMetaURL  )
            .expect( 500, /DNS lookup .* is not allowed. Because, It is private IP address/ )
            .end( done );
    } );
    it( 'for a private IP address WITHOUT a Referer with allowPrivateIPAddress=false but allowIPAddressList=[`127.0.0.1`]', done => {

        // Only change one setting
        const allowIPAddressList = [localhost];

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .expect( 200, testHTMLBody )
            .end( done );
    } );
    it( 'for a private IP address WITHOUT a Referer with allowPrivateIPAddress=false and denyIPAddressList=[`127.0.0.1`]', done => {

        // Only change one setting
        const denyIPAddressList = [localhost];

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .expect( 500, /DNS lookup .* is not allowed. Because, It is private IP address/ )
            .end( done );
    } );

    // Tests with allowPrivateIPAddress TRUE
    it( 'for a private IP address WITHOUT a Referer with allowPrivateIPAddress=true', done => {

        // Only change one setting
        const allowPrivateIPAddress = true;

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .expect( 200, testHTMLBody )
            .end( done );
    } );
    it( 'for a private IP address WITHOUT a Referer with allowPrivateIPAddress=true and allowMetaIPAddress=true', done => {

        // Change two settings
        const allowPrivateIPAddress = true;
        const allowMetaIPAddress = true;

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestMetaURL )
            .expect( 200, testHTMLBody )
            .end( done );
    } );
    it( 'for a private IP address WITHOUT a Referer with allowPrivateIPAddress=true and allowIPAddressList=[`127.0.0.1`]', done => {

        // Change two settings
        const allowPrivateIPAddress = true;
        const allowIPAddressList = [localhost];

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .expect( 200, testHTMLBody )
            .end( done );
    } );
    it( 'for a private IP address WITHOUT a Referer with allowPrivateIPAddress=true and denyIPAddressList=[`127.0.0.1`]', done => {

        // Change two settings
        const allowPrivateIPAddress = true;
        const denyIPAddressList = [localhost];

        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .expect( 500, /DNS lookup .* is not allowed. Because It is defined in denyIPAddressList./ )
            .end( done );
    } );

    // Testing valid https resource
    it( 'for a valid https resouce: https://www.w3.org/People/mimasa/test/imgformat/img/w3c_home_2.jpg', done => {

        // Default Settings
        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestValidHTTPSURL )
            .expect( 200 )
            .end( done );
    } );
} );
