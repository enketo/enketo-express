/**
 * This is just used to update the translation keys from the code until a grunt
 * task for i18next-parser becomes available.
 *
 * If not working on updating translations, this can be ignored.
 */

'use strict';

var gulp = require( 'gulp' );
var i18next = require( 'i18next-parser' );

gulp.task( 'default', function() {
    gulp.src( [
            '../public/js/src/**/*.js',
            '../app/views/**/*.pug',
            '../app/lib/communicator/**/*.js',
            '../app/controllers/**/*.js',
            '../app/models/**/*.js',
            '../node_modules/enketo-core/src/**/*.js'
        ] )
        .pipe( i18next( {
            locales: [ 'en' ],
            functions: [ 't', 'TError' ],
            ignoreVariables: true,
            // This is very odd, but has something to do with Gulp
            // changing the base to the src argument, in this case
            // apparently to url in the first item of the src argument array
            // Without setting this, the existing translations will 
            // be emptied.
            output: '../../../locales/src'
        } ) )
        .pipe( gulp.dest( './src' ) );
} );
