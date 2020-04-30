const chai = require( 'chai' );
const expect = chai.expect;
const config = require( '../../app/models/config-model' ).server;

const IPfiltering = config[ 'ip filtering' ];

/**
 * Tests the request-filtering-agent to block SSRF attacks
 * change testHTMLBody to the body of an html file that
 * you are testing on. For the default, it says <im in.>
 * and is hosted in testHTMLHost. 
 */

const testHTMLBody = 'im in.';
const enketoHost = 'http://localhost:8005';
const testHTMLHost = 'http/localhost:1234';

const requestURL = enketoHost + '/media/get/' + testHTMLHost;

var http = require('http');

var server = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('im in.');
});

describe('Testing request-filtering-agent', function () {

    before(function () {
        server.listen(1234);
    });

    after(function () {
        server.close();
    });

    describe('WITH a Referer', function () {
        const app = require( '../../config/express' );
        const filteringOptions = app.get('ip filtering');
        filteringOptions['allowPrivateIPAddress'] = true;
        filteringOptions['allowMetaIPAddress'] = false;
        filteringOptions['allowIPAddressList'] = [];
        filteringOptions['denyIPAddressList'] = [];
        app.set('ip filtering', filteringOptions);
        console.log('*****');
        console.dir(IPfiltering);
        http.get(requestURL, function(){}).on('error', function(err){
            expect(err.code).contains('ECONN');
        });
    });
});
