// Error to be translated
function TranslatedError( translationKey, translationObject ) {
    this.message = '';
    this.stack = Error().stack;
    this.translationKey = translationKey;
    this.translationParams = translationObject;
}
TranslatedError.prototype = Object.create( Error.prototype );
TranslatedError.prototype.name = 'TranslatedError';

module.exports = {
    Error,
    TranslatedError
};
