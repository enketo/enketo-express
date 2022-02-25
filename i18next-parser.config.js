module.exports = {
    contextSeparator: '_',
    // Key separator used in your translation keys

    createOldCatalogs: false,
    // Save the \_old files

    defaultNamespace: 'translation',
    // Default namespace used in your i18next config

    defaultValue: '',
    // Default value to give to empty keys

    indentation: 2,
    // Indentation of the catalog files

    keepRemoved: true,
    // Keep keys from the catalog that are no longer in code.
    // NOTE: We should probably review how many unused keys really need to be kept.

    keySeparator: '.',
    // Key separator used in your translation keys
    // If you want to use plain english keys, separators such as `.` and `:` will conflict. You might want to set `keySeparator: false` and `namespaceSeparator: false`. That way, `t('Status: Loading...')` will not think that there are a namespace and three separator dots for instance.

    // see below for more details
    lexers: {
        hbs: ['HandlebarsLexer'],
        handlebars: ['HandlebarsLexer'],

        htm: ['HTMLLexer'],
        html: ['HTMLLexer'],

        mjs: ['JavascriptLexer'],
        js: [
            {
                lexer: 'JavascriptLexer',
                functions: ['t', 'TError'], // Array of functions to match

                // acorn config (for more information on the acorn options, see here: https://github.com/acornjs/acorn#main-parser)
                acorn: {
                    sourceType: 'module',
                    ecmaVersion: 9, // forward compatibility
                    // Allows additional acorn plugins via the exported injector functions
                    injectors: [],
                    plugins: {},
                },
            },
        ],
        ts: ['JavascriptLexer'],
        jsx: ['JsxLexer'],
        tsx: ['JsxLexer'],

        default: ['JavascriptLexer'],
    },

    lineEnding: 'auto',
    // Control the line ending. See options at https://github.com/ryanve/eol

    locales: ['en'],
    // An array of the locales in your applications

    namespaceSeparator: ':',
    // Namespace separator used in your translation keys
    // If you want to use plain english keys, separators such as `.` and `:` will conflict. You might want to set `keySeparator: false` and `namespaceSeparator: false`. That way, `t('Status: Loading...')` will not think that there are a namespace and three separator dots for instance.

    output: 'locales/src/$LOCALE/translation.json',
    // Supports $LOCALE and $NAMESPACE injection
    // Supports JSON (.json) and YAML (.yml) file formats
    // Where to write the locale files relative to process.cwd()

    input: [
        'public/js/src/**/*.js',
        'app/views/**/*.pug',
        'app/lib/communicator.js',
        'app/controllers/**/*.js',
        'app/models/**/*.js',
        'node_modules/enketo-core/src/**/*.js',
    ],
    // An array of globs that describe where to look for source files
    // relative to the location of the configuration file

    reactNamespace: false,
    // For react file, extract the defaultNamespace - https://react.i18next.com/components/translate-hoc.html
    // Ignored when parsing a `.jsx` file and namespace is extracted from that file.

    sort: true,
    // Whether or not to sort the catalog

    useKeysAsDefaultValue: false,
    // Whether to use the keys as the default value; ex. "Hello": "Hello", "World": "World"
    // The option `defaultValue` will not work if this is set to true

    verbose: false,
    // Display info about the parsing including some stats
};
