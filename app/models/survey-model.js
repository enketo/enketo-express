'use strict';

var Promise = require( 'lie' );
var utils = require( '../lib/utils' );
var TError = require( '../lib/custom-error' ).TranslatedError;
var config = require( './config-model' ).server;
var client = require( 'redis' ).createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );
var pending = {};
//randomized 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
var CHARS = 'Yp8oyU0HhFQiPz9KZ1SBGvdTqCM6XDnImkbxNOVLAsEcf5uRe347Wrtlj2awgJ';
var debug = require( 'debug' )( 'survey-model' );

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
    var error;

    return new Promise( function( resolve, reject ) {
        if ( !id ) {
            error = new Error( new Error( 'Bad request. Form ID required' ) );
            error.status = 400;
            reject( error );
        } else {
            // get from db the record with key: "id:"+id
            client.hgetall( 'id:' + id, function( error, obj ) {
                if ( error ) {
                    reject( error );
                } else if ( !obj || obj.active === 'false' || obj.active === false ) {
                    // currently false is stored as 'false' but in the future node_redis might convert back to false
                    // https://github.com/mranney/node_redis/issues/449
                    error = ( !obj ) ? new TError( 'error.surveyidnotfound' ) : new TError( 'error.surveyidnotactive' );
                    error.status = 404;
                    reject( error );
                } else if ( !obj.openRosaId || !obj.openRosaServer ) {
                    error = new Error( 'Survey information for this id is incomplete.' );
                    error.status = 406;
                    reject( error );
                } else {
                    // debug( 'object retrieved from database for id "' + id + '"', obj );
                    obj.enketoId = id;
                    // no need to wait for result of updating lastAccessed 
                    client.hset( 'id:' + id, 'lastAccessed', new Date().toISOString() );
                    resolve( obj );
                }
            } );
        }
    } );
}

function setSurvey( survey ) {
    // Set in db:
    // a) a record with key "id:"+ _createEnketoId(client.incr('surveys:counter')) and all survey info
    // b) a record with key "or:"+ _createOpenRosaKey(survey.openRosaUrl, survey.openRosaId) and the enketo_id
    var error;
    var openRosaKey = utils.getOpenRosaKey( survey );

    return new Promise( function( resolve, reject ) {
        if ( !openRosaKey ) {
            error = new Error( 'Bad request. Survey information not complete or invalid' );
            error.status = 400;
            reject( error );
        } else if ( pending[ openRosaKey ] ) {
            error = new Error( 'Conflict. Busy handling pending request for same survey' );
            error.status = 409;
            reject( error );
        } else {
            // to avoid issues with fast consecutive requests
            pending[ openRosaKey ] = true;

            _getEnketoId( openRosaKey )
                .then( function( id ) {
                    if ( id ) {
                        survey.active = true;
                        delete pending[ openRosaKey ];
                        resolve( _updateProperties( id, survey ) );
                    } else {
                        resolve( _addSurvey( openRosaKey, survey ) );
                    }
                } )
                .catch( function( error ) {
                    delete pending[ openRosaKey ];
                    reject( error );
                } );
        }
    } );
}

function updateSurvey( survey ) {
    var error,
        openRosaKey = utils.getOpenRosaKey( survey );

    return new Promise( function( resolve, reject ) {
        if ( !openRosaKey ) {
            error = new Error( 'Bad request. Survey information not complete or invalid' );
            error.status = 400;
            reject( error );
        } else {
            _getEnketoId( openRosaKey )
                .then( function( id ) {
                    if ( id ) {
                        resolve( _updateProperties( id, survey ) );
                    } else {
                        error = new Error( 'Survey not found.' );
                        error.status = 404;
                        reject( error );
                    }
                } )
                .catch( function( error ) {
                    reject( error );
                } );
        }
    } );
}

function _updateProperties( id, survey ) {
    var update = {};

    return new Promise( function( resolve, reject ) {
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
                reject( error );
            } else {
                resolve( id );
            }
        } );
    } );
}

function _addSurvey( openRosaKey, survey ) {
    var id;

    return new Promise( function( resolve, reject ) {
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
                        reject( error );
                    } else {
                        resolve( id );
                    }
                } );
        } );
    } );
}

function incrSubmissions( id ) {
    return new Promise( function( resolve, reject ) {
        client.multi()
            .incr( 'submission:counter' )
            .hincrby( 'id:' + id, 'submissions', 1 )
            .exec( function( error, replies ) {
                if ( error ) {
                    reject( error );
                } else {
                    resolve( id );
                }
            } );
    } );
}

function getNumberOfSurveys( server ) {
    var error;
    var cleanServerUrl;

    return new Promise( function( resolve, reject ) {
        cleanServerUrl = ( server === '' ) ? '' : utils.cleanUrl( server );
        if ( !cleanServerUrl && cleanServerUrl !== '' ) {
            error = new Error( 'Survey information not complete or invalid' );
            error.status = 400;
            reject( error );
        } else {
            client.keys( 'or:' + cleanServerUrl + '[/,]*', function( err, keys ) {
                if ( error ) {
                    reject( error );
                } else if ( keys ) {
                    _getActiveSurveys( keys )
                        .then( function( surveys ) {
                            resolve( surveys.length );
                        } )
                        .catch( reject );
                } else {
                    debug( 'no replies when obtaining list of surveys' );
                    reject( 'no surveys' );
                }
            } );
        }
    } );
}

function getListOfSurveys( server ) {
    var error;
    var list;
    var cleanServerUrl;

    return new Promise( function( resolve, reject ) {
        cleanServerUrl = ( server === '' ) ? '' : utils.cleanUrl( server );
        if ( !cleanServerUrl && cleanServerUrl !== '' ) {
            error = new Error( 'Survey information not complete or invalid' );
            error.status = 400;
            reject( error );
        } else {
            client.keys( 'or:' + cleanServerUrl + '[/,]*', function( err, keys ) {
                if ( error ) {
                    reject( error );
                } else if ( keys ) {
                    _getActiveSurveys( keys )
                        .then( function( surveys ) {
                            surveys.sort( _ascendingLaunchDate );
                            list = surveys.map( function( survey ) {
                                return {
                                    openRosaServer: survey.openRosaServer,
                                    openRosaId: survey.openRosaId,
                                    enketoId: survey.enketoId
                                };
                            } );

                            resolve( list );
                        } )
                        .catch( reject );
                } else {
                    debug( 'no replies when obtaining list of surveys' );
                    reject( 'no surveys' );
                }
            } );
        }
    } );
}

function _getEnketoId( openRosaKey ) {

    return new Promise( function( resolve, reject ) {
        if ( !openRosaKey ) {
            var error = new Error( 'Survey information not complete or invalid' );
            error.status = 400;
            reject( error );
        } else {
            // debug( 'getting id for : ' + openRosaKey );
            client.get( openRosaKey, function( error, id ) {
                // debug( 'result', error, id );
                if ( error ) {
                    reject( error );
                } else if ( id === '' ) {
                    error = new Error( 'ID for this survey is missing' );
                    error.status = 406;
                    reject( error );
                } else if ( id ) {
                    resolve( id );
                } else {
                    resolve( null );
                }
            } );
        }
    } );
}

function getEnketoIdFromSurveyObject( survey ) {
    var openRosaKey = utils.getOpenRosaKey( survey );

    return _getEnketoId( openRosaKey );
}

function _getActiveSurveys( openRosaIds ) {
    var tasks = openRosaIds.map( function( openRosaId ) {
        return _getEnketoId( openRosaId );
    } );

    return Promise.all( tasks )
        .then( function( ids ) {
            return ids.map( function( id ) {
                // getSurvey rejects with 404 status if survey is not active
                return getSurvey( id ).catch( _404Empty );
            } );
        } )
        .then( function( tasks ) {
            return Promise.all( tasks );
        } )
        .then( function( surveys ) {
            return surveys.filter( _nonEmpty );
        } );
}

function _createEnketoId( iterator ) {
    var id = _num_to_base62( iterator );

    while ( id.length < 4 ) {
        id = CHARS[ 0 ] + id;
    }
    return id;
}

function _num_to_base62( n ) {
    if ( n > 61 ) {
        return _num_to_base62( Math.floor( n / 62 ) ) + CHARS[ n % 62 ];
    } else {
        return CHARS[ n ];
    }
}

function _ascendingLaunchDate( a, b ) {
    return new Date( a.launchDate ) - new Date( b.launchDate );
}

function _nonEmpty( survey ) {
    return !!survey.openRosaId;
}

function _404Empty( error ) {
    if ( error && error.status && error.status === 404 ) {
        return {};
    } else {
        throw error;
    }
}

module.exports = {
    get: getSurvey,
    set: setSurvey,
    update: updateSurvey,
    getId: getEnketoIdFromSurveyObject,
    getNumber: getNumberOfSurveys,
    getList: getListOfSurveys,
    incrementSubmissions: incrSubmissions,
    createEnketoId: _createEnketoId
};
