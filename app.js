#!/usr/bin/env node

'use strict';

var cluster = require( 'cluster' );
var numCPUs = require( 'os' ).cpus().length;

if ( cluster.isMaster ) {

    // Fork workers.
    for ( var i = 0; i < numCPUs; i++ ) {
        cluster.fork();
    }

    cluster.on( 'exit', function( worker ) {
        console.log( 'Worker ' + worker.process.pid + ' sadly passed away. It will be reincarnated.' );
        cluster.fork();
    } );
} else {
    var app = require( './config/express' );
    var server = app.listen( app.get( 'port' ), function() {
        var worker = ( cluster.worker ) ? cluster.worker.id : 'Master';
        var msg = 'Worker ' + worker + ' ready for duty at port ' + server.address().port + '! (environment: ' + app.get( 'env' ) + ')';
        console.log( msg );
    } );
}
