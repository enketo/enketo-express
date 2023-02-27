import Papa from 'papaparse';
import { dataUriToBlobSync } from 'enketo-core/src/js/utils';

const dataUriCache = {};

// var hasArrayBufferView = new Blob( [ new Uint8Array( 100 ) ] ).size == 100;

/**
 * Converts a Blob to a (Base64-coded) dataURL
 *
 * @param {Blob} blob - The blob
 * @param { string } filename - The filename
 * @return {Promise<string>} Base64-encoded-converted content of the provided Blob.
 */
function blobToDataUri(blob, filename) {
    let reader;
    const cacheKey = filename || (blob && blob.name ? blob.name : null);
    const cacheResult = cacheKey ? dataUriCache[cacheKey] : null;

    return new Promise((resolve, reject) => {
        if (cacheResult) {
            // Using a cache resolves two issues:
            // 1. A mysterious and occasional iOS fileReader NOT_FOUND exception when a File is converted a second time.
            // 2. Reduce rate of linear performance degradation with each image that is added to a record.
            resolve(cacheResult);
        } else if (!(blob instanceof Blob)) {
            // There is some quirky Chrome and Safari behaviour if blob is undefined or a string
            // so we peform an additional check
            reject(new Error('TypeError: Require Blob'));
        } else {
            reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result;
                if (cacheKey) {
                    dataUriCache[cacheKey] = base64data;
                }
                resolve(base64data);
            };
            reader.onerror = (e) => {
                reject(e);
            };
            reader.readAsDataURL(blob);
        }
    });
}

/**
 * Converts a Blob to a an ArrayBuffer
 *
 * @param  {Blob} blob - The blob
 * @return {Promise<ArrayBuffer>} ArrayBuffer-converted content of the provided Blob.
 */
function blobToArrayBuffer(blob) {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onloadend = () => {
            resolve(reader.result);
        };
        reader.onerror = (e) => {
            reject(e);
        };

        // There is some quirky Chrome and Safari behaviour if blob is undefined or a string
        // so we peform an additional check
        if (!(blob instanceof Blob)) {
            reject(new Error('TypeError: Require Blob'));
        } else {
            reader.readAsArrayBuffer(blob);
        }
    });
}

/**
 * The inverse of blobToDataUri, that converts a dataURL back to a Blob
 *
 * @param  { string } dataURI - dataURI
 * @return {Promise<Blob>} Blob-converted content of provided Data URI.
 */
function dataUriToBlob(dataURI) {
    let blob;

    return new Promise((resolve, reject) => {
        try {
            blob = dataUriToBlobSync(dataURI);

            resolve(blob);
        } catch (e) {
            reject(e);
        }
    });
}

function getThemeFromFormStr(formStr) {
    const matches = formStr.match(/<\s?form .*theme-([A-z-]+)/);

    return matches && matches.length > 1 ? matches[1] : null;
}

function getTitleFromFormStr(formStr) {
    if (typeof formStr !== 'string') {
        console.error('Cannot extract form title. Not a string.');

        return;
    }
    const matches = formStr.match(/<\s?h3 [^>]*id="form-title">([^<]+)</);

    return matches && matches.length > 1 ? matches[1] : null;
}

/**
 * @param {string} csv
 */
function csvToArray(csv) {
    const input = csv.trim();
    const options = {
        skipEmptyLines: true,
    };

    let result = Papa.parse(input, options);

    if (result.errors.some((error) => error.code === 'UndetectableDelimiter')) {
        const parsed = Papa.parse(input, {
            ...options,
            delimiter: ',',
        });

        if (
            parsed.errors.length === 0 &&
            parsed.data.every((line) => line.length === 1)
        ) {
            result = parsed;
        }
    }

    if (result.errors.length) {
        let [error] = result.errors;

        if (!(error instanceof Error)) {
            error = new Error(error.message ?? String(error));
        }

        throw error;
    }

    return result.data;
}

function arrayToXml(rows, langMap) {
    // var xmlStr;
    let headers = rows.shift();
    // var langAttrs = [];
    const langs = [];

    langMap = typeof langMap !== 'object' ? {} : langMap;

    // Trim the headings
    headers = headers.map((header) => header.trim());

    // Extract and strip languages from headers
    headers = headers.map((header, index) => {
        const parts = header.split('::');
        let lang;
        if (parts && parts.length === 2) {
            lang = langMap[parts[1]] || parts[1];
            // langAttrs[ index ] = ' lang="' + lang + '"';
            langs[index] = lang;

            return parts[0];
        }
        langs[index] = '';

        return header;
    });

    // Check if headers are valid XML node names
    headers.every(throwInvalidCSVHeaderToXMLLocalName);

    // create an XML Document
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString('<root></root>', 'text/xml');
    rows.forEach((row) => {
        const item = xmlDoc.createElement('item');
        xmlDoc.firstChild.appendChild(item);
        row.forEach((value, index) => {
            const node = xmlDoc.createElement(headers[index]);
            if (langs[index]) {
                node.setAttribute('lang', langs[index]);
            }
            // encoding of XML entities is done automatically
            node.textContent = value.trim();
            item.appendChild(node);
        });
    });

    return xmlDoc;
}

function csvToXml(csv, langMap) {
    const result = csvToArray(csv);

    return arrayToXml(result, langMap);
}

/**
 * Generates a querystring from an object or an array of objects with `name` and `value` properties.
 *
 * @param  {{name: string, value: string}|Array.<{name: string, value: string}>} obj - Object or array of objects to turn into a querystring.
 * @return { string } querystring
 */
function getQueryString(obj) {
    let arr;
    let serialized;

    if (!Array.isArray(obj)) {
        arr = [obj];
    } else {
        arr = obj;
    }

    serialized = arr.reduce((previousValue, item) => {
        let addition = '';
        if (
            item &&
            typeof item.name !== 'undefined' &&
            typeof item.value !== 'undefined' &&
            item.value !== '' &&
            item.value !== null
        ) {
            addition = previousValue ? '&' : '';
            addition += _serializeQueryComponent(item.name, item.value);
        }

        return previousValue + addition;
    }, '');

    return serialized.length > 0 ? `?${serialized}` : '';
}

function _serializeQueryComponent(name, value) {
    let n;
    let serialized = '';

    // for both arrays of single-level objects and regular single-level objects
    if (typeof value === 'object') {
        for (n in value) {
            if (Object.prototype.hasOwnProperty.call(value, n)) {
                if (serialized) {
                    serialized += '&';
                }
                serialized += `${encodeURIComponent(name)}[${encodeURIComponent(
                    n
                )}]=${encodeURIComponent(value[n])}`;
            }
        }

        return serialized;
    }

    return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
}

/**
 * Based on {@link https://www.w3.org/TR/xml/#d0e804}, modified to:
 *
 * - Break up sub-patterns for readability
 * - Use JavaScript Unicode escape sequences
 * - Build a more efficient `RegExp` by joining some character ranges
 * - Omit `:`, as this pattern only checks for local names
 */
const XML_LOCAL_NAME_PATTERN = (() => {
    const nameStartCharRanges = [
        'A-Z',
        'a-z',
        '_',
        '\\u{C0}-\\u{D6}',
        '\\u{D8}-\\u{F6}',
        '\\u{F8}-\\u{2FF}',
        '\\u{370}-\\u{37D}',
        '\\u{37F}-\\u{1FFF}',
        '\\u{200C}-\\u{200D}',
        '\\u{2070}-\\u{218F}',
        '\\u{2C00}-\\u{2FEF}',
        '\\u{3001}-\\u{D7FF}',
        '\\u{F900}-\\u{FDCF}',
        '\\u{FDF0}-\\u{FFFD}',
        '\\u{10000}-\\u{EFFFF}',
    ];
    const nameCharRanges = [
        '-', // Must come first or last in a `RegExp` character class
        ...nameStartCharRanges,
        '"."',
        '\\u{B7}',
        '0-9',
        '\\u{0300}-\\u{036F}',
        '\\u{203F}-\\u{2040}',
    ];

    const nameStartChar = `[${nameStartCharRanges.join('')}]`;
    const nameChar = `[${nameCharRanges.join('')}]`;
    const name = `^${nameStartChar}${nameChar}*$`;

    return new RegExp(name, 'u');
})();

/**
 * TODO (2023-02-27): Is the below restriction really necessary? It seems we could:
 *
 * - Use existing namespace declarations present on the XForm document.
 * - Generate arbitrary namespace URIs for those which are not present, and add
 *   them to the XForm.
 */

/**
 * @param {string} name
 * @return {true | never} - Returns true if `name` is a valid XML local name,
 * throws otherwise. Namespaced CSV headers are not permitted because CSVs do
 * not have a way to convey namespace declarations.
 */
const throwInvalidCSVHeaderToXMLLocalName = (name) => {
    // Note: this is more restrictive than XML spec.
    // We cannot accept namespaces prefixes because there is no way of knowing the namespace uri in CSV.
    if (XML_LOCAL_NAME_PATTERN.test(name)) {
        return true;
    }

    throw new Error(
        `CSV column heading "${name}" cannot be turned into a valid XML element`
    );
};

/**
 *
 * @param { string } path - location.pathname in a browser
 */
function getEnketoId(path) {
    path = path.endsWith('/') ? path.substring(0, path.length - 1) : path;
    const id = path.substring(path.lastIndexOf('/') + 1);

    // previews /preview, and /preview/i can be loaded (unofficially) without an ID.
    return id === 'preview' || id === 'i' ? null : id;
}

export default {
    blobToDataUri,
    blobToArrayBuffer,
    dataUriToBlob,
    dataUriToBlobSync, // why export this?
    getThemeFromFormStr,
    getTitleFromFormStr,
    csvToXml,
    arrayToXml,
    csvToArray,
    getQueryString,
    getEnketoId,
};
