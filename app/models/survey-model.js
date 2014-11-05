"use strict";

var Q = require( 'q' ),
    utils = require( '../lib/utils' ),
    TError = require( '../lib/custom-error' ).TranslatedError,
    config = require( '../../config/config' ),
    client = require( 'redis' ).createClient( config.redis.main.port, config.redis.main.host, {
        auth_pass: config.redis.main.password
    } ),
    pending = {},
    //randomized 'abcdefghijklmnopqrstuvwxyzABCDEFGHUJKLMNOPQRSTUVWXYZ0123456789';
    CHARS = "Yp8oyU0HhFQiPz9KZ1SBGvdTqCM6XDnUmkbxNOVLAsEcf5uRe347Wrtlj2awgJ",
    debug = require( 'debug' )( 'survey-model' );

// in test environment, switch to different db
if ( process.env.NODE_ENV === 'test' ) {
    client.select( 15 );
}

/**
 * returns the information stored in the database for an enketo id
 * @param  {string} id [description]
 * @return {[type]}    [description]
 */
function getSurvey( id ) {
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
            } else if ( !obj || obj.active === 'false' || obj.active === false ) {
                // currently false is stored as 'false' but in the future node_redis might convert back to false
                // https://github.com/mranney/node_redis/issues/449
                error = ( !obj ) ? new TError( 'error.surveyidnotfound' ) : new TError( 'error.surveyidnotactive' );
                error.status = 404;
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

function setSurvey( survey ) {
    // set in db:
    // a) a record with key "id:"+ _createEnketoId(client.incr('surveys:counter')) and all survey info
    // b) a record with key "or:"+ _createOpenRosaKey(survey.openRosaUrl, survey.openRosaId) and the enketo_id
    var error,
        deferred = Q.defer(),
        openRosaKey = utils.getOpenRosaKey( survey );

    if ( !openRosaKey ) {
        error = new Error( 'Bad request. Survey information not complete or invalid' );
        error.status = 400;
        deferred.reject( error );
    } else if ( pending[ openRosaKey ] ) {
        error = new Error( 'Conflict. Busy handling pending request for same survey' );
        error.status = 409;
        deferred.reject( error );
    } else {
        // to avoid issues with fast consecutive requests
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

function updateSurvey( survey ) {
    var error,
        deferred = Q.defer(),
        openRosaKey = utils.getOpenRosaKey( survey );

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
    // always update the theme, which will delete it if the theme parameter is missing
    // avoid storing undefined as string 'undefined'
    update.theme = survey.theme || '';

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
        client.multi()
            .hmset( 'id:' + id, {
                // explicitly set the properties that need to be saved
                // this will avoid accidentally saving e.g. transformation results and cookies
                openRosaServer: survey.openRosaServer,
                openRosaId: survey.openRosaId,
                submissions: 0,
                launchDate: new Date().toISOString(),
                active: true,
                // avoid storing string 'undefined'
                theme: survey.theme || ''
            } )
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

function addSubmission( id ) {
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

function getNumberOfSurveys( server ) {
    var error,
        deferred = Q.defer();

    if ( !server ) {
        error = new Error( 'Survey information not complete or invalid' );
        error.status = 400;
        deferred.reject( error );
    } else {
        // TODO: should probably be replaced by maintaining a set that contains
        // only the ACTIVE surveys
        client.keys( "or:" + utils.cleanUrl( server ) + "*", function( err, replies ) {
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

function getListOfSurveys() {


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

function getEnketoIdFromSurveyObject( survey ) {
    var openRosaKey = utils.getOpenRosaKey( survey );

    return _getEnketoId( openRosaKey );
}

function _createEnketoId( iterator ) {
    var id = _num_to_base62( iterator );

    while ( id.length < 4 ) {
        id = CHARS[ 0 ] + id;
    }
    return id;
}

function _num_to_base62( n ) {
    if ( n > 62 ) {
        return _num_to_base62( Math.floor( n / 62 ) ) + CHARS[ n % 62 ];
    } else {
        return CHARS[ n ];
    }
}

module.exports = {
    get: getSurvey,
    set: setSurvey,
    update: updateSurvey,
    getId: getEnketoIdFromSurveyObject,
    getNumber: getNumberOfSurveys,
    getList: getListOfSurveys,
    addSubmission: addSubmission
};
