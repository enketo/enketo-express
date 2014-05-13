/* global setTimeout */
"use strict";

var transformer = require( 'node_xslt' );
var debug = require( 'debug' )( 'transformer' );

/**
 * Performs XSLT transformation on XForm asynchronously.
 * @param  {string} xform XForm string
 * @return {Function}     callback function
 */
var transform = function( xform, callback ) {
    var doc, formStylesheet, instanceStylesheet,
        error = null,
        result = {},
        start = new Date().getTime();

    // make this asynchronous, sort of
    setTimeout( function() {
        try {
            doc = transformer.readXmlString( xform );

            formStylesheet = transformer.readXsltFile( './lib/enketo-xslt/openrosa2html5form_php5.xsl' );
            result.form = transformer.transform( formStylesheet, doc, [ 'wtf', 'why' ] );

            instanceStylesheet = transformer.readXsltFile( './lib/enketo-xslt/openrosa2xmlmodel.xsl' );
            result.instance = transformer.transform( instanceStylesheet, doc, [ 'wtf', 'why' ] );

            debug( 'form and instance transformation took', ( new Date().getTime() - start ) / 1000, 'seconds' );
        } catch ( e ) {
            error = e || new Error( 'unknown transformation error' );
            debug( 'error during xslt transformation', error );
        }
        return callback( error, result );
    }, 0 );
};

exports.transform = transform;
