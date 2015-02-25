/**
 * @preserve Copyright 2014 Martijn van de Rijdt & Harvard Humanitarian Initiative
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

/**
 * Deals with browser storage
 */

define( [ 'db', 'q', 'utils', 'translator' ], function( db, Q, utils, t ) {
    "use strict";
    var server, blobEncoding, propertyStore, recordStore, surveyStore, dump,
        databaseName = 'enketo';

    function init() {
        return db.open( {
                server: databaseName,
                version: 1,
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
                    }
                }
            } )
            .then( function( s ) {
                server = s;
                console.debug( 'WHoohoeeee, we\'ve got ourselves a database! Now let\'s check if it works properly.' );
            } )
            .then( _isWriteable )
            .then( _setBlobStorageEncoding )
            .catch( function( e ) {
                // make error more useful and throw it further down the line
                var error = new Error( t( 'store.error.notavailable', {
                    error: e.message
                } ) );
                error.status = 500;
                throw error;
            } );
    }

    function _isWriteable( dbName ) {
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
        var deferred = Q.defer();

        _canStoreBlobs()
            .then( function( blobsSupported ) {
                console.debug( 'This browser is able to store blobs directly' );
                blobEncoding = false;
            } )
            .catch( function() {
                console.debug( 'This browser is not able to store blobs directly, so blobs will be Base64 encoded' );
                blobEncoding = true;
            } )
            .then( function() {
                deferred.resolve();
            } );

        return deferred.promise;
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

            console.debug( 'attempting to obtain survey from storage', id );

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

            console.debug( 'attempting to store new survey' );

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
            var resourceKeys,
                tasks = [],
                obsoleteResources = [];

            console.debug( 'attempting to update a stored survey' );

            if ( !survey.form || !survey.model || !survey.enketoId ) {
                throw new Error( 'Survey not complete' );
            }

            survey.resources = survey.resources || [];

            // build array of resource keys
            resourceKeys = survey.resources.map( function( resource ) {
                return resource.url;
            } );

            return server.surveys.get( survey.enketoId )
                .then( function( result ) {
                    // determine obsolete resources to be removed
                    if ( result.resources ) {
                        obsoleteResources = result.resources.filter( function( existing ) {
                            return resourceKeys.indexOf( existing ) < 0;
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
                        externalData: survey.externalData
                    } );
                } )
                .then( function() {
                    // add new or update existing resources
                    survey.resources.forEach( function( file ) {
                        tasks.push( surveyStore.resource.update( survey.enketoId, file ) );
                    } );
                    // remove obsolete resources
                    obsoleteResources.forEach( function( key ) {
                        tasks.push( surveyStore.resource.remove( survey.enketoId, key ) );
                    } );
                    // execution
                    return Q.all( tasks )
                        .then( function() {
                            var deferred = Q.defer();
                            // resolving with original survey (not the array returned by server.surveys.update)
                            deferred.resolve( survey );
                            return deferred.promise;
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
            var resources,
                tasks = [];

            return surveyStore.get( id )
                .then( function( survey ) {
                    resources = survey.resources || [];
                    resources.forEach( function( resource ) {
                        console.debug( 'adding removal of ', resource, 'to remove task queue' );
                        tasks.push( surveyStore.resource.remove( id, resource ) );
                    } );
                    tasks.push( server.surveys.remove( id ) );
                    return Q.all( tasks );
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

                    return Q.all( tasks )
                        .then( function( files ) {
                            record.files = files;
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
            var deferred = Q.defer();

            if ( !enketoId ) {
                deferred.reject( new Error( 'No Enketo ID provided' ) );
                return deferred.promise;
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
            var fileKeys,
                deferred = Q.defer();

            console.debug( 'attempting to store new record', record );

            if ( !record.instanceId || !record.enketoId || !record.name || !record.xml ) {
                deferred.reject( new Error( 'Record not complete' ) );
                return deferred.promise;
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
                    updated: new Date().getTime(),
                    draft: record.draft
                } )
                .then( _firstItemOnly )
                .then( propertyStore.incrementRecordCount )
                .then( function() {
                    var tasks = [];
                    console.debug( 'added the record, now checking files' );
                    record.files.forEach( function( file ) {
                        // file can be a string if it was loaded from storage and remained unchanged
                        if ( file && file.item && file.item instanceof Blob ) {
                            tasks.push( recordStore.file.update( record.instanceId, file ) );
                        }
                    } );
                    return Q.all( tasks );
                } )
                .then( function() {
                    console.debug( 'all save tasks completed!' );
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
            var fileKeys,
                tasks = [],
                obsoleteFiles = [];

            console.debug( 'attempting to update a stored record' );

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
                    if ( result.files ) {
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
                        updated: new Date().getTime(),
                        draft: record.draft
                    } );
                } )
                .then( function() {
                    // add new or update existing files
                    record.files.forEach( function( file ) {
                        // file can be a string if it was loaded from storage and remained unchanged
                        if ( file && file.item && file.item instanceof Blob ) {
                            tasks.push( recordStore.file.update( record.instanceId, file ) );
                        }
                    } );
                    // remove obsolete files
                    obsoleteFiles.forEach( function( key ) {
                        tasks.push( recordStore.file.remove( record.instanceId, key ) );
                    } );
                    // execution
                    return Q.all( tasks )
                        .then( function() {
                            var deferred = Q.defer();
                            // resolving with original record (not the array returned by server.records.update)
                            deferred.resolve( record );
                            return deferred.promise;
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
            var files,
                tasks = [];

            return recordStore.get( instanceId )
                .then( function( record ) {
                    files = record.files || [];
                    files.forEach( function( fileKey ) {
                        console.debug( 'adding removal of ', fileKey, 'to remove task queue' );
                        tasks.push( recordStore.file.remove( instanceId, fileKey ) );
                    } );
                    tasks.push( server.records.remove( instanceId ) );
                    return Q.all( tasks );
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
             * @param  {{item:Blob, name:string}}   file        file object
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
        var deferred = Q.defer();

        if ( Object.prototype.toString.call( results ) === '[object Array]' ) {
            // if an array
            deferred.resolve( results[ 0 ] );
        } else {
            // if not an array
            deferred.resolve( results );
        }

        return deferred.promise;
    }

    /**
     * Obtains a file from a specified table
     * @param  {string} table database table name
     * @param  {string} id    Enketo id of the survey
     * @param  {string} key   unique key of the file (url or fileName)
     * @return {Promise}
     */
    function _getFile( table, id, key ) {
        var prop,
            file = {},
            deferred = Q.defer();

        if ( table === 'resources' || table === 'files' ) {
            prop = ( table === 'resources' ) ? 'url' : 'name';
            server[ table ].get( id + ':' + key )
                .then( function( item ) {
                    file[ prop ] = key;
                    if ( item instanceof Blob ) {
                        file.item = item;
                        deferred.resolve( file );
                    } else if ( typeof item === 'string' ) {
                        utils.dataUriToBlob( item )
                            .then( function( item ) {
                                file.item = item;
                                deferred.resolve( file );
                            } );
                    } else {
                        // if item is falsy or unexpected
                        deferred.resolve( undefined );
                    }
                } )
                .catch( deferred.reject );
        } else {
            deferred.reject( new Error( 'Unknown table or issing id or key.' ) );
        }

        return deferred.promise;
    }

    /**
     * Updates a file in a specified table or creates a new db entry if it doesn't exist.
     *
     * @param  {string} table database table name
     * @param  {string} id    Enketo id of the survey
     * @param  {{url:string, name: string, item: Blob}} The new file (url or name property)
     * @return {Promise]}       [description]
     */
    function _updateFile( table, id, file ) {
        var error, prop, propValue,
            deferred = Q.defer();

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
                error = new Error( 'DataError. File not complete or id not provided.' );
                error.name = 'DataError';
                deferred.reject( error );
            }
        } else {
            deferred.reject( new Error( 'Unknown table or issing id or key.' ) );
        }
        return deferred.promise;
    }

    /**
     * Completely remove the database (no db.js function for this yet)
     * @return {[type]} [description]
     */
    function flush() {
        var request,
            deferred = Q.defer();

        try {
            server.close( databaseName );
        } catch ( e ) {
            console.log( 'Database has probably been removed already. Doing nothing.', e );
            deferred.resolve();
            return deferred.promise;
        }

        request = indexedDB.deleteDatabase( databaseName );

        request.onsuccess = function() {
            console.log( "Deleted database successfully" );
            deferred.resolve();
        };
        request.onerror = function( error ) {
            deferred.reject( error );
        };
        request.onblocked = function( error ) {
            deferred.reject( error );
        };

        return deferred.promise;
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

    return {
        init: init,
        property: propertyStore,
        survey: surveyStore,
        record: recordStore,
        flush: flush,
        dump: dump
    };

} );
