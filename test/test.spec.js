/* global describe, require, it*/
"use strict";

var should = require( 'should' );

describe( 'Martijn\'s', function() {
    describe( 'property', function() {
        it( 'coolness should have the value "high"', function() {
            var martijn = {
                coolness: 'high'
            };
            martijn.should.have.property( 'coolness', 'high' );
            martijn.should.not.have.property( 'coolness', 'low' );
        } );
    } );
} );
