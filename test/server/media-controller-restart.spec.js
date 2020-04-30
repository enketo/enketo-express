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

const requestURL = `/media/get/${testHTMLHost}`;
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

    it( 'for a private IP address WITH a Referer with allowPrivateIPAddress=false', done => {

        // Don't change any default IP filtering setting
        app.set( 'ip filtering', { allowPrivateIPAddress, allowMetaIPAddress, allowIPAddressList, denyIPAddressList } );

        request( app )
            .get( requestURL )
            .set( 'Referer', 'https://google.com?print=true' )
            .expect( 500, /DNS lookup .* is not allowed. Because, It is private IP address/ )
            // Btw, a little surprising that this returns a 500 error instead of e.g. a 405 Not Allowed
            .end( done );
    } );

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
} );
