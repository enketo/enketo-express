/* global describe, it, expect */
'use strict';

var utils = require( '../../public/js/src/module/utils' );

describe( 'Client Utilities', function() {

    describe( 'CSV to XML conversion', function() {

        it( 'returns an error if the csv contains column headings that are not valid XML nodeNames (start with a number)', function() {
            var csv = 'a,b,c,3\n1,2,3,4';
            var convert = function() {
                utils.csvToXml( csv );
            };
            expect( convert ).to.throw( Error );
            expect( convert ).to.throw( /"3" cannot be turned into a valid XML element/ );
        } );

        it( 'returns an error if the csv contains column headings that are not valid XML nodeNames (start with namespace prefix)', function() {
            var csv = 'a,b,c,a:d\n1,2,3,4';
            var convert = function() {
                utils.csvToXml( csv );
            };
            expect( convert ).to.throw( Error );
            expect( convert ).to.throw( /"a:d" cannot be turned into a valid XML element/ );
        } );

        it( 'returns each row as an <item/> with each row item as a child element with the column heading as nodeName', function() {
            var csv = 'a,b,c,d\n1,2,3,4\n5,6,7,8';
            var xml = utils.csvToXml( csv );
            var firstItem = '<item><a>1</a><b>2</b><c>3</c><d>4</d></item>';
            var secondItem = '<item><a>5</a><b>6</b><c>7</c><d>8</d></item>';
            expect( xml ).to.equal( '<root>' + firstItem + secondItem + '</root>' );
        } );

        it( 'deals with values that contain a comma', function() {
            var csv = 'a,b,c,d\n1,2,3,"4,2"\n5,6,7,8';
            var xml = utils.csvToXml( csv );
            expect( xml ).to.contain( '<item><a>1</a><b>2</b><c>3</c><d>4,2</d>' );
        } );

        it( 'can read csv files that uses a semi-colon separator', function() {
            var csv = 'a;b;c;d\n1;2;3;"4;2"\n5;6;7;8';
            var xml = utils.csvToXml( csv );
            expect( xml ).to.contain( '<item><a>1</a><b>2</b><c>3</c><d>4;2</d>' );
        } );

        it( 'trims column headers and values', function() {
            var csv = ' a     ;b;c;d\n    1    ;2;3;4\n5;6;7;8';
            var xml = utils.csvToXml( csv );
            expect( xml ).to.contain( '<item><a>1</a><b>2</b><c>3</c><d>4</d>' );
        } );

        it( 'ignores empty lines', function() {
            var csv = ' a;b;c\n\n1;2;3\n\n5;6;7\n';
            var xml = utils.csvToXml( csv );
            expect( xml ).to.equal( '<root><item><a>1</a><b>2</b><c>3</c></item><item><a>5</a><b>6</b><c>7</c></item></root>' );
        } );

        it( 'does not get confused by a very small csv string with \r\n linebreaks including an empty line at end', function() {
            var csv = ' a;b\r\n1;2\r\n5;6\r\n';
            var xml = utils.csvToXml( csv );
            expect( xml ).to.equal( '<root><item><a>1</a><b>2</b></item><item><a>5</a><b>6</b></item></root>' );
        } );

        it( 'encodes XML entities', function() {
            var csv = ' a;b;c\n\na & b;2;3\n\n5;6;7\n';
            var xml = utils.csvToXml( csv );
            expect( xml ).to.equal( '<root><item><a>a &amp; b</a><b>2</b><c>3</c></item><item><a>5</a><b>6</b><c>7</c></item></root>' );
        } );

        it( 'adds lang attributes', function() {
            var csv = 'a,b,c,d::english,d::french\n1,2,3,4,5';
            var xml = utils.csvToXml( csv );
            expect( xml ).to.equal( '<root><item><a>1</a><b>2</b><c>3</c><d lang="english">4</d><d lang="french">5</d></item></root>' );
        } );

        it( 'adds converted lang attributes', function() {
            var csv = 'a,b,c,d::english,d::french\n1,2,3,4,5';
            var xml = utils.csvToXml( csv, {
                'english': 'en',
                'french': 'fr'
            } );
            expect( xml ).to.equal( '<root><item><a>1</a><b>2</b><c>3</c><d lang="en">4</d><d lang="fr">5</d></item></root>' );
        } );

    } );


    describe( 'blob <-> dataURI conversion', function() {

        var aBlob1 = new Blob( [ '<a id="a"><b id="b">hey!</b></a>' ], {
                type: 'text/xml'
            } ),
            aBlob1Type = aBlob1.type,
            aBlob1Size = aBlob1.size,
            aBlob2 = new Blob( [ '<a id="a">将来の仏教研究は急速に発展す</a>' ], {
                type: 'text/xml'
            } ),
            aBlob2Size = aBlob2.size,
            aBlob2Type = aBlob2.type;

        it( 'converts a blob to a string', function( done ) {
            utils.blobToDataUri( aBlob1 )
                .then( function( result ) {
                    expect( result ).to.be.a( 'string' );
                    done();
                } );
        } );

        it( 'converts a blob to dataUri and back to same blob', function( done ) {
            utils.blobToDataUri( aBlob1 )
                .then( utils.dataUriToBlob )
                .then( function( result ) {
                    expect( result.size ).to.equal( aBlob1Size );
                    expect( result.type ).to.equal( aBlob1Type );
                    expect( result ).to.be.an.instanceof( Blob );
                    done();
                } );
        } );

        it( 'converts a blob cotaining Unicode to dataUri and back to same blob', function( done ) {
            utils.blobToDataUri( aBlob2 )
                .then( utils.dataUriToBlob )
                .then( function( result ) {
                    expect( result.size ).to.equal( aBlob2Size );
                    expect( result.type ).to.equal( aBlob2Type );
                    expect( result ).to.be.an.instanceof( Blob );
                    done();
                } );
        } );

        it( 'fails to convert a string', function( done ) {
            utils.blobToDataUri( 'a string' )
                .then( utils.dataUriToBlob )
                .catch( function( e ) {
                    expect( e.message ).to.contain( 'TypeError' );
                    done();
                } );
        } );

        it( 'fails to convert undefined', function( done ) {
            utils.blobToDataUri( undefined )
                .then( utils.dataUriToBlob )
                .catch( function( e ) {
                    expect( e.message ).to.contain( 'TypeError' );
                    done();
                } );
        } );

        it( 'fails to convert false', function( done ) {
            utils.blobToDataUri( false )
                .then( utils.dataUriToBlob )
                .catch( function( e ) {
                    expect( e.message ).to.contain( 'TypeError' );
                    done();
                } );
        } );

        it( 'fails to convert null', function( done ) {
            utils.blobToDataUri( null )
                .then( utils.dataUriToBlob )
                .catch( function( e ) {
                    expect( e.message ).to.contain( 'TypeError' );
                    done();
                } );
        } );

    } );

    describe( 'querystring builder', function() {
        [
            // simple object
            [ {
                name: 'debug',
                value: true
            }, '?debug=true' ],
            // simple array
            [
                [ {
                    name: 'debug',
                    value: false
                }, {
                    name: 'ecid',
                    value: 'abcd'
                } ], '?debug=false&ecid=abcd'
            ],
            // empty results
            [ 'string', '' ],
            [ {
                debug: true
            }, '' ],
            [ {
                name: 'ecid',
                value: ''
            }, '' ],
            [ {
                name: 'ecid',
                value: undefined
            }, '' ],
            [ {
                name: 'ecid',
                value: null
            }, '' ],
            [
                [ 'string', {} ], ''
            ],
            [
                [ {
                    debug: true
                }, {
                    something: 'that'
                } ], ''
            ],
            // encoding
            [ {
                name: 'ecid',
                value: 'a value'
            }, '?ecid=a%20value' ],
            // value is object
            [ {
                name: 'd',
                value: {
                    '/a/b': 'c',
                    '/b/c': 'd and e'
                }
            }, '?d[%2Fa%2Fb]=c&d[%2Fb%2Fc]=d%20and%20e' ],
            // complex combo
            [
                [ {
                    name: 'ecid',
                    value: 'abcd'
                }, {
                    name: 'd',
                    value: {
                        '/a/b': 'c',
                        '/b/c': 'd and e'
                    }
                } ], '?ecid=abcd&d[%2Fa%2Fb]=c&d[%2Fb%2Fc]=d%20and%20e'
            ],
            [
                [ undefined, {
                    name: 'ecid',
                    value: 'a'
                } ], '?ecid=a'
            ],
        ].forEach( function( test ) {
            it( 'generates ' + test[ 1 ] + ' from ' + JSON.stringify( test[ 0 ] ) + ' correctly', function() {
                expect( utils.getQueryString( test[ 0 ] ) ).to.equal( test[ 1 ] );
            } );
        } );
    } );

    describe( 'Title extractor', function() {
        [
            [ '<html><head><title></title></head><form><h3 id="form-title">title</h3></form></html>', 'title' ],
            [ '<html><head><title></title></head><h3 id="form-title">title</h3><form></form></html>', 'title' ],
            [ '<html><head><title></title></head><form><h3 class="class" id="form-title">title</h3></form></html>', 'title' ],
            [ '<html><head><title></title></head><form><h3 data-something="something" id="form-title">title</h3></form></html>', 'title' ],
            [ '<html><head><title></title></head><form><h3 id="form-title">123, this-that :(</h3></form></html>', '123, this-that :(' ],
        ].forEach( function( test ) {
            it( 'extracts the title correctly form the form HTML string', function() {
                expect( utils.getTitleFromFormStr( test[ 0 ] ) ).to.equal( test[ 1 ] );
            } );
        } );
    } );

} );
