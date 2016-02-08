'use strict';

var express = require( 'express' );
var router = express.Router();
var path = require( 'path' );
var os = require( 'os' );
var fs = require( 'fs' );
var url = require( 'url' );
var Busboy = require( 'busboy' );
var debug = require( 'debug' )( 'export-controller' );
var PREFIX = '__export-';
var DESTROY = 30 * 60 * 1000;

module.exports = function( app ) {
    app.use( app.get( 'base path' ) + '/export', router );
};

router
    .post( '/get-url', getExportUrl )
    .get( '/get-file/:filename', getExportFile );

function getExportUrl( req, res, next ) {
    var filePath;
    var newFilename;
    var busboy = new Busboy( {
        headers: req.headers
    } );

    busboy.on( 'file', function( fieldname, file, filename, encoding, mimetype ) {
        newFilename = PREFIX + ( Math.random() * 1e64 ).toString( 36 ).slice( 2 ) + '-' + filename;
        filePath = path.join( os.tmpDir(), newFilename );
        file.pipe( fs.createWriteStream( filePath ) );
    } );

    busboy.on( 'finish', function() {
        res.status( 201 );
        res.send( {
            'downloadUrl': url.resolve( '/export/get-file/', newFilename )
        } );
    } );

    // remove the file automatically
    setTimeout( function() {
        _delete( filePath );
    }, DESTROY );

    return req.pipe( busboy );
}

function getExportFile( req, res, next ) {
    var readStream;
    var filePath;
    var filename = req.params.filename;

    // only allow properly prefixed filenames to be retrieved
    if ( filename && filename.indexOf( PREFIX ) === 0 ) {
        filePath = path.join( os.tmpDir(), req.params.filename );
        filename = filename.substring( PREFIX.length );
        filename = filename.substring( filename.indexOf( '-' ) + 1 );

        readStream = fs.createReadStream( filePath );

        readStream.on( 'error', function() {
            next( 'route' );
        } );

        readStream.on( 'end', function() {
            _delete( filePath );
        } );

        res.type( 'zip' );
        res.set( 'Content-Disposition', 'attachment; filename="' + filename + '"' );
        readStream.pipe( res );
    } else {
        next( 'route' );
    }
}

function _delete( filePath ) {
    fs.unlink( filePath, function( error ) {
        if ( !error ) {
            debug( 'file: ' + filePath + ' was deleted' );
        } else {
            debug( 'failed to remove file: ' + filePath );
        }
    } );
}
