// Note: Enketo only uses Babel for a special IE11 build.
const presets = [
    [
        '@babel/preset-env',
        {
            targets: {
                ie: '11'
            },
            useBuiltIns: 'usage',
        },
    ],
];

module.exports = { presets };
