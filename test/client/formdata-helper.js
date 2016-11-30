'use strict';

var request = require( 'request' );
var express = require( 'express' );
var multer = require( 'multer' );
var fs = require( 'fs' );
var upload = multer( {
    dest: '/tmp/'
} );
var app = express();
var port = 8089;

app.post( '/', upload.single( 'xml_submission_fragment_file' ), function( req, res ) {
    var content = fs.readFileSync( req.file.path, {
        encoding: 'utf8'
    } );
    res.header( 'Access-Control-Allow-Origin', '*' );
    res.header( 'Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept' );
    res.send( content );
} );

app.listen( port, function() {
    console.log( 'test helper app started on port ' + port );
} );
