/* global process, __dirname */
/* eslint no-console: 0 */

/* **************
The only purpose of this script is to be used by the npm test script to write the shield badge within the README.md file
************** */

var fs = require( 'fs' );
var path = require( 'path' );
var istanbul = require( 'istanbul' );
var collector = new istanbul.Collector();
var Report = istanbul.Report;
var shieldBadgeReporter = require( 'istanbul-reporter-shield-badge' );

istanbul.Report.register( shieldBadgeReporter );

var report = Report.create( 'shield-badge', {
    readmeFilename: 'README.md',
    readmeDir: path.resolve( __dirname, '..' ),
    subject: 'coverage'
} );

try {
    console.log( '\n====================== Adding the badge to the ' + report.readmeFilename + ' =======================' );
    var serverCoverageDir = path.resolve( __dirname, '../test-coverage/server' );
    var clientCoverageDir = path.resolve( __dirname, '../test-coverage/client' );
    fs.readdirSync( serverCoverageDir ).forEach( function( file ) {
        if ( file.indexOf( 'coverage-final.json' ) === 0 ) {
            collector.add( JSON.parse( fs.readFileSync( path.resolve( serverCoverageDir, file ), 'utf8' ) ) );
        }
    } );
    fs.readdirSync( clientCoverageDir ).forEach( function( browserDir ) {
        if ( browserDir.indexOf( 'HeadlessChrome' ) === 0 ) {
            var browserDirPath = path.resolve( clientCoverageDir, browserDir );
            fs.readdirSync( browserDirPath ).forEach( function( file ) {
                if ( file.indexOf( 'coverage-final.json' ) === 0 ) {
                    collector.add( JSON.parse( fs.readFileSync( path.resolve( browserDirPath, file ), 'utf8' ) ) );
                }
            } );
        }
    } );
    report.on( 'done', function() {
        console.log( 'The istanbul shield badge report has been generated (from both sources)' );
    } );
    report.writeReport( collector, true );
} catch ( err ) {
    console.error( err.message );
    process.exit( 1 );
}
