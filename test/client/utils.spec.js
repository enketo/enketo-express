/* global define, describe, require, it, before, after, beforeEach, afterEach, expect */
"use strict";

define( [ 'utils' ], function( utils ) {

    describe( 'Client Utilities', function() {

        describe( 'CSV to XML conversion', function() {

            it( 'returns an error if the csv contains column headings that are not valid XML nodeNames (start with a number)', function() {
                var csv = 'a,b,c,3\n1,2,3,4',
                    convert = function() {
                        utils.csvToXml( csv );
                    };
                expect( convert ).to.throw( Error );
                expect( convert ).to.throw( /"3" cannot be turned into a valid XML element/ );
            } );

            it( 'returns an error if the csv contains column headings that are not valid XML nodeNames (start with namespace prefix)', function() {
                var csv = 'a,b,c,a:d\n1,2,3,4',
                    convert = function() {
                        utils.csvToXml( csv );
                    };
                expect( convert ).to.throw( Error );
                expect( convert ).to.throw( /"a:d" cannot be turned into a valid XML element/ );
            } );

            it( 'returns each row as an <item/> with each row item as a child element with the column heading as nodeName', function() {
                var csv = 'a,b,c,d\n1,2,3,4\n5,6,7,8',
                    xml = utils.csvToXml( csv );
                expect( xml ).to.contain( '<item><a>1</a><b>2</b><c>3</c><d>4</d>' );
                expect( xml ).to.contain( '<item><a>5</a><b>6</b><c>7</c><d>8</d>' );
            } );

            it( 'deals with values that contain a comma', function() {
                var csv = 'a,b,c,d\n1,2,3,"4,2"\n5,6,7,8',
                    xml = utils.csvToXml( csv );
                expect( xml ).to.contain( '<item><a>1</a><b>2</b><c>3</c><d>4,2</d>' );
            } );

            it( 'can read csv files that uses a semi-colon separator', function() {
                var csv = 'a;b;c;d\n1;2;3;"4;2"\n5;6;7;8',
                    xml = utils.csvToXml( csv );
                expect( xml ).to.contain( '<item><a>1</a><b>2</b><c>3</c><d>4;2</d>' );
            } );

            it( 'trims column headers and values', function() {
                var csv = ' a     ;b;c;d\n    1    ;2;3;4\n5;6;7;8',
                    xml = utils.csvToXml( csv );
                expect( xml ).to.contain( '<item><a>1</a><b>2</b><c>3</c><d>4</d>' );
            } );

        } );
    } );
} );
