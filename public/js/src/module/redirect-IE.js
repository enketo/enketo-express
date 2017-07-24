'use strict';

var sniffer = require( './sniffer' );
var trident = sniffer.browser.ie;

if ( trident ) {
    global.location.href = "/modern-browsers";
}
