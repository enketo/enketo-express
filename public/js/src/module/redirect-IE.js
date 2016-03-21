'use strict';

var sniffer = require( './sniffer' );
var trident = sniffer.browser.isIe();

if ( trident ) {
    global.location.href = "/modern-browsers";
}
