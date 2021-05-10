/* global __dirname */

const resolve = require( 'rollup-plugin-node-resolve' );
const commonjs = require( 'rollup-plugin-commonjs' );
const builtins = require( 'rollup-plugin-node-builtins' );
const globals = require( 'rollup-plugin-node-globals' );
const alias = require( 'rollup-plugin-alias' );
const buildFiles = require( './buildFiles' );
const path = require( 'path' );
const pkg = require( './package' );

const aliases = Object.entries( pkg.browser ).reduce( ( arr, cur ) => {
    arr.push( {
        find: cur[ 0 ],
        replacement: path.join( __dirname, cur[ 1 ] )
    } );

    return arr;
}, [] );

const plugins = [
    alias( {
        entries: aliases
    } ),
    resolve( {
        browser: true, // Default: false
        preferBuiltins: true // Explicit due to bug https://github.com/rollup/rollup-plugin-node-resolve/issues/196
    } ),
    commonjs( {
        include: 'node_modules/**', // Default: undefined
        sourceMap: false, // Default: true
    } ),
    builtins(),
    globals(),
];

const onwarn = warning => {
    // Silence circular dependency warning for jszip and rollup-plugin-node-builtins
    if ( warning.code === 'CIRCULAR_DEPENDENCY' &&
        ( warning.importer.indexOf( 'node_modules/jszip/' ) !== -1 || warning.importer.indexOf( 'node_modules/rollup-plugin-node-builtins/' ) !== -1 ) ) {
        return;
    }

    console.warn( `(!) ${warning.message}` );
};

const configs = buildFiles.entries.map( ( entryFile, i ) => {
    return {
        input: entryFile,
        output: {
            file: buildFiles.bundles[ i ],
            format: 'iife',
        },
        plugins,
        onwarn,
    };
} );

module.exports = configs;
