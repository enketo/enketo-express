'use strict';

var browser;
var os;
var ua = navigator.userAgent;
//var platform = navigator.platform;

browser = {
    isChrome: function() {
        var matchedChrome = /chrome|crios\/(\d+)/i.test( ua );
        var matchedEdge = /edge\//i.test( ua );
        // MS Edge pretends to be Chrome 42:
        // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
        return !matchedEdge && matchedChrome;
    },
    isSafari: function() {
        return /^((?!chrome|android|fxios|crios|ucbrowser).)*safari/i.test( ua );
    },
    isFirefox: function() {
        return /firefox|fxios/i.test( ua );
    },
    isIe: function() {
        return ua.indexOf( 'Trident/' ) >= 0;
    }
};

os = {
    isIos: function() {
        return /iPad|iPhone|iPod/i.test( ua );
    },
    isAndroid: function() {
        return /android/i.test( ua );
    }
};

module.exports = {
    browser: browser,
    os: os
};
