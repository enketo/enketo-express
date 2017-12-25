/* global describe, it, expect */
'use strict';

var pkg = require( '../../package.json' );
var Form = require( 'enketo-core' );

describe( 'Build checks: ', function() {
    it( 'Transformer matches Core', function() {
        expect( pkg.dependencies[ 'enketo-transformer' ] ).to.equal( Form.requiredTransformerVersion );
    } );
} );
