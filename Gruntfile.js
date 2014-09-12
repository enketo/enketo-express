"use strict";

module.exports = function( grunt ) {

    // show elapsed time at the end
    require( 'time-grunt' )( grunt );
    // load all grunt tasks
    require( 'load-grunt-tasks' )( grunt );

    grunt.initConfig( {
        pkg: grunt.file.readJSON( 'package.json' ),
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
                        DEBUG: '*, -express:*, -send'
                    }
                }
            }
        },
        sass: {
            compile: {
                files: {
                    'public/css/error.css': 'public/css/sass/error.scss',
                    'public/css/webform_default.css': 'public/css/sass/webform_formhub.scss',
                    'public/css/webform_print_default.css': 'public/css/sass/webform_print_formhub.scss'
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
                src: [ "**/*.js", "!**/enketo-core/**", "!node_modules/**", "!**/*.min.js", "!public/lib/bower-components/**/*.js" ],
                options: {
                    config: "./.jsbeautifyrc",
                    mode: "VERIFY_ONLY"
                }
            },
            fix: {
                src: [ "**/*.js", "!**/enketo-core/**", "!node_modules/**", "!**/*.min.js", "!public/lib/bower-components/**/*.js" ],
                options: {
                    config: "./.jsbeautifyrc"
                }
            }
        },
        jshint: {
            options: {
                jshintrc: ".jshintrc"
            },
            all: [ "**/*.js", "!**/enketo-core/**", "!node_modules/**", "!test/*.spec.js", "!**/*.min.js", "!public/lib/bower-components/**/*.js" ]
        },
        mochaTest: {
            all: {
                options: {
                    reporter: 'spec'
                },
                src: [ 'test/**/*.spec.js' ]
            },
            account: {
                src: [ 'test/account-*.spec.js' ]
            }
        },
        requirejs: {
            options: {
                //generateSourceMaps: true,
                preserveLicenseComments: false,
                baseUrl: "public/js/src/module",
                mainConfigFile: [ "./public/js/src/require-config.js", "./public/js/src/require-build-config.js" ],
                findNestedDependencies: true,
                optimize: "uglify2",
                done: function( done, output ) {
                    var duplicates = require( 'rjs-build-analysis' ).duplicates( output );

                    if ( duplicates.length > 0 ) {
                        grunt.log.subhead( 'Duplicates found in requirejs build:' );
                        grunt.log.warn( duplicates );
                        done( new Error( 'r.js built duplicate modules, please check the excludes option.' ) );
                    } else {
                        grunt.log.writeln( 'Checked for duplicates. All seems OK!' );
                    }
                    done();
                }
            },
            "webform": getWebformCompileOptions()
        },
        symlink: {
            core: {
                files: [ {
                    overwrite: false,
                    expand: true,
                    cwd: 'app/lib/enketo-core',
                    src: [ '*' ],
                    dest: 'public/lib/enketo-core'
                } ]
            }
        },
        env: {
            options: {
                //Shared Options Hash
            },
            test: {
                NODE_ENV: 'test'
            }
        }
    } );

    function getWebformCompileOptions( type ) {
        //add widgets js and widget config.json files
        var widgets = grunt.file.readJSON( './config/config.json' ).widgets;
        widgets.forEach( function( widget, index, arr ) {
            arr.push( 'text!' + widget.substr( 0, widget.lastIndexOf( '/' ) + 1 ) + 'config.json' );
        } );
        type = ( type ) ? '-' + type : '';
        return {
            options: {
                name: "../main-webform" + type,
                out: "public/js/webform" + type + "-combined.min.js",
                include: [ /*'core-lib/require'*/ '../../../../public/lib/bower-components/requirejs/require' ].concat( widgets )
            }
        };
    }

    grunt.registerTask( 'client-config-file', 'Temporary client-config file', function( task ) {
        var clientConfigPath = "public/temp-client-config.json";
        if ( task === 'create' ) {
            var config = require( './app/models/config-model' );
            grunt.file.write( clientConfigPath, JSON.stringify( config.client() ) );
            grunt.log.writeln( 'File ' + clientConfigPath + ' created' );
        } else if ( task === 'remove' ) {
            grunt.file.delete( clientConfigPath );
            grunt.log.writeln( 'File ' + clientConfigPath + ' removed' );
        }
    } );

    grunt.registerTask( 'default', [ 'symlink', 'compile', 'test' ] );
    grunt.registerTask( 'compile', [ 'sass', 'client-config-file:create', 'requirejs', 'client-config-file:remove' ] );
    grunt.registerTask( 'test', [ 'env:test', 'symlink', 'mochaTest', 'jsbeautifier:test', 'jshint', 'compile' ] );
    grunt.registerTask( 'develop', [ 'concurrent:develop' ] );
};
