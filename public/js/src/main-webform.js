require( [ 'require-config' ], function( rc ) {
    "use strict";

    require( [ 'controller-webform', 'jquery' ],
        function( controller, $, settings, gui, connection ) {
            var instanceToEdit = window.instanceStrToEdit || undefined;
            $( document ).ready( function() {
                controller.init( 'form.or:eq(0)', model, instanceToEdit );
            } );
        } );
} );
