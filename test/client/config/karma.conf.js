/* eslint-env node */

const baseESBuildConfig = require('../../../config/build.js');

module.exports = (config) => {
    config.set({
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '../../..',

        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha', 'sinon-chai'],

        // list of files / patterns to load in the browser
        files: [
            { pattern: 'test/client/**/*.spec.js', type: 'module' },
            {
                pattern: 'public/js/src/**/*.js',
                included: false,
                served: true,
                type: 'module',
            },
            {
                pattern: 'test/fixtures/**/*.geojson',
                included: false,
                served: true,
            },
            {
                pattern: 'test/fixtures/**/*.xml',
                included: false,
                served: true,
            },
        ],

        // list of files to exclude
        exclude: [
            'public/js/src/module/offline-app-worker-partial.js',
            'public/js/src/enketo-offline-fallback.js',
            'public/js/src/enketo-webform-edit.js',
            'public/js/src/enketo-webform-view.js',
            'public/js/src/enketo-webform.js',
        ],

        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'public/js/**/*.js': ['esbuild'],
            'test/client/**/*.js': ['esbuild'],
        },

        esbuild: {
            ...baseESBuildConfig,
            loader: {
                '.geojson': 'json',
            },
            minify: false,

            // As far as I can tell, this is necessary because Karma fails to
            // resolve split chunks. It's not entirely clear if the split chunks
            // even get written. This is unfortunate, as we're not entirely
            // testing the same build setup, but that doesn't seem to be
            // possible with the rest of our current tooling setup.
            splitting: false,
        },

        browserify: {
            debug: true,
        },

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['dots', 'coverage'],

        coverageReporter: {
            dir: 'test-coverage/client',
            subdir: (browser) => browser.toLowerCase().split(/[ /-]/)[0],
            reporters: [
                // for in-depth analysis in your browser
                {
                    type: 'html',
                    includeAllSources: true,
                },
                // for generating coverage badge in README.md
                {
                    type: 'json',
                    includeAllSources: true,
                },
                // for displaying percentages summary in command line
                {
                    type: 'text-summary',
                    includeAllSources: true,
                },
                {
                    type: 'lcov',
                    includeAllSources: true,
                },
            ],
        },

        // web server port
        port: 9876,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_WARN,

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: false,

        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        // browsers: [ 'Chrome', 'Safari', 'Firefox', 'Opera' ],

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: false,
    });
};
