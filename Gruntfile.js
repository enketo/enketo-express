module.exports = grunt => {
    const JS_INCLUDE = [ '**/*.js', '!node_modules/**', '!test/**/*.spec.js', '!public/js/*-bundle.js', '!public/js/*-bundle.min.js' ];
    const pkg = grunt.file.readJSON( 'package.json' );
    const path = require( 'path' );
    const nodeSass = require( 'node-sass' );

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
                        DEBUG: '*, -express:*, -send, -compression, -body-parser:*, -puppeteer:*'
                    }
                }
            }
        },
        sass: {
            options: {
                functions: {
                    'base64-url($mimeType, $data)': function( mimeType, data ) {
                        const base64 = new Buffer( data.getValue() ).toString( 'base64' );
                        const urlString = `url("data:${mimeType.getValue()};base64,${base64}")`;
                        return nodeSass.types.String( urlString );
                    }
                }
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
                files: [ 'app/views/styles/**/*.scss', 'widget/**/*.scss', '!app/views/styles/component/_system_variables.scss' ],
                tasks: [ 'sass' ],
                options: {
                    spawn: false,
                    livereload: true
                }
            },
            jade: {
                files: [ 'app/views/**/*.pug' ],
                options: {
                    spawn: false,
                    livereload: true
                }
            },
            language: {
                files: [ 'app/views/**/*.pug', 'app/controllers/**/*.js', 'app/models/**/*.js', 'public/js/src/**/*.js' ],
                tasks: [ 'shell:translation', 'i18next' ]
            },
            js: {
                files: [ 'public/js/src/**/*.js', 'widget/**/*.js' ],
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
        eslint: {
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
                reporters: [ 'dots' ],
                configFile: 'test/client/config/karma.conf.js'
            },
            headless: {
                browsers: [ 'ChromeHeadless' ]
            },
            browsers: {
                browsers: [ 'Chrome', 'ChromeCanary', 'Firefox', 'Opera' /*,'Safari'*/ ],
            }
        },
        browserify: {
            development: {
                files: {
                    'public/js/enketo-webform-dev-bundle.js': [ 'public/js/src/main-webform.js' ],
                    'public/js/enketo-webform-edit-dev-bundle.js': [ 'public/js/src/main-webform-edit.js' ],
                    'public/js/enketo-webform-view-dev-bundle.js': [ 'public/js/src/main-webform-view.js' ],
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
                    'public/js/enketo-webform-view-bundle.js': [ 'public/js/src/main-webform-view.js' ],
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
                    'public/js/enketo-webform-view-bundle.min.js': [ 'public/js/enketo-webform-view-bundle.js' ],
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
            },
            production: {
                NODE_ENV: 'production'
            }
        },
        i18next: {
            locales: {
                cwd: 'locales/',
                expand: true,
                src: [ '*/' ],
                include: [ '**/translation.json', '**/translation-additions.json' ],
                rename( dest, src ) {
                    return `${dest + src}translation-combined.json`;
                },
                dest: 'locales/'
            }
        }
    } );

    grunt.registerTask( 'client-config-file', 'Temporary client-config file', task => {
        const CLIENT_CONFIG_PATH = 'public/temp-client-config.json';
        if ( task === 'create' ) {
            const config = require( './app/models/config-model' );
            grunt.file.write( CLIENT_CONFIG_PATH, JSON.stringify( config.client ) );
            grunt.log.writeln( `File ${CLIENT_CONFIG_PATH} created` );
        } else if ( task === 'remove' ) {
            grunt.file.delete( CLIENT_CONFIG_PATH );
            grunt.log.writeln( `File ${CLIENT_CONFIG_PATH} removed` );
        }
    } );

    grunt.registerTask( 'system-sass-variables', 'Creating _system_variables.scss', () => {
        const SYSTEM_SASS_VARIABLES_PATH = 'app/views/styles/component/_system_variables.scss';
        const config = require( './app/models/config-model' );
        grunt.file.write( SYSTEM_SASS_VARIABLES_PATH, `$base-path: "${config.server[ 'base path' ]}";` );
        grunt.log.writeln( `File ${SYSTEM_SASS_VARIABLES_PATH} created` );
    } );

    grunt.registerTask( 'widgets', 'generate widget reference files', () => {
        const WIDGETS_JS_LOC = 'public/js/';
        const WIDGETS_JS = `${WIDGETS_JS_LOC}widgets.js`;
        const WIDGETS_SASS_LOC = 'app/views/styles/component/';
        const WIDGETS_SASS = `${WIDGETS_SASS_LOC}_widgets.scss`;
        const PRE = '// This file is automatically generated with `grunt widgets`\n';
        const widgets = require( './app/models/config-model' ).server.widgets;
        const coreWidgets = require( './public/js/src/module/core-widgets' );
        const paths = Object.keys( widgets ).map( key => coreWidgets[ widgets[ key ] ] || widgets[ key ] );
        let content = `${PRE}'use strict';\n\nmodule.exports = [\n    ${paths.map( p => grunt.file.exists( WIDGETS_JS_LOC, `${p}.js` ) ? `require( '${p}' )` : `//${p} not found` ).join( ',\n    ' )}\n];\n`;
        grunt.file.write( WIDGETS_JS, content );
        grunt.log.writeln( `File ${WIDGETS_JS} created` );
        content = `${PRE +
    paths.map( p => {
        p = path.join( '../../', p );
        return grunt.file.exists( WIDGETS_SASS_LOC, `${p}.scss` ) ? `@import "${p}"` : `//${p} not found`;
    } ).join( ';\n' )};`;
        grunt.file.write( WIDGETS_SASS, content );
        grunt.log.writeln( `File ${WIDGETS_SASS} created` );
    } );

    grunt.registerTask( 'default', [ 'i18next', 'widgets', 'css', 'js', 'uglify' ] );
    grunt.registerTask( 'js', [ 'client-config-file:create', 'widgets', 'browserify:production' ] );
    grunt.registerTask( 'js-dev', [ 'client-config-file:create', 'widgets', 'browserify:development' ] );
    grunt.registerTask( 'css', [ 'system-sass-variables:create', 'sass' ] );
    grunt.registerTask( 'test', [ 'env:test', 'js', 'css', 'mochaTest:all', 'karma:headless', 'jsbeautifier:test', 'eslint' ] );
    grunt.registerTask( 'test-browser', [ 'env:test', 'css', 'client-config-file:create', 'karma:browsers' ] );
    grunt.registerTask( 'develop', [ 'env:develop', 'i18next', 'js-dev', 'css', 'concurrent:develop' ] );
    grunt.registerTask( 'test-and-build', [ 'env:test', 'mochaTest:all', 'karma:headless', 'env:production', 'default' ] );
};
