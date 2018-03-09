#!/usr/bin/env node

const cluster = require( 'cluster' );
const numCPUs = require( 'os' ).cpus().length;

if ( cluster.isMaster ) {

    // Fork workers.
    for ( let i = 0; i < numCPUs; i++ ) {
        cluster.fork();
    }

    cluster.on( 'exit', function( worker ) {
        console.log( 'Worker ' + worker.process.pid + ' sadly passed away. It will be reincarnated.' );
        cluster.fork();
    } );
} else {
    const app = require( './config/express' );
    const server = app.listen( app.get( 'port' ), () => {
        const worker = ( cluster.worker ) ? cluster.worker.id : 'Master';
        const msg = 'Worker ' + worker + ' ready for duty at port ' + server.address().port + '! (environment: ' + app.get( 'env' ) + ')';
        console.log( msg );
    } );
    /**
     * The goal of this timeout is to time out AFTER the client (browser request) times out.
     * This avoids nasty issues where a proxied submission is still ongoing but Enketo
     * drops the connection, potentially resulting in the browser queue not emptying,
     * despite submitting successfully.
     *
     * https://github.com/kobotoolbox/enketo-express/issues/564
     */
    server.timeout = app.get( 'timeout' ) + 1000;
}
