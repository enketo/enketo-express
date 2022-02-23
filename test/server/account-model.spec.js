// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const chai = require('chai');

const { expect } = chai;
const chaiAsPromised = require('chai-as-promised');
const config = require('../../app/models/config-model').server;

config['account lib'] = undefined;
const model = require('../../app/models/account-model');

chai.use(chaiAsPromised);

describe('Account Model', () => {
    describe('get: when attempting to obtain an account', () => {
        it('returns an error when the account does not exist', () =>
            expect(model.get('nonexisting')).to.eventually.be.rejected);

        [
            // config               // request serverUrl
            ['http://example.com', 'http://example.com'],
            ['http://example.com', 'https://example.com'],
            ['http://example.com', 'http://example.com/johndoe'],
            ['http://example.com', 'https://example.com/johndoe'],
            ['https://example.com', 'http://example.com'],
            ['https://example.com', 'http://example.com/johndoe'],
            ['https://example.com', 'https://example.com/johndoe'],
            ['example.com', 'http://example.com'],
            ['example.com', 'https://example.com'],
            ['example.com', 'http://example.com/johndoe'],
        ].forEach((test) => {
            const accountServerUrl = test[0];
            const requestServerUrl = test[1];
            it(`returns the hardcoded account object with linked server ${accountServerUrl} and request server ${requestServerUrl}`, () => {
                let getAccountPromise;
                const accountKey = '123abc';
                const survey = {
                    openRosaServer: requestServerUrl,
                };

                config['linked form and data server']['server url'] =
                    accountServerUrl;
                config['linked form and data server']['api key'] = accountKey;

                getAccountPromise = model.get(survey);

                return Promise.all([
                    expect(getAccountPromise)
                        .to.eventually.have.property('key')
                        .and.to.equal(accountKey),
                    expect(getAccountPromise)
                        .to.eventually.have.property('linkedServer')
                        .and.to.equal(accountServerUrl),
                ]);
            });
        });

        [
            ['http://example.com', 'http://example.org', 403],
            ['http://examplecom', 'http://example.org', 403],
            ['http://example.com/johndoe', 'http://example.com', 403],
        ].forEach((test) => {
            const accountServerUrl = test[0];
            const requestServerUrl = test[1];
            const errorCode = test[2];
            it(`returns ${errorCode} for ${accountServerUrl} and request server ${requestServerUrl}`, () => {
                const survey = {
                    openRosaServer: requestServerUrl,
                };

                config['linked form and data server']['server url'] =
                    accountServerUrl;

                const getAccountPromise = model.get(survey);

                return expect(getAccountPromise).to.eventually.be.rejected;
            });
        });
    });
});
