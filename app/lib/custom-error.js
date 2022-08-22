/**
 * @module custom-error
 */

/**
 * Error to be translated
 *
 * @static
 * @param { string } translationKey - translation key
 * @param { object } translationObject - translation object
 */
function TranslatedError(translationKey, translationObject) {
    this.message = '';
    this.stack = Error().stack;
    this.translationKey = translationKey;
    this.translationParams = translationObject;
}
TranslatedError.prototype = Object.create(Error.prototype);
TranslatedError.prototype.name = 'TranslatedError';

class ResponseError extends Error {
    constructor(status, message) {
        super(message);

        this.status = status;
    }
}

module.exports = {
    /**
     * @type { Error }
     */
    Error,
    TranslatedError,
    ResponseError,
};
