const config = {
    "presets": [
        [
            "@babel/env",
            {
                "targets": {
                    "edge": "18"
                }
            }
        ]
    ],
    plugins: [ "@babel/plugin-proposal-object-rest-spread" ]
}

module.exports = config;