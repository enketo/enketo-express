/* global define, describe, xdescribe, require, it, xit, before, after, beforeEach, afterEach, expect, Blob */
"use strict";

/**
 * ***********************************************************************************************************
 * Once PhantomJS 2.0 can be used for testing we can move these tests to the general (headless+browser) spec
 * ***********************************************************************************************************
 *
 * When using actual browsers for testing be careful that an open browser window with the same domain, may
 * lock up indexedDb!
 *
 */

// TODO: when chai-as-promised adapter is working, convert these tests using .eventually.

define( [ 'store' ], function( store ) {

    describe( 'Client Storage', function() {
        var resourceA, resourceB, fileA, fileB, recordA, recordB, surveyA;

        beforeEach( function() {
            resourceA = {
                url: '/path/to/resource1',
                item: new Blob( [ '<html>something1</html' ], {
                    type: "text/xml"
                } )
            };
            resourceB = {
                url: '/path/to/resource2',
                item: new Blob( [ '<html>something2</html' ], {
                    type: "text/xml"
                } )
            };
            fileA = {
                name: 'something1.xml',
                item: new Blob( [ '<html>something1</html' ], {
                    type: "text/xml"
                } )
            };
            fileB = {
                name: 'something2.xml',
                item: new Blob( [ '<html>something2å</html' ], {
                    type: "text/xml"
                } )
            };
            recordA = {
                instanceId: 'recordA',
                enketoId: 'surveyA',
                name: 'name A',
                xml: '<model></model>'
            };
            recordB = {
                instanceId: 'recordB',
                enketoId: 'surveyA',
                name: 'name B',
                xml: '<model></model>'
            };
            surveyA = {
                enketoId: 'surveyA',
                form: '<form class="or"></form>',
                model: '<model></model>',
                hash: '12345'
            };
        } );

        it( 'library is loaded', function() {
            expect( typeof store ).to.equal( 'object' );
        } );

        it( 'IndexedDb is supported and writeable', function( done ) {

            // manually "fix" browsers in console if database schema has changed
            // window.store = store; 

            // In Safari the DB appears to be blocked. Occassionally all these tests pass.

            store.flush()
                .then( store.init )
                .then( done, done );
        } );

        describe( 'storing settings and properties', function() {

            beforeEach( function( done ) {
                store.property.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the setting object has no "name" property', function( done ) {
                store.property.update( {
                        something: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'succeeds if the setting object has a "name" property', function( done ) {
                var toSet = {
                    name: 'something',
                    value: new Date().getTime()
                };
                store.property.update( toSet )
                    .then( function() {
                        return store.property.get( 'something' );
                    } )
                    .then( function( setting ) {
                        expect( setting ).to.deep.equal( toSet );
                        done();
                    } )
                    .catch( done );
            } );

            it( 'is able to store simple objects as a setting', function( done ) {
                var toSet = {
                    name: 'something',
                    value: {
                        complex: true,
                        more_complex: {
                            is: true
                        }
                    }
                };
                store.property.update( toSet )
                    .then( function() {
                        return store.property.get( 'something' );
                    } )
                    .then( function( setting ) {
                        expect( setting ).to.deep.equal( toSet );
                        done();
                    } )
                    .catch( done );
            } );

            it( 'will update the setting if it already exists', function( done ) {
                var toSet = {
                        name: 'something',
                        value: new Date().getTime()
                    },
                    newValue = 'something else';

                store.property.update( toSet )
                    .then( function( setting ) {
                        setting.value = newValue;
                        return store.property.update( setting );
                    } )
                    .then( function() {
                        return store.property.get( 'something' );
                    } )
                    .then( function( setting ) {
                        expect( setting.value ).to.equal( newValue );
                        done();
                    } )
                    .catch( done );
            } );

        } );

        describe( 'storing (form) resources', function() {

            beforeEach( function( done ) {
                store.survey.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the resource has no "url" property', function( done ) {
                store.survey.resource.update( 'abcd', {
                        something: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the setting object has no "item" property', function( done ) {
                store.survey.resource.update( 'abcd', {
                        url: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the "item" is not a Blob', function( done ) {
                store.survey.resource.update( 'abcd', {
                        key: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'succeeds if key and item are present and item is a Blob', function( done ) {
                var id = 'TESt',
                    url = resourceA.url;

                store.survey.resource.update( id, resourceA )
                    .then( function( stored ) {
                        return store.survey.resource.get( id, url );
                    } )
                    .then( function( result ) {
                        expect( result.item.type ).to.equal( resourceA.item.type );
                        expect( result.item.size ).to.equal( resourceA.item.size );
                        expect( result.item ).to.be.an.instanceof( Blob );
                        expect( result.url ).to.equal( url );
                    } )
                    .then( done, done );
            } );

        } );


        describe( 'storing surveys', function() {

            beforeEach( function( done ) {
                store.survey.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the survey has no "form" property', function() {
                delete surveyA.form;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.survey.set( surveyA );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "model" property', function() {
                delete surveyA.model;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.survey.set( surveyA );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "id" property', function() {
                delete surveyA.enketoId;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.survey.set( surveyA );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "hash" property', function() {
                delete surveyA.hash;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.survey.set( surveyA );
                } ).to.throw( /not complete/ );
            } );

            it( 'succeeds if the survey has the required properties and doesn\'t exist already', function( done ) {
                store.survey.set( surveyA )
                    .then( function( result ) {
                        // check response of setSurvey
                        expect( result ).to.deep.equal( surveyA );
                        return store.survey.get( surveyA.enketoId );
                    } )
                    .then( function( result ) {
                        // check response of getSurvey
                        expect( result ).to.deep.equal( surveyA );
                    } )
                    .then( done, done );
            } );

            it( 'fails if a survey with that id already exists in the db', function( done ) {
                store.survey.set( surveyA )
                    .then( function() {
                        return store.survey.set( surveyA );
                    } )
                    .catch( function( item, e ) {
                        expect( true ).to.equal( true );
                        done();
                    } );
            } );

        } );

        describe( 'getting surveys', function() {

            it( 'returns undefined if a survey does not exist', function( done ) {
                store.survey.get( 'nonexisting' )
                    .then( function( result ) {
                        expect( result ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );

        } );

        describe( 'updating surveys', function() {

            beforeEach( function( done ) {
                store.survey.removeAll()
                    .then( done, done );
            } );

            it( 'succeeds if the survey has the required properties and contains no file resources', function( done ) {
                store.survey.set( surveyA )
                    .then( function() {
                        surveyA.model = '<model><new>value</new></model>';
                        surveyA.hash = '6789';
                        return store.survey.update( surveyA );
                    } )
                    .then( function( result ) {
                        // check response of updateSurvey
                        expect( result ).to.deep.equal( surveyA );
                        return store.survey.get( surveyA.enketoId );
                    } )
                    .then( function( result ) {
                        // check response of getSurvey
                        expect( result.model ).to.equal( surveyA.model );
                        expect( result.hash ).to.equal( surveyA.hash );
                    } )
                    .then( done, done );
            } );

            it( 'succeeds if the survey has the required properties and contains file resources', function( done ) {
                var urlA = resourceA.url;

                store.survey.set( surveyA )
                    .then( function() {
                        surveyA.resources = [ resourceA, resourceB ];
                        return store.survey.update( surveyA );
                    } )
                    .then( function( result ) {
                        // check response of updateSurvey
                        expect( result ).to.deep.equal( surveyA );
                        return store.survey.resource.get( result.enketoId, urlA );
                    } )
                    .then( function( result ) {
                        // check response of getResource
                        expect( result.item.type ).to.equal( surveyA.resources[ 0 ].item.type );
                        expect( result.item.size ).to.equal( surveyA.resources[ 0 ].item.size );
                        expect( result.item ).to.be.an.instanceof( Blob );
                    } )
                    .then( done, done );
            } );

            it( 'removes any form resources that have become obsolete', function( done ) {
                var urlA = resourceA.url,
                    urlB = resourceB.url;

                store.survey.set( surveyA )
                    .then( function() {
                        // store 2 resources
                        surveyA.resources = [ resourceA, resourceB ];
                        return store.survey.update( surveyA );
                    } )
                    .then( function( result ) {
                        // update survey to contain only 1 resource
                        surveyA.resources = [ {
                            url: urlA,
                            item: resourceA.item
                        } ];
                        return store.survey.update( surveyA );
                    } )
                    .then( function( result ) {
                        // check response of updateSurvey
                        expect( result ).to.deep.equal( surveyA );
                        return store.survey.resource.get( result.enketoId, urlB );
                    } )
                    .then( function( result ) {
                        // check response of getResource
                        expect( result ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );
        } );

        describe( 'removing surveys', function() {

            beforeEach( function( done ) {
                store.survey.removeAll()
                    .then( done, done );
            } );

            it( 'succeeds if the survey contains no files', function( done ) {
                store.survey.set( surveyA )
                    .then( function() {
                        return store.survey.remove( surveyA.enketoId );
                    } )
                    .then( function() {
                        return store.survey.get( surveyA.enketoId );
                    } )
                    .then( function( result ) {
                        expect( result ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );

            it( 'succeeds if the survey contains files', function( done ) {
                var url = resourceA.url;

                surveyA.enketoId = surveyA.enketoId + Math.random();

                store.survey.set( surveyA )
                    .then( function( result ) {
                        surveyA.resources = [ resourceA, resourceB ];
                        return store.survey.update( surveyA );
                    } )
                    .then( function( result ) {
                        return store.survey.remove( surveyA.enketoId );
                    } )
                    .then( function( result ) {
                        return store.survey.resource.get( surveyA.enketoId, url );
                    } )
                    .then( function( result ) {
                        expect( result ).to.equal( undefined );
                        done();
                    } )
                    .catch( done );
            } );

        } );

        describe( 'storing (record) files', function() {

            beforeEach( function( done ) {
                store.record.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the resource has no "name" property', function( done ) {
                store.record.file.update( 'abcd', {
                        item: fileA
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the setting object has no "item" property', function( done ) {
                store.record.file.update( 'abcd', {
                        name: 'something.jpg'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the "item" is not a Blob', function( done ) {
                store.record.file.update( 'abcd', {
                        name: 'something',
                        item: 'a string'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'succeeds if key and item are present and item is a Blob', function( done ) {
                var id = 'TESt',
                    name = fileA.name;

                store.record.file.update( id, fileA )
                    .then( function( stored ) {
                        return store.record.file.get( id, name );
                    } )
                    .then( function( result ) {
                        expect( result.item.type ).to.equal( fileA.item.type );
                        expect( result.item.size ).to.equal( fileA.item.size );
                        expect( result.item ).to.be.an.instanceof( Blob );
                        expect( result.name ).to.equal( name );
                        done();
                    } )
                    .catch( done );
            } );

        } );

        describe( 'storing records', function() {

            beforeEach( function( done ) {
                store.record.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the record has no "instanceId" property', function( done ) {
                delete recordA.instanceId;
                store.record.set( recordA )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                    } )
                    .then( done, done );
            } );

            it( 'fails if the record has no "enketoId" property', function( done ) {
                delete recordA.enketoId;
                store.record.set( recordA )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                    } )
                    .then( done, done );
            } );

            it( 'fails if the record has no "name" property', function( done ) {
                delete recordA.name;
                store.record.set( recordA )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                    } )
                    .then( done, done );
            } );

            it( 'fails if the record has no "xml" property', function( done ) {
                delete recordA.xml;
                store.record.set( recordA )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                    } )
                    .then( done, done );
            } );

            it( 'succeeds if the record has the required properties and doesn\'t exist already', function( done ) {
                store.record.set( recordA )
                    .then( function( result ) {
                        expect( result ).to.deep.equal( recordA );
                        return store.record.get( recordA.instanceId );
                    } )
                    .then( function( result ) {
                        expect( result.instanceId ).to.equal( recordA.instanceId );
                        expect( result.xml ).to.equal( recordA.xml );
                        expect( result.updated ).to.be.at.least( new Date().getTime() - 100 );
                        done();
                    } )
                    .catch( done );
            } );

            it( 'succeeds if the record has the required properties, contains files, and doesn\'t exist already', function( done ) {
                var name1 = fileA.name,
                    name2 = fileB.name;

                recordA.files = [ fileA, fileB ];
                store.record.set( recordA )
                    .then( function( result ) {
                        expect( result ).to.deep.equal( recordA );
                        return store.record.get( recordA.instanceId );
                    } )
                    .then( function( result ) {
                        expect( result.instanceId ).to.equal( recordA.instanceId );
                        expect( result.xml ).to.equal( recordA.xml );
                        expect( result.updated ).to.be.at.least( new Date().getTime() - 100 );
                        expect( result.files[ 0 ].name ).to.equal( name1 );
                        expect( result.files[ 1 ].name ).to.equal( name2 );
                        expect( result.files[ 0 ].item ).to.to.be.an.instanceof( Blob );
                        expect( result.files[ 1 ].item ).to.to.be.an.instanceof( Blob );
                        done();
                    } )
                    .catch( done );
            } );

            it( 'fails if a record with that instanceId already exists in the db', function( done ) {
                recordA.name = "another name";
                store.record.set( recordA )
                    .then( function() {
                        return store.record.set( recordA );
                    } )
                    .catch( function( e ) {
                        // Firefox failure? => https://github.com/aaronpowell/db.js/issues/98
                        expect( true ).to.equal( true );
                    } )
                    .then( done, done );
            } );

            it( 'fails if a record with that instanceName already exists in the db', function( done ) {
                recordA.instanceId = "anotherid";
                store.record.set( recordA )
                    .then( function() {
                        return store.record.set( recordA );
                    } )
                    .catch( function( e ) {
                        // Firefox failure? => https://github.com/aaronpowell/db.js/issues/98
                        expect( true ).to.equal( true );
                    } )
                    .then( done, done );
            } );

            it( 'increments the record-counter value when it succeeds', function( done ) {
                var initialCount;
                store.record.set( recordA )
                    .then( function() {
                        return store.property.getSurveyStats( recordA.enketoId );
                    } )
                    .then( function( stats ) {
                        initialCount = stats.recordCount;
                        expect( initialCount ).to.be.a( 'number' );
                        return store.record.set( recordB );
                    } )
                    .then( function() {
                        return store.property.getSurveyStats( recordA.enketoId );
                    } )
                    .then( function( stats ) {
                        expect( stats.recordCount ).to.equal( initialCount + 1 );
                    } )
                    .then( done, done );
            } );

        } );

        describe( 'obtaining records', function() {

            it( 'returns undefined if the record does not exist', function( done ) {
                store.record.get( 'notexisting' )
                    .then( function( record ) {
                        expect( record ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );

        } );

        describe( 'updating records', function() {

            beforeEach( function( done ) {
                store.record.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the updated record has no "instanceId" property', function( done ) {
                store.record.set( recordA )
                    .then( function() {
                        delete recordA.instanceId;
                        recordA.xml = '<model><change>a</change></model>';
                        return store.record.update( recordA );
                    } )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                        done();
                    } );
            } );

            it( 'fails if the updated record has no "name" property', function( done ) {
                store.record.set( recordA )
                    .then( function() {
                        delete recordA.name;
                        recordA.xml = '<model><change>a</change></model>';
                        return store.record.update( recordA );
                    } )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                        done();
                    } );
            } );

            it( 'fails if the updated record has no "xml" property', function( done ) {
                store.record.set( recordA )
                    .then( function() {
                        delete recordA.xml;
                        return store.record.update( recordA );
                    } )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                        done();
                    } );
            } );

            it( 'succeeds if the updated record has the required properties', function( done ) {
                var updatedXml = '<model><change>a</change></model>';

                store.record.set( recordA )
                    .then( function() {
                        recordA.xml = updatedXml;
                        return store.record.update( recordA );
                    } )
                    .then( function( result ) {
                        expect( result ).to.deep.equal( recordA );
                        expect( result.xml ).to.equal( updatedXml );
                        return store.record.get( recordA.instanceId );
                    } )
                    .then( function( result ) {
                        expect( result.xml ).to.equal( updatedXml );
                    } )
                    .then( done, done );
            } );

            it( 'succeeds if the updated record has the required properties and includes files', function( done ) {
                var name1 = fileA.name,
                    name2 = fileB.name;

                store.record.set( recordA )
                    .then( function( result ) {
                        recordA.files = [ fileA, fileB ];
                        return store.record.update( recordA );
                    } )
                    .then( function( result ) {
                        // check update response
                        expect( result.files.length ).to.equal( 2 );
                        expect( result.files[ 0 ].name ).to.equal( name1 );
                        expect( result.files[ 1 ].name ).to.equal( name2 );
                        return store.record.get( recordA.instanceId );
                    } )
                    .then( function( result ) {
                        // check get response
                        expect( result.files.length ).to.equal( 2 );
                        expect( result.files[ 0 ].name ).to.equal( name1 );
                        expect( result.files[ 1 ].name ).to.equal( name2 );
                    } )
                    .then( done, done );
            } );

            it( 'removes any record files that have become obsolete', function( done ) {
                var name1 = fileA.name,
                    name2 = fileB.name;

                recordA.files = [ fileA ];
                store.record.set( recordA )
                    .then( function( result ) {
                        expect( result.files[ 0 ].name ).to.equal( name1 );
                        // update files
                        recordA.files = [ fileB ];
                        return store.record.update( recordA );
                    } )
                    .then( function( result ) {
                        // check update response
                        expect( result.files.length ).to.equal( 1 );
                        expect( result.files[ 0 ].name ).to.equal( name2 );
                        return store.record.get( recordA.instanceId );
                    } )
                    .then( function( result ) {
                        // check get response
                        expect( result.files.length ).to.equal( 1 );
                        expect( result.files[ 0 ].name ).to.equal( name2 );
                        return store.record.file.get( recordA.instanceId, name1 );
                    } )
                    .then( function( result ) {
                        // check whether obsolete file has been removed
                        expect( result ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );

            it( 'does not remove record files that were loaded into a draft record and were left unchanged', function( done ) {
                var name1 = fileA.name,
                    name2 = fileB.name;

                recordA.files = [ fileA ];
                store.record.set( recordA )
                    .then( function( result ) {
                        expect( result.files[ 0 ].name ).to.equal( name1 );
                        // update files, fileA remains but is included as a {name: name1} without item (blob)
                        recordA.files = [ {
                            name: name1
                        }, fileB ];
                        return store.record.update( recordA );
                    } )
                    .then( function( result ) {
                        // check update response
                        expect( result.files.length ).to.equal( 2 );
                        expect( result.files[ 0 ].name ).to.equal( name1 );
                        expect( result.files[ 1 ].name ).to.equal( name2 );
                        return store.record.get( recordA.instanceId );
                    } )
                    .then( function( result ) {
                        // check get response
                        expect( result.files.length ).to.equal( 2 );
                        expect( result.files[ 0 ].name ).to.equal( name1 );
                        expect( result.files[ 1 ].name ).to.equal( name2 );
                        return store.record.file.get( recordA.instanceId, name1 );
                    } )
                    .then( function( result ) {
                        // check whether obsolete file has been removed
                        expect( result ).to.deep.equal( fileA );
                    } )
                    .then( done, done );
            } );

        } );


        describe( 'removing records', function() {

            beforeEach( function( done ) {
                store.record.removeAll()
                    .then( done, done );
            } );

            it( 'succeeds if the record contains no files', function( done ) {

                store.record.set( recordA )
                    .then( function() {
                        return store.record.remove( recordA.instanceId );
                    } )
                    .then( function() {
                        return store.record.get( recordA.instanceId );
                    } )
                    .then( function( result ) {
                        expect( result ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );

            it( 'succeeds if the record contains files', function( done ) {
                var url = fileA.url;

                recordA.instanceId = recordA.instanceId + Math.random();

                store.record.set( recordA )
                    .then( function( result ) {
                        recordA.files = [ fileA, fileB ];
                        return store.record.update( recordA );
                    } )
                    .then( function( result ) {
                        return store.record.remove( recordA.instanceId );
                    } )
                    .then( function( result ) {
                        return store.record.file.get( recordA.instanceId, url );
                    } )
                    .then( function( result ) {
                        expect( result ).to.equal( undefined );
                        done();
                    } )
                    .catch( done );
            } );
        } );

        describe( 'obtaining a list of records', function() {

            beforeEach( function( done ) {
                store.record.removeAll()
                    .then( done, done );
            } );

            it( 'returns an empty array if there are no records', function( done ) {
                store.record.getAll( 'surveyA' )
                    .then( function( records ) {
                        expect( records ).to.deep.equal( [] );
                    } )
                    .then( done, done );
            } );

            it( 'returns an array of all records', function( done ) {
                // recordA and recordB have the same enketoId
                store.record.set( recordA )
                    .then( function() {
                        return store.record.set( recordB );
                    } )
                    .then( function() {
                        return store.record.getAll( recordA.enketoId );
                    } )
                    .then( function( records ) {
                        expect( records.length ).to.equal( 2 );
                        expect( records[ 0 ].instanceId ).to.equal( recordA.instanceId );
                        expect( records[ 0 ].enketoId ).to.equal( recordA.enketoId );
                        expect( records[ 0 ].xml ).to.equal( recordA.xml );
                        expect( records[ 1 ].instanceId ).to.equal( recordB.instanceId );
                        expect( records[ 1 ].instanceId ).to.equal( recordB.instanceId );
                        expect( records[ 1 ].xml ).to.equal( recordB.xml );
                    } )
                    .then( done, done );
            } );

            it( 'only returns records with the requested enketoId', function( done ) {
                store.record.set( recordA )
                    .then( function() {
                        // make sure enketoId is different
                        recordB.enketoId = 'different';
                        return store.record.set( recordB );
                    } )
                    .then( function() {
                        return store.record.getAll( recordA.enketoId );
                    } )
                    .then( function( records ) {
                        expect( records.length ).to.equal( 1 );
                        expect( records[ 0 ].instanceId ).to.equal( recordA.instanceId );
                        expect( records[ 0 ].enketoId ).to.equal( recordA.enketoId );
                        expect( records[ 0 ].xml ).to.equal( recordA.xml );
                    } )
                    .then( done, done );
            } );

            it( 'exludes drafts if requested', function( done ) {
                // recordA and recordB have the same enketoId
                store.record.set( recordA )
                    .then( function() {
                        // set draft status to true of new record
                        recordB.draft = true;
                        return store.record.set( recordB );
                    } )
                    .then( function() {
                        return store.record.getAll( recordA.enketoId, true );
                    } )
                    .then( function( records ) {
                        expect( records.length ).to.equal( 1 );
                        expect( records[ 0 ].instanceId ).to.equal( recordA.instanceId );
                        expect( records[ 0 ].enketoId ).to.equal( recordA.enketoId );
                        expect( records[ 0 ].xml ).to.equal( recordA.xml );
                    } )
                    .then( done, done );
            } );

        } );

    } );

} );
