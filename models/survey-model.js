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
        var msg, error,
            deferred = Q.defer();

        if ( !id ) {
            error = new Error( new Error( 'Bad request. Form ID required' ) );
            error.status = 400;
            deferred.reject( error );
        } else {
            // get from db the record with key: "id:"+id
            client.hgetall( 'id:' + id, function( error, obj ) {
                if ( error ) {
                    deferred.reject( error );
                } else if ( !obj || obj.active === 'false' ) {
                    msg = 'Survey with this id ' + ( !obj ? 'not found.' : 'no longer active.' );
                    error = new Error( msg );
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
        }

        return deferred.promise;
    }

    function _setSurvey( survey ) {
        // set in db:
        // a) a record with key "id:"+ _createEnketoId(client.incr('surveys:counter')) and all survey info
        // b) a record with key "or:"+ _createOpenRosaKey(survey.openRosaUrl, survey.openRosaId) and the enketo_id
        var error,
            deferred = Q.defer(),
            openRosaKey = _getOpenRosaKey( survey );

        if ( !openRosaKey ) {
            error = new Error( 'Bad request. Survey information not complete or invalid' );
            error.status = 400;
            deferred.reject( error );
        } else if ( pending[ openRosaKey ] ) {
            deferred.reject( new Error( 'Sorry, busy handling the same pending request' ) );
        } else {
            // to avoid issues with fast subsequent requests
            pending[ openRosaKey ] = true;

            return _getEnketoId( openRosaKey )
                .then( function( id ) {
                    if ( id ) {
                        survey.active = true;
                        delete pending[ openRosaKey ];
                        return _updateProperties( id, survey );
                    } else {
                        return _addSurvey( openRosaKey, survey );
                    }
                } )
                .catch( function( error ) {
                    delete pending[ openRosaKey ];
                    deferred.reject( error );
                } );
        }

        return deferred.promise;
    }

    function _updateSurvey( survey ) {
        var error,
            deferred = Q.defer(),
            openRosaKey = _getOpenRosaKey( survey );

        if ( !openRosaKey ) {
            error = new Error( 'Bad request. Survey information not complete or invalid' );
            error.status = 400;
            deferred.reject( error );
        } else {
            return _getEnketoId( openRosaKey )
                .then( function( id ) {
                    if ( id ) {
                        return _updateProperties( id, survey );
                    } else {
                        error = new Error( 'Survey not found.' );
                        error.status = 404;
                        deferred.reject( error );
                    }
                } )
                .catch( function( error ) {
                    deferred.reject( error );
                } );
        }

        return deferred.promise;
    }

    function _getOpenRosaKey( survey ) {
        if ( !survey || !survey.openRosaServer || !survey.openRosaId ) {
            return null;
        }
        return 'or:' + _cleanUrl( survey.openRosaServer ) + ',' + survey.openRosaId.trim().toLowerCase();
    }

    function _updateProperties( id, survey ) {
        var deferred = Q.defer(),
            update = {};

        // create new object only including the updateable properties
        if ( typeof survey.openRosaServer !== 'undefined' ) {
            update.openRosaServer = survey.openRosaServer;
        }
        if ( typeof survey.active !== 'undefined' ) {
            update.active = survey.active;
        }

        client.hmset( 'id:' + id, update, function( error ) {
            if ( error ) {
                deferred.reject( error );
            } else {
                deferred.resolve( id );
            }
        } );

        return deferred.promise;
    }

    function _addSurvey( openRosaKey, survey ) {
        var id,
            deferred = Q.defer();

        client.incr( 'survey:counter', function( error, iterator ) {
            id = _createEnketoId( iterator );
            survey.submissions = 0;
            survey.launchDate = new Date().toISOString();
            survey.active = true;
            client.multi()
                .hmset( 'id:' + id, survey )
                .set( openRosaKey, id )
                .exec( function( error, replies ) {
                    delete pending[ openRosaKey ];
                    if ( error ) {
                        deferred.reject( error );
                    } else {
                        deferred.resolve( id );
                    }
                } );
        } );

        return deferred.promise;
    }

    function _addSubmission( id ) {
        var deferred = Q.defer();

        client.multi()
            .incr( 'submission:counter' )
            .hincrby( 'id:' + id, 'submissions', 1 )
            .exec( function( error, replies ) {
                if ( error ) {
                    deferred.reject( error );
                } else {
                    deferred.resolve( id );
                }
            } );
    }

    function _getNumberOfSurveys( server ) {
        var error,
            deferred = Q.defer();

        if ( !server ) {
            error = new Error( 'Survey information not complete or invalid' );
            error.status = 400;
            deferred.reject( error );
        } else {
            // TODO: should probably be replaced by maintaining a set that contains
            // only the ACTIVE surveys
            client.keys( "or:" + _cleanUrl( server ) + "*", function( err, replies ) {
                if ( error ) {
                    deferred.reject( error );
                } else if ( replies ) {
                    debug( 'replies', replies, replies.length );
                    deferred.resolve( replies.length );
                } else {
                    debug( 'no replies when obtaining number of surveys' );
                    deferred.reject( 'no surveys' );
                }
            } );
        }
        return deferred.promise;
    }

    function _getListOfSurveys() {


    }

    function _getEnketoId( openRosaKey ) {
        var iterator,
            deferred = Q.defer();

        if ( !openRosaKey ) {
            var error = new Error( 'Survey information not complete or invalid' );
            error.status = 400;
            deferred.reject( error );
        } else {
            debug( 'getting id for : ' + openRosaKey );
            client.get( openRosaKey, function( error, id ) {
                debug( 'result', error, id );
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
        }

        return deferred.promise;
    }

    function _getEnketoIdFromSurveyObject( survey ) {
        var openRosaKey = _getOpenRosaKey( survey );

        return _getEnketoId( openRosaKey );
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
        getId: _getEnketoIdFromSurveyObject,
        getNumber: _getNumberOfSurveys,
        getList: _getListOfSurveys,
        cleanUrl: _cleanUrl,
        addSubmission: _addSubmission
    };
};
