// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const chai = require('chai');

const { expect } = chai;
const chaiAsPromised = require('chai-as-promised');
const submission = require('../../app/models/submission-model');

chai.use(chaiAsPromised);

describe('Survey Model', () => {
    describe('isNew() check', () => {
        const id = 'AAAA';
        const instanceId = 'uuid:BBBB';

        it('returns true for not-previously logged submissions', () => {
            const test = submission.isNew(id, instanceId);
            return expect(test).to.eventually.equal(true);
        });

        it('returns false for previously logged submissions', () => {
            const test = submission
                .isNew(id, instanceId)
                .then(() => submission.isNew(id, instanceId));
            return expect(test).to.eventually.equal(false);
        });

        it('is rejected if id is undefined', () => {
            const test = submission.isNew(undefined, instanceId);
            return expect(test)
                .to.eventually.be.rejected.and.have.property('status')
                .that.equals(400);
        });

        it('is rejected if id is null', () => {
            const test = submission.isNew(null, instanceId);
            return expect(test)
                .to.eventually.be.rejected.and.have.property('status')
                .that.equals(400);
        });

        it('is rejected if id is false', () => {
            const test = submission.isNew(false, instanceId);
            return expect(test)
                .to.eventually.be.rejected.and.have.property('status')
                .that.equals(400);
        });

        it('is rejected if instanceId is undefined', () => {
            const test = submission.isNew(id, undefined);
            return expect(test)
                .to.eventually.be.rejected.and.have.property('status')
                .that.equals(400);
        });

        it('is rejected if instanceId is null', () => {
            const test = submission.isNew(id, null);
            return expect(test)
                .to.eventually.be.rejected.and.have.property('status')
                .that.equals(400);
        });

        it('is rejected if instanceId is false', () => {
            const test = submission.isNew(id, false);
            return expect(test)
                .to.eventually.be.rejected.and.have.property('status')
                .that.equals(400);
        });
    });
});
