import settings from '../../public/js/src/module/settings';
import records from '../../public/js/src/module/records-queue';
import store from '../../public/js/src/module/store';

/**
 * @typedef Record { import('./store').Record }
 */

/**
 * While some of this is tested in store.spec.js, this suite tests the additional
 * logic performed in records-queue.js functionality around the client store.
 */
describe( 'Records queue', () => {
    const autoSavedKey = records.getAutoSavedKey();
    const enketoIdA = 'surveyA';
    const enketoIdB = 'surveyB';
    const instanceId = 'recordA';

    /** @type { Record } */
    let record;

    /** @type { File[] } */
    let files;

    beforeEach( done => {
        record = {
            instanceId,
            enketoId: enketoIdA,
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
                enketoId: settings.enketoId,
                name: `__autoSave_${Date.now()}`,
                xml: '<model><autosaved/></model>',
                files: [],
            } );
        } ).then( () => done(), done );
    } );

    afterEach( done => {
        store.flush().then( done, done );
    } );

    describe( 'storing records', () => {
        it( 'creates a record', done => {
            const originalRecord = Object.assign( {}, record );

            records.save( 'set', record )
                .then( () => {
                    return store.record.get( instanceId );
                } )
                .then( ( record ) => {
                    Object.entries( originalRecord ).forEach( ( [ key, value ] ) => {
                        expect( record[key] ).to.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'updates an autosave draft record with files', done => {
            record.files = files.slice();

            records.updateAutoSavedRecord( record )
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
            }, record );

            records.updateAutoSavedRecord( autoSavedUpdate )
                .then( () => {
                    return records.save( 'set', record );
                } )
                .then( () => {
                    return store.record.get( instanceId );
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
                instanceId,
                enketoId: 'surveyAUpdated',
                name: 'name A updated',
                xml: '<model><updated/></model>'
            };
            const payload = Object.assign( {}, update );

            records.save( 'update', payload )
                .then( () => {
                    return store.record.get( instanceId );
                } )
                .then( ( record ) => {
                    Object.entries( update ).forEach( ( [ key, value ] ) => {
                        expect( record[key] ).to.equal( value );
                    } );
                } )
                .then( done, done );
        } );

        it( 'creates a last-saved record when creating a record', done => {
            const originalRecord = Object.assign( {}, record );

            records.save( 'set', record )
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
            const originalRecord = Object.assign( {}, record );

            records.save( 'set', {
                instanceId: 'b',
                enketoId: enketoIdB,
                name: 'name B',
                xml: '<model><something>b</something></model>'
            } )
                .then( () => {
                    return records.save( 'set', record );
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
                instanceId,
                enketoId: 'surveyAUpdated',
                name: 'name A updated',
                xml: '<model><updated/></model>'
            };
            const payload = Object.assign( {}, update );

            records.save( 'set', record )
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
                instanceId,
                enketoId: 'surveyAUpdated',
                name: 'name A updated',
                xml: '<model><updated/></model>'
            };
            const payload = Object.assign( {}, update );

            records.save( 'set', record )
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
    } );
} );
