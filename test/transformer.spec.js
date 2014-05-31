/* global describe, require, it*/
"use strict";

var should = require( 'should' );
var fs = require( "fs" );
var transformer = require( "../lib/transformer" );

describe( 'transformer', function() {

    describe( 'transforms valid XForms', function() {
        var xform = fs.readFileSync( './test/forms/widgets.xml' );
        it( 'without an error', function( done ) {

            transformer.transform( xform )
                .then( function( result ) {
                    result.should.be.of.type( 'object' );
                    result.should.have.property( 'form' );
                    result.should.have.property( 'model' );
                    result.form.should.not.be.empty;
                    result.model.should.not.be.empty;
                    done();
                } )
                .catch( function( error ) {
                    error.should.not.be.ok;
                    done();
                } )
        } );
    } );

    describe( 'transforms invalid XForms', function() {
        var invalid_xforms = [ undefined, null, '', '<data>' ];

        invalid_xforms.forEach( function( xform ) {
            it( 'with a parse error', function( done ) {
                var errorMsg,
                    result = false;

                transformer.transform( xform )
                    .then( function( result ) {
                        result = result;
                    } )
                    .catch( function( error ) {
                        errorMsg = error.message;
                    } )
                    .then( function() {
                        result.should.not.be.ok;
                        errorMsg.should.containEql( 'parse' );
                        done();
                    } );
            } );
        } );

    } );
} );
