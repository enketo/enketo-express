/* global: console, process, require, Promise */
'use strict';

/**
 * See https://github.com/kobotoolbox/enketo-express/blob/master/doc/duplicates.md for more information about this tool.
 * 
 * MAKE A BACKUP BEFORE RUNNING THIS SCRIPT TO REMOVE DUPLICATES! 
 */
var config = require( '../app/models/config-model' ).server;
var mainClient = require( 'redis' ).createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );
var cacheClient = require( 'redis' ).createClient( config.redis.cache.port, config.redis.cache.host, {
    auth_pass: config.redis.cache.password
} );
var fs = require( 'fs' );
var path = require( 'path' );
var mode = 'analyze';

process.argv.forEach( function( val, index, array ) {
    if ( val === 'remove' ) {
        mode = 'remove';
    }
} );

if ( mode === 'analyze' ) {
    console.log( '\nLooking for duplicates...\n' );

    checkDuplicateEnketoIds()
        .catch( function( error ) {
            console.error( error );
        } )
        .then( function( result ) {
            process.exit( 0 );
        } );
} else if ( mode === 'remove' ) {
    console.log( '\nLooking for duplicates to remove them...\n' );
    removeDuplicateEnketoIds()
        .catch( function( error ) {
            console.error( error );
        } )
        .then( function() {
            process.exit( 0 );
        } );
}

function checkDuplicateEnketoIds() {
    return getDuplicates()
        .then( function( duplicates ) {
            duplicates.forEach( function( duplicate ) {
                console.log( 'Duplicate for %s: %s and %s (registered formID: %s)', duplicate.id, duplicate.key1, duplicate.key2, duplicate.openRosaId );
            } );
            console.log( '\nFound %d duplicates.\n', duplicates.length );
        } );
}

function removeDuplicateEnketoIds() {
    return getDuplicates()
        .then( function( duplicates ) {
            var tasks = [];
            var i = 1;

            console.log( '\nFound %d duplicate(s).\n', duplicates.length );

            duplicates.forEach( function( duplicate ) {
                var or1 = duplicate.key1.split( ',' )[ 1 ];
                var or2 = duplicate.key2.split( ',' )[ 1 ];

                if ( or1 !== duplicate.openRosaId && or2 === duplicate.openRosaId ) {
                    tasks.push( remove( duplicate.key1, duplicate.id ) );
                } else if ( or1 === duplicate.openRosaId && or2 !== duplicate.openRosaId ) {
                    tasks.push( remove( duplicate.key2, duplicate.id ) );
                }

                removeCache( duplicate.key1 );
                removeCache( duplicate.key2 );

                i++;
            } );

            return Promise.all( tasks );

        } )
        .then( function( logs ) {
            console.log( '\nRemoved %d duplicate(s).\n', logs.length );
            if ( logs.length === 0 ) {
                return;
            }
            return new Promise( function( resolve, reject ) {
                var p = path.join( __dirname, '../logs/duplicates-removed-' + ( new Date().toISOString().replace( ':', '.' ) ) + '.txt' );
                fs.writeFile( p, logs.join( '\n' ), function( err ) {
                    if ( err ) {
                        reject( err );
                    } else {
                        resolve();
                    }
                } );
            } );
        } );
}

function getDuplicates() {
    return getAllKeys()
        .then( function( keys ) {
            var tasks = [];
            keys.forEach( function( key ) {
                tasks.push( getId( key ) );
            } );

            return Promise.all( tasks );
        } )
        .then( function( objs ) {
            var duplicates = [];
            var ids = [];
            var keys = [];
            var tasks = [];

            objs.forEach( function( obj ) {
                var foundIndex = ids.indexOf( obj.id );
                if ( foundIndex === -1 ) {
                    ids.push( obj.id );
                    keys.push( obj.key );
                } else {
                    duplicates.push( {
                        id: obj.id,
                        key1: keys[ foundIndex ],
                        key2: obj.key
                    } );
                }
            } );

            duplicates.forEach( function( duplicate ) {
                tasks.push( getSurveyOpenRosaId( duplicate ) );
            } );
            return Promise.all( tasks );
        } );
}

function getAllKeys() {
    return new Promise( function( resolve, reject ) {
        mainClient.keys( 'or:*', function( error, keys ) {
            if ( error ) {
                reject( error );
            } else {
                resolve( keys );
            }
        } );
    } );
}

function getId( key ) {
    return new Promise( function( resolve, reject ) {
        mainClient.get( key, function( error, id ) {
            if ( error ) {
                reject( error );
            } else {
                resolve( {
                    key: key,
                    id: id
                } );
            }
        } );
    } );
}

function getSurveyOpenRosaId( duplicate ) {
    return new Promise( function( resolve, reject ) {
        mainClient.hgetall( 'id:' + duplicate.id, function( error, survey ) {
            if ( error ) {
                reject( error );
            } else {
                duplicate.openRosaId = survey.openRosaId;
                resolve( duplicate );
            }
        } );
    } );
}

function remove( key, id ) {
    var msg;
    return new Promise( function( resolve, reject ) {
        // just remove it, the next time the Enketo button is clicked, it will add a completely new entry and generate a new Id.
        mainClient.del( key, function( err ) {
            if ( err ) {
                msg = 'Error: could not remove ' + key + ' for id ' + id;
                console.error( msg );
                reject( new Error( msg ) );
            } else {
                msg = 'Removed ' + key + ' for id ' + id;
                console.log( msg );
                resolve( msg );
            }
        } );
    } );
}

function removeCache( key ) {
    var cacheKey = key.replace( 'or:', 'ca:' );
    console.log( 'Removing cache for ', cacheKey );
    // remove cache entries, and ignore results
    cacheClient.del( cacheKey );
}
