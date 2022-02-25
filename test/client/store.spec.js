/**
 * @module store.spec.js
 * @description Tests client-side data storage logic
 * @see {SurveyEncryptionSpec}
 */

// TODO: when chai-as-promised adapter is working, convert these tests using .eventually.

import db from 'db.js';
import store from '../../public/js/src/module/store';

/**
 * @typedef {import('./feature/survey-encryption.spec.js')} SurveyEncryptionSpec
 */

/**
 * @typedef {import('../../app/models/survey-model').SurveyObject} Survey
 */

describe('Client Storage', () => {
    let resourceA;
    let resourceB;
    let fileA;
    let fileB;
    let recordA;
    let recordB;

    /** @type {Survey} */
    let surveyA;

    before((done) => {
        store.init().then(() => done());
    });

    beforeEach(() => {
        resourceA = {
            url: '/path/to/resource1',
            item: new Blob(['<html>something1</html'], {
                type: 'text/xml',
            }),
        };
        resourceB = {
            url: '/path/to/resource2',
            item: new Blob(['<html>something2</html'], {
                type: 'text/xml',
            }),
        };
        fileA = {
            name: 'something1.xml',
            item: new Blob(['<html>something1</html'], {
                type: 'text/xml',
            }),
        };
        fileB = {
            name: 'something2.xml',
            item: new Blob(['<html>something2</html'], {
                type: 'text/xml',
            }),
        };
        recordA = {
            instanceId: 'recordA',
            enketoId: 'surveyA',
            name: 'name A',
            xml: '<model></model>',
        };
        recordB = {
            instanceId: 'recordB',
            enketoId: 'surveyA',
            name: 'name B',
            xml: '<model></model>',
        };
        surveyA = {
            enketoId: 'surveyA',
            form: '<form class="or"></form>',
            model: '<model></model>',
            hash: '12345',
        };
    });

    it('library is loaded', () => {
        expect(typeof store).to.equal('object');
    });

    describe('storing settings and properties', () => {
        afterEach((done) => {
            store.property.removeAll().then(done, done);
        });

        it('fails if the setting object has no "name" property', (done) => {
            store.property
                .update({
                    something: 'something',
                })
                .catch((e) => {
                    expect(e.name).to.equal('DataError');
                    done();
                });
        });

        it('succeeds if the setting object has a "name" property', (done) => {
            const toSet = {
                name: 'something',
                value: new Date().getTime(),
            };
            store.property
                .update(toSet)
                .then(() => store.property.get('something'))
                .then((setting) => {
                    expect(setting).to.deep.equal(toSet);
                    done();
                })
                .catch(done);
        });

        it('is able to store simple objects as a setting', (done) => {
            const toSet = {
                name: 'something',
                value: {
                    complex: true,
                    more_complex: {
                        is: true,
                    },
                },
            };
            store.property
                .update(toSet)
                .then(() => store.property.get('something'))
                .then((setting) => {
                    expect(setting).to.deep.equal(toSet);
                    done();
                })
                .catch(done);
        });

        it('will update the setting if it already exists', (done) => {
            const toSet = {
                name: 'something',
                value: new Date().getTime(),
            };
            const newValue = 'something else';

            store.property
                .update(toSet)
                .then((setting) => {
                    setting.value = newValue;
                    return store.property.update(setting);
                })
                .then(() => store.property.get('something'))
                .then((setting) => {
                    expect(setting.value).to.equal(newValue);
                    done();
                })
                .catch(done);
        });
    });

    describe('storing (form) resources', () => {
        afterEach((done) => {
            store.survey.removeAll().then(done, done);
        });

        it('fails if the resource has no "url" property', (done) => {
            store.survey.resource
                .update('abcd', {
                    something: 'something',
                })
                .catch((e) => {
                    expect(e.name).to.equal('DataError');
                    done();
                });
        });

        it('fails if the setting object has no "item" property', (done) => {
            store.survey.resource
                .update('abcd', {
                    url: 'something',
                })
                .catch((e) => {
                    expect(e.name).to.equal('DataError');
                    done();
                });
        });

        it('fails if the "item" is not a Blob', (done) => {
            store.survey.resource
                .update('abcd', {
                    key: 'something',
                })
                .catch((e) => {
                    expect(e.name).to.equal('DataError');
                    done();
                });
        });

        it('succeeds if key and item are present and item is a Blob', (done) => {
            const id = 'TESt';
            const { type } = resourceA.item;
            const { size } = resourceA.item;
            const { url } = resourceA;

            store.survey.resource
                .update(id, resourceA)
                .then(() => store.survey.resource.get(id, url))
                .then((result) => {
                    expect(result.item.type).to.equal(type);
                    expect(result.item.size).to.equal(size);
                    expect(result.item).to.be.an.instanceof(Blob);
                    expect(result.url).to.equal(url);
                })
                .then(done, done);
        });
    });

    describe('storing surveys', () => {
        afterEach((done) => {
            store.survey.removeAll().then(done, done);
        });

        it('fails if the survey has no "form" property', () => {
            delete surveyA.form;
            // note: the throw assert works here because the error is thrown before in sync part of function
            expect(() => {
                store.survey.set(surveyA);
            }).to.throw(/not complete/);
        });

        it('fails if the survey has no "model" property', () => {
            delete surveyA.model;
            // note: the throw assert works here because the error is thrown before in sync part of function
            expect(() => {
                store.survey.set(surveyA);
            }).to.throw(/not complete/);
        });

        it('fails if the survey has no "id" property', () => {
            delete surveyA.enketoId;
            // note: the throw assert works here because the error is thrown before in sync part of function
            expect(() => {
                store.survey.set(surveyA);
            }).to.throw(/not complete/);
        });

        it('fails if the survey has no "hash" property', () => {
            delete surveyA.hash;
            // note: the throw assert works here because the error is thrown before in sync part of function
            expect(() => {
                store.survey.set(surveyA);
            }).to.throw(/not complete/);
        });

        it("succeeds if the survey has the required properties and doesn't exist already", (done) => {
            store.survey
                .set(surveyA)
                .then((result) => {
                    // check response of setSurvey
                    expect(result).to.deep.equal(surveyA);
                    return store.survey.get(surveyA.enketoId);
                })
                .then((result) => {
                    // check response of getSurvey
                    expect(result).to.deep.equal(surveyA);
                })
                .then(done, done);
        });

        it('fails if a survey with that id already exists in the db', (done) => {
            store.survey
                .set(surveyA)
                .then(() => store.survey.set(surveyA))
                .catch(() => {
                    expect(true).to.equal(true);
                    done();
                });
        });
    });

    describe('getting surveys', () => {
        afterEach((done) => {
            store.survey.removeAll().then(done, done);
        });

        it('returns undefined if a survey does not exist', (done) => {
            store.survey
                .get('nonexisting')
                .then((result) => {
                    expect(result).to.equal(undefined);
                })
                .then(done, done);
        });
    });

    describe('updating surveys', () => {
        afterEach((done) => {
            store.survey.removeAll().then(done, done);
        });

        it('succeeds if the survey has the required properties and contains no file resources', (done) => {
            store.survey
                .set(surveyA)
                .then(() => {
                    surveyA.model = '<model><new>value</new></model>';
                    surveyA.hash = '6789';
                    return store.survey.update(surveyA);
                })
                .then((result) => {
                    // check response of updateSurvey
                    expect(result).to.deep.equal(surveyA);
                    return store.survey.get(surveyA.enketoId);
                })
                .then((result) => {
                    // check response of getSurvey
                    expect(result.model).to.equal(surveyA.model);
                    expect(result.hash).to.equal(surveyA.hash);
                })
                .then(done, done);
        });

        it('succeeds if the survey has the required properties and contains file resources', (done) => {
            const urlA = resourceA.url;
            const { type } = resourceA.item;
            const { size } = resourceA.item;

            store.survey
                .set(surveyA)
                .then(() => {
                    surveyA.resources = [resourceA, resourceB];
                    return store.survey.update(surveyA);
                })
                .then((result) => {
                    // check response of updateSurvey
                    expect(result).to.deep.equal(surveyA);
                    return store.survey.resource.get(result.enketoId, urlA);
                })
                .then((result) => {
                    // check response of getResource
                    expect(result.item.type).to.equal(type);
                    expect(result.item.size).to.equal(size);
                    expect(result.item).to.be.an.instanceof(Blob);
                })
                .then(done, done);
        });

        it('removes any form resources that have become obsolete', (done) => {
            const urlA = resourceA.url;
            const urlB = resourceB.url;
            const itemA = new Blob([resourceA.item], {
                type: resourceA.type,
            });

            store.survey
                .set(surveyA)
                .then(() => {
                    // store 2 resources
                    surveyA.resources = [resourceA, resourceB];
                    return store.survey.update(surveyA);
                })
                .then(() => {
                    // update survey to contain only 1 resource
                    surveyA.resources = [
                        {
                            url: urlA,
                            item: itemA,
                        },
                    ];
                    return store.survey.update(surveyA);
                })
                .then((result) => {
                    // check response of updateSurvey
                    expect(result).to.deep.equal(surveyA);
                    return store.survey.resource.get(result.enketoId, urlB);
                })
                .then((result) => {
                    // check response of getResource
                    expect(result).to.equal(undefined);
                })
                .then(done, done);
        });
    });

    describe('removing surveys', () => {
        afterEach((done) => {
            store.survey.removeAll().then(done, done);
        });

        it('succeeds if the survey contains no files', (done) => {
            store.survey
                .set(surveyA)
                .then(() => store.survey.remove(surveyA.enketoId))
                .then(() => store.survey.get(surveyA.enketoId))
                .then((result) => {
                    expect(result).to.equal(undefined);
                })
                .then(done, done);
        });

        it('succeeds if the survey contains files', (done) => {
            const { url } = resourceA;

            surveyA.enketoId += Math.random();

            store.survey
                .set(surveyA)
                .then(() => {
                    surveyA.resources = [resourceA, resourceB];
                    return store.survey.update(surveyA);
                })
                .then(() => store.survey.remove(surveyA.enketoId))
                .then(() => store.survey.resource.get(surveyA.enketoId, url))
                .then((result) => {
                    expect(result).to.equal(undefined);
                    done();
                })
                .catch(done);
        });
    });

    describe('storing (record) files', () => {
        afterEach((done) => {
            store.record.removeAll().then(done, done);
        });

        it('fails if the resource has no "name" property', (done) => {
            store.record.file
                .update('abcd', {
                    item: fileA,
                })
                .catch((e) => {
                    expect(e.name).to.equal('DataError');
                    done();
                });
        });

        it('fails if the setting object has no "item" property', (done) => {
            store.record.file
                .update('abcd', {
                    name: 'something.jpg',
                })
                .catch((e) => {
                    expect(e.name).to.equal('DataError');
                    done();
                });
        });

        it('fails if the "item" is not a Blob', (done) => {
            store.record.file
                .update('abcd', {
                    name: 'something',
                    item: 'a string',
                })
                .catch((e) => {
                    expect(e.name).to.equal('DataError');
                    done();
                });
        });

        it('succeeds if key and item are present and item is a Blob', (done) => {
            const id = 'TESt';
            const { type } = fileA.item;
            const { size } = fileA.item;
            const { name } = fileA;

            store.record.file
                .update(id, fileA)
                .then(() => store.record.file.get(id, name))
                .then((result) => {
                    expect(result.item.type).to.equal(type);
                    expect(result.item.size).to.equal(size);
                    expect(result.item).to.be.an.instanceof(Blob);
                    expect(result.name).to.equal(name);
                    done();
                })
                .catch(done);
        });
    });

    describe('storing records', () => {
        afterEach((done) => {
            store.record.removeAll().then(done, done);
        });

        it('fails if the record has no "instanceId" property', (done) => {
            delete recordA.instanceId;
            store.record
                .set(recordA)
                .catch((e) => {
                    expect(e.message).to.contain('not complete');
                })
                .then(done, done);
        });

        it('fails if the record has no "enketoId" property', (done) => {
            delete recordA.enketoId;
            store.record
                .set(recordA)
                .catch((e) => {
                    expect(e.message).to.contain('not complete');
                })
                .then(done, done);
        });

        it('fails if the record has no "name" property', (done) => {
            delete recordA.name;
            store.record
                .set(recordA)
                .catch((e) => {
                    expect(e.message).to.contain('not complete');
                })
                .then(done, done);
        });

        it('fails if the record has no "xml" property', (done) => {
            delete recordA.xml;
            store.record
                .set(recordA)
                .catch((e) => {
                    expect(e.message).to.contain('not complete');
                })
                .then(done, done);
        });

        it("succeeds if the record has the required properties and doesn't exist already", (done) => {
            const startTimestamp = new Date().getTime();

            store.record
                .set(recordA)
                .then((result) => {
                    expect(result).to.deep.equal(recordA);
                    return store.record.get(recordA.instanceId);
                })
                .then((result) => {
                    expect(result.instanceId).to.equal(recordA.instanceId);
                    expect(result.xml).to.equal(recordA.xml);
                    expect(result.created).to.be.at.least(startTimestamp);
                    expect(result.updated).to.be.at.least(startTimestamp);
                    done();
                })
                .catch(done);
        });

        it("succeeds if the record has the required properties, contains files, and doesn't exist already", (done) => {
            const name1 = fileA.name;
            const name2 = fileB.name;
            const startTimestamp = new Date().getTime();

            recordA.files = [fileA, fileB];
            store.record
                .set(recordA)
                .then((result) => {
                    expect(result).to.deep.equal(recordA);
                    return store.record.get(recordA.instanceId);
                })
                .then((result) => {
                    expect(result.instanceId).to.equal(recordA.instanceId);
                    expect(result.xml).to.equal(recordA.xml);
                    expect(result.updated).to.be.at.least(startTimestamp);
                    expect(result.files[0].name).to.equal(name1);
                    expect(result.files[1].name).to.equal(name2);
                    expect(result.files[0].item).to.to.be.an.instanceof(Blob);
                    expect(result.files[1].item).to.to.be.an.instanceof(Blob);
                    done();
                })
                .catch(done);
        });

        it('fails if a record with that instanceId already exists in the db', (done) => {
            recordA.name = 'another name';
            store.record
                .set(recordA)
                .then(() => store.record.set(recordA))
                .catch(() => {
                    // Firefox failure? => https://github.com/aaronpowell/db.js/issues/98
                    expect(true).to.equal(true);
                })
                .then(done, done);
        });

        it('fails if a record with that instanceName already exists in the db', (done) => {
            recordA.instanceId = 'anotherid';
            store.record
                .set(recordA)
                .then(() => store.record.set(recordA))
                .catch(() => {
                    // Firefox failure? => https://github.com/aaronpowell/db.js/issues/98
                    expect(true).to.equal(true);
                })
                .then(done, done);
        });

        it('increments the record-counter value when it succeeds', (done) => {
            let initialCount;
            store.record
                .set(recordA)
                .then(() => store.property.getSurveyStats(recordA.enketoId))
                .then((stats) => {
                    initialCount = stats.recordCount;
                    expect(initialCount).to.be.a('number');
                    return store.record.set(recordB);
                })
                .then(() => store.property.getSurveyStats(recordA.enketoId))
                .then((stats) => {
                    expect(stats.recordCount).to.equal(initialCount + 1);
                })
                .then(done, done);
        });
    });

    describe('obtaining records', () => {
        it('returns undefined if the record does not exist', (done) => {
            store.record
                .get('notexisting')
                .then((record) => {
                    expect(record).to.equal(undefined);
                })
                .then(done, done);
        });
    });

    describe('updating records', () => {
        afterEach((done) => {
            store.record.removeAll().then(done, done);
        });

        it('fails if the updated record has no "instanceId" property', (done) => {
            store.record
                .set(recordA)
                .then(() => {
                    delete recordA.instanceId;
                    recordA.xml = '<model><change>a</change></model>';
                    return store.record.update(recordA);
                })
                .catch((e) => {
                    expect(e.message).to.contain('not complete');
                    done();
                });
        });

        it('fails if the updated record has no "name" property', (done) => {
            store.record
                .set(recordA)
                .then(() => {
                    delete recordA.name;
                    recordA.xml = '<model><change>a</change></model>';
                    return store.record.update(recordA);
                })
                .catch((e) => {
                    expect(e.message).to.contain('not complete');
                    done();
                });
        });

        it('fails if the updated record has no "xml" property', (done) => {
            store.record
                .set(recordA)
                .then(() => {
                    delete recordA.xml;
                    return store.record.update(recordA);
                })
                .catch((e) => {
                    expect(e.message).to.contain('not complete');
                    done();
                });
        });

        it('succeeds if the updated record has the required properties', (done) => {
            const updatedXml = '<model><change>a</change></model>';

            store.record
                .set(recordA)
                .then(() => {
                    recordA.xml = updatedXml;
                    return store.record.update(recordA);
                })
                .then((result) => {
                    expect(result).to.deep.equal(recordA);
                    expect(result.xml).to.equal(updatedXml);
                    return store.record.get(recordA.instanceId);
                })
                .then((result) => {
                    expect(result.xml).to.equal(updatedXml);
                })
                .then(done, done);
        });

        it('succeeds if the updated record has the required properties and includes files', (done) => {
            const name1 = fileA.name;
            const name2 = fileB.name;

            store.record
                .set(recordA)
                .then(() => {
                    recordA.files = [fileA, fileB];
                    return store.record.update(recordA);
                })
                .then((result) => {
                    // check update response
                    expect(result.files.length).to.equal(2);
                    expect(result.files[0].name).to.equal(name1);
                    expect(result.files[1].name).to.equal(name2);
                    return store.record.get(recordA.instanceId);
                })
                .then((result) => {
                    // check get response
                    expect(result.files.length).to.equal(2);
                    expect(result.files[0].name).to.equal(name1);
                    expect(result.files[1].name).to.equal(name2);
                })
                .then(done, done);
        });

        it('removes any record files that have become obsolete', (done) => {
            const name1 = fileA.name;
            const name2 = fileB.name;

            recordA.files = [fileA];
            store.record
                .set(recordA)
                .then((result) => {
                    expect(result.files[0].name).to.equal(name1);
                    // update files
                    recordA.files = [fileB];
                    return store.record.update(recordA);
                })
                .then((result) => {
                    // check update response
                    expect(result.files.length).to.equal(1);
                    expect(result.files[0].name).to.equal(name2);
                    return store.record.get(recordA.instanceId);
                })
                .then((result) => {
                    // check get response
                    expect(result.files.length).to.equal(1);
                    expect(result.files[0].name).to.equal(name2);
                    return store.record.file.get(recordA.instanceId, name1);
                })
                .then((result) => {
                    // check whether obsolete file has been removed
                    expect(result).to.equal(undefined);
                })
                .then(done, done);
        });

        it('does not remove record files that were loaded into a draft record and were left unchanged', (done) => {
            const name1 = fileA.name;
            const name2 = fileB.name;
            const size1 = fileA.item.size;

            recordA.files = [fileA];
            store.record
                .set(recordA)
                .then((result) => {
                    expect(result.files[0].name).to.equal(name1);
                    // update files, fileA remains but is included as a {name: name1} without item (blob)
                    recordA.files = [
                        {
                            name: name1,
                        },
                        fileB,
                    ];
                    return store.record.update(recordA);
                })
                .then((result) => {
                    // check update response
                    expect(result.files.length).to.equal(2);
                    expect(result.files[0].name).to.equal(name1);
                    expect(result.files[1].name).to.equal(name2);
                    return store.record.get(recordA.instanceId);
                })
                .then((result) => {
                    // check get response
                    expect(result.files.length).to.equal(2);
                    expect(result.files[0].name).to.equal(name1);
                    expect(result.files[1].name).to.equal(name2);
                    return store.record.file.get(recordA.instanceId, name1);
                })
                .then((result) => {
                    // check whether obsolete file has been removed
                    expect(result.item.size).to.equal(size1);
                    expect(result.name).to.equal(name1);
                })
                .then(done, done);
        });
    });

    describe('removing records', () => {
        afterEach((done) => {
            store.record.removeAll().then(done, done);
        });

        it('succeeds if the record contains no files', (done) => {
            store.record
                .set(recordA)
                .then(() => store.record.remove(recordA.instanceId))
                .then(() => store.record.get(recordA.instanceId))
                .then((result) => {
                    expect(result).to.equal(undefined);
                })
                .then(done, done);
        });

        it('succeeds if the record contains files', (done) => {
            const { name } = fileA;

            recordA.instanceId += Math.random();

            store.record
                .set(recordA)
                .then(() => {
                    recordA.files = [fileA, fileB];
                    return store.record.update(recordA);
                })
                .then(() => store.record.file.get(recordA.instanceId, name))
                .then((result) => {
                    expect(result).to.have.property('item');
                    expect(result.item).to.be.an.instanceof(Blob);
                })
                .then(() => store.record.remove(recordA.instanceId))
                .then(() => store.record.file.get(recordA.instanceId, name))
                .then((result) => {
                    expect(result).to.equal(undefined);
                    done();
                })
                .catch(done);
        });
    });

    describe('obtaining a list of records', () => {
        afterEach((done) => {
            store.record.removeAll().then(done, done);
        });

        it('returns an empty array if there are no records', (done) => {
            store.record
                .getAll('surveyA')
                .then((records) => {
                    expect(records).to.deep.equal([]);
                })
                .then(done, done);
        });

        it('returns an array of all records', (done) => {
            // recordA and recordB have the same enketoId
            store.record
                .set(recordA)
                .then(() => store.record.set(recordB))
                .then(() => store.record.getAll(recordA.enketoId))
                .then((records) => {
                    expect(records.length).to.equal(2);
                    expect(records[0].instanceId).to.equal(recordA.instanceId);
                    expect(records[0].enketoId).to.equal(recordA.enketoId);
                    expect(records[0].xml).to.equal(recordA.xml);
                    expect(records[1].instanceId).to.equal(recordB.instanceId);
                    expect(records[1].instanceId).to.equal(recordB.instanceId);
                    expect(records[1].xml).to.equal(recordB.xml);
                })
                .then(done, done);
        });

        it('only returns records with the requested enketoId', (done) => {
            store.record
                .set(recordA)
                .then(() => {
                    // make sure enketoId is different
                    recordB.enketoId = 'different';
                    return store.record.set(recordB);
                })
                .then(() => store.record.getAll(recordA.enketoId))
                .then((records) => {
                    expect(records.length).to.equal(1);
                    expect(records[0].instanceId).to.equal(recordA.instanceId);
                    expect(records[0].enketoId).to.equal(recordA.enketoId);
                    expect(records[0].xml).to.equal(recordA.xml);
                })
                .then(done, done);
        });

        it('exludes drafts if requested', (done) => {
            // recordA and recordB have the same enketoId
            store.record
                .set(recordA)
                .then(() => {
                    // set draft status to true of new record
                    recordB.draft = true;
                    return store.record.set(recordB);
                })
                .then(() => store.record.getAll(recordA.enketoId, true))
                .then((records) => {
                    expect(records.length).to.equal(1);
                    expect(records[0].instanceId).to.equal(recordA.instanceId);
                    expect(records[0].enketoId).to.equal(recordA.enketoId);
                    expect(records[0].xml).to.equal(recordA.xml);
                })
                .then(done, done);
        });
    });

    describe('initialization failures', () => {
        /** @type {import('sinon').SinonSandbox} */
        let sandbox;

        /** @type {Error | Event} */
        let error;

        beforeEach(() => {
            sandbox = sinon.createSandbox();

            sandbox.stub(db, 'open').callsFake(() => Promise.reject(error));
        });

        afterEach(() => {
            sandbox.restore();
        });

        it('fails silently when specified', async () => {
            error = new Error();

            /** @type {Error | null} */
            let caught = null;

            try {
                await store.init({ failSilently: true });
            } catch (error) {
                caught = error;
            }

            expect(caught).to.equal(null);
        });
    });
});
