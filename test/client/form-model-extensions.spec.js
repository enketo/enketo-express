/* global describe, require, beforeAll, afterAll, it */
var Model = require( '../../public/js/src/module/Form-model' );

describe( 'getting XML fragments', function() {

    it( 'works for simple models', function() {
        var x = '<model><instance><data><a>a</a><b/><c><c1>1</c1><c2>2</c2></c><meta><instanceID/></meta></data></instance></model>';
        var model = new Model( x );
        model.init();
        expect( model.getXmlFragmentStr( model.xml.querySelector( 'b' ) ) ).to.equal( '<data><b/></data>' );
        expect( model.getXmlFragmentStr( model.xml.querySelector( 'c2' ) ) ).to.equal( '<data><c><c2>2</c2></c></data>' );
    } );

    it( 'works for primary instances with a default namespace', function() {
        var x = '<model><instance><data xmlns="https://some.namespace.com/"><a>a</a><b/><c><c1>1</c1><c2>2</c2></c><meta><instanceID/></meta></data></instance></model>';
        var model = new Model( x );
        model.init();
        expect( model.getXmlFragmentStr( model.xml.querySelector( 'b' ) ) ).to.equal( '<data xmlns="https://some.namespace.com/"><b/></data>' );
        expect( model.getXmlFragmentStr( model.xml.querySelector( 'c2' ) ) ).to.equal( '<data xmlns="https://some.namespace.com/"><c><c2>2</c2></c></data>' );
    } );

    it( 'works for models that include namespaced attributes and repeats', function() {
        var x = '<model><instance><data xmlns:enk="http://enketo.org/xforms"><a>a</a><b/>' +
            '<r enk:last-used-ordinal="3" enk:ordinal="1"><n>n</n></r><r enk:ordinal="3"><n>n</n></r>' +
            '<meta><instanceID/></meta></data></instance></model>';
        var model = new Model( x );
        model.init();
        expect( model.getXmlFragmentStr( model.xml.querySelector( 'b' ) ) ).to.equal( '<data xmlns:enk="http://enketo.org/xforms"><b/></data>' );
        expect( model.getXmlFragmentStr( model.xml.querySelector( 'r' ) ) ).to.equal( '<data xmlns:enk="http://enketo.org/xforms"><r enk:last-used-ordinal="3" enk:ordinal="1"/></data>' );
        expect( model.getXmlFragmentStr( model.xml.querySelector( 'n' ) ) ).to.equal( '<data xmlns:enk="http://enketo.org/xforms"><r enk:last-used-ordinal="3" enk:ordinal="1"><n>n</n></r></data>' );
        expect( model.getXmlFragmentStr( model.xml.querySelectorAll( 'n' )[ 1 ] ) ).to.equal( '<data xmlns:enk="http://enketo.org/xforms"><r enk:ordinal="3"><n>n</n></r></data>' );
        expect( model.getXmlFragmentStr( model.xml.querySelectorAll( 'r' )[ 1 ] ) ).to.equal( '<data xmlns:enk="http://enketo.org/xforms"><r enk:ordinal="3"/></data>' );
    } );

    // TODO: add nested_repeats.xml, to enable this test
    xit( 'works for models that include tricky text nodes with carriage returns', function() {
        var model = getModel( 'nested_repeats.xml' );
        model.init();
        expect( model.getXmlFragmentStr( model.xml.querySelector( 'kids_details' ) ).replace( />\s+</g, '><' ) ).to.equal(
            '<nested_repeats xmlns:jr="http://openrosa.org/javarosa" xmlns:orx="http://openrosa.org/xforms/" id="nested_repeats"><kids><kids_details></kids_details></kids></nested_repeats>' );
    } );

} );
