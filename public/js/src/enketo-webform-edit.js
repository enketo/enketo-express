import gui from './module/gui';
import controller from './module/controller-webform';
import settings from './module/settings';
import connection from './module/connection';
import { init as initTranslator, t, localize } from './module/translator';
import utils from './module/utils';

const range = document.createRange();

function _updateMaxSizeSetting(survey) {
    if (survey.maxSize) {
        // overwrite default max size
        settings.maxSize = survey.maxSize;
    }

    return survey;
}

/**
 * Wrap location access to detect/prevent navigation in tests.
 */
 const _location = {
    get href() {
        return location.href;
    },
    set href(href) {
        location.href = href;
    },
    reload: location.reload.bind(location),
};

/**
 * @private
 * @param {unknown} error
 */
export const showErrorOrAuthenticate = (error) => {
    const loader = document.querySelector('.main-loader');

    loader.classList.add('fail');

    if (error.status === 401) {
        _location.href = `${settings.loginUrl}?return_url=${encodeURIComponent(_location.href)}`;
    } else {
        if (!Array.isArray(error)) {
            error = [ error.message  || t('error.unknown') ];
        }

        gui.alertLoadErrors(error, t('alert.loaderror.editadvice'));
    }
};

/**
 * @typedef InitEditOptions
 * @property {string} enketoId
 * @property {string} instanceId
 */

/**
 * @param {InitEditOptions} options
 */
function _init(options) {
    return initTranslator(options)
        .then(survey => Promise.all([
            connection.getFormParts(survey),
            connection.getExistingInstance(survey)
        ]))
        .then(responses => {
            const formParts = responses[ 0 ];
            formParts.instance = responses[ 1 ].instance;
            formParts.instanceAttachments = responses[ 1 ].instanceAttachments;

            if (formParts.form && formParts.model && formParts.instance) {
                return gui.swapTheme(formParts);
            } else {
                throw new Error(t('error.unknown'));
            }
        })
        .then(connection.getMaximumSubmissionSize)
        .then(_updateMaxSizeSetting)
        .then((formParts) => {
            const formFragment = range.createContextualFragment(formParts.form);
            const formHeader = document.querySelector('.main > .paper > .form-header');

            formHeader.after(formFragment);

            const formEl = document.querySelector('form.or');

            return controller.init(formEl, {
                modelStr: formParts.model,
                instanceStr: formParts.instance,
                external: formParts.externalData,
                instanceAttachments: formParts.instanceAttachments,
                isEditing: true,
                survey: formParts,
            })
                .then(form => {
                    formParts.languages = form.languages;

                    document.querySelector('head>title').textContent = utils.getTitleFromFormStr(formParts.form);
                    localize(formEl);
                });
        })
        .catch(showErrorOrAuthenticate);
}

if (ENV !== 'test') {
    _init({
        enketoId: settings.enketoId,
        instanceId: settings.instanceId,
    });
}
