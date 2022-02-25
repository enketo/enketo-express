### Requirements

### 1. Update translation keys from code

The translation keys in [/locales/src/en/translation.json](https://github.com/enketo/enketo-express/blob/master/locales/src/en/translation.json) will be continuously updated with `grunt develop`. You can also do this manually by running [BROKEN TBC].

### 2. Update English strings for new keys (or for existing keys)

The easiest is to manually edit the English strings in [/locales/src/en/translation.json](https://github.com/enketo/enketo-express/blob/master/locales/src/en/translation.json). A piece of text can be divided into paragraphs by splitting it up into an array. A plural form can be added by adding the same key with `_plural` appended to it (there are more advanced plural options too, see [i18next doc](http://i18next.com/pages/doc_features.html))

### 3. Update Transifex resource

This can be done manually if the translations should be finished before the new keys are merged in master. It is also done automatically by Transifex as soon as the new /locales/src/en/translation.json is merged in master.

### 4. Get translation work done

For missing keys the English translation will be used as a fallback, which makes translation updates a little less urgent.

### 5. Update translations in repo

When the translations are ready, download each from Transifex and update /locales/src/\*\*/translation.json
