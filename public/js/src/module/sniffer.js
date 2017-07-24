'use strict';

var ua = navigator.userAgent;
var os = require( 'enketo-core/src/js/sniffer' ).os;

module.exports = {
    browser: {
        get chrome() {
            var matchedChrome = /chrome|crios\/(\d+)/i.test( ua );
            var matchedEdge = /edge\//i.test( ua );
            // MS Edge pretends to be Chrome 42:
            // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
            return !matchedEdge && matchedChrome;
        },
        get safari() {
            return /^((?!chrome|android|fxios|crios|ucbrowser).)*safari/i.test( ua );
        },
        get firefox() {
            return /firefox|fxios/i.test( ua );
        },
        get ie() {
            return ua.indexOf( 'Trident/' ) >= 0;
        }
    },
    os: os
};
