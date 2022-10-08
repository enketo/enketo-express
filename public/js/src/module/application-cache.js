/**
 * Deals with storing the app using service workers.
 */

import events from './event';
import settings from './settings';

/**
 * @private
 *
 * Used only for mocking `window.reload` in tests.
 */
const location = {
    get protocol() {
        return window.location.protocol;
    },

    reload() {
        window.location.reload();
    },
};

/**
 * @private
 *
 * Exported only for testing.
 */
const UPDATE_REGISTRATION_INTERVAL = 60 * 60 * 1000;

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @param {Survey} survey
 */
const init = async (survey) => {
    try {
        if (navigator.serviceWorker != null) {
            const workerPath = `${settings.basePath}/x/offline-app-worker.js`;
            const workerURL = new URL(workerPath, window.location.href);

            workerURL.searchParams.set('version', settings.version);

            const registration = await navigator.serviceWorker.register(
                workerURL
            );

            // Registration was successful
            console.log(
                'Offline application service worker registration successful with scope: ',
                registration.scope
            );
            setInterval(() => {
                console.log(
                    'Checking for offline application cache service worker update'
                );
                registration.update();
            }, UPDATE_REGISTRATION_INTERVAL);

            const currentActive = registration.active;

            if (currentActive != null) {
                registration.addEventListener('updatefound', () => {
                    _reportOfflineLaunchCapable(false);
                });

                navigator.serviceWorker.addEventListener(
                    'controllerchange',
                    () => {
                        location.reload();
                    }
                );
            }

            try {
                registration.update();
            } catch {
                // Probably offline
            }

            if (currentActive == null) {
                location.reload();
            } else {
                _reportOfflineLaunchCapable(true);
            }
        } else {
            if (location.protocol.startsWith('http:')) {
                console.error(
                    'Service workers not supported on this http URL (insecure)'
                );
            } else {
                console.error(
                    'Service workers not supported on this browser. This form cannot launch online'
                );
            }

            _reportOfflineLaunchCapable(false);
        }
    } catch (error) {
        // registration failed :(
        const registrationError = Error(
            `Offline application service worker registration failed: ${error.message}`
        );

        registrationError.stack = error.stack;

        _reportOfflineLaunchCapable(false);

        throw registrationError;
    }

    return survey;
};

function _reportOfflineLaunchCapable(capable = true) {
    document.dispatchEvent(events.OfflineLaunchCapable({ capable }));
}

export default {
    init,
    location,
    UPDATE_REGISTRATION_INTERVAL,
    get serviceWorkerScriptUrl() {
        if (
            'serviceWorker' in navigator &&
            navigator.serviceWorker.controller
        ) {
            return navigator.serviceWorker.controller.scriptURL;
        }

        return null;
    },
};
