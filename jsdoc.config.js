module.exports = {
    opts: {
        encoding: 'utf8',
        destination: './docs/',
        tutorials: './tutorials',
        recurse: true,
        /*
            TODO: Providing JSDoc with package.json makes it generate
            `/docs/enketo-express/[version number]/index.html` instead of simply
            `/docs/index.html`. For now we will stick with providing
            documentation only for latest version, but it could be nice to
            expand it to multiple versions in the future.
        */
        // package: 'package.json',
        readme: 'README.md',
        template: 'node_modules/docdash',
    },
    plugins: ['jsdoc-ts-utils', 'plugins/markdown'],
    source: {
        include: ['app/', 'config/', 'tools/', './README.md'],
    },
    templates: {
        cleverLinks: true,
        monospaceLinks: true,
        default: {
            outputSourceFiles: true,
            includeDate: false,
            useLongnameInNav: true,
        },
    },
    markdown: {
        idInHeadings: true,
    },
    docdash: {
        static: true,
        sort: true,
        meta: {
            title: 'Enketo Express',
            description:
                'The full-fledged Enketo web application for the ODK ecosystem',
        },
        search: true,
        collapse: false,
        wrap: true,
        typedefs: true,
        removeQuotes: 'none',
        scripts: [],
        menu: {
            'Github repo': {
                href: 'https://github.com/enketo/enketo-express',
                target: '_blank',
                class: 'menu-item',
                id: 'repository',
            },
            'Change log': {
                href: 'https://github.com/enketo/enketo-express/blob/master/CHANGELOG.md',
                target: '_blank',
                class: 'menu-item',
                id: 'change-log',
            },
        },
        sectionOrder: [
            'Tutorials',
            'Classes',
            'Modules',
            'Externals',
            'Events',
            'Namespaces',
            'Mixins',
            'Interfaces',
        ],
    },
    tsUtils: {
        /**
         * We may actually want to enable this, but it was a surprisng default.
         *
         * @see {@link https://github.com/homer0/jsdoc-ts-utils#configuration}
         */
        typeScriptUtilityTypes: false,
    },
};
