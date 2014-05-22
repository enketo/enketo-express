module.exports = function( grunt ) {
    "use strict";

    grunt.initConfig( {
        pkg: grunt.file.readJSON( 'package.json' ),
        config: grunt.file.readJSON( 'config.json' ),
        concurrent: {
            develop: {
                tasks: [ 'nodemon', 'watch' ],
                options: {
                    logConcurrentOutput: true
                }
            }
        },
        nodemon: {
            dev: {
                script: 'bin/www',
                options: {
                    //nodeArgs: [ '--debug' ],
                    callback: function( nodemon ) {
                        nodemon.on( 'restart', function() {
                            setTimeout( function() {
                                require( 'fs' ).writeFileSync( '.rebooted', 'rebooted' );
                            }, 1000 );
                        } );
                    },
                    env: {
                        NODE_ENV: 'development',
                        DEBUG: '*, -express:*'
                    }
                }
            }
        },
        sass: {
            compile: {
                files: {
                    'public/css/error.css': 'public/css/sass/error.scss',
                    'public/css/webform_default.css': 'public/css/sass/webform_formhub.scss'
                }
            }
        },
        watch: {
            sass: {
                files: [ '.rebooted', 'config.json', 'public/css/sass/**/*.scss', 'public/lib/enketo-core/src/**/*.scss', 'views/**/*.jade' ],
                tasks: [ 'sass' ],
                options: {
                    spawn: true,
                    livereload: true
                }
            }
        },
        jsbeautifier: {
            test: {
                src: [ "**/*.js", "!**/enketo-core/**", "!node_modules/**" ],
                options: {
                    config: "./.jsbeautifyrc",
                    mode: "VERIFY_ONLY"
                }
            },
            fix: {
                src: [ "**/*.js", "!**/enketo-core/**", "!node_modules/**" ],
                options: {
                    config: "./.jsbeautifyrc"
                }
            }
        },
        jshint: {
            options: {
                jshintrc: ".jshintrc"
            },
            all: [ "**/*.js", "!**/enketo-core/**", "!node_modules/**", "!test/*.spec.js" ]
        },
        // Configure a mochaTest task
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: [ 'test/**/*.spec.js' ]
            }
        },
        symlink: {
            options: {

            },
            expanded: {
                files: [ {
                    overwrite: false,
                    expand: true,
                    cwd: 'lib/enketo-core',
                    src: [ '*' ],
                    dest: 'public/lib/enketo-core'
                } ]
            }
        }
    } );

    require( 'load-grunt-tasks' )( grunt );

    grunt.registerTask( 'default', [ 'test', 'sass' ] );
    grunt.registerTask( 'test', [ 'mochaTest', 'jsbeautifier:test', 'jshint' ] );
    grunt.registerTask( 'develop', [ 'concurrent:develop' ] );
};
