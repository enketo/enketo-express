import applicationCache from '../../public/js/src/module/application-cache';
import events from '../../public/js/src/module/event';
import settings from '../../public/js/src/module/settings';

describe('Application cache initialization (offline service worker registration)', () => {
    const basePath = '-';
    const version = `1.2.3-BADB3D`;
    const applicationUpdatedEvent = events.ApplicationUpdated();
    const applicationUpdatedType = applicationUpdatedEvent.type;
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

    /** @type {Function | null} */
    let controllerChangeListener;

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

        settings.basePath ??= undefined;
        settings.version ??= undefined;
        sandbox.stub(settings, 'basePath').value(basePath);
        sandbox.stub(settings, 'version').value(version);

        const addControllerChangeListener =
            navigator.serviceWorker.addEventListener;

        controllerChangeListener = null;

        sandbox
            .stub(navigator.serviceWorker, 'addEventListener')
            .callsFake((type, listener) => {
                if (type === 'controllerchange') {
                    expect(controllerChangeListener).to.equal(null);
                    controllerChangeListener = listener;
                }
                addControllerChangeListener.call(
                    navigator.serviceWorker,
                    type,
                    listener
                );
            });
    });

    afterEach(() => {
        document.removeEventListener(
            offlineLaunchCapableType,
            offlineLaunchCapableListener
        );

        if (controllerChangeListener != null) {
            navigator.serviceWorker.removeEventListener(
                'controllerchange',
                controllerChangeListener
            );
        }

        timers.reset();
        timers.restore();
        sandbox.restore();
    });

    it('registers the service worker script', async () => {
        await applicationCache.init();

        expect(registrationStub).to.have.been.calledWith(
            new URL(
                `${basePath}/x/offline-app-worker.js?version=${version}`,
                window.location.href
            )
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

    it('reloads when an updated service worker becomes active on load', async () => {
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

    it('notifies the user, rather than reloading, when the service worker has changed', async () => {
        activeServiceWorker = {};
        await applicationCache.init();

        timers.tick(applicationCache.UPDATE_REGISTRATION_INTERVAL);

        const listener = sandbox.fake();

        document.addEventListener(applicationUpdatedType, listener);
        navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
        document.removeEventListener(applicationUpdatedType, listener);

        expect(reloadStub).not.to.have.been.called;
        expect(listener).to.have.been.calledOnceWith(applicationUpdatedEvent);
    });
});
