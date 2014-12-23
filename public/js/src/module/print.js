/**
 * @preserve Copyright 2014 Martijn van de Rijdt
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Deals with printing
 */

define( [ 'jquery' ], function( $ ) {
    "use strict";
    var dpi, printStyleSheet, $printStyleSheetLink;

    /**
     * Gets print stylesheets
     * @return {Element} [description]
     */
    function getPrintStyleSheet() {
        var sheet, media;
        // document.styleSheets is an Object not an Array
        for ( var i in document.styleSheets ) {
            sheet = document.styleSheets[ i ];
            console.log( 'checking prop', i, sheet );
            if ( sheet.media.mediaText === 'print' ) {
                return sheet;
            }
        }
        return null;
    }

    function getPrintStyleSheetLink() {
        return $( 'link[media="print"]:eq(0)' );
    }

    /**
     * Applies the print stylesheet to the current view by changing stylesheets media property to 'all'
     */
    function styleToAll() {
        printStyleSheet = printStyleSheet || getPrintStyleSheet();
        $printStyleSheetLink = $printStyleSheetLink || getPrintStyleSheetLink();
        //Chrome:
        printStyleSheet.media.mediaText = 'all';
        //Firefox:
        $printStyleSheetLink.attr( 'media', 'all' );
    }

    /**
     * Resets the print stylesheet to only apply to media 'print'
     */
    function styleReset() {
        printStyleSheet.media.mediaText = 'print';
        $printStyleSheetLink.attr( 'media', 'print' );
        $( '.print-height-adjusted, .print-width-adjusted' )
            .removeAttr( 'style' )
            .removeClass( 'print-height-adjusted print-width-adjusted' );
        $( '.back-to-screen-view' ).off( 'click' ).remove();
    }

    /**
     * Prints the form after first setting page breaks (every time it is called)
     */
    function printForm() {
        window.print();
    }

    return printForm;
} );
