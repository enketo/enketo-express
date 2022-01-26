const alias = require( 'esbuild-plugin-alias' );
const path = require( 'path' );
const pkg = require( '../package.json' );
const config = require( '../app/models/config-model' ).server;

const cwd = process.cwd();

const entryPoints = pkg.entries.map( entry => (
    path.resolve( cwd, entry )
) );

const isProduction = process.env.NODE_ENV === 'production';

const offlineResources = config['themes supported']
    .reduce( ( accumulator, theme ) => {
        accumulator.push( `${config['base path']}${config['offline path']}/css/theme-${theme}.css` );
        accumulator.push( `${config['base path']}${config['offline path']}/css/theme-${theme}.print.css` );

        return accumulator;
    }, [] )
    .concat( [
        `${config['base path']}${config['offline path']}/images/icon_180x180.png`
    ] );

const offlineVersion = `${pkg.version}-${Date.now()}`;

module.exports = {
    bundle: true,
    define: {
        OFFLINE_APP_WORKER_RESOURCES: JSON.stringify( offlineResources ),
        OFFLINE_APP_WORKER_VERSION: JSON.stringify( offlineVersion ),
    },
    entryPoints: [
        ...entryPoints,
        path.resolve( cwd, 'public/js/src/module/offline-app-worker.js' ),
    ],
    format: 'iife',
    minify: isProduction,
    outdir: path.resolve( cwd, './public/js/build' ),
    plugins: [
        alias(
            Object.fromEntries(
                Object.entries( pkg.browser ).map( ( [ key, value ] ) => (
                    [ key, path.resolve( cwd, `${value}.js` ) ]
                ) )
            )
        ),
    ],
    sourcemap: isProduction ? false : 'inline',
    target: [
        'chrome89',
        'edge89',
        'firefox90',
        'safari13',
    ],
};
