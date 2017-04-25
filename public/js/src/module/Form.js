// Extend the Enketo Core Form class, and expose it for local testing.

'use strict';

var Form = require( 'enketo-core/src/js/Form' );
var $ = require( 'jquery' );

var constraintUpdate = function( updated ) {
    var $nodes;
    var that = this;

    updated = updated || {};
    $nodes = this.getRelatedNodes( 'data-constraint', '', updated );
    $nodes.trigger( 'constraintevaluated.oc' );
};
var originalInit = Form.prototype.init;

Form.prototype.evaluationCascadeAdditions = [ constraintUpdate ];

/**
 * Overrides function in Enketo Core to hide asterisk if field has value.
 * 
 * @param  {[type]} n [description]
 */
Form.prototype.updateRequiredVisibility = function( n ) {
    var node;
    if ( n.required ) {
        node = this.model.node( n.path, n.ind );
        n.$required.toggleClass( 'hide', node.getVal().toString() !== '' || !node.isRequired( n.required ) );
    }
};


Form.prototype.init = function() {
    var $nodes;
    var that = this;
    var loadErrors = originalInit.call( this );
    // Add custom functionality
    try {
        // Evaluate "required" expressions upon load to hide asterisks.
        // Evaluate "constraint" expressions upon load to show error message for fields that *have a value*.
        this.getRelatedNodes( 'data-required' ).add( $( this.getRelatedNodes( 'data-constraint' ) ) ).each( function() {
            var $input = $( this );
            that.validateInput( $input )
                .then( function( passed ) {
                    if ( !passed ) {
                        // Undo the displaying of a required error message upon load
                        that.setValid( $input, 'required' );
                    }
                } );
        } );
    } catch ( e ) {
        console.error( e );
        loadErrors.push( e.name + ': ' + e.message );
    }
    return loadErrors;
};

module.exports = Form;
