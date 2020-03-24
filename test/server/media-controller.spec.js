const chai = require( 'chai' );
const expect = chai.expect;
const chaiAsPromised = require( 'chai-as-promised' );
const request = require( 'request' );
const config = require( '../../config/config' );

const allowPrivateIP = config.IPfiltering.allowPrivateIPAddress;

/**
 * Tests the request-filtering-agent to block SSRF attacks
 * change testHTMLBody to the body of an html file that
 * you are testing on. For the default, it says <i'm in.>
 * and is hosted in testHTMLHost. 
 */

const testHTMLBody = 'i\'m in.';
const enketoHost = 'http://localhost:8005';
const testHTMLHost = 'http://localhost:1234';

const requestURL = enketoHost + '/media/get' + testHTMLHost;


describe('Media Controller', () => {
	describe('No Referer Request', () => {
		it('Private ip (localhost:1234) request', () => {
			request( requestURL ,
				function(error, response, body){
					if ( !allowPrivateIP ) {
						expect(body).to.be.equal(undefined);
					} else {
						expect(body).to.be.equal('i\'m in.');
					}
				});
		});	
	});
});

