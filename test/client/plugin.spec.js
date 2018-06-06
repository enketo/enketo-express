var $ = require( 'jquery' );
require( '../../public/js/src/module/plugin' );

describe( 'JQuery plugins', function() {
    describe( 'btnText', function() {
        it( 'can change the text of a button', function() {
            var $button = $( '<button><i> </i>submit</button>' );
            $button.btnText( 'save' );
            expect( $button[ 0 ].lastChild.textContent ).to.equal( 'save' );
        } );

        it( 'can change the text of a button if busy state is busy during change', function() {
            var $button = $( '<button><i> </i>submit</button>' );
            $button.btnBusyState( true );
            $button.btnText( 'save' );
            $button.btnBusyState( false );
            expect( $button[ 0 ].lastChild.textContent ).to.equal( 'save' );
        } );
    } );
} );
