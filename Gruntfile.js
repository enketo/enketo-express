'use strict';

module.exports = function( grunt ) {
    var JS_INCLUDE = [ '**/*.js', '!node_modules/**', '!test/**/*.spec.js', '!public/js/*-bundle.js', '!public/js/*-bundle.min.js' ];
    var pkg = grunt.file.readJSON( 'package.json' );

    require( 'time-grunt' )( grunt );
    require( 'load-grunt-tasks' )( grunt );

    grunt.config.init( {
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
                script: 'app.js',
                options: {
                    watch: [ 'app', 'config' ],
                    //nodeArgs: [ '--debug' ],
                    env: {
                        NODE_ENV: 'development',
                        DEBUG: '*, -express:*, -send, -compression, -body-parser:*'
                    }
                }
            }
        },
        sass: {
            options: {
                sourceMap: false
            },
            compile: {
                cwd: 'app/views/styles',
                dest: 'public/css',
                expand: true,
                outputStyle: 'compressed',
                src: '**/*.scss',
                ext: '.css',
                flatten: true,
                extDot: 'last'
            }
        },
        watch: {
            config: {
                files: [ 'config/*.json' ],
                tasks: [ 'client-config-file:create' ]
            },
            sass: {
                files: [ 'app/views/styles/**/*.scss' ],
                tasks: [ 'sass' ],
                options: {
                    spawn: false,
                    livereload: true
                }
            },
            jade: {
                files: [ 'app/views/**/*.jade' ],
                options: {
                    spawn: false,
                    livereload: true
                }
            },
            language: {
                files: [ 'app/views/**/*.jade', 'app/controllers/**/*.js', 'app/models/**/*.js', 'public/js/src/**/*.js' ],
                tasks: [ 'shell:translation' ]
            },
            js: {
                files: [ 'public/js/src/**/*.js' ],
                tasks: [ 'js-dev' ],
                options: {
                    spawn: false,
                    livereload: true
                }
            }
        },
        shell: {
            translation: {
                command: [
                    'cd locales',
                    'gulp',
                    'cd ..'
                ].join( '&&' )
            }
        },
        jsbeautifier: {
            test: {
                src: JS_INCLUDE,
                options: {
                    config: './.jsbeautifyrc',
                    mode: 'VERIFY_ONLY'
                }
            },
            fix: {
                src: JS_INCLUDE,
                options: {
                    config: './.jsbeautifyrc'
                }
            }
        },
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            all: JS_INCLUDE,
        },
        // test server JS
        mochaTest: {
            all: {
                options: {
                    reporter: 'dot'
                },
                src: [ 'test/server/**/*.spec.js' ]
            },
            account: {
                src: [ 'test/server/account-*.spec.js' ]
            }
        },
        // test client JS
        karma: {
            options: {
                singleRun: true,
                reporters: [ 'dots' ]
            },
            headless: {
                configFile: 'test/client/config/karma.conf.js',
                browsers: [ 'PhantomJS' ]
            },
            browsers: {
                configFile: 'test/client/config/karma.conf.js',
                browsers: [ 'Chrome', 'ChromeCanary', 'Firefox', 'Opera' /*,'Safari'*/ ],
            }
        },
        browserify: {
            development: {
                files: {
                    'public/js/enketo-webform-dev-bundle.js': [ 'public/js/src/main-webform.js' ],
                    'public/js/enketo-webform-edit-dev-bundle.js': [ 'public/js/src/main-webform-edit.js' ],
                    'public/js/enketo-offline-fallback-dev-bundle.js': [ 'public/js/src/main-offline-fallback.js' ]
                },
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
            },
            production: {
                files: {
                    'public/js/enketo-webform-bundle.js': [ 'public/js/src/main-webform.js' ],
                    'public/js/enketo-webform-edit-bundle.js': [ 'public/js/src/main-webform-edit.js' ],
                    'public/js/enketo-offline-fallback-bundle.js': [ 'public/js/src/main-offline-fallback.js' ]
                },
            },
            options: {
                // ensure that enketo-config and widgets are overridden in **enketo-core**
                transform: [
                    [ 'aliasify', {
                        aliases: pkg.aliasify.aliases,
                        global: true
                    } ]
                ]
            },
        },
        uglify: {
            all: {
                files: {
                    'public/js/enketo-webform-bundle.min.js': [ 'public/js/enketo-webform-bundle.js' ],
                    'public/js/enketo-webform-edit-bundle.min.js': [ 'public/js/enketo-webform-edit-bundle.js' ],
                    'public/js/enketo-offline-fallback-bundle.min.js': [ 'public/js/enketo-offline-fallback-bundle.js' ],
                },
            },
        },
        env: {
            develop: {
                NODE_ENV: 'develop'
            },
            test: {
                NODE_ENV: 'test'
            }
        }
    } );

    grunt.registerTask( 'client-config-file', 'Temporary client-config file', function( task ) {
        var clientConfigPath = 'public/temp-client-config.json';
        if ( task === 'create' ) {
            var config = require( './app/models/config-model' );
            grunt.file.write( clientConfigPath, JSON.stringify( config.client ) );
            grunt.log.writeln( 'File ' + clientConfigPath + ' created' );
        } else if ( task === 'remove' ) {
            grunt.file.delete( clientConfigPath );
            grunt.log.writeln( 'File ' + clientConfigPath + ' removed' );
        }
    } );

    grunt.registerTask( 'system-sass-variables', 'Creating _system_variables.scss', function( task ) {
        var systemSassVariablesPath = 'app/views/styles/component/_system_variables.scss';
        var config = require( './app/models/config-model' );
        grunt.file.write( systemSassVariablesPath, '$base-path: "' + config.server[ 'base path' ] + '";' );
        grunt.log.writeln( 'File ' + systemSassVariablesPath + ' created' );
    } );

    grunt.registerTask( 'default', [ 'css', 'js', 'uglify' ] );
    grunt.registerTask( 'js', [ 'client-config-file:create', 'browserify:production' ] );
    grunt.registerTask( 'js-dev', [ 'client-config-file:create', 'browserify:development' ] );
    grunt.registerTask( 'css', [ 'system-sass-variables:create', 'sass' ] );
    grunt.registerTask( 'test', [ 'env:test', 'js', 'css', 'mochaTest:all', 'karma:headless', 'jsbeautifier:test', 'jshint' ] );
    grunt.registerTask( 'test-browser', [ 'env:test', 'css', 'client-config-file:create', 'karma:browsers' ] );
    grunt.registerTask( 'develop', [ 'env:develop', 'js-dev', 'concurrent:develop' ] );
};
