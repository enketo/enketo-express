const chai = require('chai');

const { expect } = chai;
const chaiAsPromised = require('chai-as-promised');
const model = require('../../app/models/instance-model');

chai.use(chaiAsPromised);

describe('Instance Model', () => {
    describe('set: when attempting to cache an instance', () => {
        let survey;

        beforeEach(() => {
            survey = {
                openRosaId: 'widgets',
                openRosaServer: 'http://example.com',
                instanceId: 'someid',
                returnUrl: 'http://example.com',
                instance: '<data></data>',
                instanceAttachments: {
                    'test.jpg': 'https://example.com/test.jpg',
                },
            };
        });

        it('returns an 400 error when instanceId is missing', () => {
            delete survey.instanceId;
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
        it('returns an 400 error when openRosaServer is missing', () => {
            delete survey.openRosaServer;
            return expect(model.set(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns an 400 error when instance is missing', () => {
            delete survey.instance;
            return expect(model.set(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns the survey object when successful', () =>
            expect(model.set(survey)).to.eventually.deep.equal(survey));
    });

    describe('get: when attempting to obtain a cached instance', () => {
        let survey;
        let promise;

        beforeEach(() => {
            survey = {
                openRosaId: 'widgets',
                openRosaServer: 'http://example.com',
                instanceId: 'someid',
                returnUrl: 'http://example.com',
                instance: '<data></data>',
                instanceAttachments: {
                    'test.jpg': 'https://example.com/test.jpg',
                },
            };
        });

        it('returns an 400 error when instanceId is missing', () => {
            delete survey.instanceId;
            return expect(model.get(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });
        it('returns an 404 error when instance record not cached', () => {
            survey.instanceId = 'non-existing';
            return expect(model.get(survey))
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(404);
        });
        it('returns the survey object with the instance property when successful', () => {
            promise = model.set(survey).then(model.get);
            return Promise.all([
                expect(promise)
                    .to.eventually.have.property('instance')
                    .that.equals(survey.instance),
                expect(promise)
                    .to.eventually.have.property('returnUrl')
                    .that.equals(survey.returnUrl),
            ]);
        });
    });

    describe('remove: when attempting to remove a cached instance', () => {
        let survey;

        beforeEach(() => {
            survey = {
                openRosaId: 'widgets',
                instanceId: 'someid',
                openRosaServer: 'http://example.com',
                returnUrl: 'http://example.com',
                instance: '<data></data>',
            };
        });

        it('returns a 400 error when the instanceId property is not provided in the parameter', () => {
            const setPromise = model.set(survey).then(model.get);
            const remPromise = setPromise.then(() => {
                delete survey.instanceId;
                return model.remove(survey);
            });
            return expect(remPromise)
                .to.eventually.be.rejected.and.to.have.property('status')
                .that.equals(400);
        });

        it('returns the removed instanceId when successful', () => {
            const setPromise = model.set(survey).then(model.get);
            const remPromise = setPromise.then(model.remove);
            const getPromise = remPromise.then(() =>
                model.get({
                    instanceId: survey.instanceId,
                })
            );

            return Promise.all([
                expect(setPromise)
                    .to.eventually.have.property('instance')
                    .that.equals(survey.instance),
                expect(remPromise).to.eventually.equal(survey.instanceId),
                expect(getPromise)
                    .to.eventually.be.rejected.and.to.have.property('status')
                    .that.equals(404),
            ]);
        });

        it('returns the removed instanceId if the record was already removed or never existed', () =>
            expect(model.remove(survey)).to.eventually.equal(
                survey.instanceId
            ));
    });
});
