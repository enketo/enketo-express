/* global define, describe, require, it, before, after, beforeEach, afterEach, expect */
"use strict";

define( [ 'utils' ], function( utils ) {

    describe( 'Client Utilities', function() {

        it( 'library is loaded', function() {
            expect( typeof utils ).to.equal( 'object' );
        } );

    } );
} );
