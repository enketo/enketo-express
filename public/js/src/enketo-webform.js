import gui from './module/gui';
import controller from './module/controller-webform';
import settings from './module/settings';
import connection from './module/connection';
import { FormModel } from 'enketo-core/src/js/form-model';
import { init as initTranslator, t, localize, loadTranslation } from './module/translator';
import store from './module/store';
import utils from './module/utils';
import events from './module/event';
import formCache from './module/form-cache';
import applicationCache from './module/application-cache';

/**
 * @typedef {import('../../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef InitOfflineOptions
 * @property {Record<string, any>} [defaults]
 * @property {string} enketoId
 * @property {boolean} [print]
 */

/**
 * @param {InitOfflineOptions} options
 * @returns {Promise<Survey>}
 */
function _initOffline(options) {
    console.log('App in offline-capable mode.');

    const {
        enketoId,
        defaults,
        print,
    } = options;

    try {
        _setAppCacheEventHandlers();
    } catch (error) {
        return showErrorOrAuthenticate(document.querySelector('.main-loader'), error);
    }

    return applicationCache.init({ enketoId })
        .then(initTranslator)
        .then(formCache.init)
        .then(_addBranding)
        .then(_swapTheme)
        .then(formCache.updateMaxSubmissionSize)
        .then (_updateMaxSizeSetting)
        .then(survey => initSurveyController(survey, { defaults, print }))
        .then(({ form, survey }) => {
            return Promise.all([ survey, ...form.languages.map(loadTranslation) ]);
        })
        .then(([ survey ]) => formCache.updateMedia(survey))
        .then(_setFormCacheEventHandlers)
        .catch(reason => {
            return showErrorOrAuthenticate(document.querySelector('.main-loader'), reason);
        });
}

/**
 * @typedef InitOnlineOptions
 * @property {Record<string, any>} [defaults]
 * @property {string} enketoId
 * @property {boolean} [print]
 * @property {string} [xformUrl]
 */

/**
 * @param {InitOnlineOptions} options
 * @returns {Promise<Survey>}
 */
function _initOnline(options) {
    console.log('App in online-only mode.');

    const {
        enketoId,
        defaults,
        print,
        xformUrl,
    } = options;

    return store.init({ failSilently: true })
        .then(() => initTranslator({
            enketoId,
            xformUrl,
        }))
        .then(connection.getFormParts)
        .then(_addBranding)
        .then(_swapTheme)
        .then (connection.getMaximumSubmissionSize)
        .then(_updateMaxSizeSetting)
        .then(survey => initSurveyController(survey, { defaults, print }))
        .then(({ survey }) => survey)
        .catch(reason => {
            return showErrorOrAuthenticate(document.querySelector('.main-loader'), reason);
        });
}

/**
 * @typedef InitAppOptions
 * @property {Record<string, any>} [defaults]
 * @property {string} enketoId
 * @property {boolean} isOffline
 * @property {boolean} [print]
 * @property {string} [xformUrl]
 */

/**
 * @private
 * @param {InitAppOptions} options
 */
export const initApp = async (options) => {
    _setEmergencyHandlers();

    if (options.isOffline) {
        return await _initOffline({
            enketoId: options.enketoId,
            defaults: options.defaults,
            print: options.print,
        });
    }

    return await _initOnline({
        enketoId: options.enketoId,
        defaults: options.defaults,
        print: options.print,
        xformUrl: options.xformUrl,
    });
};

if (ENV !== 'test') {
    initApp({
        enketoId: settings.enketoId,
        defaults: settings.defaults,
        isOffline: settings.offline,
        print: settings.print,
        xformUrl: settings.xformUrl,
    });
}

/**
 * @param {Survey} survey
 */
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
    reload: () => { location.reload(); },
};

const LOAD_ERROR_CLASS = 'fail';

/**
 * @private
 * @param {HTMLElement} loader
 * @param {unknown} error
 */
export const showErrorOrAuthenticate = (loader, error) => {
    error = (typeof error === 'string') ? new Error(error) : error;
    loader.classList.add(LOAD_ERROR_CLASS);

    if (error.status === 401) {
        _location.href = `${settings.loginUrl}?return_url=${encodeURIComponent(_location.href)}`;
    } else {
        if (!Array.isArray(error)) {
            error = [ error.message  || t('error.unknown') ];
        }

        gui.alertLoadErrors(error,  t('alert.loaderror.entryadvice'));
    }
};

function _setAppCacheEventHandlers() {

    document.addEventListener(events.OfflineLaunchCapable().type, event => {
        const capable = event.detail.capable;
        gui.updateStatus.offlineCapable(capable);

        const scriptUrl = applicationCache.serviceWorkerScriptUrl;
        if (scriptUrl) {
            connection.getServiceWorkerVersion(scriptUrl)
                .then(gui.updateStatus.applicationVersion);
        }

    });

    document.addEventListener(events.ApplicationUpdated().type, () => {
        gui.feedback(t('alert.appupdated.msg'), 20, t('alert.appupdated.heading'));
    });
}

function _setFormCacheEventHandlers(survey) {
    document.addEventListener(events.FormUpdated().type, () => {
        gui.feedback(t('alert.formupdated.msg'), 20, t('alert.formupdated.heading'));
    });

    return survey;
}

const FLUSH_BUTTON_SELECTOR = '.side-slider__advanced__button.flush-db';

/**
 * Advanced/emergency handlers that should always be activated even if form loading fails.
 */
function _setEmergencyHandlers() {
    const flushBtn = document.querySelector(FLUSH_BUTTON_SELECTOR);

    if (flushBtn) {
        flushBtn.addEventListener('click', () => {
            gui.confirm({
                msg: t('confirm.deleteall.msg'),
                heading: t('confirm.deleteall.heading')
            }, {
                posButton: t('confirm.deleteall.posButton'),
            })
                .then(confirmed => {
                    if (!confirmed) {
                        throw new Error('Cancelled by user');
                    }

                    return store.flush();
                })
                .then(() => {
                    _location.reload();
                })
                .catch(() => {});
        });
    }
}

const BRAND_IMAGE_SELECTOR = '.form-header__branding img';

/**
 * Adds/replaces branding if necessary, and unhides branding.
 *
 * @param { Survey } survey
 * @return { Survey }
 */
function _addBranding(survey) {
    const brandImg = document.querySelector(BRAND_IMAGE_SELECTOR);
    const attribute = (settings.offline) ? 'data-offline-src' : 'src';

    if (brandImg != null) {
        if (survey.branding && survey.branding.source && brandImg.src !== survey.branding.source) {
            brandImg.removeAttribute('src');
            brandImg.setAttribute(attribute, survey.branding.source);
        }

        brandImg.classList.remove('hide');
    }

    return survey;
}

const SWAP_THEME_ERROR_MESSAGE = 'Received form incomplete';

/**
 * Swaps the theme if necessary.
 *
 * @param  { Survey } survey
 * @return { Promise<Survey> }
 */
function _swapTheme(survey) {
    if (survey.form && survey.model) {
        return gui.swapTheme(survey);
    } else {
        return Promise.reject(new Error(SWAP_THEME_ERROR_MESSAGE));
    }
}

/**
 * @param {string} modelStr
 * @param {Record<string, any>} [defaults]
 * @return {string | null}
 */
function _prepareInstance(modelStr, defaults) {
    const entries = Object.entries(defaults || {});

    if (entries.length === 0) {
        return null;
    }

    let model = new FormModel(modelStr, {
        full: false,
    });

    model.init();

    for (const [ path, value ] of Object.entries(defaults)) {
        // if this fails, the FormModel will output a console error and ignore the instruction
        model.node(path).setVal(value);
    }

    // TODO: would be good to not include nodes that weren't in the defaults parameter
    // HOWEVER, that would also set number of repeats to 0, which may be undesired
    // TODO: would be good to just pass model along instead of converting to string first
    // existingInstance = model.getStr();
    return model.getStr();
}

/**
 * @typedef InitSurveyControllerOptions
 * @property {Record<string, any>} [defaults]
 * @property {boolean} [print]
 */

/**
 * @typedef {import('enketo-core').Form} EnketoForm
 */

/**
 * @typedef InitSurveyControllerResult
 * @property {EnketoForm} form
 * @property {Survey} survey
 */

/**
 * @private
 * @param {Survey} survey
 * @param {InitSurveyControllerOptions} [options]
 * @return {Promise<InitSurveyControllerResult>}
 */
export const initSurveyController = async (survey, options = {}) => {
    const range = document.createRange();
    const formFragment = range.createContextualFragment(survey.form);
    const formHeader = document.querySelector('.main > .paper > .form-header');

    formHeader.after(formFragment);

    const formElement = document.querySelector('form.or');
    const instanceStr = _prepareInstance(survey.model, options.defaults);

    const form = await controller.init(formElement, {
        modelStr: survey.model,
        instanceStr,
        external: survey.externalData,
        survey,
    });

    const formTitle = utils.getTitleFromFormStr(survey.form);

    let pageTitle = document.querySelector('head > title');

    pageTitle.textContent = formTitle;

    if (options.print) {
        gui.applyPrintStyle();
    }

    localize(formElement);

    return {
        form,
        survey,
    };
};
