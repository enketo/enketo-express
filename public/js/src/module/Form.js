// Extend the Enketo Core Form Model, and expose it for local testing.

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

Form.prototype.evaluationCascadeAdditions = [ constraintUpdate ];

module.exports = Form;
