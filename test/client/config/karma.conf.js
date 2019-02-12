// Karma configuration
// Generated on Wed Nov 26 2014 15:52:30 GMT-0700 (MST)
const resolve = require( 'rollup-plugin-node-resolve' );
const commonjs = require( 'rollup-plugin-commonjs' );
const json = require( 'rollup-plugin-json' );
const builtins = require( 'rollup-plugin-node-builtins' );
const globals = require( 'rollup-plugin-node-globals' );

module.exports = config => {
    config.set( {

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '../../..',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: [ 'mocha', 'sinon-chai' ],


        // list of files / patterns to load in the browser
        files: [
            'test/client/**/*.spec.js', {
                pattern: 'public/js/src/**/*.js',
                included: false
            },
        ],


        // list of files to exclude
        exclude: [],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'test/client/**/*.spec.js': [ 'rollup' ],
        },
        rollupPreprocessor: {
            output: {
                format: 'iife'
            },
            plugins: [
                resolve( {
                    module: true, // Default: true
                    main: true, // Default: true
                    browser: true, // Default: false
                } ),
                commonjs( {
                    include: 'node_modules/**', // Default: undefined
                    sourceMap: false, // Default: true
                } ),
                json(), // used to import package.json in tests
                builtins(),
                globals(),
            ]
        },

        browserify: {
            debug: true,
            transform: [ 'aliasify' ]
        },


        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: [ 'dots' ],


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
