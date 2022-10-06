/**
 * This is a stopgap measure to support forms previously cached with
 * `data-offline-src` attributes. It can be removed when forms are
 * loaded by the service worker.
 *
 * @param {HTMLElement} rootElement
 */
const reviveOfflineMediaSources = (rootElement) => {
    rootElement.querySelectorAll('[data-offline-src]').forEach((element) => {
        element.src = element.dataset.offlineSrc;
        delete element.dataset.offlineSrc;
    });
};

/**
 * @param {Element} rootElement
 * @param {Record<string, string>} [media]
 */
export const replaceMediaSources = (rootElement, media = {}) => {
    const isHTML = rootElement instanceof HTMLElement;

    if (isHTML) {
        reviveOfflineMediaSources(rootElement);
    }

    const sourceElements = rootElement.querySelectorAll('[src^="jr:"]');

    sourceElements.forEach((element) => {
        const source = (
            isHTML ? element.src : element.getAttribute('src')
        )?.trim();
        const fileName = source.replace(/.*\/([^/]+)$/, '$1');
        const replacement = media[fileName];

        if (replacement != null) {
            if (isHTML) {
                element.src = replacement;
            } else {
                element.setAttribute('src', replacement);
            }
        }
    });

    if (isHTML) {
        const formLogoURL = media['form_logo.png'];

        if (formLogoURL != null) {
            const formLogoContainer = rootElement.querySelector('.form-logo');

            if (formLogoContainer.firstElementChild == null) {
                const formLogoImg = document.createElement('img');

                formLogoImg.src = formLogoURL;
                formLogoImg.alt = 'form logo';

                formLogoContainer.append(formLogoImg);
            }
        }
    }
};

/**
 * This is a hack/workaround, and should be replaced when possible.
 *
 * When opening a submission to edit, the instance's XML state is merged
 * with the form's base model definition. This occurs internally within
 * enketo-core's `FormModel#init`. When loading a normal form, we'd be
 * able to rely on the `odk-instance-first-load` event, but this event
 * is not fired when opening a submission to edit.
 *
 * Additionally, when enketo-core encounters instance state where a
 * signature or annotation was skipped, it will attempt to use a `blob:`
 * URL from the previous session and fail to load the default.
 *
 * By hooking into the assignment of `modelRoot`, we can replace its media
 * sources both (implicitly, for now) on `odk-instance-first-load` and when
 * the merge of instance state is complete.
 *
 * @param {import('enketo-core/src/js/form').Form} form
 * @param {Record<string, string>} [media]
 */
export const replaceModelMediaSources = (form, media = {}) => {
    /** @type {Element | null} */
    let modelRoot = null;

    Object.defineProperty(form.model, 'rootElement', {
        get() {
            return modelRoot;
        },
        set(rootElement) {
            if (rootElement !== modelRoot) {
                modelRoot = rootElement;

                replaceMediaSources(modelRoot, media);
            }
        },
    });
};
