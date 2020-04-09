const chai = require( 'chai' );
const expect = chai.expect;
const request = require( 'request' );
const config = require( '../../config/config' );

const IPfiltering = config.IPfiltering;

/**
 * Tests the request-filtering-agent to block SSRF attacks
 * change testHTMLBody to the body of an html file that
 * you are testing on. For the default, it says <i'm in.>
 * and is hosted in testHTMLHost. 
 */

const testHTMLBody = 'i\'m in.\n';
const enketoHost = 'http://localhost:8005';
const testHTMLHost = 'http/localhost:1234';

const requestURL = enketoHost + '/media/get/' + testHTMLHost;

// TODO: Check if testHTMLHost is running

describe( 'Media Controller', () => {

    console.log( 'Testing request-filtering-agent on this request: ' + requestURL);
    
    describe( 'No Referer Request', () => {

        if (!IPfiltering.allowPrivateIPAddress) {
            if (IPfiltering.allowIPAddressList === '' ) {
                it( 'allowPrivateIPAddress is false', () => {
                    request( requestURL ,
                        function(error, response, body){
                            expect(body).to.be.equal(undefined);
                        });
                });    
            } else if (IPfiltering.allowIPAddressList.includes( 'localhost' ) || IPfiltering.allowIPAddressList.includes( '127.0.0.1' )) {
                it( 'allowPrivateIPAddress is false, but allowIPAddresslist contains: localhost or 127.0.0.1', () => {
                    request( requestURL ,
                        function(error, response, body){
                            expect(body).to.be.equal(testHTMLBody);
                        });
                });
                
            } else if (IPfiltering.denyIPAddressList.includes( 'localhost' ) || IPfiltering.denyIPAddressList.includes( '127.0.0.1' )) {
                it( 'allowPrivateIPAddress is false, but denyIPAddressList contains: localhost or 127.0.0.1', () => {
                    request( requestURL ,
                        function(error, response, body){
                            expect(body).to.be.equal(undefined);
                        });
                });
                
            }

        }

        if (IPfiltering.allowPrivateIPAddress) {
            if (IPfiltering.allowIPAddressList === '' && IPfiltering.denyIPAddressList === '' ) {
                it( 'allowPrivateIPAddress is true', () => {
                    request( requestURL ,
                        function(error, response, body){
                            expect(body).to.be.equal(testHTMLBody);
                        });
                });    
            } else if (IPfiltering.allowIPAddressList.includes( 'localhost' ) || IPfiltering.allowIPAddressList.includes( '127.0.0.1' )) {
                it( 'allowPrivateIPAddress is true, but allowIPAddresslist contains: localhost or 127.0.0.1', () => {
                    request( requestURL ,
                        function(error, response, body){
                            expect(body).to.be.equal(testHTMLBody);
                        });
                });
                
            } else if (IPfiltering.denyIPAddressList.includes( 'localhost' ) || IPfiltering.denyIPAddressList.includes( '127.0.0.1' )) {
                it( 'allowPrivateIPAddress is true, but denyIPAddressList contains: localhost or 127.0.0.1', () => {
                    request( requestURL ,
                        function(error, response, body){
                            expect(body).to.be.equal(undefined); 
                        });
                });
                
            }

        }

    });

    

    describe( 'With Referer Request', () => {

        if (!IPfiltering.allowPrivateIPAddress) {
            if (IPfiltering.allowIPAddressList === '' ) {
                it( 'allowPrivateIPAddress is false', () => {
                    request ( { referer : 'https://google.com?print=true', url : requestURL } ,
                        function(error, response, body){
                            expect(body).to.be.equal(undefined);
                        });
                });    
            } else if (IPfiltering.allowIPAddressList.includes( 'localhost' ) || IPfiltering.allowIPAddressList.includes( '127.0.0.1' )) {
                it( 'allowPrivateIPAddress is false, but allowIPAddresslist contains: localhost or 127.0.0.1', () => {
                    request ( { referer : 'https://google.com?print=true', url : requestURL } ,
                        function(error, response, body){
                            expect(body).to.be.equal(testHTMLBody);
                        });
                });
                
            } else if (IPfiltering.denyIPAddressList.includes( 'localhost' ) || IPfiltering.denyIPAddressList.includes( '127.0.0.1' )) {
                it( 'allowPrivateIPAddress is false, but denyIPAddressList contains: localhost or 127.0.0.1', () => {
                    request ( { referer : 'https://google.com?print=true', url : requestURL } ,
                        function(error, response, body){
                            expect(body).to.be.equal(undefined);
                        });
                });
                
            }

        }

        if (IPfiltering.allowPrivateIPAddress) {
            if (IPfiltering.allowIPAddressList === '' && IPfiltering.denyIPAddressList === '' ) {
                it( 'allowPrivateIPAddress is true', () => {
                    request ( { referer : 'https://google.com?print=true', url : requestURL } ,
                        function(error, response, body){
                            expect(body).to.be.equal(testHTMLBody);
                        });
                });    
            } else if (IPfiltering.allowIPAddressList.includes( 'localhost' ) || IPfiltering.allowIPAddressList.includes( '127.0.0.1' )) {
                it( 'allowprivateipaddress is true, but allowipaddresslist contains: localhost or 127.0.0.1', () => {
                    request ( { referer : 'https://google.com?print=true', url : requestURL } ,
                        function(error, response, body){
                            expect(body).to.be.equal(testHTMLBody);
                        });
                });
                
            } else if (IPfiltering.denyIPAddressList.includes( 'localhost' ) || IPfiltering.denyIPAddressList.includes( '127.0.0.1' )) {
                it( 'allowprivateipaddress is true, but denyIPAddressList contains: localhost or 127.0.0.1', () => {
                    request ( { referer : 'https://google.com?print=true', url : requestURL } ,
                        function(error, response, body){
                            expect(body).to.be.equal(undefined); 
                        });
                });
                
            }

        }

    });


});

