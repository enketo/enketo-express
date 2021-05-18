import records from '../../public/js/src/module/records-queue';
import settings from '../../public/js/src/module/settings';
import store from '../../public/js/src/module/store';

/**
 * @typedef Record { import('./store').Record }
 */

/**
 * @typedef SinonSandbox { import('sinon').SinonSandbox }
 */

/**
 * While some of this is tested in store.spec.js, this suite tests the additional
 * logic performed in records-queue.js functionality around the client store.
 */
describe( 'Records queue', () => {
    const enketoIdA = 'surveyA';
    const instanceIdA = 'recordA';
    const enketoIdB = 'surveyB';
    const instanceIdB = 'recordB';

    /** @type {string} */
    let autoSavedKey;

    /** @type { string } */
    let enketoId;

    /** @type { SinonSandbox } */
    let sandbox;

    /** @type { Record } */
    let recordA;

    /** @type { File[] } */
    let files;

    beforeEach( done => {
        enketoId = enketoIdA;

        sandbox = sinon.createSandbox();
        sandbox.stub( settings, 'enketoId' ).get( () => enketoId );

        autoSavedKey = records.getAutoSavedKey();

        recordA = {
            enketoId,
            instanceId: instanceIdA,
            name: 'name A',
            xml: '<model><something>a</something></model>'
        };

        files = [
            {
                name: 'something1.xml',
                item: new Blob( [ '<html>something1</html' ], {
                    type: 'text/xml'
                } )
            },
            {
                name: 'something2.xml',
                item: new Blob( [ '<html>something2</html' ], {
                    type: 'text/xml'
                } )
            }
        ];

        store.init().then( records.init ).then( () => {
            return store.record.set( {
                instanceId: autoSavedKey,
                enketoId,
                name: `__autoSave_${Date.now()}`,
                xml: '<model><autosaved/></model>',
                files: [],
            } );
        } ).then( () => done(), done );
    } );

    afterEach( done => {
        let caught;

        store.flush()
            .then( () => done )
            .catch( reason => {
                // It's not entirely clear to me why, but the `flush` call is throwing
                // an event from `IDBOpenDBRequest.onupgradeneeded` on the first call.
                if ( reason instanceof IDBVersionChangeEvent ) {
                    console.log( 'caught unexpected IDBVersionChangeEvent, attempting to flush again', reason );

                    return store.flush();
                }

                caught = reason;
            } )
            .catch( reason => {
                console.log(
                    'second attempt to flush failed', reason,
                    'is IDBVersionChangeEvent again?', reason instanceof IDBVersionChangeEvent
                );

                caught = reason;
            } )
            .finally( () => done( caught ) );
    } );

    describe( 'storing records', () => {
        it( 'creates a record', done => {
            const originalRecord = Object.assign( {}, recordA );

            records.save( 'set', recordA )
                .then( () => {
                    return store.record.get( instanceIdA );
                } )
                .then( ( record ) => {
                    Object.entries( originalRecord ).forEach( ( [ key, value ] ) => {
                        expect( record[key] ).to.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'updates an autosave draft record with files', done => {
            recordA.files = files.slice();

            records.updateAutoSavedRecord( recordA )
                .then( () => {
                    return records.getAutoSavedRecord();
                } )
                .then( ( record ) => {
                    expect( record.draft ).to.equal( true );
                    expect( record.xml ).to.equal( record.xml );
                    expect( record.files.length ).to.equal( files.length );

                    for ( const [ index, file ] of files.entries() ) {
                        const updated = record.files[index];

                        expect( updated.name ).to.equal( file.name );
                        expect( updated.item ).to.to.be.an.instanceof( Blob );
                    }
                } )
                .then( done, done );
        } );

        it( 'creates a record with the current autosaved record\'s files', done => {
            const autoSavedUpdate = Object.assign( {
                files: files.slice(),
            }, recordA );

            records.updateAutoSavedRecord( autoSavedUpdate )
                .then( () => {
                    return records.save( 'set', recordA );
                } )
                .then( () => {
                    return store.record.get( instanceIdA );
                } )
                .then( ( record ) => {
                    expect( record.files.length ).to.equal( files.length );

                    for ( const [ index, file ] of files.entries() ) {
                        const updated = record.files[index];

                        expect( updated.name ).to.equal( file.name );
                        expect( updated.item ).to.to.be.an.instanceof( Blob );
                    }
                } )
                .then( done, done );
        } );

        it( 'updates a record', done => {
            const update = {
                enketoId,
                instanceId: instanceIdA,
                name: 'name A updated',
                xml: '<model><updated/></model>'
            };
            const payload = Object.assign( {}, update );

            records.save( 'set', recordA )
                .then( () => {
                    return records.save( 'update', payload );
                } )
                .then( () => {
                    return store.record.get( instanceIdA );
                } )
                .then( ( record ) => {
                    Object.entries( update ).forEach( ( [ key, value ] ) => {
                        expect( record[key] ).to.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'creates a last-saved record when creating a record', done => {
            const originalRecord = Object.assign( {}, recordA );

            records.save( 'set', recordA )
                .then( () => {
                    return records.getLastSavedRecord();
                } )
                .then( ( record ) => {
                    Object.entries( originalRecord ).forEach( ( [ key, value ] ) => {
                        if ( key === 'instanceId' ) {
                            expect( record[key] ).to.equal( records.getLastSavedKey() );
                        } else if ( key === 'name' ) {
                            expect( record[key] ).to.match( /^__lastSaved_\d+$/ );
                        } else {
                            expect( record[key] ).to.equal( value );
                        }
                    } );
                } )
                .then( done, done );
        } );

        it( 'replaces a last-saved record when creating a newer record', done => {
            const originalRecord = Object.assign( {}, recordA );

            records.save( 'set', {
                enketoId,
                instanceId: 'b',
                name: 'name B',
                xml: '<model><something>b</something></model>'
            } )
                .then( () => {
                    return records.save( 'set', recordA );
                } )
                .then( () => {
                    return records.getLastSavedRecord();
                } )
                .then( ( record ) => {
                    Object.entries( originalRecord ).forEach( ( [ key, value ] ) => {
                        if ( key === 'instanceId' ) {
                            expect( record[key] ).to.equal( records.getLastSavedKey() );
                        } else if ( key === 'name' ) {
                            expect( record[key] ).to.match( /^__lastSaved_\d+$/ );
                        } else {
                            expect( record[key] ).to.equal( value );
                        }
                    } );
                } )
                .then( done, done );
        } );

        it( 'creates a last-saved record when updating a record', done => {
            const update = {
                enketoId,
                instanceId: instanceIdA,
                name: 'name A updated',
                xml: '<model><updated/></model>'
            };
            const payload = Object.assign( {}, update );

            records.save( 'set', recordA )
                .then( () => {
                    // This would be the condition in cases where a record already
                    // existed before this feature was implemented
                    return store.record.remove( records.getLastSavedKey() );
                } )
                .then( () => {
                    return records.save( 'update', update );
                } )
                .then( () => {
                    return records.getLastSavedRecord();
                } )
                .then( ( record ) => {
                    Object.entries( payload ).forEach( ( [ key, value ] ) => {
                        if ( key === 'instanceId' ) {
                            expect( record[key] ).to.equal( records.getLastSavedKey() );
                        } else if ( key === 'name' ) {
                            expect( record[key] ).to.match( /^__lastSaved_\d+$/ );
                        } else {
                            expect( record[key] ).to.equal( value );
                        }
                    } );
                } )
                .then( done, done );
        } );

        it( 'replaces a last-saved record when updating a record', done => {
            const update = {
                enketoId,
                instanceId: instanceIdA,
                name: 'name A updated',
                xml: '<model><updated/></model>'
            };
            const payload = Object.assign( {}, update );

            records.save( 'set', recordA )
                .then( () => {
                    return records.save( 'update', update );
                } )
                .then( () => {
                    return records.getLastSavedRecord();
                } )
                .then( ( record ) => {
                    Object.entries( payload ).forEach( ( [ key, value ] ) => {
                        if ( key === 'instanceId' ) {
                            expect( record[key] ).to.equal( records.getLastSavedKey() );
                        } else if ( key === 'name' ) {
                            expect( record[key] ).to.match( /^__lastSaved_\d+$/ );
                        } else {
                            expect( record[key] ).to.equal( value );
                        }
                    } );
                } )
                .then( done, done );
        } );

        it( 'creates separate last-saved records for different forms', done => {
            const enketoIdA = enketoId;
            const originalRecordA = Object.assign( {}, recordA );

            /** @type { Record } */
            const recordB = {
                enketoId: enketoIdB,
                instanceId: instanceIdB,
                name: 'name B',
                xml: '<model><something>b</something></model>'
            };

            const originalRecordB = Object.assign( {}, recordB );

            // Create record/last-saved for first form id
            records.save( 'set', recordA )
                // Create autosave record for second form id
                .then( () => {
                    enketoId = enketoIdB;

                    return store.record.set( {
                        instanceId: records.getAutoSavedKey(),
                        enketoId,
                        name: `__autoSave_${Date.now()}`,
                        xml: '<model><autosaved/></model>',
                        files: [],
                    } );
                } )
                // Create record/last-saved for second form id
                .then( () => {
                    return records.save( 'set', recordB );
                } )
                // Get last-saved record for second form id
                .then( () => {
                    return records.getLastSavedRecord();
                } )
                // Validate last-saved record for second form id
                .then( lastSavedB => {
                    Object.entries( originalRecordB ).forEach( ( [ key, value ] ) => {
                        if ( key === 'instanceId' ) {
                            expect( lastSavedB[key] ).to.equal( records.getLastSavedKey() );
                        } else if ( key === 'name' ) {
                            expect( lastSavedB[key] ).to.match( /^__lastSaved_\d+$/ );
                        } else {
                            expect( lastSavedB[key] ).to.equal( value );
                        }
                    } );
                } )
                // Get last-saved record for first form id
                .then( () => {
                    enketoId = enketoIdA;

                    return records.getLastSavedRecord();
                } )
                // Validate last-saved record for first form id has not changed
                .then( lastSavedA => {
                    Object.entries( originalRecordA ).forEach( ( [ key, value ] ) => {
                        if ( key === 'instanceId' ) {
                            expect( lastSavedA[key] ).to.equal( records.getLastSavedKey() );
                        } else if ( key === 'name' ) {
                            expect( lastSavedA[key] ).to.match( /^__lastSaved_\d+$/ );
                        } else {
                            expect( lastSavedA[key] ).to.equal( value );
                        }
                    } );
                } )
                .then( done, done );
        } );

        it( 'gets the record list, excludes the auto-saved/last-saved records', done => {
            const recordB = {
                enketoId,
                instanceId: 'b',
                name: 'name B',
                xml: '<model><something>b</something></model>'
            };

            const autoSavedKey = records.getAutoSavedKey();
            const expectedExcludedKeys = new Set( [
                autoSavedKey,
                records.getLastSavedKey(),
            ] );

            const expectedRecordData = [
                Object.assign( {}, recordA ),
                Object.assign( {}, recordB ),
            ];

            records.save( 'set', recordA )
                .then( () => {
                    return records.save( 'set', recordB );
                } )
                .then( () => {
                    return records.getRecordList();
                } )
                .then( ( records ) => {
                    expect( records.length ).to.equal( expectedRecordData.length );

                    records.forEach( record => {
                        expect( expectedExcludedKeys.has( record.instanceId ) ).to.equal( false );
                    } );

                    expectedRecordData.forEach( ( recordData, index ) => {
                        const record = records[index];

                        Object.entries( recordData ).forEach( ( [ key, value ] ) => {
                            expect( record[key] ).to.equal( value );
                        } );
                    } );
                } )
                .then( done, done );
        } );
    } );
} );
