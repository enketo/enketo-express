// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const config = require('../../app/models/config-model').server;
const model = require('../../app/models/survey-model');

chai.use(chaiAsPromised);

const { expect } = chai;

// help function to ensure subsequent database entries don't have the exact same timestamp
// redis is fast...
const _wait1ms = () =>
    new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 1);
    });

describe('Survey Model', () => {
    describe('set: when attempting to store new surveys', () => {
        let survey;

        beforeEach(() => {
            survey = {
                openRosaId: 'widgets',
                openRosaServer: 'https://ona.io/enketo',
            };
        });

        it('returns an error if the OpenRosa Server is missing', () => {
            delete survey.openRosaServer;
            return expect(model.set(survey)).to.eventually.be.rejected;
        });

        it('returns an error if the OpenRosa Form ID is missing', () => {
            delete survey.openRosaId;
            return expect(model.set(survey)).to.eventually.be.rejected;
        });

        it('returns an error if the OpenRosa Form ID is an empty string', () => {
            survey.openRosaId = '';
            return expect(model.set(survey)).to.eventually.be.rejected;
        });

        it('returns an error if the OpenRosa Server is an empty string', () => {
            survey.openRosaServer = '';
            return expect(model.set(survey)).to.eventually.be.rejected;
        });

        it('returns an enketo id if succesful', () =>
            expect(model.set(survey)).to.eventually.match(/^[A-z0-9]{4,31}$/));

        it('returns a different enketo id if the capitalization of the OpenRosa Form ID changes', () => {
            const surveyDifferent = {
                openRosaId: 'Survey',
                openRosaServer: survey.openRosaServer,
            };
            return Promise.all([
                model.set(survey),
                model.set(surveyDifferent),
            ]).then((results) => expect(results[0]).not.to.equal(results[1]));
        });

        it('returns an enketo id when the survey includes a theme property', () => {
            survey.theme = 'gorgeous';
            return expect(model.set(survey)).to.eventually.match(
                /^[A-z0-9]{4,31}$/
            );
        });

        it('drops nearly simultaneous set requests to avoid db corruption', () =>
            Promise.all([
                expect(model.set(survey)).to.eventually.match(
                    /^[A-z0-9]{4,31}$/
                ),
                expect(model.set(survey)).to.eventually.be.rejected,
                expect(model.set(survey)).to.eventually.be.rejected,
            ]));
    });

    describe('get: when attempting to obtain a survey', () => {
        it('returns an error when survey does not exist', () =>
            expect(model.get('nonexisting')).to.eventually.be.rejected);

        it('returns the survey object when survey exists', () => {
            const survey = {
                openRosaId: 'test',
                openRosaServer: 'https://ona.io/enketo',
            };
            const getSurveyPromise = model.set(survey).then(model.get);
            return Promise.all([
                expect(getSurveyPromise)
                    .to.eventually.have.property('openRosaId')
                    .and.to.equal(survey.openRosaId),
                expect(getSurveyPromise)
                    .to.eventually.have.property('openRosaServer')
                    .and.to.equal(survey.openRosaServer),
            ]);
        });

        it('returns the survey object with a theme parameter when this exists', () => {
            const survey = {
                openRosaId: 'test',
                openRosaServer: 'https://ona.io/enketo',
                theme: 'gorgeous',
            };
            const getSurveyPromise = model.set(survey).then(model.get);
            return expect(getSurveyPromise)
                .to.eventually.have.property('theme')
                .and.to.equal(survey.theme);
        });

        it('returns the survey object with an empty string as theme property if the theme is undefined', () => {
            const survey = {
                openRosaId: 'test',
                openRosaServer: 'https://ona.io/enketo',
            };
            const getSurveyPromise = model.set(survey).then(model.get);
            return expect(getSurveyPromise)
                .to.eventually.have.property('theme')
                .and.to.equal('');
        });
    });

    describe('update: when updating an existing survey', () => {
        let survey;

        beforeEach(() => {
            survey = {
                openRosaId: 'test',
                openRosaServer: 'https://ona.io/enketo',
            };
        });

        it('it returns an error when the parameters are incorrect', () => {
            const promise1 = model.set(survey);
            const promise2 = promise1
                .then(() => {
                    survey.openRosaId = '';
                    // change to http
                    survey.openRosaServer = 'http://ona.io/enketo';
                    return model.update(survey);
                })
                .then(model.get);
            return Promise.all([
                expect(promise1).to.eventually.have.length(config['id length']),
                expect(promise2).to.eventually.be.rejected,
            ]);
        });

        it('returns the (protocol) edited survey object when succesful', () => {
            const promise = model
                .set(survey)
                .then(() => {
                    // change to http
                    survey.openRosaServer = 'http://ona.io/enketo';
                    return model.update(survey);
                })
                .then(model.get);
            return Promise.all([
                expect(promise)
                    .to.eventually.have.property('openRosaId')
                    .and.to.equal(survey.openRosaId),
                expect(promise)
                    .to.eventually.have.property('openRosaServer')
                    .and.to.equal('http://ona.io/enketo'),
            ]);
        });

        it('returns the (theme added) edited survey object when succesful', () => {
            const promise = model
                .set(survey)
                .then(() => {
                    // add theme
                    survey.theme = 'gorgeous';
                    return model.update(survey);
                })
                .then(model.get);
            return Promise.all([
                expect(promise)
                    .to.eventually.have.property('openRosaId')
                    .and.to.equal(survey.openRosaId),
                expect(promise)
                    .to.eventually.have.property('openRosaServer')
                    .and.to.equal(survey.openRosaServer),
                expect(promise)
                    .to.eventually.have.property('theme')
                    .and.to.equal('gorgeous'),
            ]);
        });

        it('returns the (theme: "") edited survey object when succesful', () => {
            let promise;

            survey.theme = 'gorgeous';
            promise = model
                .set(survey)
                .then(() => {
                    survey.theme = '';
                    return model.update(survey);
                })
                .then(model.get);
            return expect(promise)
                .to.eventually.have.property('theme')
                .and.to.equal('');
        });

        it('returns the (theme: undefined) edited survey object when succesful', () => {
            let promise;

            survey.theme = 'gorgeous';
            promise = model
                .set(survey)
                .then(() => {
                    delete survey.theme;
                    return model.update(survey);
                })
                .then(model.get);
            return expect(promise)
                .to.eventually.have.property('theme')
                .and.to.equal('');
        });

        it('returns the (theme: null) edited survey object when succesful', () => {
            let promise;

            survey.theme = 'gorgeous';
            promise = model
                .set(survey)
                .then(() => {
                    survey.theme = null;
                    return model.update(survey);
                })
                .then(model.get);
            return expect(promise)
                .to.eventually.have.property('theme')
                .and.to.equal('');
        });

        it('returns the (protocol) edited survey object when succesful and called via set()', () => {
            const promise = model
                .set(survey)
                .then(() => {
                    // change to http
                    survey.openRosaServer = 'http://ona.io/enketo';
                    // set again
                    return model.set(survey);
                })
                .then(model.get);
            return Promise.all([
                expect(promise)
                    .to.eventually.have.property('openRosaId')
                    .and.to.equal(survey.openRosaId),
                expect(promise)
                    .to.eventually.have.property('openRosaServer')
                    .and.to.equal('http://ona.io/enketo'),
            ]);
        });

        it('returns the (theme) edited survey object when succesful and called via set()', () => {
            const promise = model
                .set(survey)
                .then(() => {
                    // change theme
                    survey.theme = 'different';
                    // set again
                    return model.set(survey);
                })
                .then(model.get);
            return Promise.all([
                expect(promise)
                    .to.eventually.have.property('openRosaId')
                    .and.to.equal(survey.openRosaId),
                expect(promise)
                    .to.eventually.have.property('openRosaServer')
                    .and.to.equal(survey.openRosaServer),
                expect(promise)
                    .to.eventually.have.property('theme')
                    .and.to.equal('different'),
            ]);
        });
    });

    describe('getId: when obtaining the enketo ID', () => {
        const survey = {
            openRosaId: 'existing',
            openRosaServer: 'https://ona.io/enketo',
        };

        it('of an existing survey, it returns the id', () => {
            const promise1 = model.set(survey);
            const promise2 = promise1.then(() => model.getId(survey));
            return Promise.all([
                expect(promise1).to.eventually.match(/^[A-z0-9]{4,31}$/),
                expect(promise2).to.eventually.match(/^[A-z0-9]{4,31}$/),
            ]);
        });

        it('of an existing survey, it returns null if the id does not have a case-sensitive match', () => {
            const promise1 = model.set(survey);
            const promise2 = promise1.then(() => {
                survey.openRosaId = 'Existing';
                return model.getId(survey);
            });
            return Promise.all([
                expect(promise1).to.eventually.match(/^[A-z0-9]{4,31}$/),
                expect(promise2).to.eventually.be.fulfilled.and.deep.equal(
                    null
                ),
            ]);
        });

        it('of a non-existing survey, it returns null', () => {
            survey.openRosaId = 'non-existing';

            const promise = model.getId(survey);
            return expect(promise).to.eventually.be.fulfilled.and.deep.equal(
                null
            );
        });

        it('of a survey with incorrect parameters, it returns a 400 error', () => {
            survey.openRosaId = null;
            const promise = model.getId(survey);
            return expect(promise)
                .to.eventually.be.rejected.and.have.property('status')
                .that.equals(400);
        });
    });

    describe('getNumber', () => {
        const server = 'https://kobotoolbox.org/enketo';
        const survey1 = {
            openRosaId: 'a',
            openRosaServer: server,
        };
        const survey2 = {
            openRosaId: 'b',
            openRosaServer: server,
        };
        // Include:
        const survey3 = {
            openRosaId: 'c',
            openRosaServer: `${server}/deep`,
        };
        // Do not include:
        const survey4 = {
            openRosaId: 'd',
            openRosaServer: `${server}deep`,
        };

        it('obtains the number of surveys if all are active', () => {
            const getNumber = model
                .set(survey1)
                .then(() => model.set(survey2))
                .then(_wait1ms)
                .then(() => model.set(survey3))
                .then(_wait1ms)
                .then(() => model.set(survey4))
                .then(() => model.getNumber(server));
            return expect(getNumber).to.eventually.equal(3);
        });

        it('obtains the number of active surveys only', () => {
            const getNumber = model
                .set(survey1)
                .then(() => model.set(survey2))
                .then(_wait1ms)
                .then(() => model.set(survey3))
                .then(_wait1ms)
                .then(() => model.set(survey4))
                .then(() =>
                    model.update({
                        openRosaServer: server,
                        openRosaId: survey1.openRosaId,
                        active: false,
                    })
                )
                .then(() => model.getNumber(server));
            return expect(getNumber).to.eventually.equal(2);
        });
    });

    describe('getList', () => {
        const server = 'https://kobotoolbox.org/enketo';
        const survey1 = {
            openRosaId: 'a',
            openRosaServer: server,
        };
        const survey2 = {
            openRosaId: 'b',
            openRosaServer: server,
        };
        // Include:
        const survey3 = {
            openRosaId: 'c',
            openRosaServer: `${server}/deep`,
        };
        // Do not include:
        const survey4 = {
            openRosaId: 'd',
            openRosaServer: `${server}deep`,
        };

        it('obtains the list surveys if all are active in ascending launch date order', () => {
            const getList = model
                .set(survey1)
                .then(_wait1ms)
                .then(() => model.set(survey2))
                .then(_wait1ms)
                .then(() => model.set(survey3))
                .then(_wait1ms)
                .then(() => model.set(survey4))
                .then(() => model.getList(server))
                .then((list) =>
                    list.map((item) => ({
                        openRosaServer: item.openRosaServer,
                        openRosaId: item.openRosaId,
                    }))
                );

            return expect(getList).to.eventually.deep.equal([
                {
                    openRosaServer: server,
                    openRosaId: 'a',
                },
                {
                    openRosaServer: server,
                    openRosaId: 'b',
                },
                {
                    openRosaServer: `${server}/deep`,
                    openRosaId: 'c',
                },
            ]);
        });

        it('obtains the list of active surveys only', () => {
            const getList = model
                .set(survey1)
                .then(_wait1ms)
                .then(() => model.set(survey2))
                .then(_wait1ms)
                .then(() => model.set(survey3))
                .then(_wait1ms)
                .then(() => model.set(survey4))
                .then(() =>
                    model.update({
                        openRosaServer: server,
                        openRosaId: survey1.openRosaId,
                        active: false,
                    })
                )
                .then(() => model.getList(server))
                .then((list) => list.map((item) => item.openRosaId));

            return expect(getList).to.eventually.deep.equal(['b', 'c']);
        });
    });

    describe('creates enketoIds', () => {
        const survey1 = {
            openRosaId: 'a',
            openRosaServer: 'https://kobotoolbox.org/enketo',
        };

        it('without duplicates', () => {
            const ids = [];
            const NUM = 1000;
            let tests = Promise.resolve();

            for (let i = 0; i < NUM; i++) {
                tests = tests.then((id) => {
                    if (ids.indexOf(id) === -1) {
                        ids.push(id);
                    }
                    return model.createNewEnketoId();
                });
            }

            const result = tests.then(() => ids);

            return expect(result).to.eventually.have.lengthOf(NUM);
        });

        // Collission without auto-regeneration of ID.
        it('throws when, an already-used ID is forced', () => {
            const test = () =>
                model.set(survey1).then((id) => model.createNewEnketoId(id, 0));
            return expect(test()).to.be.rejectedWith(/Failed to create/);
        });

        // This tests the loop in createEnketoId when a collission occurs.
        it('when an already-used ID is merely suggested', () => {
            const test = () =>
                model.set(survey1).then((id) => model.createNewEnketoId(id));
            return expect(test()).to.eventually.match(/[A-z0-9]{4,31}/);
        });

        // This tests the loop in createEnketoId when a collission occurs.
        it('when an already-used ID is merely suggested', () => {
            const test = () => {
                let suggestedId;
                return model
                    .set(survey1)
                    .then((id) => {
                        suggestedId = id;
                        return model.createNewEnketoId(id);
                    })
                    .then((newId) => newId && newId !== suggestedId);
            };
            return expect(test()).to.eventually.equal(true);
        });
    });
});
