/* global describe, it, expect */
'use strict';

var Dn = require( '../../public/widget/discrepancy-note/Dn' );
var jquery = require( 'jquery' );
Dn.prototype._init = function() {};

describe( 'DN object', function() {

    describe( 'parses JSON string', function() {
        var dn = new Dn();

        [ 'a', '[]', '{queries:[], logs:[]}', true, null, false, {},
            [], {
                a: true
            }, {
                "queries": [],
                "logs": []
            }
        ].forEach( function( test ) {
            it( 'throws an error, if the JSON string is invalid or not a string', function() {
                var parse = function() {
                    dn._parseModelFromString( test );
                };
                expect( parse ).to.throw( Error );
                expect( parse ).to.throw( /Failed to parse discrepancy/ );
            } );
        } );

        [ '', '{}' ].forEach( function( test ) {
            it( 'returns an empty model if the JSON string is an empty string or an empty stringified object', function() {
                expect( dn._parseModelFromString( test ) ).to.deep.equal( {
                    queries: [],
                    logs: []
                } );
            } );
        } );

        [
            '{"queries":[], "logs":[]}',
            '{"queries":[],"logs": [{ "type": "comment", "status": "updated", "message": "This is an older comment.", "user" : "Maurice Moss (moss)", "date_time" : "2016-04-22 14:44:20 -06:00"},{ "type": "audit",  "message": "Item data value updated from old_value to new_value.",  "user" : "Jen Barber (jen)","date_time" : "2016-05-18 12:44:20 -06:00" }]}'
        ].forEach( function( test ) {
            it( 'returns the correct model if the JSON string is a valid stringified object', function() {
                expect( dn._parseModelFromString( test ) ).to.deep.equal( JSON.parse( test ) );
            } );
        } );

    } );


    describe( 'extracts the current status from the discrepancy note data model', function() {
        var dn = new Dn();

        [
            [ '{}', '' ],
            [ '{"queries":[], "logs":[{"type": "comment"}]}', '' ],
            [ '{"queries":[], "logs":[{"type": "comment", "status": "updated"}]}', 'updated' ],
            [ '{"queries":[], "logs":[{"type": "audit"},{"type": "comment", "status": "updated"}]}', 'updated' ],
            [ '{"queries":[], "logs":[{"type": "comment", "status":"new"},{"type": "comment", "status": "updated"}]}', 'new' ],
            [ '{"queries":[{"type": "comment", "status": "closed"}], "logs":[{"type": "comment", "status": "updated"}]}', 'closed' ],
        ].forEach( function( test ) {
            it( 'and returns the correct status', function() {
                var model = dn._parseModelFromString( test[ 0 ] );
                expect( model ).to.be.an( 'object' );
                expect( dn._getCurrentStatus( model ) ).to.equal( test[ 1 ] );
            } );
        } );
    } );

    describe( 'getting parsed elapsed time from datetime string', function() {
        var dn = new Dn();

        [ false, true, null, 'a', {},
            []
        ].forEach( function( test ) {
            it( 'returns "error" when an invalid datetime string is provided', function() {
                expect( dn._getParsedElapsedTime( test ) ).to.equal( 'error' );
            } );
        } );
    } );

    describe( 'parsing elapsed time from milliseconds', function() {
        var dn = new Dn();

        [ -1, -Infinity, false, true, null, 'a', {},
            []
        ].forEach( function( test ) {
            it( 'returns "error" when not a number or a negative number is provided', function() {
                expect( dn._getParsedElapsedTime( test ) ).to.equal( 'error' );
            } );
        } );

        [
            [ 0, '0 minute(s)' ],
            [ 29999, '0 minute(s)' ],
            [ 30000, '1 minute(s)' ],
            [ 59.5 * 60 * 1000 - 1, '59 minute(s)' ],
            [ 59.5 * 60 * 1000, '1 hour(s)' ],
            [ 1.5 * 60 * 60 * 1000, '2 hour(s)' ],
            [ 23.5 * 60 * 60 * 1000 - 1, '23 hour(s)' ],
            [ 23.5 * 60 * 60 * 1000, '1 day(s)' ],
            [ ( 5 / 12 + 30 - 0.5 ) * 24 * 60 * 60 * 1000 - 1, '30 day(s)' ],
            [ ( 5 / 12 + 30 - 0.5 ) * 24 * 60 * 60 * 1000, '1 month(s)' ],
            [ 11.5 * ( 5 / 12 + 30 ) * 24 * 60 * 60 * 1000 - 1, '11 month(s)' ],
            [ 11.5 * ( 5 / 12 + 30 ) * 24 * 60 * 60 * 1000, '1 year(s)' ],
            [ 1.5 * 12 * ( 5 / 12 + 30 ) * 24 * 60 * 60 * 1000, '2 year(s)' ],
        ].forEach( function( test ) {
            it( 'returns correct human-readable response', function() {
                expect( dn._parseElapsedTime( test[ 0 ] ) ).to.equal( test[ 1 ] );
            } );
        } );

    } )

} );
