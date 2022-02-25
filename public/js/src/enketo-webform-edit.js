import gui from './module/gui';
import controller from './module/controller-webform';
import settings from './module/settings';
import connection from './module/connection';
import { init as initTranslator, t, localize } from './module/translator';
import utils from './module/utils';

const loader = document.querySelector('.main-loader');
const formheader = document.querySelector('.main > .paper > .form-header');
const survey = {
    enketoId: settings.enketoId,
    instanceId: settings.instanceId,
};
const range = document.createRange();

initTranslator(survey)
    .then((survey) =>
        Promise.all([
            connection.getFormParts(survey),
            connection.getExistingInstance(survey),
        ])
    )
    .then((responses) => {
        const formParts = responses[0];
        formParts.instance = responses[1].instance;
        formParts.instanceAttachments = responses[1].instanceAttachments;

        if (formParts.form && formParts.model && formParts.instance) {
            return gui.swapTheme(formParts);
        }
        throw new Error(t('error.unknown'));
    })
    .then(connection.getMaximumSubmissionSize)
    .then(_updateMaxSizeSetting)
    .then(_init)
    .catch(_showErrorOrAuthenticate);

function _updateMaxSizeSetting(survey) {
    if (survey.maxSize) {
        // overwrite default max size
        settings.maxSize = survey.maxSize;
    }

    return survey;
}

function _showErrorOrAuthenticate(error) {
    loader.classList.add('fail');

    if (error.status === 401) {
        window.location.href = `${
            settings.loginUrl
        }?return_url=${encodeURIComponent(window.location.href)}`;
    } else {
        if (!Array.isArray(error)) {
            error = [error.message || t('error.unknown')];
        }

        gui.alertLoadErrors(error, t('alert.loaderror.editadvice'));
    }
}

function _init(formParts) {
    const formFragment = range.createContextualFragment(formParts.form);
    formheader.after(formFragment);
    const formEl = document.querySelector('form.or');

    return controller
        .init(formEl, {
            modelStr: formParts.model,
            instanceStr: formParts.instance,
            external: formParts.externalData,
            instanceAttachments: formParts.instanceAttachments,
            isEditing: true,
            survey: formParts,
        })
        .then((form) => {
            formParts.languages = form.languages;
            document.querySelector('head>title').textContent =
                utils.getTitleFromFormStr(formParts.form);
            localize(formEl);
        });
}
