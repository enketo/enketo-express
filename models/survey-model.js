"use strict";

module.exports = function( client ) {
    var Q = require( 'q' ),
        debug = require( 'debug' )( 'survey-model' ),
        pending = {},
        CHARS = "Yp8oyU0HhFQiPz9KZ1SBGvdTqCM6XDnUmkbxNOVLAsEcf5uRe347Wrtlj2awgJ";
    //randomized 'abcdefghijklmnopqrstuvwxyzABCDEFGHUJKLMNOPQRSTUVWXYZ0123456789';

    // ability to pass a different (test db) client
    if ( !client ) {
        debug( 'creating default production db client' );
        client = require( 'redis' ).createClient();
    } else {
        //console.log( 'using (test) db passed as survey-model require parameter' );
    }

    /**
     * returns the information stored in the database for an enketo id
     * @param  {string} id [description]
     * @return {[type]}    [description]
     */
    function _getSurvey( id ) {
        var deferred = Q.defer();

        // get from db the record with key: "id:"+id
        client.hgetall( 'id:' + id, function( error, obj ) {

            if ( error ) {
                deferred.reject( error );
            } else if ( !obj ) {
                error = new Error( 'Survey with this id not found.' );
                error.status = 404;
                debug( 'returning ', error );
                deferred.reject( error );
            } else if ( !obj.openRosaId || !obj.openRosaServer ) {
                error = new Error( 'Survey information for this id is incomplete.' );
                error.status = 406;
                deferred.reject( error );
            } else {
                debug( 'object retrieved from database for id "' + id + '"', obj );
                obj.enketoId = id;
                // no need to wait for result of updating lastAccessed 
                client.hset( 'id:' + id, 'lastAccessed', new Date().toISOString() );
                deferred.resolve( obj );
            }
        } );

        return deferred.promise;
    }

    function _setSurvey( survey ) {
        // set in db:
        // a) a record with key "id:"+ _createEnketoId(client.incr('surveys:counter')) and all survey info
        // b) a record with key "or:"+ _createOpenRosaKey(survey.openRosaUrl, survey.openRosaId) and the enketo_id
        var deferred = Q.defer(),
            openRosaKey = _getOpenRosaKey( survey );

        // to avoid issues with fast subsequent requests
        if ( !pending[ openRosaKey ] ) {
            pending[ openRosaKey ] = true;
        } else {
            deferred.reject( new Error( 'Sorry, busy handling the same pending request' ) );
        }

        if ( !openRosaKey ) {
            setTimeout( function() {
                deferred.reject( new Error( 'Survey information not complete or invalid' ) );
            }, 0 );
            return deferred.promise;
        }

        return _getEnketoId( openRosaKey )
            .then( function( id ) {
                if ( id ) {
                    return _updateServer( id, survey.openRosaServer );
                } else {
                    client.incr( 'survey:counter', function( error, iterator ) {
                        id = _createEnketoId( iterator );
                        survey.submissions = 0;
                        survey.launchDate = new Date().toISOString();
                        client.multi()
                            .hmset( 'id:' + id, survey )
                            .set( openRosaKey, id )
                            .exec( function( error, replies ) {
                                if ( error ) {
                                    deferred.reject( error );
                                } else {
                                    deferred.resolve( id );
                                }
                            } );
                    } );
                }
                return deferred.promise;
            } );
        // server, formid, submissions, launch_date, last_accessed, theme, 
    }

    function _updateSurvey( survey ) {

    }

    function _getOpenRosaKey( survey ) {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId ) {
            return null;
        }
        return 'or:' + _cleanUrl( survey.openRosaServer ) + ',' + survey.openRosaId.trim().toLowerCase();
    }

    function _updateServer( id, serverUrl ) {
        // updates just the serverUrl in case the server makes an API call using a different HTTP(S) protocol
        // than the one save in the enketo db
        var deferred = Q.defer();

        client.hset( 'id:' + id, serverUrl, function( error ) {
            if ( error ) {
                deferred.reject( error );
            } else {
                deferred.resolve( id );
            }
        } );

        return deferred.promise;
    }

    function _getEnketoId( openRosaKey ) {
        var iterator,
            deferred = Q.defer();
        console.log( 'getting id for : ' + openRosaKey );
        client.get( openRosaKey, function( error, id ) {
            if ( error ) {
                deferred.reject( error );
            } else if ( id === '' ) {
                error = new Error( "ID for this survey is missing" );
                error.status = 406;
                deferred.reject( error );
            } else if ( id ) {
                deferred.resolve( id );
            } else {
                deferred.resolve( null );
            }
        } );

        return deferred.promise;
    }

    function _createEnketoId( iterator ) {
        var id = _num_to_base62( iterator );

        while ( id.length < 4 ) {
            id = CHARS[ 0 ] + id;
        }
        return id;
    }

    /**
     * cleans a Server URL so it becomes useful as a db key
     * It strips the protocol, removes a trailing slash, and converts to lowercase
     * @param  {string} url [description]
     * @return {string=}     [description]
     */
    function _cleanUrl( url ) {
        var matches;
        url = url.trim();
        if ( url.lastIndexOf( '/' ) === url.length - 1 ) {
            url = url.substring( 0, url.length - 1 );
        }
        matches = url.match( /https?\:\/\/(www\.)?(.+)/ );
        if ( matches.length > 2 ) {
            return matches[ 2 ].toLowerCase();
        }
        return null;
    }

    function _num_to_base62( n ) {
        if ( n > 62 ) {
            return _num_to_base62( Math.floor( n / 62 ) ) + CHARS[ n % 62 ];
        } else {
            return CHARS[ n ];
        }
    }

    // public methods
    return {
        get: _getSurvey,
        set: _setSurvey,
        update: _updateSurvey,
        cleanUrl: _cleanUrl
    };
};
