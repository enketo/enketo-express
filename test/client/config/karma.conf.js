// Karma configuration
// Generated on Wed Nov 26 2014 15:52:30 GMT-0700 (MST)



module.exports = config => {
    config.set( {

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '../../..',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: [ 'mocha', 'sinon-chai' ],


        // list of files / patterns to load in the browser
        files: [
            'test/client/**/*.spec.js'
        ],


        // list of files to exclude
        exclude: [],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'public/js/**/!(enketo-offline-fallback).js': [ 'esbuild' ],
            'test/client/**/*.js': [ 'esbuild' ],
        },

        esbuild: {
            target: [
                'chrome89',
                'edge89',
                'firefox90',
                'safari13',
            ],
        },

        browserify: {
            debug: true,
            transform: [ 'aliasify' ]
        },


        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: [ 'dots', 'coverage' ],


        coverageReporter: {
            dir: 'test-coverage/client',
            reporters: [
                // for in-depth analysis in your browser
                {
                    type: 'html',
                    includeAllSources: true
                },
                // for generating coverage badge in README.md
                {
                    type: 'json',
                    includeAllSources: true
                },
                // for displaying percentages summary in command line
                {
                    type: 'text-summary',
                    includeAllSources: true
                }
            ]
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
        singleRun: false
    } );
};
