import applicationCache from '../../public/js/src/module/application-cache';
import events from '../../public/js/src/module/event';
import settings from '../../public/js/src/module/settings';

describe('Application Cache', () => {
    const basePath = '-';
    const offlineLaunchCapableType = events.OfflineLaunchCapable().type;

    /** @type {ServiceWorker | null} */
    let activeServiceWorker;

    /** @type {sinon.SinonSandbox} */
    let sandbox;

    /** @type {sinon.SinonFakeTimers} */
    let timers;

    /** @type {sinon.SinonFake} */
    let offlineLaunchCapableListener;

    /** @type {sinon.SinonStub} */
    let reloadStub;

    /** @type {sinon.SinonStub} */
    let registrationStub;

    /** @type {sinon.SinonFake} */
    let registrationUpdateFake;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        timers = sandbox.useFakeTimers(Date.now());

        offlineLaunchCapableListener = sinon.fake();

        document.addEventListener(
            offlineLaunchCapableType,
            offlineLaunchCapableListener
        );

        activeServiceWorker = null;

        registrationUpdateFake = sandbox.fake(() => Promise.resolve());

        registrationStub = sandbox
            .stub(navigator.serviceWorker, 'register')
            .callsFake(() =>
                Promise.resolve({
                    addEventListener() {},
                    active: activeServiceWorker,
                    update: registrationUpdateFake,
                })
            );
        reloadStub = sandbox
            .stub(applicationCache.location, 'reload')
            .callsFake(() => {});

        if (!('basePath' in settings)) {
            settings.basePath = undefined;
        }

        sandbox.stub(settings, 'basePath').value(basePath);
    });

    afterEach(() => {
        document.removeEventListener(
            offlineLaunchCapableType,
            offlineLaunchCapableListener
        );
        timers.restore();
        sandbox.restore();
    });

    it('registers the service worker script', async () => {
        await applicationCache.init();

        expect(registrationStub).to.have.been.calledWith(
            `${basePath}/x/offline-app-worker.js`
        );
    });

    it('reloads immediately after registering the service worker for the first time', async () => {
        await applicationCache.init();

        expect(reloadStub).to.have.been.called;
    });

    it('does not reload immediately after registering the service worker for subsequent times', async () => {
        activeServiceWorker = {};

        await applicationCache.init();

        expect(reloadStub).not.to.have.been.called;
    });

    it('reports offline capability after registering the service worker for subsequent times', async () => {
        activeServiceWorker = {};

        await applicationCache.init();

        expect(offlineLaunchCapableListener).to.have.been.calledWith(
            events.OfflineLaunchCapable({ capable: true })
        );
    });

    it('reports offline capability is not available when service workers are not available', async () => {
        activeServiceWorker = {};

        sandbox.stub(navigator, 'serviceWorker').value(null);

        await applicationCache.init();

        expect(offlineLaunchCapableListener).to.have.been.calledWith(
            events.OfflineLaunchCapable({ capable: false })
        );
    });

    it('reports offline capability is not available when registration throws an error', async () => {
        activeServiceWorker = {};

        const error = new Error('Something bad');

        registrationStub.callsFake(() => Promise.reject(error));

        /** @type {Error} */
        let caught;

        try {
            await applicationCache.init();
        } catch (error) {
            caught = error;
        }

        expect(offlineLaunchCapableListener).to.have.been.calledWith(
            events.OfflineLaunchCapable({ capable: false })
        );
        expect(caught instanceof Error).to.equal(true);
        expect(caught.message).to.include(error.message);
        expect(caught.stack).to.equal(error.stack);
    });

    it('reloads when an updated service worker becomes active', async () => {
        activeServiceWorker = {};
        await applicationCache.init();

        expect(applicationCache.location.reload).not.to.have.been.called;

        navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));

        expect(applicationCache.location.reload).to.have.been.called;
    });

    it('checks for updates immediately after registration', async () => {
        await applicationCache.init();

        expect(registrationUpdateFake).to.have.been.calledOnce;
    });

    it('checks for updates immediately after registration', async () => {
        await applicationCache.init();

        expect(registrationUpdateFake).to.have.been.calledOnce;

        timers.tick(applicationCache.UPDATE_REGISTRATION_INTERVAL);

        expect(registrationUpdateFake).to.have.been.calledTwice;
    });
});
