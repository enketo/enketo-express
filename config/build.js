// @ts-check

const path = require('path');
const pkg = require('../package.json');

const cwd = process.cwd();

const entryPoints = pkg.entries.map((entry) => path.resolve(cwd, entry));

module.exports = /** @satisfies {import('esbuild').BuildOptions} */ ({
    alias: Object.fromEntries(
        Object.entries(pkg.browser).map(([key, value]) => [
            key,
            path.resolve(cwd, `${value}.js`),
        ])
    ),
    bundle: true,
    chunkNames: 'chunks/[name]-[hash]',
    entryPoints,
    entryNames: '[name]',
    external: ['crypto', 'libxslt'],
    format: 'esm',
    minify: true,
    outdir: path.resolve(cwd, './public/js/build'),
    sourcemap: true,
    splitting: true,
    target: ['chrome89', 'edge89', 'firefox90', 'safari13'],
});
