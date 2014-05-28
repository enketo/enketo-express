define( [ 'jquery' ], function( $ ) {
    "use strict";
    // plugin to select the first word(s) of a string and capitalize it
    $.fn.capitalizeStart = function( numWords ) {
        if ( !numWords ) {
            numWords = 1;
        }
        var node = this.contents().filter( function() {
                return this.nodeType == 3;
            } ).first(),
            text = node.text(),
            first = text.split( " ", numWords ).join( " " );

        if ( !node.length )
            return;

        node[ 0 ].nodeValue = text.slice( first.length );
        node.before( '<span class="capitalize">' + first + '</span>' );
    };

    $.fn.btnBusyState = function( busy ) {
        var $button, btnContent;
        return this.each( function() {
            $button = $( this );
            btnContent = $button.data( 'btnContent' );

            if ( busy && !btnContent ) {
                btnContent = $button.html();
                $button.data( 'btnContent', btnContent );
                $button
                    .empty()
                    .append( '<progress></progress>' )
                    .attr( 'disabled', true );
            } else if ( !busy && btnContent ) {
                $button.data( 'btnContent', null );
                $button
                    .empty()
                    .append( btnContent )
                    .removeAttr( 'disabled' );
            }
        } );
    };

} );
