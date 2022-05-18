/**
 * @module config-model
 */

const config = require('../../config/default-config');
const pkg = require('../../package.json');
const mergeWith = require('lodash/mergeWith');
const path = require('path');
const fs = require('fs');
const url = require('url');

const themePath = path.join(__dirname, '../../public/css');
const languagePath = path.join(__dirname, '../../locales/src');
const pkgDir = require('pkg-dir');
const { execSync } = require('child_process');
// var debug = require( 'debug' )( 'config-model' );

// Merge default and local config files if a local config.json file exists
try {
    const localConfigJSON = String(
        fs.readFileSync(path.resolve(process.cwd(), './config/config.json'))
    );
    const localConfig = JSON.parse(localConfigJSON);

    mergeWith(config, localConfig, (objValue, srcValue) => {
        if (Array.isArray(srcValue)) {
            // Overwrite completely if value in localConfig is an array (do not merge arrays)
            return srcValue;
        }
    });
} catch (err) {
    // Override default config with environment variables if a local config.json does not exist
    console.warn(
        'No local config.json found. Will check environment variables instead.'
    );
    _updateConfigFromEnv(config);
    _setRedisConfigFromEnv();
}

/**
 * Updates all configuration items for which an environment variable was set.
 */
function _updateConfigFromEnv() {
    const envVarNames = [];

    for (const envVarName in process.env) {
        if (
            Object.prototype.hasOwnProperty.call(process.env, envVarName) &&
            envVarName.indexOf('ENKETO_') === 0
        ) {
            envVarNames.push(envVarName);
        }
    }

    envVarNames.sort().forEach(_updateConfigItemFromEnv);
}

/**
 * Updates a configuration item that corresponds to the provided environment variable name.
 *
 * @param { string } envVarName - environment variable name
 */
function _updateConfigItemFromEnv(envVarName) {
    const parts = envVarName.split('_').slice(1).map(_convertNumbers);
    let nextNumberIndex = _findNumberIndex(parts);
    let proceed = true;
    let part;
    let settingArr;
    let setting;
    let propName;

    while (proceed) {
        proceed = false;
        part = parts.slice(0, nextNumberIndex).join('_');
        settingArr = _findSetting(config, part);
        if (settingArr) {
            setting = settingArr[0];
            propName = settingArr[1];
            if (!Array.isArray(setting[propName])) {
                setting[propName] = _convertType(process.env[envVarName]);
            } else if (nextNumberIndex === parts.length - 1) {
                // simple populate array item (simple value)
                setting[propName][parts[nextNumberIndex]] =
                    process.env[envVarName];
            } else if (
                typeof setting[propName][parts[nextNumberIndex]] !== 'undefined'
            ) {
                // this array item (object) already exists
                nextNumberIndex = _findNumberIndex(parts, nextNumberIndex + 1);
                proceed = true;
            } else {
                // clone previous array item (object) and empty all property values
                setting[propName][parts[nextNumberIndex]] = _getEmptyClone(
                    setting[propName][parts[nextNumberIndex] - 1]
                );
                proceed = true;
            }
        }
    }
}

/**
 * Converts stringified booleans and `null` to original types
 *
 * @param { string } str - A thing to be converted.
 * @return {string|boolean|null} an un-stringified value or input value itself
 */
function _convertType(str) {
    switch (str) {
        case 'true':
            return true;
        case 'false':
            return false;
        case 'null':
            return null;
        default:
            return str;
    }
}

/**
 * Searches the configuration object to find a match for an environment variable,
 * or the first part of such a variable.
 *
 * @param { object } obj - Configuration object
 * @param { string } envName - Environment variable name or the first part of one
 * @param { string } prefix - Prefix to use (for nested objects)
 * @return {{0: object, 1: string}} 2-item array of object and property name
 */
function _findSetting(obj, envName, prefix = '') {
    for (const prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            const propEnvStyle = prefix + prop.replace(/ /g, '_').toUpperCase();
            if (propEnvStyle === envName) {
                return [obj, prop];
            }
            if (typeof obj[prop] === 'object' && obj[prop] !== null) {
                const found = _findSetting(
                    obj[prop],
                    envName,
                    `${propEnvStyle}_`
                );
                if (found) {
                    return found;
                }
            }
        }
    }
}

/**
 * Convert a non-empty string number to a number.
 *
 * @param { string } str - A stringified number
 * @return {string|number} an input value or unstrigified number
 */
function _convertNumbers(str) {
    if (!str) {
        return str;
    }
    const converted = Number(str);

    return !isNaN(converted) ? converted : str;
}

/**
 * Finds the index of the first array item that is a number.
 *
 * @param {Array<string|number>} arr - Array of strings and numbers
 * @param { number } [start] - Start index
 * @return {number|undefined} The found index
 */
function _findNumberIndex(arr, start = 0) {
    let i;
    arr.some((val, index) => {
        if (typeof val === 'number' && index >= start) {
            i = index;

            return true;
        }
    });

    return i;
}

/**
 * Returns an empty clone of the provided simple object
 *
 * @param { object } obj - A simple object
 * @return { object } Clone of input object with emptied properties
 */
function _getEmptyClone(obj) {
    const clone = JSON.parse(JSON.stringify(obj));
    _emptyObjectProperties(clone);

    return clone;
}

/**
 * Replaces all non-null and non-object property values with empty string.
 *
 * @param { object } obj - A simple object
 */
function _emptyObjectProperties(obj) {
    for (const prop in obj) {
        // if a simple array of string values
        if (Array.isArray(obj[prop]) && typeof obj[prop][0] === 'string') {
            obj[prop] = [];
        } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
            _emptyObjectProperties(obj[prop]);
        } else if (obj[prop]) {
            obj[prop] = ''; // let's hope this has no side-effects
        }
    }
}

/**
 * Overrides any redis settings if a special enviroment URL variable is set.
 */
function _setRedisConfigFromEnv() {
    const redisMainUrl = process.env.ENKETO_REDIS_MAIN_URL;
    const redisCacheUrl = process.env.ENKETO_REDIS_CACHE_URL;

    if (redisMainUrl) {
        config.redis.main = _extractRedisConfigFromUrl(redisMainUrl);
    }
    if (redisCacheUrl) {
        config.redis.cache = _extractRedisConfigFromUrl(redisCacheUrl);
    }
}

/**
 * Parses a redis URL and returns an object with `host`, `port` and `password` properties.
 *
 * @param { string } redisUrl - A compliant redis url
 * @return {{host: string, port: string, password: string|null}} config object
 */
function _extractRedisConfigFromUrl(redisUrl) {
    const parsedUrl = url.parse(redisUrl);
    const password =
        parsedUrl.auth && parsedUrl.auth.split(':')[1]
            ? parsedUrl.auth.split(':')[1]
            : null;

    return {
        host: parsedUrl.hostname,
        port: parsedUrl.port,
        password,
    };
}

/**
 * Returns a list of supported themes,
 * in case a list is provided only the ones that exists are returned.
 *
 * @static
 * @param {Array<string>} themeList - A list of themes e.g `['formhub', 'grid']`
 * @return {Array<string>} An list of supported theme names
 */
function getThemesSupported(themeList) {
    const themes = [];

    if (fs.existsSync(themePath)) {
        fs.readdirSync(themePath).forEach((file) => {
            const matches = file.match(/^theme-([A-z-]+)\.css$/);
            if (matches && matches.length > 1) {
                if (themeList !== undefined && themeList.length) {
                    if (themeList.indexOf(matches[1]) !== -1) {
                        themes.push(matches[1]);
                    }
                } else {
                    themes.push(matches[1]);
                }
            }
        });
    }

    return themes;
}

try {
    // need to be in the correct directory to run git describe --tags
    config.version = String(
        execSync(`cd ${__dirname}; git describe --tags`, {
            encoding: 'utf-8',
        })
    ).trim();
} catch (e) {
    // Probably not deployed with git, try special .tag.txt file
    try {
        config.version = `${String(execSync('head -1 .tag.txt')).trim()}-r`;
    } catch (e) {
        // no .tag.txt present, use package.json version
        config.version = `${pkg.version}-p`;
    }
}

// detect supported themes
config['themes supported'] = getThemesSupported(config['themes supported']);

// detect supported languages
config['languages supported'] = fs
    .readdirSync(languagePath)
    .filter(
        (file) =>
            file.indexOf('.') !== 0 &&
            fs.statSync(path.join(languagePath, file)).isDirectory()
    );

// if necessary, correct the base path to use for all routing
if (config['base path'] && config['base path'].indexOf('/') !== 0) {
    config['base path'] = `/${config['base path']}`;
}
if (
    config['base path'] &&
    config['base path'].lastIndexOf('/') === config['base path'].length - 1
) {
    config['base path'] = config['base path'].substring(
        0,
        config['base path'].length - 1
    );
}
config['offline path'] = '/x';

config.root = pkgDir.sync(__dirname);

// ensure backwards compatibility of old external authentication configurations
const { authentication } = config['linked form and data server'];
if (
    authentication['managed by enketo'] === false &&
    authentication['external login url that sets cookie']
) {
    authentication.type = 'cookie';
    authentication.url = authentication['external login url that sets cookie'];
}
delete authentication['external login url that sets cookie'];
delete authentication['managed by enketo'];

if (config['id length'] < 4) {
    config['id length'] = 4;
} else if (config['id length'] > 31) {
    config['id length'] = 31;
}

module.exports = {
    /**
     * @type { object }
     */
    server: config,
    /**
     * @type { object }
     */
    client: {
        googleApiKey: config.google['api key'],
        maps: config.maps,
        modernBrowsersURL: 'modern-browsers',
        supportEmail: config.support.email,
        themesSupported: config['themes supported'],
        defaultTheme: config['default theme'],
        languagesSupported: config['languages supported'],
        timeout: config.timeout,
        submissionParameter: {
            name: config['query parameter to pass to submission'],
        },
        basePath: config['base path'],
        repeatOrdinals: config['repeat ordinals'],
        validateContinuously: config['validate continuously'],
        validatePage: config['validate page'],
        swipePage: config['swipe page'],
        textMaxChars: config['text field character limit'],
        csrfCookieName: config['csrf cookie name'],
        excludeNonRelevant: config['exclude non-relevant'],
        experimentalOptimizations: config['experimental optimizations'],
    },
    getThemesSupported,
};
