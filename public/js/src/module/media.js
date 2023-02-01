/**
 * @typedef ReplaceMediaOptions
 * @property {boolean} isOffline
 */

/**
 * @param {Element} rootElement
 * @param {Record<string, string>} [media]
 * @param {ReplaceMediaOptions} [options]
 */
export const replaceMediaSources = (rootElement, media = {}, options = {}) => {
    const sourceElements = rootElement.querySelectorAll(
        '[href^="jr:"], [src^="jr:"], [data-offline-src^="jr:"]'
    );
    const isHTML = rootElement instanceof HTMLElement;

    sourceElements.forEach((element) => {
        const attr = element.hasAttribute('href') ? 'href' : 'src';
        const offlineSrc = isHTML ? element.dataset.offlineSrc : null;
        const source =
            offlineSrc ?? element[attr] ?? element.getAttribute(attr);
        const fileName = source.replace(/.*\/([^/]+)$/, '$1');
        const replacement = media[fileName];

        if (replacement != null) {
            if (offlineSrc != null) {
                element.dataset.offlineSrc = replacement;
            } else if (isHTML) {
                element[attr] = replacement;
            } else {
                element.setAttribute(attr, replacement);
            }
        }
    });

    if (isHTML) {
        const formLogoURL = media['form_logo.png'];

        if (formLogoURL != null) {
            const formLogoContainer = rootElement.querySelector('.form-logo');

            if (formLogoContainer.firstElementChild == null) {
                const formLogoImg = document.createElement('img');

                if (options.isOffline) {
                    formLogoImg.dataset.offlineSrc = formLogoURL;
                } else {
                    formLogoImg.src = formLogoURL;
                }
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
