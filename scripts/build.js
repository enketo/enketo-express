/* eslint-env node */

const alias = require( 'esbuild-plugin-alias' );
const esbuild = require( 'esbuild' );
const path = require( 'path' );
const pkg = require( '../package' );

const cwd = process.cwd();

const entryPoints = pkg.entries.map( entry => (
    path.resolve( cwd, entry )
) );

const isProduction = process.env.NODE_ENV === 'production';

esbuild.build( {
    bundle: true,
    entryPoints,
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
} );
