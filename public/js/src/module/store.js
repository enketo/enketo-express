/**
 * Deals with browser storage
 */

'use strict';

var db = require( 'db.js' );
var utils = require( './utils' );
var Promise = require( 'lie' );
var sniffer = require( './sniffer' );
var t = require( './translator' ).t;

var server;
var blobEncoding;
var propertyStore;
var recordStore;
var surveyStore;
var dataStore;
var dump;
var available = false;
var databaseName = 'enketo';

function init() {

    return _checkSupport()
        .then( function() {
            return db.open( {
                server: databaseName,
                version: 2,
                schema: {
                    // the surveys
                    surveys: {
                        key: {
                            keyPath: 'enketoId',
                            autoIncrement: false
                        },
                        indexes: {
                            enketoId: {
                                unique: true
                            }
                        }
                    },
                    // the resources that belong to a survey
                    resources: {
                        key: {
                            autoIncrement: false
                        },
                        indexes: {
                            key: {
                                unique: true
                            }
                        }
                    },
                    // Records in separate table because it makes more sense for getting, updating and removing records
                    // if they are not stored in one (giant) array or object value.
                    // Need to watch out for bad iOS bug: http://www.raymondcamden.com/2014/9/25/IndexedDB-on-iOS-8--Broken-Bad
                    // but with the current keys there is no risk of using the same key in multiple tables.
                    // InstanceId is the key because instanceName may change when editing a draft.
                    records: {
                        key: {
                            keyPath: 'instanceId',
                        },
                        indexes: {
                            // useful to check if name exists
                            name: {
                                unique: true
                            },
                            // the actual key
                            instanceId: {
                                unique: true
                            },
                            // to get all records belonging to a form
                            enketoId: {
                                unique: false
                            }
                        }
                    },
                    // the files that belong to a record
                    files: {
                        key: {
                            autoIncrement: false
                        },
                        indexes: {
                            key: {
                                unique: true
                            }
                        }
                    },
                    // settings or other global app properties
                    properties: {
                        key: {
                            keyPath: 'name',
                            autoIncrement: false
                        },
                        indexes: {
                            key: {
                                unique: true
                            }
                        }
                    },
                    // Dynamic data, passed by via querystring is stored in a separate table, 
                    // because its update mechanism is separate from the survey + resources. 
                    // Otherwise the all-or-nothing form+resources update would remove this data.
                    data: {
                        key: {
                            keyPath: 'enketoId',
                            autoIncrement: false
                        },
                        indexes: {
                            enketoId: {
                                unique: true
                            }
                        }
                    }
                }
            } );
        } )
        .then( function( s ) {
            server = s;
        } )
        .then( _isWriteable )
        .then( _setBlobStorageEncoding )
        .then( function() {
            available = true;
        } )
        .catch( function( error ) {
            console.error( 'store initialization error', error );
            // make error more useful and throw it further down the line
            if ( typeof error === 'string' ) {
                error = new Error( error );
            } else if ( !( error instanceof Error ) ) {
                error = new Error( t( 'store.error.notavailable', {
                    error: JSON.stringify( error )
                } ) );
            }
            error.status = 500;
            throw error;
        } );
}


function _checkSupport() {
    var error;
    // best to perform this specific check ourselves and not rely on specific error message in db.js.
    return new Promise( function( resolve, reject ) {
        if ( typeof indexedDB === 'object' ) {
            resolve();
        } else {
            if ( sniffer.os.ios ) {
                error = new Error( t( 'store.error.iosusesafari' ) );
            } else {
                error = new Error( t( 'store.error.notsupported' ) );
            }
            error.status = 500;
            reject( error );
        }
    } );
}

function isAvailable() {
    return available;
}

function _isWriteable() {
    return propertyStore.update( {
        name: 'testWrite',
        value: new Date().getTime()
    } );
}

// detect older indexedDb implementations that do not support storing blobs properly (e.g. Safari 7 and 8)
function _canStoreBlobs() {
    var aBlob = new Blob( [ '<a id="a"><b id="b">hey!</b></a>' ], {
        type: 'text/xml'
    } );

    return propertyStore.update( {
        name: 'testBlobWrite',
        value: aBlob
    } );
}

function _setBlobStorageEncoding() {

    return _canStoreBlobs()
        .then( function() {
            console.log( 'This browser is able to store blobs directly' );
            blobEncoding = false;
        } )
        .catch( function() {
            console.log( 'This browser is not able to store blobs directly, so blobs will be Base64 encoded' );
            blobEncoding = true;
        } );
}

propertyStore = {
    get: function( name ) {
        return server.properties.get( name )
            .then( _firstItemOnly );
    },
    update: function( property ) {
        return server.properties.update( property )
            .then( _firstItemOnly );
    },
    removeAll: function() {
        return _flushTable( 'properties' );
    },
    getSurveyStats: function( id ) {
        return server.properties.get( id + ':stats' );
    },
    incrementRecordCount: function( record ) {
        return propertyStore.getSurveyStats( record.enketoId )
            .then( function( stats ) {
                if ( !stats ) {
                    stats = {
                        name: record.enketoId + ':stats'
                    };
                }
                if ( !stats.recordCount ) {
                    stats.recordCount = 0;
                }
                ++stats.recordCount;
                return propertyStore.update( stats );
            } );
    },
    addSubmittedInstanceId: function( record ) {
        return propertyStore.getSurveyStats( record.enketoId )
            .then( function( stats ) {
                if ( !stats ) {
                    stats = {
                        name: record.enketoId + ':stats'
                    };
                }
                if ( !stats.submitted ) {
                    stats.submitted = [];
                }
                stats.submitted.push( record.instanceId );
                return propertyStore.update( stats );
            } );
    }
};

surveyStore = {
    /** 
     * Obtains a single survey's form HTML and XML model from storage
     * @param  {[type]} id [description]
     * @return {[type]}    [description]
     */
    get: function( id ) {
        return server.surveys.get( id )
            .then( _firstItemOnly );
    },
    /**
     * Stores a single survey's form HTML and XML model
     *
     * @param {[type]} survey [description]
     * @return {Promise}        [description]
     */
    set: function( survey ) {
        if ( !survey.form || !survey.model || !survey.enketoId || !survey.hash ) {
            throw new Error( 'Survey not complete' );
        }
        return server.surveys.add( survey )
            .then( _firstItemOnly );
    },
    /**
     * Updates a single survey's form HTML and XML model as well any external resources belonging to the form
     *
     * @param  {[type]} s [description]
     * @return {Promise}        [description]
     */
    update: function( survey ) {
        var resourceKeys;
        var tasks = [];
        var obsoleteResources = [];

        if ( !survey.form || !survey.model || !survey.enketoId ) {
            throw new Error( 'Survey not complete' );
        }

        // note: if survey.resources = undefined/null, do not store empty array
        // as it means there are no resources to store (and load)
        if ( survey.resources ) {
            // build array of resource keys
            resourceKeys = survey.resources.map( function( resource ) {
                return resource.url;
            } );
        }

        return server.surveys.get( survey.enketoId )
            .then( function( result ) {
                // determine obsolete resources to be removed
                if ( result.resources ) {
                    obsoleteResources = result.resources.filter( function( existing ) {
                        return !resourceKeys || resourceKeys.indexOf( existing ) < 0;
                    } );
                }
                // update the existing survey
                return server.surveys.update( {
                    form: survey.form,
                    model: survey.model,
                    enketoId: survey.enketoId,
                    hash: survey.hash,
                    theme: survey.theme,
                    resources: resourceKeys,
                    maxSize: survey.maxSize,
                    externalData: survey.externalData,
                    branding: survey.branding
                } );
            } )
            .then( function() {
                if ( survey.resources ) {
                    // add new or update existing resources
                    survey.resources.forEach( function( file ) {
                        tasks.push( surveyStore.resource.update( survey.enketoId, file ) );
                    } );
                }
                // remove obsolete resources
                obsoleteResources.forEach( function( key ) {
                    tasks.push( surveyStore.resource.remove( survey.enketoId, key ) );
                } );
                // execution
                return Promise.all( tasks )
                    .then( function() {
                        // resolving with original survey (not the array returned by server.surveys.update)
                        return survey;
                    } );
            } );
    },
    /**
     * Removes survey form and all its resources
     *
     * @param  {[type]} id [description]
     * @return {Promise}    [description]
     */
    remove: function( id ) {
        var resources;
        var tasks = [];

        return surveyStore.get( id )
            .then( function( survey ) {
                resources = survey.resources || [];
                resources.forEach( function( resource ) {
                    tasks.push( surveyStore.resource.remove( id, resource ) );
                } );
                tasks.push( server.surveys.remove( id ) );
                return Promise.all( tasks );
            } );
    },
    /**
     * removes all surveys and survey resources
     * @return {Promise} [description]
     */
    removeAll: function() {
        return _flushTable( 'surveys' )
            .then( function() {
                return _flushTable( 'resources' );
            } );
    },
    resource: {
        /**
         * Obtains a form resource
         * @param  {string} id  Enketo survey ID
         * @param  {string} url URL of resource
         * @return {Promise}
         */
        get: function( id, url ) {
            return _getFile( 'resources', id, url );
        },
        /**
         * Updates a form resource in storage or creates it if it does not yet exist.
         *
         * @param  {{item:Blob, url:string}} resource
         * @return {[type]}          [description]
         */
        update: function( id, resource ) {
            return _updateFile( 'resources', id, resource );
        },
        /**
         * Removes form resource
         *
         * @param  {string} id  Enketo survey ID
         * @param  {string} url URL of resource
         * @return {Promise}
         */
        remove: function( id, url ) {
            return server.resources.remove( id + ':' + url );
        }
    }
};

dataStore = {
    /** 
     * Obtains the stored dynamic data belonging to a form.
     * 
     * @param  {string} id [description]
     * @return {Promise}    promise that resolves with data object
     */
    get: function( id ) {
        return server.data.get( id )
            .then( _firstItemOnly );
    },
    /**
     * Updates the dynamic data belonging to a form
     *
     * @param  {{enketoId: string, submissionParameter: {name: string, value: string}}} data object with dynamic data
     * @return {Promise}        promise that resolves with data object
     */
    update: function( data ) {
        if ( !data.enketoId ) {
            throw new Error( 'Dynamic data object not complete' );
        }

        return server.data.update( data )
            .then( _firstItemOnly );
    },
    /**
     * Removes the dynamic data belonging to a form
     *
     * @param  {string} id [description]
     * @return {Promise}    [description]
     */
    remove: function( id ) {
        return dataStore.remove( id );
    }
};


recordStore = {
    /** 
     * Obtains a single record (XML + files)
     *
     * @param  {[type]} record [description]
     * @return {Promise}        [description]
     */
    get: function( instanceId ) {
        var tasks = [];

        return server.records.get( instanceId )
            .then( _firstItemOnly )
            .then( function( record ) {
                if ( !record ) {
                    return record;
                }

                record.files.forEach( function( fileKey ) {
                    tasks.push( recordStore.file.get( record.instanceId, fileKey ) );
                } );

                return Promise.all( tasks )
                    .then( function( files ) {
                        // filter out the failed files (= undefined)
                        files = files.filter( function( file ) {
                            return file;
                        } );
                        record.files = files || [];
                        return record;
                    } );
            } );
    },
    /** 
     * Obtains all stored records for a particular survey without record files
     *
     * @param  {string}  enketoId   EnketoId of the survey the record belongs to
     * @param { boolean} finalonly  Only included records that are 'final' (i.e. not 'draft')
     * @return {Promise}
     */
    getAll: function( enketoId, finalOnly ) {

        if ( !enketoId ) {
            return Promise.reject( new Error( 'No Enketo ID provided' ) );
        }

        return server.records.query( 'enketoId' )
            .only( enketoId )
            .execute()
            .then( function( records ) {
                // exclude drafts if required
                if ( finalOnly ) {
                    records = records.filter( function( record ) {
                        return !record.draft;
                    } );
                }
                // order by updated property, ascending
                return records.sort( function( a, b ) {
                    return a.updated - b.updated;
                } );
            } );
    },
    /**
     * Sets a new single record (XML + files)
     *
     * @param {[type]} record [description]
     * @return {Promise}        [description]
     */
    set: function( record ) {
        var fileKeys;

        if ( !record.instanceId || !record.enketoId || !record.name || !record.xml ) {
            return Promise.reject( new Error( 'Record not complete' ) );
        }

        record.files = record.files || [];

        // build array of file keys
        fileKeys = record.files.map( function( file ) {
            return file.name;
        } );

        return server.records.add( {
                instanceId: record.instanceId,
                enketoId: record.enketoId,
                name: record.name,
                xml: record.xml,
                files: fileKeys,
                created: new Date().getTime(),
                updated: new Date().getTime(),
                draft: record.draft
            } )
            .then( _firstItemOnly )
            .then( propertyStore.incrementRecordCount )
            .then( function() {
                // execution, sequentially
                return record.files.reduce( function( prevPromise, file ) {
                    return prevPromise.then( function() {
                        if ( file && file.item && file.item instanceof Blob ) {
                            // file can be a string if it was loaded from storage and remained unchanged
                            return recordStore.file.update( record.instanceId, file );
                        }
                        return Promise.resolve();
                    } );
                }, Promise.resolve() );
            } )
            .then( function() {
                return record;
            } );
    },
    /**
     * Updates (or creates) a single record (XML + files)
     *
     * @param {[type]} record [description]
     * @return {Promise}        [description]
     */
    update: function( record ) {
        var fileKeys;
        var obsoleteFiles = [];

        if ( !record.instanceId || !record.enketoId || !record.name || !record.xml ) {
            throw new Error( 'Record not complete' );
        }

        record.files = record.files || [];

        // build array of file keys
        fileKeys = record.files.map( function( file ) {
            return file.name;
        } );

        return server.records.get( record.instanceId )
            .then( function( result ) {
                // determine obsolete files to be removed
                if ( result && result.files ) {
                    obsoleteFiles = result.files.filter( function( existing ) {
                        return fileKeys.indexOf( existing ) < 0;
                    } );
                }
                // update the existing record
                return server.records.update( {
                    instanceId: record.instanceId,
                    enketoId: record.enketoId,
                    name: record.name,
                    xml: record.xml,
                    files: fileKeys,
                    created: ( result && result.created ? result.created : new Date().getTime() ),
                    updated: new Date().getTime(),
                    draft: record.draft
                } );
            } )
            .then( function() {
                // execution, sequentially 
                return record.files.reduce( function( prevPromise, file ) {
                        return prevPromise.then( function() {
                            // file can be a string if it was loaded from storage and remained unchanged
                            if ( file && file.item && file.item instanceof Blob ) {
                                return recordStore.file.update( record.instanceId, file );
                            }
                            return Promise.resolve();
                        } );
                    }, Promise.resolve() )
                    .then( function() {
                        return obsoleteFiles.reduce( function( prevPromise, key ) {
                            return prevPromise.then( function() {
                                return recordStore.file.remove( record.instanceId, key );
                            } );
                        }, Promise.resolve() );
                    } )
                    .then( function() {
                        // resolving with original record (not the array returned by server.records.update)
                        return record;
                    } );
            } );
    },
    /** 
     * Removes a single record (XML + files)
     *
     * @param {[type]} record [description]
     * @return {Promise}        [description]
     */
    remove: function( instanceId ) {
        var files;
        var tasks = [];

        return server.records.get( instanceId )
            .then( _firstItemOnly )
            .then( function( record ) {
                files = record.files || [];
                files.forEach( function( fileKey ) {
                    tasks.push( recordStore.file.remove( instanceId, fileKey ) );
                } );
                tasks.push( server.records.remove( instanceId ) );
                return Promise.all( tasks );
            } );
    },
    /**
     * removes all records and record files
     * @return {Promise} [description]
     */
    removeAll: function() {
        return _flushTable( 'records' )
            .then( function() {
                return _flushTable( 'files' );
            } );
    },
    file: {
        /**
         * Obtains a file belonging to a record
         *
         * @param  {string} instanceId The instanceId that is part of the record (meta>instancID)
         * @param  {string} fileKey     unique key that identifies the file in the record (meant to be fileName)
         * @return {Promise}          [description]
         */
        get: function( instanceId, fileKey ) {
            return _getFile( 'files', instanceId, fileKey );
        },
        /**
         * Updates an file belonging to a record in storage or creates it if it does not yet exist. This function is exported
         * for testing purposes, but not actually used as a public function in Enketo.
         *
         * @param  {string}                     instanceId  instanceId that is part of the record (meta>instancID)
         * @param  {{item:Blob, name:string }}   file        file object
         * @return {Promise}
         */
        update: function( instanceId, file ) {
            return _updateFile( 'files', instanceId, file );
        },
        /**
         * Removes a record file
         *
         * @param  {string} instanceId  instanceId that is part of the record (meta>instancID)
         * @param  {string} fileKey     unique key that identifies the file in the record (meant to be fileName)
         * @return {Promise}
         */
        remove: function( instanceId, fileKey ) {
            return server.files.remove( instanceId + ':' + fileKey );
        }
    }
};


/**
 * Db.js get and update functions return arrays. This function extracts the first item of the array
 * and passed it along.
 *
 * @param  {<*>} array Array of retrieve database items.
 * @return {Promise}       [description]
 */
function _firstItemOnly( results ) {

    if ( Object.prototype.toString.call( results ) === '[object Array]' ) {
        // if an array
        return Promise.resolve( results[ 0 ] );
    } else {
        // if not an array
        return Promise.resolve( results );
    }
}

/**
 * Obtains a file from a specified table
 *
 * @param  {string} table database table name
 * @param  {string} id    Enketo id of the survey
 * @param  {string} key   unique key of the file (url or fileName)
 * @return {Promise}
 */
function _getFile( table, id, key ) {
    var prop;
    var file = {};

    return new Promise( function( resolve, reject ) {
        if ( table === 'resources' || table === 'files' ) {
            prop = ( table === 'resources' ) ? 'url' : 'name';
            return server[ table ].get( id + ':' + key )
                .then( function( item ) {
                    file[ prop ] = key;
                    if ( item instanceof Blob ) {
                        file.item = item;
                        resolve( file );
                    } else if ( typeof item === 'string' ) {
                        utils.dataUriToBlob( item )
                            .then( function( item ) {
                                file.item = item;
                                resolve( file );
                            } );
                    } else {
                        // if item is falsy or unexpected
                        resolve( undefined );
                    }
                } )
                .catch( reject );
        } else {
            reject( new Error( 'Unknown table or issing id or key.' ) );
        }
    } );
}

/**
 * Updates a file in a specified table or creates a new db entry if it doesn't exist.
 *
 * @param  {string} table database table name
 * @param  {string} id    Enketo id of the survey
 * @param  {{(url:string | name: string), item: Blob}} The new file (url or name property)
 * @return {Promise]}       [description]
 */
function _updateFile( table, id, file ) {
    var error;
    var prop;
    var propValue;

    if ( table === 'resources' || table === 'files' ) {
        prop = ( table === 'resources' ) ? 'url' : 'name';
        if ( id && file && file.item instanceof Blob && file[ prop ] ) {
            propValue = file[ prop ];
            file.key = id + ':' + file[ prop ];
            delete file[ prop ];
            /*
             * IE doesn't like complex objects with Blob properties so we store
             * the blob as the value.
             * The files table does not have a keyPath for this reason.
             * The format of file (item: Blob, key: string) is db.js way of directing
             * it to store the blob instance as the value.
             */
            if ( blobEncoding ) {
                return utils.blobToDataUri( file.item )
                    .then( function( convertedBlob ) {
                        file.item = convertedBlob;
                        return server[ table ].update( file )
                            .then( function() {
                                file[ prop ] = propValue;
                                delete file.key;
                                return file;
                            } );
                    } );
            } else {
                return server[ table ].update( file )
                    .then( function() {
                        file[ prop ] = propValue;
                        delete file.key;
                        return file;
                    } );
            }
        } else {
            error = new Error( 'DataError. File not complete or ID not provided.' );
            error.name = 'DataError';
            return Promise.reject( error );
        }
    } else {
        return Promise.reject( new Error( 'Unknown table or missing ID or key.' ) );
    }
}

/**
 * Completely remove the database (no db.js function for this yet)
 * @return {[type]} [description]
 */
function flush() {
    var request;

    return new Promise( function( resolve, reject ) {
        try {
            server.close( databaseName );
        } catch ( e ) {
            console.log( 'Database has probably been removed already. Doing nothing.', e );
            resolve();
        }

        request = indexedDB.deleteDatabase( databaseName );

        request.onsuccess = function() {
            console.log( 'Deleted database successfully' );
            resolve();
        };
        request.onerror = function( error ) {
            reject( error );
        };
        request.onblocked = function( error ) {
            reject( error );
        };
    } );
}

/**
 * Removes a table from the store
 *
 * @param  {string} table [description]
 * @return {Promise}       [description]
 */
function _flushTable( table ) {
    return server[ table ].clear();
}

// debugging utilities: TODO: should move elsewhere or be turned into useful functions that return promises
dump = {
    resources: function() {
        server.resources
            .query()
            .all()
            .execute()
            .done( function( results ) {
                console.log( results.length + ' resources found' );
                results.forEach( function( item ) {
                    if ( item instanceof Blob ) {
                        console.log( item.type, item.size, URL.createObjectURL( item ) );
                    } else {
                        console.log( 'resource string with length ', item.length, 'found' );
                    }
                } );
            } );
    },
    surveys: function() {
        server.surveys
            .query()
            .all()
            .execute()
            .done( function( results ) {
                console.log( results.length + ' surveys found' );
                results.forEach( function( item ) {
                    console.log( 'survey', item );
                } );
            } );
    },
    records: function() {
        server.records
            .query()
            .all()
            .execute()
            .done( function( results ) {
                console.log( results.length + ' records found' );
                results.forEach( function( item ) {
                    console.log( 'survey', item );
                } );
            } );
    },
    files: function() {
        server.files
            .query()
            .all()
            .execute()
            .done( function( results ) {
                console.log( results.length + ' resources found' );
                results.forEach( function( item ) {
                    if ( item instanceof Blob ) {
                        console.log( item.type, item.size, URL.createObjectURL( item ) );
                    } else {
                        console.log( 'resource string with length ', item.length, 'found' );
                    }
                } );
            } );
    },
};

module.exports = {
    init: init,
    isAvailable: isAvailable,
    property: propertyStore,
    survey: surveyStore,
    dynamicData: dataStore,
    record: recordStore,
    flush: flush,
    dump: dump
};
