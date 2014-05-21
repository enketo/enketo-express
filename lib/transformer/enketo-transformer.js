/* global setTimeout */
"use strict";

var transformer = require( 'node_xslt' );
var Q = require( 'q' );
var debug = require( 'debug' )( 'transformer' );

/**
 * Performs XSLT transformation on XForm asynchronously.
 * @param  {string} xform XForm string
 * @return {Function}     promise
 */
var transform = function( xform ) {
    var error, errorMsg, doc, formStylesheet, instanceStylesheet,
        deferred = Q.defer(),
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
            deferred.resolve( result );
        } catch ( e ) {
            error = ( e ) ? new Error( e ) : new Error( 'unknown transformation error' );
            debug( 'error during xslt transformation', error );
            deferred.reject( error );
        }
    }, 0 );

    return deferred.promise;
};

exports.transform = transform;
