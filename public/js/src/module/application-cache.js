/**
 * Deals with storing the app using service workers.
 */

import events from './event';
import settings from './settings';

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @param {Survey} survey
 */
const init = async (survey) => {
    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register(
                `${settings.basePath}/x/offline-app-worker.js`
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
            }, 60 * 60 * 1000);

            const currentActive = registration.active;

            if (currentActive != null) {
                registration.addEventListener('updatefound', () => {
                    _reportOfflineLaunchCapable(false);
                });

                navigator.serviceWorker.addEventListener(
                    'controllerchange',
                    () => {
                        window.location.reload();
                    }
                );
            }

            await registration.update();

            if (currentActive == null) {
                window.location.reload();
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
