Translation workflow
========

### Requirements

Install [i18next-parser](https://github.com/i18next/i18next-parser) and [gulp](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md#getting-started)

### 1. Update translation keys from code 

Create an updated locales/en/translation.json by running `gulp` **from the /locales folder**. 

### 2. Update English strings for new keys (or for existing keys)

### 3. Update Transifex resource 

This can also be done manually if the translations should be finished by the time the new keys are merged in master. It is also done automatically by Transfix as soon as the new /locales/en/translation.json is merged in master.

### 4. Get translation work done

For missing keys the English translation will be used as a fallback, which makes this less super urgent.

### 5. Update translations in repo

When the translations are ready, download each from Transifex and update /locales/**/translation.json
