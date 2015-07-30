"use strict";

var config = require( '../../config/default-config' ),
    localConfig = require( '../../config/config' ),
    merge = require( 'lodash/object/merge' ),
    path = require( 'path' ),
    fs = require( 'fs' ),
    themePath = path.join( __dirname, '../../public/css' ),
    languagePath = path.join( __dirname, '../../locales' ),
    debug = require( 'debug' )( 'config-model' );

// merge default and local config
merge( config, localConfig );

// detect supported themes
config[ 'themes supported' ] = [];
if ( fs.existsSync( themePath ) ) {
    fs.readdirSync( themePath ).forEach( function( file ) {
        var matches = file.match( /^theme-([A-z]+)\.css$/ );
        if ( matches && matches.length > 1 ) {
            config[ 'themes supported' ].push( matches[ 1 ] );
        }
    } );
}

// detect supported languages
config[ 'languages supported' ] = fs.readdirSync( languagePath ).filter( function( file ) {
    return fs.statSync( path.join( languagePath, file ) ).isDirectory();
} );

module.exports = {
    server: config,
    client: {
        googleApiKey: config.google[ 'api key' ],
        maps: config.maps,
        widgets: config.widgets,
        modernBrowsersURL: 'modern-browsers',
        supportEmail: config.support.email,
        themesSupported: config[ 'themes supported' ],
        languagesSupported: config[ 'languages supported' ]
    }
};
