"use strict";

var config = require( '../../config/config' ),
    debug = require( 'debug' )( 'config-model' );

module.exports = {
    client: function() {
        var app = require( '../../config/express' );

        return {
            googleApiKey: config.google[ 'api key' ],
            maps: config.maps,
            widgets: config.widgets,
            modernBrowsersURL: 'modern-browsers',
            supportEmail: config.support.email,
            themesSupported: app.get( 'themes supported' ),
            languagesSupported: app.get( 'languages supported' )
        };
    }
};
