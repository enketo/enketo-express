/** ********************************************************************************************
 * Just a word of warning. Be extra careful changing this code by always testing the decryption
 * of submissions with and without media files in ODK Briefcase. If a regression is created it
 * may be impossible to retrieve encrypted data (also the user likely cannot share the private
 * key).
 ********************************************************************************************* */
import forge from 'node-forge';
import utils from './utils';

/**
 * @typedef {import('../../../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyObject} Survey
 */

const SYMMETRIC_ALGORITHM = 'AES-CFB'; // JAVA: "AES/CFB/PKCS5Padding"
const ASYMMETRIC_ALGORITHM = 'RSA-OAEP'; // JAVA: "RSA/NONE/OAEPWithSHA256AndMGF1Padding"
const ASYMMETRIC_OPTIONS = {
    md: forge.md.sha256.create(),
    mgf: forge.mgf.mgf1.create(forge.md.sha1.create()),
};

/**
 * Checks whether encryption is supported by the browser.
 *
 * @return { boolean } whether encryption is support by the browser
 */
function isSupported() {
    return (
        typeof ArrayBuffer !== 'undefined' &&
        new ArrayBuffer(8).byteLength === 8 &&
        typeof Uint8Array !== 'undefined' &&
        new Uint8Array(8).length === 8
    );
}

const isEncryptionEnabledSymbol = Symbol('isEncryptionEnabled');

/**
 * @param {Survey} survey
 * @return {boolean}
 */
function isEncryptionEnabled(survey) {
    return Boolean(survey[isEncryptionEnabledSymbol]);
}

/**
 * Converts an encryption-enabled survey's private `isEncryptionEnabledSymbol`
 * property to a serializable string property.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#supported_types}
 * @param {Survey} survey
 * @return {Survey}
 */
function serializeEncryptedSurvey(survey) {
    if (isEncryptionEnabled(survey)) {
        return { ...survey, isEncryptionEnabled: true };
    }

    return survey;
}

/**
 * Restores a serialized survey's encryption-enabled state by converting its
 * `isEncryptionEnabled` property to the private `isEncryptionEnabledSymbol`.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#supported_types}
 * @param {Survey} survey
 * @return {Survey}
 */
function deserializeEncryptedSurvey(survey) {
    if (survey.isEncryptionEnabled) {
        const result = { ...survey };

        delete result.isEncryptionEnabled;

        return setEncryptionEnabled(result);
    }

    return survey;
}

/**
 * @param {Survey} survey
 * @return {Survey}
 */
function setEncryptionEnabled(survey) {
    return Object.defineProperty(survey, isEncryptionEnabledSymbol, {
        configurable: false,
        value: true,
    });
}

/**
 * Encrypts a record.
 *
 * @param {{id: string, version: string, encryptionKey: string}} form - form properties object
 * @param {{instanceId: string, xml: string, files?: [Blob]}} record - record to encrypt
 */
function encryptRecord(form, record) {
    const symmetricKey = _generateSymmetricKey();
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----${form.encryptionKey}-----END PUBLIC KEY-----`;
    const forgePublicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    const base64EncryptedSymmetricKey = _rsaEncrypt(
        symmetricKey,
        forgePublicKey
    );
    const seed = new Seed(record.instanceId, symmetricKey); // _getIvSeedArray( record.instanceId, symmetricKey );
    const manifest = new Manifest(form.id, form.version);
    manifest.addElement('base64EncryptedKey', base64EncryptedSymmetricKey);
    manifest.addMetaElement('instanceID', record.instanceId);

    let elements = [form.id];
    if (form.version) {
        elements.push(form.version);
    }
    elements = elements.concat([
        base64EncryptedSymmetricKey,
        record.instanceId,
    ]);

    return _encryptMediaFiles(record.files, symmetricKey, seed)
        .then(manifest.addMediaFiles)
        .then((blobs) => {
            const submissionXmlEnc = _encryptSubmissionXml(
                record.xml,
                symmetricKey,
                seed
            );
            manifest.addXmlSubmissionFile(submissionXmlEnc);
            blobs.push(submissionXmlEnc);

            return blobs;
        })
        .then((blobs) => {
            const fileMd5s = blobs.map(
                (blob) =>
                    `${blob.name.substring(0, blob.name.length - 4)}::${
                        blob.md5
                    }`
            );
            elements = elements.concat(fileMd5s);
            manifest.addElement(
                'base64EncryptedElementSignature',
                _getBase64EncryptedElementSignature(elements, forgePublicKey)
            );

            // overwrite record properties so it can be process as a regular submission
            record.xml = manifest.getXmlStr();
            record.files = blobs;

            return record;
        });
}

function _generateSymmetricKey() {
    // 256 bit key (32 bytes) for AES256
    return forge.random.getBytesSync(32);
}

// Equivalent to "RSA/NONE/OAEPWithSHA256AndMGF1Padding"
function _rsaEncrypt(byteString, publicKey) {
    const encrypted = publicKey.encrypt(
        byteString,
        ASYMMETRIC_ALGORITHM,
        ASYMMETRIC_OPTIONS
    );

    return forge.util.encode64(encrypted);
}

function _md5Digest(byteString) {
    const md = forge.md.md5.create();
    md.update(byteString);

    return md.digest();
}

function _getBase64EncryptedElementSignature(elements, publicKey) {
    // ODK Collect code also adds a newline character **at the end**!
    const elementsStr = `${elements.join('\n')}\n`;
    const messageDigest = _md5Digest(elementsStr).getBytes();

    return _rsaEncrypt(messageDigest, publicKey);
}

function _encryptMediaFiles(files, symmetricKey, seed) {
    files = files || [];

    const funcs = files.map(
        (file) => () =>
            /*
             * Note using new fileReader().readAsBinaryString() is about 30% faster than using readAsDataURL
             * However, readAsDataURL() works in IE11, and readAsBinaryString() is a bit frowned upon.
             * Interestingly, readAsArrayBuffer() is significantly slower than both. That difference is
             * caused by forge.util.createBuffer() (which accepts both types as parameter)
             */
            utils.blobToDataUri(file).then((dataUri) => {
                const byteString = forge.util.decode64(dataUri.split(',')[1]);
                const buffer = forge.util.createBuffer(byteString, 'raw');
                const mediaFileEnc = _encryptContent(
                    buffer,
                    symmetricKey,
                    seed
                );
                mediaFileEnc.name = `${file.name}.enc`;
                mediaFileEnc.md5 = _md5Digest(byteString).toHex();

                return mediaFileEnc;
            })
    );

    // This needs to be sequential for seed array incrementation!
    return funcs.reduce(
        (prevPromise, func) =>
            prevPromise.then((result) =>
                func().then((blob) => {
                    result.push(blob);

                    return result;
                })
            ),
        Promise.resolve([])
    );
}

function _encryptSubmissionXml(xmlStr, symmetricKey, seed) {
    const submissionXmlEnc = _encryptContent(
        forge.util.createBuffer(xmlStr, 'utf8'),
        symmetricKey,
        seed
    );
    submissionXmlEnc.name = 'submission.xml.enc';
    submissionXmlEnc.md5 = _md5Digest(xmlStr).toHex();

    return submissionXmlEnc;
}

/**
 * Symmetric encryption equivalent to Java "AES/CFB/PKCS5Padding"
 *
 * @param { ByteBuffer } content - content to encrypt
 * @param { object } symmetricKey - symmetric encryption key
 * @param { Seed } seed - seed
 */
function _encryptContent(content, symmetricKey, seed) {
    const cipher = forge.cipher.createCipher(SYMMETRIC_ALGORITHM, symmetricKey);
    const iv = seed.getIncrementedSeedByteString();

    cipher.mode.pad = forge.cipher.modes.cbc.prototype.pad.bind(cipher.mode);
    cipher.start({
        iv,
    });

    cipher.update(content);
    const pass = cipher.finish();
    const byteString = cipher.output.getBytes();

    if (!pass) {
        throw new Error('Encryption failed.');
    }

    // Write the bytes of the string to an ArrayBuffer
    const buffer = new ArrayBuffer(byteString.length);
    const array = new Uint8Array(buffer);

    for (let i = 0; i < byteString.length; i++) {
        array[i] = byteString.charCodeAt(i);
    }

    // Write the ArrayBuffer to a blob
    return new Blob([array]);
}

function Seed(instanceId, symmetricKey) {
    // iv is the 16-byte md5 hash of the instanceID and the symmetric key
    const messageDigest = _md5Digest(instanceId + symmetricKey).getBytes();
    const ivSeedArray = messageDigest
        .split('')
        .map((item) => item.charCodeAt(0));
    let ivCounter = 0;

    this.getIncrementedSeedByteString = () => {
        ++ivSeedArray[ivCounter % ivSeedArray.length];
        ++ivCounter;

        return ivSeedArray.map((code) => String.fromCharCode(code)).join('');
    };
}

function Manifest(formId, formVersion) {
    const ODK_SUBMISSION_NS = 'http://opendatakit.org/submissions';
    const OPENROSA_XFORMS_NS = 'http://openrosa.org/xforms';
    const manifestEl = document.createElementNS(ODK_SUBMISSION_NS, 'data');
    // move to constructor after ES6 class conversion
    manifestEl.setAttribute('encrypted', 'yes');
    manifestEl.setAttribute('id', formId);
    if (formVersion) {
        manifestEl.setAttribute('version', formVersion);
    }

    this.getXmlStr = () => new XMLSerializer().serializeToString(manifestEl);
    this.addElement = (nodeName, content) => {
        const el = document.createElementNS(ODK_SUBMISSION_NS, nodeName);
        el.textContent = content;
        manifestEl.appendChild(el);
    };
    this.addMetaElement = (nodeName, content) => {
        const metaPresent = manifestEl.querySelector('meta');
        const metaEl =
            metaPresent || document.createElementNS(OPENROSA_XFORMS_NS, 'meta');
        const childEl = document.createElementNS(OPENROSA_XFORMS_NS, nodeName);
        childEl.textContent = content;
        metaEl.appendChild(childEl);
        if (!metaPresent) {
            manifestEl.appendChild(metaEl);
        }
    };
    this.addMediaFiles = (blobs) => blobs.map(_addMediaFile);

    this.addXmlSubmissionFile = (blob) => {
        const xmlFileEl = document.createElementNS(
            ODK_SUBMISSION_NS,
            'encryptedXmlFile'
        );
        xmlFileEl.setAttribute('type', 'file'); // temporary, used in HTTP submission logic
        xmlFileEl.textContent = blob.name;
        manifestEl.appendChild(xmlFileEl);
    };

    function _addMediaFile(blob) {
        // For now we put each media file under its own <media> element due a bug in Aggregate
        // https://github.com/opendatakit/aggregate/issues/319
        // Once, we no longer need compatibility with old Aggregate servers, we can change that
        // by putting all <file> elements under 1 <media> element
        const mediaEl = document.createElementNS(ODK_SUBMISSION_NS, 'media');
        const fileEl = document.createElementNS(ODK_SUBMISSION_NS, 'file');
        fileEl.setAttribute('type', 'file'); // temporary, used in HTTP submission logic
        fileEl.textContent = blob.name;
        mediaEl.appendChild(fileEl);
        manifestEl.appendChild(mediaEl);

        return blob;
    }
}

export default {
    isEncryptionEnabled,
    setEncryptionEnabled,
    serializeEncryptedSurvey,
    deserializeEncryptedSurvey,
    isSupported,
    encryptRecord,
    Seed,
};
