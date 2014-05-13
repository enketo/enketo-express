var transformer = require( '../lib/transformer/enketo-transformer' );
var fs = require( 'fs' );
var Q = require( 'q' );
var communicator = require( '../lib/communicator/openrosa-communicator' );
var debug = require( 'debug' )( 'form-controller' );

function get( server, id ) {

    return _getXForm( server, id )
        .then( function( xform ) {
            return _transform( xform );
        } )
        .fail( function( error ) {
            throw error;
        } );

    // xform = communicator.getXForm(server, id, function(){}, function(){});
}

function _getXForm( server, id ) {
    var deferred = Q.defer();

    fs.readFile( "./geo.xml", "utf-8", function( error, text ) {
        if ( error ) {
            deferred.reject( new Error( error ) );
        } else {
            debug( 'XForm file content length: ', text.length );
            deferred.resolve( text );
        }
    } );
    return deferred.promise;
}

function _transform( xform ) {
    var deferred = Q.defer();

    transformer.transform( '<wrong>', function( error, result ) {
        if ( error ) {
            deferred.reject( error );
        } else {
            debug( 'result form length: ', JSON.stringify( result.form.length ) );
            deferred.resolve( result );
        }
    } );

    return deferred.promise;
}

module.exports = {
    get: get
};
