module.exports = grunt => {
    const JS_INCLUDE = [
        '**/*.js',
        '!**/offline-app-worker-partial.js',
        '!**/node_modules/**',
        '!test/**/*.spec.js',
        '!public/js/build/*',
        '!test/client/config/karma.conf.js',
        '!docs/**',
        '!test-coverage/**',
        '!**/redirect-IE.js'
    ];
    const path = require( 'path' );
    const nodeSass = require( 'node-sass' );
    const bundles = require( './buildFiles' ).bundles;

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
                implementation: nodeSass
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
                tasks: [ 'js' ],
                options: {
                    spawn: false,
                    livereload: true
                }
            }
        },
        shell: {
            buildReadmeBadge: {
                command: 'node ./tools/update-readme-with-shield-badge.js'
            },
            'clean-css': {
                command: 'rm -f public/css/*'
            },
            'clean-locales': {
                command: 'find locales -name "translation-combined.json" -delete && rm -fr locales/??'
            },
            'clean-js': {
                command: 'rm -f public/js/build/* && rm -f public/js/*.js && rm -f public/temp-client-config.json'
            },
            translation: {
                command: 'echo "No automatic translation key generation at the moment."'
                // Does not work correctly yet for TError() calls and probably not for pug files either.
                // npx i18next -c ./i18next-parser.config.js
            },
            rollup: {
                command: 'npx rollup --config'
            }
        },
        eslint: {
            check: {
                src: JS_INCLUDE
            },
            fix: {
                options: {
                    fix: true,
                },
                src: JS_INCLUDE
            }
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
                configFile: 'test/client/config/karma.conf.js'
            },
            headless: {
                browsers: [ 'ChromeHeadless' ]
            },
            browsers: {
                browsers: [ 'Chrome', 'ChromeCanary', 'Firefox', 'Opera' /*,'Safari'*/ ],
            }
        },
        nyc: {
            cover: {
                options: {
                    reporter: [
                        'html',
                        'text-summary',
                        'json'
                    ],
                    reportDir: './test-coverage/server',
                    include: [ 'app/**/*.js' ],
                },
                cmd: false,
                args: [ 'grunt', 'mochaTest:all' ]
            }
        },
        terser: {
            options: {
                // https://github.com/enketo/enketo-express/issues/72
                keep_classnames: true,
            },
            all: {
                files: bundles
                    .map( bundle => [ bundle.replace( '.js', '.min.js' ), [ bundle ] ] )
                    .reduce( ( o, [ key, value ] ) => {
                        o[ key ] = value;

                        return o;
                    }, {} )
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
                cwd: 'locales/src/',
                expand: true,
                src: [ '*/' ],
                include: [ '**/translation.json', '**/translation-additions.json' ],
                rename( dest, src ) {
                    return `${dest + src}translation-combined.json`;
                },
                dest: 'locales/build/'
            }
        }
    } );

    grunt.registerTask( 'client-config-file', 'Temporary client-config file', task => {
        const CLIENT_CONFIG_PATH = 'public/js/build/client-config.js';
        if ( task === 'create' ) {
            // https://github.com/enketo/enketo-express/issues/102
            // The require cache may contain stale configuration from another task. Purge it.
            delete require.cache[ require.resolve( './app/models/config-model' ) ];
            const config = require( './app/models/config-model' );
            grunt.file.write( CLIENT_CONFIG_PATH, `export default ${JSON.stringify( config.client )};` );
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
        const WIDGETS_JS_LOC = 'public/js/build/';
        const WIDGETS_JS = `${WIDGETS_JS_LOC}widgets.js`;
        const WIDGETS_SASS_LOC = 'app/views/styles/component/';
        const WIDGETS_SASS = `${WIDGETS_SASS_LOC}_widgets.scss`;
        const PRE = '// This file is automatically generated with `grunt widgets`\n\n';
        const widgets = require( './app/models/config-model' ).server.widgets;
        const coreWidgets = require( './public/js/src/module/core-widgets' );
        const paths = Object.keys( widgets ).map( key => coreWidgets[ widgets[ key ] ] || widgets[ key ] );
        let num = 0;
        let content = PRE + paths.map( p => {
            if ( grunt.file.exists( WIDGETS_JS_LOC, `${p}.js` ) ) {
                num++;

                return `import w${num} from '${p}';`;
            } else {
                return `//${p} not found`;
            }
        } ).join( '\n' ) + `\n\nexport default [${[ ...Array( num ).keys() ].map( n => 'w' + ( n + 1 ) ).join( ', ' )}];`;
        grunt.file.write( WIDGETS_JS, content );
        grunt.log.writeln( `File ${WIDGETS_JS} created` );
        content = `${PRE +
    paths.map( p => {
        p = path.join( '../', p );

        return grunt.file.exists( WIDGETS_SASS_LOC, `${p}.scss` ) ? `@import "${p}"` : `//${p} not found`;
    } ).join( ';\n' )};`;
        grunt.file.write( WIDGETS_SASS, content );
        grunt.log.writeln( `File ${WIDGETS_SASS} created` );
    } );

    grunt.registerTask( 'default', [ 'locales', 'widgets', 'css', 'js', 'terser' ] );
    grunt.registerTask( 'locales', [ 'shell:clean-locales', 'i18next' ] );
    grunt.registerTask( 'js', [ 'shell:clean-js', 'client-config-file:create', 'widgets', 'shell:rollup' ] );
    grunt.registerTask( 'css', [ 'shell:clean-css', 'system-sass-variables:create', 'sass' ] );
    grunt.registerTask( 'test', [ 'env:test', 'js', 'css', 'nyc:cover', 'karma:headless', 'shell:buildReadmeBadge', 'eslint:check' ] );
    grunt.registerTask( 'test-browser', [ 'env:test', 'css', 'client-config-file:create', 'karma:browsers' ] );
    grunt.registerTask( 'develop', [ 'env:develop', 'i18next', 'js', 'css', 'concurrent:develop' ] );
    grunt.registerTask( 'test-and-build', [ 'env:test', 'mochaTest:all', 'karma:headless', 'env:production', 'default' ] );
};
