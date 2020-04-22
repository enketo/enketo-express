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

describe('Testing request-filtering-agent on the following options:', function () {

    before(function () {
        server.listen(1234);
    });
    
    after(function () {
        server.close();
    });

    describe('\n\tallowPrivateIPAddress = ' + IPfiltering.allowPrivateIPAddress 
        + '\n\tallowMetaIPAddress = ' + IPfiltering.allowMetaIPAddress 
        + '\n\tallowIPAddressList = ' + IPfiltering.allowIPAddressList 
        + '\n\tdenyIPAddressList = ' + IPfiltering.denyIPAddressList + '\n' 
    , function () {
        it('WITH a Referer', function (done) {
            const options = {
                host: '127.0.0.1',
                port: 8005,
                path: '/media/get/' + testHTMLHost,
                headers: {
                    'Referer': 'https://google.com?print=true'
                }
            };
            if (!IPfiltering.allowPrivateIPAddress) {
                if (IPfiltering.allowIPAddressList.length == 0 && IPfiltering.denyIPAddressList.length == 0) {
                    http.get(options, function(){}).on('error', function(err){
                        expect(err.code).contains('ECONN');
                    });
                    done();
                }
                else if (IPfiltering.allowIPAddressList.includes( 'localhost' ) || IPfiltering.allowIPAddressList.includes( '127.0.0.1' )) {
                    http.get(options, function(res) {
                        var data = '';
                        res.on('data', function(chunk) {
                            data+=chunk;
                        });
                        res.on('end', function() {
                            expect(data).to.be.equal(testHTMLBody);
                            done();
                        });
                    });
                }
                else if (IPfiltering.denyIPAddressList.includes( 'localhost' ) || IPfiltering.denyIPAddressList.includes( '127.0.0.1' )) {
                    http.get(options, function(){}).on('error', function(err){
                        expect(err.code).contains('ECONN');
                    });
                    done();
                }
            }
            if (IPfiltering.allowPrivateIPAddress) {
                if (IPfiltering.allowIPAddressList.length == 0 && IPfiltering.denyIPAddressList.length == 0) {
                    http.get(options, function(res) {
                        var data = '';
                        res.on('data', function(chunk) {
                            data+=chunk;
                        });
                        res.on('end', function() {
                            expect(data).to.be.equal(testHTMLBody);
                            done();
                        });
                    });
                }
                else if (IPfiltering.allowIPAddressList.includes( 'localhost' ) || IPfiltering.allowIPAddressList.includes( '127.0.0.1' )) {
                    http.get(options, function(res) {
                        var data = '';
                        res.on('data', function(chunk) {
                            data+=chunk;
                        });
                        res.on('end', function() {
                            expect(data).to.be.equal(testHTMLBody);
                            done();
                        });
                    });
                }
                else if (IPfiltering.denyIPAddressList.includes( 'localhost' ) || IPfiltering.denyIPAddressList.includes( '127.0.0.1' )) {
                    http.get(options, function(){}).on('error', function(err){
                        expect(err.code).contains('ECONN');
                    });
                    done();
                }
            }
        });

        it('WITHOUT a Referer', function (done) {
            if (!IPfiltering.allowPrivateIPAddress) {
                if (IPfiltering.allowIPAddressList.length == 0 && IPfiltering.denyIPAddressList.length == 0) {
                    http.get(requestURL, function(){}).on('error', function(err){
                        expect(err.code).contains('ECONN');
                    });
                    done();
                }
                else if (IPfiltering.allowIPAddressList.includes( 'localhost' ) || IPfiltering.allowIPAddressList.includes( '127.0.0.1' )) {
                    http.get(requestURL, function(res) {
                        var data = '';
                        res.on('data', function(chunk) {
                            data+=chunk;
                        });
                        res.on('end', function() {
                            expect(data).to.be.equal(testHTMLBody);
                        });
                        done();
                    });
                }
                else if (IPfiltering.denyIPAddressList.includes( 'localhost' ) || IPfiltering.denyIPAddressList.includes( '127.0.0.1' )) {
                    http.get(requestURL, function(){}).on('error', function(err){
                        expect(err.code).contains('ECONN');
                    });
                    done();
                }
            }
            if (IPfiltering.allowPrivateIPAddress) {
                if (IPfiltering.allowIPAddressList.length == 0 && IPfiltering.denyIPAddressList.length == 0) {
                    http.get(requestURL, function(res) {
                        var data = '';
                        res.on('data', function(chunk) {
                            data+=chunk;
                        });
                        res.on('end', function() {
                            expect(data).to.be.equal(testHTMLBody);
                        });
                        done();
                    });
                }
                else if (IPfiltering.allowIPAddressList.includes( 'localhost' ) || IPfiltering.allowIPAddressList.includes( '127.0.0.1' )) {
                    http.get(requestURL, function(res) {
                        var data = '';
                        res.on('data', function(chunk) {
                            data+=chunk;
                        });
                        res.on('end', function() {
                            expect(data).to.be.equal(testHTMLBody);
                        });
                        done();
                    });
                }
                else if (IPfiltering.denyIPAddressList.includes( 'localhost' ) || IPfiltering.denyIPAddressList.includes( '127.0.0.1' )) {
                    http.get(requestURL, function(){}).on('error', function(err){
                        expect(err.code).contains('ECONN');
                    });
                    done();
                }
            }
        });
    });
});
