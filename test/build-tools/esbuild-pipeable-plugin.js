// @ts-check

const { readFile } = require('fs').promises;

/**
 * @typedef {import('esbuild').PluginBuild} PluginBuild
 */

/**
 * @typedef {import('esbuild').OnResolveArgs} OnResolveArgs
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
 * @typedef {Function} PipeableTransform
 * @param {PipeableTransformOptions} options
 * @return {OnLoadResult | Promise<OnLoadResult>}
 */

/**
 * @typedef {Function} PipeableSetupOptionsTransform
 * @param {PipeableTransform} transform
 * @return {OnLoadResult | Promise<OnLoadResult>}
 */

/**
 * @typedef PipeableSetupOptions
 * @property {PipeableTransformOptions} transform
 */

/**
 * @typedef {Function} PipeableSetup
 * @param {PluginBuild} build
 * @param {PipeableSetupOptions} [pipeableOptions]
 */

/**
 * @typedef PipeablePluginOptions
 * @property {RegExp} [filter]
 * @property {string} [namespace]
 * @property {PipeableSetup} [setup]
 */

/**
 * @typedef PipeableESBuildPlugin
 * @property {string} name
 * @property {PipeableSetup} setup
 */

/**
 * Helper function to create a pipeable esbuild plugin.
 *
 * @see {@link https://github.com/nativew/esbuild-plugin-pipe#support}
 * @param {string} name
 * @param {PipeableTransform} transform
 * @param {PipeablePluginOptions} [options]
 * @return {PipeableESBuildPlugin}
 */
const createPipeablePlugin = (name, transform, options = {}) => ({
    name,
    /**
     * @param {PluginBuild} build
     * @param {PipeableSetupOptions} [setupOptions]
     */
    setup(build, setupOptions) {
        if (setupOptions != null) {
            return transform(setupOptions.transform);
        }

        const { filter, namespace, setup } = {
            filter: /.*/,
            namespace: name,
            setup: null,

            ...options,
        };

        if (setup != null) {
            const pipeableSetupBuild = {
                initialOptions: build.initialOptions,
                onEnd: build.onEnd.bind(build),
                onLoad: () => {},
                onResolve: build.onResolve.bind(build),
                onStart: build.onStart.bind(build),
            };

            setup(pipeableSetupBuild);
        }

        build.onLoad({ filter, namespace }, async (args) => {
            const contents = await readFile(args.path);

            return transform({ args, contents });
        });
    }
});

module.exports = createPipeablePlugin;
