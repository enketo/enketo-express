module.exports = function( grunt ) {

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
                    nodeArgs: [ '--debug' ],
                    callback: function( nodemon ) {
                        nodemon.on( 'restart', function() {
                            setTimeout( function() {
                                require( 'fs' ).writeFileSync( '.rebooted', 'rebooted' );
                            }, 1000 );
                        } );
                    },
                    env: {
                        NODE_ENV: 'development',
                        DEBUG: 'enketo'
                    }
                }
            }
        },
        sass: {
            compile: {
                files: {
                    'public/css/error.css': 'public/css/sass/error.scss'
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
                src: [ "**/*.js", "!public/lib/**/*.js", "!node_modules/**/*.js" ],
                options: {
                    config: "./.jsbeautifyrc",
                    mode: "VERIFY_ONLY"
                }
            },
            fix: {
                src: [ "**/*.js", "!node_modules/**/*.js" ],
                options: {
                    config: "./.jsbeautifyrc"
                }
            }
        },
        jshint: {
            options: {
                jshintrc: ".jshintrc"
            },
            all: [ "**/*.js", "!public/lib/**/*.js", "!node_modules/**/*.js" ]
        },
        // Configure a mochaTest task
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: [ 'test/**/*.js' ]
            }
        }
    } );

    require( 'load-grunt-tasks' )( grunt );

    grunt.registerTask( 'default', [ 'sass' ] );
    grunt.registerTask( 'test', [ 'mochaTest', 'jsbeautifier:test', 'jshint' ] );
    grunt.registerTask( 'develop', [ 'concurrent:develop' ] );
};
