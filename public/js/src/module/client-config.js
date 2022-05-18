const config = window.env ? { ...window.env } : {};

config.experimentalOptimizations = {
    ...config.experimentalOptimizations,
    /**
     * @see {@link https://github.com/enketo/enketo-core/blob/1f5471974255307ad0ead0f451c3ceceea52376c/config.js#L3-L11}
     */
    computeAsync:
        config.experimentalOptimizations?.computeAsync ||
        /[?&]computeAsync\b/.test(window.location.search),
};

export default config;
