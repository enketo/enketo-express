"use strict";

var config = require( '../../config/config' );

module.exports = {
    client: function() {
        return {
            google_api_key: config.google[ 'api key' ],
            maps: config.maps,
            widgets: config.widgets,
            modernBrowserURL: 'modern-browsers'
        };
    }
};
