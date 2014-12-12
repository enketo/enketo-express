"use strict";

var config = require( '../../config/config' );

module.exports = {
    client: function() {
        return {
            googleApiKey: config.google[ 'api key' ],
            maps: config.maps,
            widgets: config.widgets,
            modernBrowserURL: 'modern-browsers',
            supportEmail: config.support.email
        };
    }
};
