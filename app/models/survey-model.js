const utils = require( '../lib/utils' );
const TError = require( '../lib/custom-error' ).TranslatedError;
const config = require( './config-model' ).server;
const client = require( 'redis' ).createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );
const pending = {};
const debug = require( 'debug' )( 'survey-model' );

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
    return new Promise( ( resolve, reject ) => {
        if ( !id ) {
            const error = new Error( new Error( 'Bad request. Form ID required' ) );
            error.status = 400;
            reject( error );
        } else {
            // get from db the record with key: "id:"+id
            client.hgetall( `id:${id}`, ( error, obj ) => {
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
                    client.hset( `id:${id}`, 'lastAccessed', new Date().toISOString() );
                    resolve( obj );
                }
            } );
        }
    } );
}

function setSurvey( survey ) {
    return new Promise( ( resolve, reject ) => {
        // Set in db:
        // a) a record with key "id:"+ _createEnketoId(client.incr('surveys:counter')) and all survey info
        // b) a record with key "or:"+ _createOpenRosaKey(survey.openRosaUrl, survey.openRosaId) and the enketo_id
        let error;
        const openRosaKey = utils.getOpenRosaKey( survey );
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
                .then( id => {
                    if ( id ) {
                        survey.active = true;
                        delete pending[ openRosaKey ];
                        resolve( _updateProperties( id, survey ) );
                    } else {
                        resolve( _addSurvey( openRosaKey, survey ) );
                    }
                } )
                .catch( error => {
                    delete pending[ openRosaKey ];
                    reject( error );
                } );
        }
    } );
}

function updateSurvey( survey ) {
    return new Promise( ( resolve, reject ) => {
        const openRosaKey = utils.getOpenRosaKey( survey );
        let error;
        if ( !openRosaKey ) {
            error = new Error( 'Bad request. Survey information not complete or invalid' );
            error.status = 400;
            reject( error );
        } else {
            _getEnketoId( openRosaKey )
                .then( id => {
                    if ( id ) {
                        resolve( _updateProperties( id, survey ) );
                    } else {
                        error = new Error( 'Survey not found.' );
                        error.status = 404;
                        reject( error );
                    }
                } )
                .catch( error => {
                    reject( error );
                } );
        }
    } );
}

function _updateProperties( id, survey ) {
    return new Promise( ( resolve, reject ) => {
        const update = {};
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

        client.hmset( `id:${id}`, update, error => {
            if ( error ) {
                reject( error );
            } else {
                resolve( id );
            }
        } );
    } );
}

function _addSurvey( openRosaKey, survey ) {
    // survey:counter no longer serves any purpose, after https://github.com/kobotoolbox/enketo-express/issues/481
    return _createNewEnketoId()
        .then( id => {
            return new Promise( function( resolve, reject ) {
                client.multi()
                    .hmset( `id:${id}`, {
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
                    .exec( error => {
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
    return new Promise( ( resolve, reject ) => {
        client.multi()
            .incr( 'submission:counter' )
            .hincrby( `id:${id}`, 'submissions', 1 )
            .exec( error => {
                if ( error ) {
                    reject( error );
                } else {
                    resolve( id );
                }
            } );
    } );
}

function getNumberOfSurveys( server ) {
    return new Promise( ( resolve, reject ) => {
        let error;
        const cleanServerUrl = ( server === '' ) ? '' : utils.cleanUrl( server );
        if ( !cleanServerUrl && cleanServerUrl !== '' ) {
            error = new Error( 'Survey information not complete or invalid' );
            error.status = 400;
            reject( error );
        } else {
            client.keys( `or:${cleanServerUrl}[/,]*`, ( err, keys ) => {
                if ( error ) {
                    reject( error );
                } else if ( keys ) {
                    _getActiveSurveys( keys )
                        .then( surveys => {
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
    return new Promise( ( resolve, reject ) => {
        let error;
        const cleanServerUrl = ( server === '' ) ? '' : utils.cleanUrl( server );
        if ( !cleanServerUrl && cleanServerUrl !== '' ) {
            error = new Error( 'Survey information not complete or invalid' );
            error.status = 400;
            reject( error );
        } else {
            client.keys( `or:${cleanServerUrl}[/,]*`, ( err, keys ) => {
                if ( error ) {
                    reject( error );
                } else if ( keys ) {
                    _getActiveSurveys( keys )
                        .then( surveys => {
                            surveys.sort( _ascendingLaunchDate );
                            const list = surveys.map( survey => ( {
                                openRosaServer: survey.openRosaServer,
                                openRosaId: survey.openRosaId,
                                enketoId: survey.enketoId
                            } ) );

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
    return new Promise( ( resolve, reject ) => {
        if ( !openRosaKey ) {
            const error = new Error( 'Survey information not complete or invalid' );
            error.status = 400;
            reject( error );
        } else {
            // debug( 'getting id for : ' + openRosaKey );
            client.get( openRosaKey, ( error, id ) => {
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
    const openRosaKey = utils.getOpenRosaKey( survey );

    return _getEnketoId( openRosaKey );
}

function _getActiveSurveys( openRosaIds ) {
    const tasks = openRosaIds.map( openRosaId => _getEnketoId( openRosaId ) );

    return Promise.all( tasks )
        .then( ids => ids.map( id => // getSurvey rejects with 404 status if survey is not active
            getSurvey( id ).catch( _404Empty ) ) )
        .then( tasks => Promise.all( tasks ) )
        .then( surveys => surveys.filter( _nonEmpty ) );
}

/**
 * Generates a new random Enketo ID that has not been used yet, or checks whether a provided id has not been used.
 * 8 characters keeps the chance of collisions below about 10% until about 10,000,000 IDs have been generated
 * 
 * @param {string=} id This is optional, and only really included to write tests for collissions or a future "vanity ID" feature
 * @param {number=} triesRemaining Avoid infinite loops when collissions become the norm.
 */
function _createNewEnketoId( id = utils.randomString( 8 ), triesRemaining = 10 ) {
    return new Promise( ( resolve, reject ) => {
        client.hgetall( `id:${id}`, ( error, obj ) => {
            if ( error ) {
                reject( error );
            } else if ( obj ) {
                if ( triesRemaining-- ) {
                    resolve( _createNewEnketoId( undefined, triesRemaining ) );
                } else {
                    const error = new Error( 'Failed to create unique Enketo ID.' );
                    error.status = 500;
                    reject( error );
                }
            } else {
                resolve( id );
            }
        } );
    } );
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
    createNewEnketoId: _createNewEnketoId
};
