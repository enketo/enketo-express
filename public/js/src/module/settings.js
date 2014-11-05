/**
 * @preserve Copyright 2014 Martijn van de Rijdt
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

define( [ 'text!enketo-config' ], function( config ) {
    "use strict";
    var queryParams = _getAllQueryParams(),
        settings = {},
        settingsMap = [ {
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
    settingsMap.forEach( function( obj, i ) {
        if ( queryParams[ obj.q ] && typeof settings[ obj.s ] === 'undefined' ) {
            settings[ obj.s ] = queryParams[ obj.q ];
        }
    } );

    // add defaults object
    settings.defaults = {};
    for ( var p in queryParams ) {
        var path, value;
        if ( queryParams.hasOwnProperty( p ) ) {
            if ( p.search( /d\[(.*)\]/ ) !== -1 ) {
                path = decodeURIComponent( p.match( /d\[(.*)\]/ )[ 1 ] );
                value = decodeURIComponent( queryParams[ p ] );
                settings.defaults[ path ] = value;
            }
        }
    }

    // add common app configuration constants
    config = JSON.parse( config );
    for ( var prop in config ) {
        if ( config.hasOwnProperty( prop ) ) {
            settings[ prop ] = config[ prop ];
        }
    }

    // add enketoId
    settings.enketoIdPrefix = '::';
    settings.enketoId = _getEnketoId( '\/' + settings.enketoIdPrefix, window.location.pathname ) || _getEnketoId( '#', window.location.hash );

    // determine whether view is offline-capable
    settings.offline = !( new RegExp( '\/' + settings.enketoIdPrefix ).test( window.location.pathname ) ) && !!window.location.hash;

    function _getEnketoId( prefix, haystack ) {
        var id = new RegExp( prefix ).test( haystack ) ? haystack.substring( haystack.lastIndexOf( prefix ) + prefix.length ) : null;
        return id;
    }

    function _getAllQueryParams() {
        var val, processedVal,
            query = window.location.search.substring( 1 ),
            vars = query.split( "&" ),
            params = {};
        for ( var i = 0; i < vars.length; i++ ) {
            var pair = vars[ i ].split( "=" );
            if ( pair[ 0 ].length > 0 ) {
                val = decodeURIComponent( pair[ 1 ] );
                processedVal = ( val === 'true' ) ? true : ( val === 'false' ) ? false : val;
                params[ pair[ 0 ] ] = processedVal;
            }
        }

        return params;
    }

    return settings;
} );
