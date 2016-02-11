'use strict';

var trident = global.navigator.userAgent.indexOf( 'Trident/' ) >= 0;

if ( trident ) {
    global.location.href = "/modern-browsers";
}
