/* global describe, require, it*/
"use strict";

var should = require( 'should' );
var fs = require( "fs" );
var transformer = require( "../lib/transformer/enketo-transformer" );

describe( 'transformer', function() {

    describe( 'transforms valid XForms', function() {
        var xform = fs.readFileSync( './test/forms/widgets.xml' );
        it( 'without an error', function( done ) {
            transformer.transform( xform, function( error, result ) {
                if ( error ) throw Error;
                result.should.be.of.type( 'object' );
                result.should.have.property( 'form' );
                result.should.have.property( 'instance' );
                result.form.should.not.be.empty;
                result.instance.should.not.be.empty;
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
                    ( function() {
                        if ( error ) throw error;
                    } ).should.throw( /parse/i );
                    done();
                } );
            } );
        } );

    } );
} );
