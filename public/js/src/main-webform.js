/* global modelStr, instanceStr */

require( [ 'require-config' ], function( rc ) {
    "use strict";

    require( [ 'controller-webform', 'jquery' ],
        function( controller, $, settings, gui, connection ) {
            var instanceStr = window.instanceStr || undefined;
            $( document ).ready( function() {
                controller.init( 'form.or:eq(0)', modelStr, instanceStr );
            } );
        } );
} );
