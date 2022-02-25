import i18next from 'i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import settings from './settings';

const LOADPATH = `${settings.basePath}${settings.offlinePath}/locales/build/__lng__/translation-combined.json`;
const LANGEXTRACT = /^[a-z]{2,3}/;
const range = document.createRange();

// The postProcessor assumes that array values with line breaks should be divided into HTML paragraphs.
const htmlParagraphsPostProcessor = {
    type: 'postProcessor',
    name: 'htmlParagraphsPostProcessor',
    process(value) {
        const paragraphs = value.split('\n');

        return paragraphs.length > 1
            ? `<p>${paragraphs.join('</p><p>')}</p>`
            : value;
    },
};

/**
 * Initializes translator and resolves **when translations have been loaded**.
 *
 * @param  {=*?} something - can be anything
 * @return { Promise }       promise resolving the original something argument
 */
const init = (something) => initialize.then(() => something);

const initialize = new Promise((resolve, reject) => {
    i18next
        .use(HttpApi)
        .use(LanguageDetector)
        .use(htmlParagraphsPostProcessor)
        .init(
            {
                whitelist: settings.languagesSupported,
                fallbackLng: 'en',
                joinArrays: '\n',
                backend: {
                    loadPath: LOADPATH,
                },
                load: 'languageOnly',
                lowerCaseLng: true,
                detection: {
                    order: ['querystring', 'navigator'],
                    lookupQuerystring: 'lang',
                    caches: false,
                },
                interpolation: {
                    prefix: '__',
                    suffix: '__',
                },
                postProcess: ['htmlParagraphsPostProcessor'],
            },
            (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            }
        );
});

const t = (key, options) => i18next.t(key, options);

/**
 * Localizes the descendents of an element based on the data-i18n attribute.
 * Performance-optimized in Chrome (used bench6 form).
 *
 * Note, this does not work if there is translation context (i.e. options for t(key, options) call).
 *
 * @param {Element} container - The element to localize.
 * @param { string } [lng] - The 2-or-3-character IANA subtag.
 */
const localize = (container, lng) => {
    const cache = {};
    const list = container.querySelectorAll('[data-i18n]');

    return Promise.resolve()
        .then(() => {
            if (lng) {
                return i18next.changeLanguage(lng);
            }
        })
        .then(() => {
            list.forEach((el) => {
                const key = el.dataset.i18n;
                if (key) {
                    if (!cache[key]) {
                        let options = {};
                        // quick hack for __icon__ replacement
                        if (el.dataset.i18nIcon) {
                            options = {
                                icon: `<span class="icon ${el.dataset.i18nIcon}"> </span>`,
                                interpolation: { escapeValue: false },
                            };
                        }
                        if (el.dataset.i18nNumber) {
                            options = {
                                number: el.dataset.i18nNumber,
                            };
                        }
                        cache[key] = t(key, options);
                    }
                    // This assumes that if the element has a placeholder, that's the thing that
                    // needs to be localized, since placeholders are only used on form controls,
                    // and the textContent of a form control is never translatable.
                    if (el.placeholder) {
                        el.placeholder = cache[key];
                    } else if (el.dataset.i18nIcon) {
                        el.textContent = '';
                        el.append(range.createContextualFragment(cache[key]));
                    } else {
                        el.textContent = cache[key];
                    }
                }
            });

            // return current language directionality
            return i18next.dir();
        });
};

/**
 * Loads a translation file. This function is used to cache all language files for offline usage, upon form load.
 *
 * @param  { string } lang - 2-character IANA language subtag
 */
const loadTranslation = (lang) => {
    if (lang) {
        console.log(`loading translations for ${lang}`);
        fetch(LOADPATH.replace('__lng__', lang));
        // Do nothing. It is now cached. Wonderful.
    }
};

const getCurrentUiLanguage = () => {
    const matches = i18next.language.match(LANGEXTRACT);

    return matches.length ? matches[0] : null;
};

const getBrowserLanguage = () => {
    const matches = navigator.language.match(LANGEXTRACT);

    return matches.length ? matches[0] : null;
};

export {
    init,
    t,
    localize,
    loadTranslation,
    getCurrentUiLanguage,
    getBrowserLanguage,
};

/**
 * add keys from XSL stylesheets manually
 *
 * t('constraint.invalid');
 * t('constraint.required');
 * t('form.required');
 *
 * and from custom widgets
 *
 * t('literacywidget.start');
 * t('literacywidget.finish');
 */
