const { createInstrumenter } = require('istanbul-lib-instrument');
const createPipeablePlugin = require('./esbuild-pipeable-plugin');

/**
 * @typedef {import('istanbul-lib-instrument').InstrumenterOptions} InstrumenterOptions
 */

/**
 * @typedef {import('source-map').RawSourceMap} RawSourceMap
 */

const instrumenter = createInstrumenter({
    compact: false,
    esModules: true,
});

/**
 * @param {string} source
 * @param {string} path
 * @param {RawSourceMap} [inputSourceMap]
 * @return {Promise<string>}
 */
const instrument = (source, path, inputSourceMap) => (
    new Promise((resolve, reject) => {
        instrumenter.instrument(source, path, (error, code) => {
            if (error == null) {
                resolve(code);
            } else {
                reject(error);
            }
        }, inputSourceMap);
    })
);

/**
 * @typedef {import('esbuild').PluginBuild} PluginBuild
 */

/**
 * @typedef {import('esbuild').OnLoadArgs} OnLoadArgs
 */

/**
 * @typedef {import('esbuild').OnLoadResult} OnLoadResult
 */

/**
 * @typedef PipeableTransformOptions
 * @property {OnLoadArgs} args
 * @property {string} contents
 */

/**
 * @typedef {Function} PipeableSetup
 * @param {PluginBuild} build
 * @param {PipeableTransformOptions} [pipeableOptions]
 */

/**
 * @typedef PipeableEsbuildPlugin
 * @property {string} name
 * @property {PipeableSetup} setup
 */

/**
 * @typedef {Function} PipeableEsbuildPluginTransform
 * @param {PipeableTransformOptions} options
 */

const instanbulInstrument = createPipeablePlugin(
    'esbuild-plugin-istanbul',
    async ({ args, contents }) => {
        const { path } = args;

        if (!path.includes('/public/js/src/')) {
            return { contents };
        }

        const instrumented = await instrument(contents, path);

        return { contents: instrumented };
    }
);

module.exports = instanbulInstrument;
