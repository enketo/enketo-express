/**
 * @module utils
 */

const crypto = require('crypto');
const evpBytesToKey = require('evp_bytestokey');
const validUrl = require('valid-url');
// var debug = require( 'debug' )( 'utils' );

/**
 * Returns a unique, predictable openRosaKey from a survey oject
 *
 * @static
 * @param {module:survey-model~SurveyObject} survey - survey object
 * @param { string } [prefix] - prefix
 * @return {string|null} openRosaKey
 */
function getOpenRosaKey(survey, prefix) {
    if (!survey || !survey.openRosaServer || !survey.openRosaId) {
        return null;
    }
    prefix = prefix || 'or:';

    // Server URL is not case sensitive, form ID is case-sensitive
    return `${
        prefix + cleanUrl(survey.openRosaServer)
    },${survey.openRosaId.trim()}`;
}

/**
 * Returns a XForm manifest hash.
 *
 * @static
 * @param {Array} manifest - hash of XForm manifest
 * @param { string } type - Webform type
 * @return { string } Hash
 */
function getXformsManifestHash(manifest, type) {
    const hash = '';

    if (!manifest || manifest.length === 0) {
        return hash;
    }
    if (type === 'all') {
        return md5(JSON.stringify(manifest));
    }
    if (type) {
        const filtered = manifest.map((mediaFile) => mediaFile[type]);

        return md5(JSON.stringify(filtered));
    }

    return hash;
}

/**
 * Cleans a Server URL so it becomes useful as a db key
 * It strips the protocol, removes a trailing slash, removes www, and converts to lowercase
 *
 * @static
 * @param { string } url - Url to be cleaned up
 * @return { string } Cleaned up url
 */
function cleanUrl(url) {
    url = url.trim();
    if (url.lastIndexOf('/') === url.length - 1) {
        url = url.substring(0, url.length - 1);
    }
    const matches = url.match(/https?:\/\/(www\.)?(.+)/);
    if (matches && matches.length > 2) {
        return matches[2].toLowerCase();
    }

    return url;
}

/**
 * The name of this function is deceiving. It checks for a valid server URL and therefore doesn't approve of:
 * - fragment identifiers
 * - query strings
 *
 * @static
 * @param { string } url - Url to be validated
 * @return { boolean } Whether the url is valid
 */
function isValidUrl(url) {
    return !!validUrl.isWebUri(url) && !/\?/.test(url) && !/#/.test(url);
}

/**
 * Returns md5 hash of given message
 *
 * @static
 * @param { string } message - Message to be hashed
 * @return { string } Hash string
 */
function md5(message) {
    const hash = crypto.createHash('md5');
    hash.update(message);

    return hash.digest('hex');
}

/**
 * This is not secure encryption as it doesn't use a random cipher. Therefore the result is
 * always the same for each text & pw (which is desirable in this case).
 * This means the password is vulnerable to be cracked,
 * and we should use a dedicated low-importance password for this.
 *
 * @static
 * @param { string } text - The text to be encrypted
 * @param { string } pw - The password to use for encryption
 * @return { string } The encrypted result
 */
function insecureAes192Encrypt(text, pw) {
    let encrypted;
    const stuff = _getKeyIv(pw);
    const cipher = crypto.createCipheriv('aes192', stuff.key, stuff.iv);
    encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return encrypted;
}

/**
 * Decrypts encrypted text.
 *
 * @static
 * @param { object } encrypted - The text to be decrypted
 * @param { object } pw - The password to use for decryption
 * @return { string } The decrypted result
 */
function insecureAes192Decrypt(encrypted, pw) {
    let decrypted;
    const stuff = _getKeyIv(pw);
    const decipher = crypto.createDecipheriv('aes192', stuff.key, stuff.iv);
    decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Returns random howMany-lengthed string from provided characters.
 *
 * @static
 * @param { number } [howMany] - Desired length of string
 * @param { string } [chars] - Characters to use
 * @return { string } Random string
 */
function randomString(
    howMany = 8,
    chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
) {
    const rnd = crypto.randomBytes(howMany);

    return new Array(howMany)
        .fill() // create indices, so map can iterate
        .map((val, i) => chars[rnd[i] % chars.length])
        .join('');
}

/**
 * Not secure, but used for backward compatibility with deprecated crypto.createCipher
 * It's okay to use for this purpose.
 *
 * @param { string } pw - password
 */
function _getKeyIv(pw) {
    return evpBytesToKey(pw, null, 192, 16);
}

/**
 * Returns random item from array.
 *
 * @static
 * @param {Array} array - Target array
 * @return {*|null} Random array item
 */
function pickRandomItemFromArray(array) {
    if (!Array.isArray(array) || array.length === 0) {
        return null;
    }
    const random = Math.floor(Math.random() * array.length);
    if (!array[random]) {
        return null;
    }

    return array[random];
}

/**
 * Compares two objects by shallow properties.
 *
 * @static
 * @param { object } a - First object to be compared
 * @param { object } b - Second object to be compared
 * @return {null|boolean} Whether objects are equal (`null` for invalid arguments)
 */
function areOwnPropertiesEqual(a, b) {
    let prop;
    const results = [];

    if (typeof a !== 'object' || typeof b !== 'object') {
        return null;
    }

    for (prop in a) {
        if (Object.prototype.hasOwnProperty.call(a, prop)) {
            if (a[prop] !== b[prop]) {
                return false;
            }
            results[prop] = true;
        }
    }
    for (prop in b) {
        if (!results[prop] && Object.prototype.hasOwnProperty.call(b, prop)) {
            if (b[prop] !== a[prop]) {
                return false;
            }
        }
    }

    return true;
}

module.exports = {
    getOpenRosaKey,
    getXformsManifestHash,
    cleanUrl,
    isValidUrl,
    md5,
    randomString,
    pickRandomItemFromArray,
    areOwnPropertiesEqual,
    insecureAes192Decrypt,
    insecureAes192Encrypt,
};
