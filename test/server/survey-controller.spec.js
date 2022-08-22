// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

const request = require('supertest');
const config = require('../../app/models/config-model').server;

config['base path'] = '';

const app = require('../../config/express');

describe('Survey Controller', () => {
    describe('meta data: ', () => {
        const endpoints = [
            '/x/abcd',
            '/abcd',
            '/preview',
            '/preview/abcd',
            '/edit/abcd?instance_id=a',
        ];

        endpoints.forEach((endpoint) => {
            it(`endpoint ${endpoint} adds a __enketo_meta_deviceid cookie when absent`, (done) => {
                app.set('offline enabled', true);
                request(app)
                    .get(endpoint)
                    .expect(200)
                    .expect('set-cookie', /__enketo_meta_deviceid/)
                    .end(done);
            });
        });
    });
});
