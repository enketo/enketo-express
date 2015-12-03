'use strict';

var browser;

/**
 * It is a sad state of affairs that we need this.
 */

browser = {
    isChrome: function() {
        var matchedChrome = navigator.userAgent.match( /Chrome\/(\d+)/ );
        var matchedEdge = navigator.userAgent.match( /Edge\// );
        // MS Edge pretends to be Chrome 42:
        // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
        return !matchedEdge && matchedChrome;
    },
    isOnIos: function() {
        return /iPad|iPhone|iPod/i.test( navigator.platform );
    }
};

module.exports = {
    browser: browser
};
