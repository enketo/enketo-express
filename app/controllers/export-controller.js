const express = require( 'express' );
const router = express.Router();
const path = require( 'path' );
const os = require( 'os' );
const fs = require( 'fs' );
const url = require( 'url' );
const Busboy = require( 'busboy' );
const debug = require( 'debug' )( 'export-controller' );
const PREFIX = '__export-';
const DESTROY = 30 * 60 * 1000;

module.exports = app => {
    app.use( `${app.get( 'base path' )}/export`, router );
};

router
    .post( '/get-url', getExportUrl )
    .get( '/get-file/:filename', getExportFile );

function getExportUrl( req, res ) {
    let filePath;
    let newFilename;
    const busboy = new Busboy( {
        headers: req.headers
    } );

    busboy.on( 'file', ( fieldname, file, filename ) => {
        newFilename = `${PREFIX + ( Math.random() * 1e64 ).toString( 36 ).slice( 2 )}-${filename}`;
        filePath = path.join( os.tmpDir(), newFilename );
        file.pipe( fs.createWriteStream( filePath ) );
    } );

    busboy.on( 'finish', () => {
        res.status( 201 );
        res.send( {
            'downloadUrl': url.resolve( '/export/get-file/', newFilename )
        } );
    } );

    // remove the file automatically
    setTimeout( () => {
        _delete( filePath );
    }, DESTROY );

    return req.pipe( busboy );
}

function getExportFile( req, res, next ) {
    let filename = req.params.filename;

    // only allow properly prefixed filenames to be retrieved
    if ( filename && filename.indexOf( PREFIX ) === 0 ) {
        const filePath = path.join( os.tmpDir(), req.params.filename );
        filename = filename.substring( PREFIX.length );
        filename = filename.substring( filename.indexOf( '-' ) + 1 );

        const readStream = fs.createReadStream( filePath );

        readStream.on( 'error', () => {
            next( 'route' );
        } );

        readStream.on( 'end', () => {
            _delete( filePath );
        } );

        res.type( 'zip' );
        res.set( 'Content-Disposition', `attachment; filename="${filename}"` );
        readStream.pipe( res );
    } else {
        next( 'route' );
    }
}

function _delete( filePath ) {
    fs.unlink( filePath, error => {
        if ( !error ) {
            debug( `file: ${filePath} was deleted` );
        } else {
            debug( `failed to remove file: ${filePath}` );
        }
    } );
}
