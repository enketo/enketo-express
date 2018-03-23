'use strict';

var config = require( 'enketo/config' );
var queryParams = _getAllQueryParams();
var settings = {};
var DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
var DEFAULT_LOGIN_URL = '/login';
var DEFAULT_THANKS_URL = '/thanks';
var settingsMap = [
    { q: 'return', s: 'returnUrl' }, { q: 'returnURL', s: 'returnUrl' }, 'returnUrl',
    { q: 'server', s: 'serverUrl' }, { q: 'serverURL', s: 'serverUrl' }, 'serverUrl',
    { q: 'form', s: 'xformUrl' }, { q: 'id', s: 'xformId' },
    'instanceId', { q: 'instance_id', s: 'instanceId' },
    'parentWindowOrigin', 'print', 'format', 'landscape', 'margin', 'touch',
];

// rename query string parameters to settings, but only if they do not exist already
settingsMap.forEach( function( obj ) {
    if ( typeof obj === 'string' && typeof queryParams[ obj ] !== 'undefined' && typeof settings[ obj ] === 'undefined' ) {
        settings[ obj ] = queryParams[ obj ];
    } else if ( typeof queryParams[ obj.q ] !== 'undefined' && typeof settings[ obj.s ] === 'undefined' ) {
        settings[ obj.s ] = queryParams[ obj.q ];
    }
} );

//add default login Url
settings.loginUrl = config[ 'basePath' ] + DEFAULT_LOGIN_URL;

// add default return Url
settings.defaultReturnUrl = config[ 'basePath' ] + DEFAULT_THANKS_URL;

// add defaults object
settings.defaults = {};
for ( var p in queryParams ) {
    if ( queryParams.hasOwnProperty( p ) ) {
        var path;
        var value;
        if ( p.search( /d\[(.*)\]/ ) !== -1 ) {
            path = decodeURIComponent( p.match( /d\[(.*)\]/ )[ 1 ] );
            value = decodeURIComponent( queryParams[ p ] );
            settings.defaults[ path ] = value;
        }
    }
}

// add common app configuration constants
for ( var prop in config ) {
    if ( config.hasOwnProperty( prop ) ) {
        settings[ prop ] = config[ prop ];
    }
}

// add submission parameter value
if ( settings.submissionParameter && settings.submissionParameter.name ) {
    // sets to undefined when necessary
    settings.submissionParameter.value = queryParams[ settings.submissionParameter.name ];
}

// add language override value
settings.languageOverrideParameter = queryParams.lang ? {
    name: 'lang',
    value: queryParams.lang
} : undefined;

// set default maxSubmissionSize
settings.maxSize = DEFAULT_MAX_SIZE;

// add type
if ( window.location.pathname.indexOf( '/preview' ) === 0 ) {
    settings.type = 'preview';
} else if ( window.location.pathname.indexOf( '/single' ) === 0 ) {
    settings.type = 'single';
} else if ( window.location.pathname.indexOf( '/edit' ) === 0 ) {
    settings.type = 'edit';
} else if ( window.location.pathname.indexOf( '/view' ) === 0 ) {
    settings.type = 'view';
} else {
    settings.type = 'other';
}

// Provide easy way to change online-only prefix if we wanted to in the future
settings.enketoIdPrefix = '::';

// Determine whether view is offline-capable
settings.offline = !!document.querySelector( 'html' ).getAttribute( 'manifest' );

// Extract Enketo ID
settings.enketoId = ( settings.offline ) ? _getEnketoId( '#', window.location.hash ) : _getEnketoId( '/' + settings.enketoIdPrefix, window.location.pathname );

// Set multipleAllowed for single webform views
if ( settings.type === 'single' && settings.enketoId.length !== 32 && settings.enketoId.length !== 64 ) {
    settings.multipleAllowed = true;
}

// Determine whether "go to" functionality should be enabled.
settings.goTo = settings.type === 'edit' || settings.type === 'preview' || settings.type === 'view';

// A bit crude and hackable by users, but this way also type=view with a record will be caught.
settings.printRelevantOnly = !!settings.instanceId;

function _getEnketoId( prefix, haystack ) {
    var id = new RegExp( prefix ).test( haystack ) ? haystack.substring( haystack.lastIndexOf( prefix ) + prefix.length ) : null;
    return id;
}

function _getAllQueryParams() {
    var val;
    var processedVal;
    var query = window.location.search.substring( 1 );
    var vars = query.split( '&' );
    var params = {};

    for ( var i = 0; i < vars.length; i++ ) {
        var pair = vars[ i ].split( '=' );
        if ( pair[ 0 ].length > 0 ) {
            val = decodeURIComponent( pair[ 1 ] );
            processedVal = ( val === 'true' ) ? true : ( val === 'false' ) ? false : val;
            params[ pair[ 0 ] ] = processedVal;
        }
    }

    return params;
}

module.exports = settings;
