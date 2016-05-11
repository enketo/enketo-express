'use strict';

var pluginName = 'discrepancyNote';
var $ = require( 'jquery' );
var Comment = require( './Dn' );

$.fn[ pluginName ] = function( options, event ) {

    options = options || {};

    return this.each( function() {
        var $this = $( this );
        var data = $this.data( pluginName );

        if ( !data && typeof options === 'object' ) {
            $this.data( pluginName, new Comment( this, options, event, pluginName ) );
        } else if ( data && typeof options == 'string' ) {
            data[ options ]( this );
        }
    } );
};

module.exports = {
    'name': pluginName,
    'selector': '.or-appearance-dn input[type="text"][data-for], .or-appearance-dn textarea[data-for]',
    'helpersRequired': [ 'input', 'pathToAbsolute', 'evaluate' ]
};
