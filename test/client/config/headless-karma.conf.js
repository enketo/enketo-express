// Karma configuration
// Generated on Wed Nov 26 2014 15:52:30 GMT-0700 (MST)
"use strict";

module.exports = function( config ) {
    config.set( {

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '../../..',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: [ 'mocha', 'requirejs', 'sinon-chai' ],


        // list of files / patterns to load in the browser
        files: [
            'public/js/src/require-config.js',
            'test/client/test-main.js', {
                pattern: 'test/client/**/*.spec.js',
                included: false
            }, {
                pattern: 'public/lib/bower-components/q/q.js',
                included: false
            }, {
                pattern: 'public/lib/bower-components/papaparse/papaparse.js',
                included: false
            }, {
                pattern: 'public/lib/martijnr-db.js/src/db.js',
                included: false
            }, {
                pattern: 'public/js/src/**/*.js',
                included: false
            },
        ],


        // list of files to exclude
        exclude: [],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {},


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
        logLevel: config.LOG_INFO,


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
