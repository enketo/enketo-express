'use strict';

var settings = require( './module/settings' );

if ( settings.offline && settings.enketoId && settings.submissionParameter && settings.submissionParameter.value ) {
    location.href = window.location.pathname + window.location.hash;
}
