// Extend the Enketo Core Form Model, and expose it for local testing.

'use strict';

var Model = require( 'enketo-core/src/js/Form-model' );
var $ = require( 'jquery' );

Model.prototype.getValidationEventData = function( el, type ) {
    var fullPath = this.getXPath( el, 'instance', true );
    var xmlFragment = this.getXmlFragmentStr( el );
    var file = ( type === 'binary' ) ? el.textContent : undefined;
    return {
        fullPath: fullPath,
        xmlFragment: xmlFragment,
        file: file
    };
};

Model.prototype.getRemovalEventData = function( el ) {
    var xmlFragment = this.getXmlFragmentStr( el );
    return {
        xmlFragment: xmlFragment
    };
};

Model.prototype.getXmlFragmentStr = function( node ) {
    var clone;
    var n;
    var dataStr;
    var tempAttrName = 'temp-id';
    var id = Math.floor( Math.random() * 100000000 );
    node.setAttribute( tempAttrName, id );
    clone = this.rootElement.cloneNode( true );
    node.removeAttribute( tempAttrName );
    n = clone.querySelector( '[' + tempAttrName + '="' + id + '"]' );
    n.removeAttribute( tempAttrName );

    $( n ).children().remove();

    while ( n !== clone ) {
        $( n ).siblings().remove();
        n = n.parentNode;
    }

    dataStr = ( new XMLSerializer() ).serializeToString( clone, 'text/xml' );
    // restore default namespaces
    dataStr = dataStr.replace( /\s(data-)(xmlns\=("|')[^\s\>]+("|'))/g, ' $2' );
    return dataStr;
};

module.exports = Model;
