// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

/*
 * Some of these tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */
const request = require( 'supertest' );
const config = require( '../../app/models/config-model' ).server;
config[ 'base path' ] = '';
const app = require( '../../config/express' );
const surveyModel = require( '../../app/models/survey-model' );
const instanceModel = require( '../../app/models/instance-model' );
const cacheModel = require( '../../app/models/cache-model' );
const redis = require( 'redis' );
const client = redis.createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );

describe( 'transformation', () => {
    const validApiKey = 'abc';
    const validAuth = {
        'Authorization': `Basic ${Buffer.from( `${validApiKey}:` ).toString( 'base64' )}`
    };
    const validServer = 'https://testserver.com/bob';
    const validFormId = 'something';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded','Accept': 'application/json' }
    let enketo_url;

    beforeEach( done => {
        const s = {
            openRosaServer: validServer,
            openRosaId: validFormId,
        };
        // add survey if it doesn't exist in the db
        surveyModel.set( s )
            .then( () => {
                s.info = {
                    hash: 'a'
                };
                s.form = '<form/>';
                s.model = '<model/>';

                return cacheModel.set( s );
            } ).then(() => {
                done()
            })

    } );

    //afterEach( done => {
    //    // select test database and flush it
    //    client.select( 15, err => {
    //        if ( err ) {
    //            return done( err );
    //        }
    //        client.flushdb( err => {
    //            if ( err ) {
    //                return done( err );
    //            }

    //            return instanceModel.set( {
    //                openRosaServer: validServer,
    //                openRosaId: validFormId,
    //                instanceId: beingEdited,
    //                returnUrl: 'https://enketo.org',
    //                instance: '<data></data>'
    //            } ).then( () => {
    //                done();
    //            } );
    //        } );
    //    } );
    //} );

    it( 'Create survey', done => {
        app.set( 'offline enabled', true );
        request( app )
            .post( `/api/v2/survey` )
            .set( validAuth )
            .send( {
                server_url: 'https://testserver.com/bob',
                form_id: validFormId,
                return_url: 'http://example.com',
            } )
            .end((err, resp) => {
                enketo_url = new URL(resp.body['url'])
                done();
            })
    } );

    it('Get transformation', done => {
        request(app)
            .post(`/transform/xform${enketo_url.pathname}`)
            .set( validAuth )
            .set(headers)
            .send({})
            .expect(resp => {
                console.log(resp);
            })
            .end(done)
    })
});
