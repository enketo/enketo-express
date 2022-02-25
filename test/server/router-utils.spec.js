const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

chai.should();
chai.use(sinonChai);
const { expect } = chai;
const chaiAsPromised = require('chai-as-promised');

const utils = require('../../app/lib/utils');
const routerUtils = require('../../app/lib/router-utils');

chai.use(chaiAsPromised);

describe('Router utilities', () => {
    describe('enketoIdParam function', () => {
        it('should assign enketoId to request object', () => {
            const req = {};
            const res = {};
            const next = sinon.fake();
            const id = 'aA12bB34';
            routerUtils.enketoId(req, res, next, id);
            expect(req.enketoId).to.equal('aA12bB34');
            expect(next).to.have.been.calledWith();
        });

        it('should pass "route" when id is invalid', () => {
            const req = {};
            const res = {};
            const next = sinon.fake();
            const id = '1';
            routerUtils.enketoId(req, res, next, id);
            expect(req).should.not.have.property('enketoId');
            expect(next).to.have.been.calledWith('route');
        });
    });

    describe('encryptedEnketoIdSingle function', () => {
        it('should assign decrypted enketoId to request object', () => {
            const req = {};
            const res = {};
            const next = sinon.fake();
            const encryptedId = utils.insecureAes192Encrypt(
                'aA12bB34',
                routerUtils.idEncryptionKeys.singleOnce
            );
            const id = `${encryptedId}`;
            routerUtils.encryptedEnketoIdSingle(req, res, next, id);
            expect(req.enketoId).to.equal('aA12bB34');
            expect(next).to.have.been.calledWith();
        });

        it('should pass "route" when encrypted id is invalid', () => {
            const req = {};
            const res = {};
            const next = sinon.fake();
            const encryptedId = 'x';
            const id = `${encryptedId}`;
            routerUtils.encryptedEnketoIdSingle(req, res, next, id);
            expect(req).should.not.have.property('enketoId');
            expect(next).to.have.been.calledWith('route');
        });

        it('should pass "route" when decrypted id is invalid', () => {
            const originalConsoleError = console.error;
            console.error = () => {};
            const req = {};
            const res = {};
            const next = sinon.fake();
            const encryptedId = utils.insecureAes192Encrypt(
                'Ń™€ßį§¶•',
                routerUtils.idEncryptionKeys.singleOnce
            );
            const id = `${encryptedId}`;
            routerUtils.encryptedEnketoIdSingle(req, res, next, id);
            expect(req).should.not.have.property('enketoId');
            expect(next).to.have.been.calledWith('route');
            console.error = originalConsoleError;
        });
    });

    describe('encryptedEnketoIdView function', () => {
        it('should assign decrypted enketoId to request object', () => {
            const req = {};
            const res = {};
            const next = sinon.fake();
            const encryptedId = utils.insecureAes192Encrypt(
                'aA12bB34',
                routerUtils.idEncryptionKeys.view
            );
            const id = `${encryptedId}`;
            routerUtils.encryptedEnketoIdView(req, res, next, id);
            expect(req.enketoId).to.equal('aA12bB34');
            expect(next).to.have.been.calledWith();
        });
    });
});
