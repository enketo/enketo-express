// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const chai = require('chai');

const { expect } = chai;
const chaiAsPromised = require('chai-as-promised');
const { cacheClient } = require('../../app/lib/db');

const model = require('../../app/models/cache-model');

let survey;

chai.use(chaiAsPromised);

describe('Cache Model', () => {
    beforeEach(() => {
        survey = {
            openRosaServer: 'https://testserver.com/bob',
            openRosaId: 'widgets',
            info: {
                hash: 'abc',
            },
            manifest: [
                {
                    filename: 'users.csv',
                    hash: 'md5:1111',
                    downloadUrl:
                        'https://my.openrosa.server/xformsMedia/123456/123456.csv',
                },
            ],
            form: '<form>some form</form>',
            model: '<data>some model</data>',
        };
    });

    describe('set: when attempting to cache a survey', () => {
        it('returns an 400 error when openRosaServer is missing', () => {
            delete survey.openRosaServer;
            return expect(model.set(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns an 400 error when openRosaId is missing', () => {
            delete survey.openRosaId;
            return expect(model.set(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns an 400 error when info.hash is missing', () => {
            delete survey.info.hash;
            return expect(model.set(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns an 400 error when form is missing', () => {
            delete survey.form;
            return expect(model.set(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns an 400 error when model is missing', () => {
            delete survey.model;
            return expect(model.set(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns the survey object when successful if no manifest was provided', () => {
            delete survey.manifest;
            return expect(model.set(survey)).to.eventually.deep.equal(survey);
        });
        it('returns the survey object when successful if an empty manifest was provided', () => {
            survey.manifest = [];
            return expect(model.set(survey)).to.eventually.deep.equal(survey);
        });
        it('returns the survey object when successful if a manifest was provided', () =>
            expect(model.set(survey)).to.eventually.deep.equal(survey));
    });

    describe('expiration', () => {
        const expiration = 30 * 24 * 60 * 60 * 1000;
        const getTtl = (key) =>
            new Promise((resolve, reject) => {
                cacheClient.pttl(key, (error, ttl) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(ttl);
                });
            });
        it(`is ${expiration} milliseconds for new cache items`, () => {
            const promise = model
                .set(survey)
                .then(() => getTtl('ca:testserver.com/bob,widgets'));
            return expect(promise)
                .to.eventually.be.at.most(expiration)
                .and.to.be.at.least(expiration - 10);
        });
        it('is reset to the original expiration every time the cache item is accessed ', () => {
            let promise1;
            let promise2;
            const delayTime = 1 * 1000;
            const delay = () =>
                new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(true);
                    }, delayTime);
                });

            promise1 = model
                .set(survey)
                .then(delay)
                .then(() => getTtl('ca:testserver.com/bob,widgets'));
            promise2 = promise1
                .then(() => model.get(survey))
                .then(() => getTtl('ca:testserver.com/bob,widgets'));

            return Promise.all([
                expect(promise1)
                    .to.eventually.be.at.most(expiration - delayTime)
                    .and.to.be.at.least(expiration - delayTime - 100),
                expect(promise2)
                    .to.eventually.be.at.most(expiration)
                    .and.to.be.at.least(expiration - 10),
            ]);
        });
    });

    describe('get: when attempting to obtain a cached survey', () => {
        it('returns a 400 error when openRosaServer is missing', () => {
            delete survey.openRosaServer;
            return expect(model.get(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns a 400 error when openRosaId is missing', () => {
            delete survey.openRosaId;
            return expect(model.get(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns null when instance record not cached', () => {
            survey.openRosaId = 'non-existing';
            return expect(model.get(survey)).to.eventually.deep.equal(null);
        });
        it('returns the survey object with the form and model properties when successful for item without manifest', () => {
            let promise;

            delete survey.manifest;
            promise = model.set(survey).then(model.get);
            return Promise.all([
                expect(promise)
                    .to.eventually.have.property('form')
                    .that.equals(survey.form),
                expect(promise)
                    .to.eventually.have.property('model')
                    .that.equals(survey.model),
                expect(promise)
                    .to.eventually.have.property('xslHash')
                    .and.to.have.length.above(2),
                expect(promise)
                    .to.eventually.have.property('formHash')
                    .and.to.have.length.above(2),
            ]);
        });
        it('returns the survey object with the form and model properties when successful', () => {
            const promise = model.set(survey).then(model.get);
            return Promise.all([
                expect(promise)
                    .to.eventually.have.property('form')
                    .that.equals(survey.form),
                expect(promise)
                    .to.eventually.have.property('model')
                    .that.equals(survey.model),
                expect(promise)
                    .to.eventually.have.property('xslHash')
                    .and.to.have.length.above(2),
                expect(promise)
                    .to.eventually.have.property('formHash')
                    .and.to.have.length.above(2),
            ]);
        });
    });

    describe('check: when checking the status of a cached survey', () => {
        it('returns a 400 error when info.hash is missing', () => {
            delete survey.info.hash;
            return expect(model.check(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns false when the cache is outdated (formHash changed)', () => {
            let setPromise;
            let checkPromise;
            let updatedSurvey;

            updatedSurvey = JSON.parse(JSON.stringify(survey));
            setPromise = model.set(survey);
            updatedSurvey.info = {
                hash: 'something else',
            };
            checkPromise = setPromise.then(() => model.check(updatedSurvey));

            return Promise.all([
                expect(setPromise).to.eventually.deep.equal(survey),
                expect(checkPromise).to.eventually.deep.equal(false),
            ]);
        });
        it('returns true when the XForm hash remains unchanged but the manifest hash of a mediaFile changes', () => {
            let setPromise;
            let checkPromise;
            let updatedSurvey;

            updatedSurvey = JSON.parse(JSON.stringify(survey));
            updatedSurvey.manifest[0].hash = 'md5:changed';
            setPromise = model.set(survey);
            checkPromise = setPromise.then(() => model.check(updatedSurvey));

            return Promise.all([
                expect(setPromise).to.eventually.deep.equal(survey),
                expect(checkPromise).to.eventually.equal(true),
            ]);
        });
        it('returns false when the XForm hash changes', () => {
            let setPromise;
            let checkPromise;
            let updatedSurvey;

            updatedSurvey = JSON.parse(JSON.stringify(survey));
            setPromise = model.set(survey);
            updatedSurvey.info.hash = 'def';
            checkPromise = setPromise.then(() => model.check(updatedSurvey));

            return Promise.all([
                expect(setPromise).to.eventually.deep.equal(survey),
                expect(checkPromise).to.eventually.deep.equal(false),
            ]);
        });
        /* TODO: rewrite for new cache, if necessary
        it( 'returns false when the XForm hash remains unchanged but the URL of a mediaFile changes', function() {
            var setPromise;
            var checkPromise;
            var updatedSurvey;

            updatedSurvey = JSON.parse( JSON.stringify( survey ) );
            updatedSurvey.manifest[ 0 ].downloadUrl = 'http://a-new-url.com';
            setPromise = model.set( survey );
            checkPromise = setPromise.then( function() {
                return model.check( updatedSurvey );
            } );

            return Promise.all( [
                expect( setPromise ).to.eventually.deep.equal( survey ),
                expect( checkPromise ).to.eventually.equal( false )
            ] );
        } );
        */
        it('returns null when instance record not cached', () => {
            survey.openRosaId = 'non-existing';
            return expect(model.check(survey)).to.eventually.deep.equal(null);
        });
        it('returns true when the cache is existing and up-to-date', () =>
            expect(
                model.set(survey).then(model.check)
            ).to.eventually.deep.equal(true));
    });

    describe('getHashes: when obtaining the hashes of a current cached survey', () => {
        it('returns a 400 error when openRosaId is missing', () => {
            delete survey.openRosaId;
            return expect(model.getHashes(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns a 400 error when openRosaServer is missing', () => {
            delete survey.openRosaServer;
            return expect(model.getHashes(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns the unchanged survey when the survey is not cached', () => {
            let original;
            survey.openRosaId = 'non-existing-at-all';
            original = JSON.parse(JSON.stringify(survey));
            return expect(model.getHashes(survey)).to.eventually.deep.equal(
                original
            );
        });
        it('returns the hashes when a cached survey is available', () => {
            const getPromise = model.set(survey).then(model.getHashes);

            return expect(getPromise)
                .to.eventually.have.property('formHash')
                .that.equals('abc');
        });
        it('returns a different formHash when only the XForm hash has been updated', () => {
            let getHashes1;
            let getHashes2;
            const updatedSurvey = JSON.parse(JSON.stringify(survey));

            getHashes1 = model.set(survey).then((s) => {
                delete s.info;
                delete s.manifest;
                return model.getHashes(s);
            });

            updatedSurvey.info.hash = 'def';

            getHashes2 = getHashes1
                .then(() => model.set(updatedSurvey))
                .then((s) => {
                    delete s.info;
                    delete s.manifest;
                    return model.getHashes(s);
                });

            return Promise.all([
                expect(getHashes1)
                    .to.eventually.have.property('formHash')
                    .that.equals('abc'),
                expect(getHashes2)
                    .to.eventually.have.property('formHash')
                    .that.equals('def'),
            ]);
        });
        /* TODO: rewrite these tests if necessary, to test the new cache mechanism
        it( 'returns the same mediaUrl hash when manifest resource md5 has been updated', function() {
            var getHashes1;
            var getHashes2;
            var expectedFormHash = 'abc';
            var expectedMediaUrlHash = '125d07a4b194812b6dd23be62e60f846';
            var updatedSurvey = JSON.parse( JSON.stringify( survey ) );

            getHashes1 = model.set( survey ).then( model.getHashes );

            updatedSurvey.manifest[ 0 ].hash = 'def';

            getHashes2 = getHashes1.
            then( function() {
                    return model.set( updatedSurvey );
                } )
                .then( model.getHashes );

            return Promise.all( [
                expect( getHashes1 ).to.eventually.have.property( 'formHash' ).that.equals( expectedFormHash ),
                expect( getHashes1 ).to.eventually.have.property( 'mediaUrlHash' ).that.equals( expectedMediaUrlHash ),

                expect( getHashes2 ).to.eventually.have.property( 'formHash' ).that.equals( expectedFormHash ),
                expect( getHashes2 ).to.eventually.have.property( 'mediaUrlHash' ).that.equals( expectedMediaUrlHash ),
            ] );
        } );
        it( 'returns a different mediaUrlHash when a manifest resource downloadUrl has been updated', function() {
            var getHashes1;
            var getHashes2;
            var expectedFormHash = 'abc';
            var updatedSurvey = JSON.parse( JSON.stringify( survey ) );

            getHashes1 = model.set( survey ).then( model.getHashes );

            updatedSurvey.manifest[ 0 ].downloadUrl = 'https://a-changed-url.com';

            getHashes2 = getHashes1.
            then( function() {
                    return model.set( updatedSurvey );
                } )
                .then( model.getHashes );

            return Promise.all( [
                expect( getHashes1 ).to.eventually.have.property( 'formHash' ).that.equals( expectedFormHash ),
                expect( getHashes1 ).to.eventually.have.property( 'mediaUrlHash' ).that.equals( '125d07a4b194812b6dd23be62e60f846' ),

                expect( getHashes2 ).to.eventually.have.property( 'formHash' ).that.equals( expectedFormHash ),
                expect( getHashes2 ).to.eventually.have.property( 'mediaUrlHash' ).that.equals( '0a0c98112322a6a65835d8cd1955f871' ),
            ] );
        } );
        */
    });

    describe('flush(ing): when attempting to flush the cache', () => {
        const getCacheCount = () =>
            new Promise((resolve, reject) => {
                cacheClient.keys('ca:*', (error, keys) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(keys.length);
                });
            });
        it('with flushAll(), the entire cache becomes empty...', () => {
            let count1;
            let count2;
            const survey2 = JSON.parse(JSON.stringify(survey));
            survey2.openRosaId = 'something_else';
            count1 = model
                .set(survey)
                .then(() => {
                    model.set(survey2);
                })
                .then(getCacheCount);
            count2 = count1.then(model.flushAll).then(getCacheCount);

            return Promise.all([
                expect(count1).to.eventually.equal(2),
                expect(count2).to.eventually.deep.equal(0),
            ]);
        });
        it('with flush(s), an individual survey cache becomes empty...', () => {
            const get1Promise = model.set(survey).then(model.get);
            const get2Promise = get1Promise
                .then(model.flush)
                .then(() => model.get(survey));
            return Promise.all([
                expect(get1Promise)
                    .to.eventually.have.property('form')
                    .that.equals(survey.form),
                expect(get2Promise).to.eventually.deep.equal(null),
            ]);
        });
    });
});
