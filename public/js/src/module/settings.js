'use strict';

var config = require( 'enketo-config' );
var queryParams = _getAllQueryParams();
var settings = {};
var settingsMap = [ {
    q: 'return',
    s: 'returnUrl'
}, {
    q: 'returnURL',
    s: 'returnUrl'
}, {
    q: 'returnUrl',
    s: 'returnUrl'
}, {
    q: 'showbranch',
    s: 'showBranch'
}, {
    q: 'debug',
    s: 'debug'
}, {
    q: 'touch',
    s: 'touch'
}, {
    q: 'server',
    s: 'serverUrl'
}, {
    q: 'serverURL',
    s: 'serverUrl'
}, {
    q: 'serverUrl',
    s: 'serverUrl'
}, {
    q: 'form',
    s: 'xformUrl'
}, {
    q: 'id',
    s: 'xformId'
}, {
    q: 'formName',
    s: 'xformId'
}, {
    q: 'instanceId',
    s: 'instanceId'
}, {
    q: 'instance_id',
    s: 'instanceId'
}, {
    q: 'entityId',
    s: 'entityId'
}, {
    q: 'source',
    s: 'source'
}, {
    q: 'parentWindowOrigin',
    s: 'parentWindowOrigin'
} ];

// rename query string parameters to settings, but only if they do not exist already
settingsMap.forEach( function( obj ) {
    if ( queryParams[ obj.q ] && typeof settings[ obj.s ] === 'undefined' ) {
        settings[ obj.s ] = queryParams[ obj.q ];
    }
} );

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

// add enketoId
settings.enketoIdPrefix = '::';
settings.enketoId = _getEnketoId( '\/' + settings.enketoIdPrefix, window.location.pathname ) || _getEnketoId( '#', window.location.hash );

// determine whether view is offline-capable
// TODO: check for manifest attribute on html element instead?
settings.offline = !( new RegExp( '\/' + settings.enketoIdPrefix ).test( window.location.pathname ) ) && !!window.location.hash;

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
