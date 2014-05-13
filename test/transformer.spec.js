var assert = require( "assert" );
var fs = require( "fs" );
var transformer = require( "../lib/transformer/enketo-transformer" );

describe( 'transformer', function() {

    describe( 'transforms valid XForms', function() {
        var xform = fs.readFileSync( './test/forms/widgets.xml' );
        it( 'without an error', function( done ) {
            transformer.transform( xform, function( error, result ) {
                if ( error ) throw Error;
                assert( typeof result === 'object', 'result is object' );
                assert( !!result.form, 'result has form property' );
                assert( !!result.instance, 'result has instance property' );
                assert( result.form.length > 0, 'form property has length > 0' );
                assert( result.instance.length > 0, 'instance property has length > 0' );
                done();
            } );
        } );
    } );

    describe( 'transforms invalid XForms', function() {
        var invalid_xforms = [ undefined, null, '', '<data>' ];

        invalid_xforms.forEach( function( xform ) {
            it( 'with a parse error', function( done ) {
                transformer.transform( xform, function( error, result ) {
                    // this seems a bit weird, may as just as well check value of error
                    assert.throws( function() {
                        if ( error ) throw error;
                    }, /parse/i );
                    done();
                } );
            } );
        } );

    } );
} );
