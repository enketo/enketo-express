/* global setTimeout */
"use strict";

var transformer = require( 'node_xslt' );
var Q = require( 'q' );
var libxmljs = require( "libxmljs" );
var debug = require( 'debug' )( 'transformer' );

/**
 * Performs XSLT transformation on XForm asynchronously.
 * @param  {string} xform XForm string
 * @return {Function}     promise
 */
function _transform( xform, manifest ) {
    var error, errorMsg, doc, formStylesheet, instanceStylesheet, xsltEndTime,
        deferred = Q.defer(),
        result = {},
        startTime = new Date().getTime();

    // make this asynchronous, sort of
    setTimeout( function() {
        try {
            doc = transformer.readXmlString( xform );

            formStylesheet = transformer.readXsltFile( './lib/enketo-xslt/openrosa2html5form_php5.xsl' );
            result.form = _stripRoot( transformer.transform( formStylesheet, doc, [ 'wtf', 'why' ] ) );

            instanceStylesheet = transformer.readXsltFile( './lib/enketo-xslt/openrosa2xmlmodel.xsl' );
            result.model = _stripRoot( transformer.transform( instanceStylesheet, doc, [ 'wtf', 'why' ] ) );

            xsltEndTime = new Date().getTime();
            debug( 'form and instance XSLT transformation took ' + ( xsltEndTime - startTime ) / 1000 + ' seconds' );

            result.form = _replaceMediaSources( result.form, manifest );
            debug( 'post-processing transformation result took ' + ( new Date().getTime() - xsltEndTime ) / 1000 + ' seconds' );

            deferred.resolve( result );
        } catch ( e ) {
            error = ( e ) ? new Error( e ) : new Error( 'unknown transformation error' );
            debug( 'error during xslt transformation', error );
            deferred.reject( error );
        }
    }, 0 );

    return deferred.promise;
}

function _stripRoot( xml ) {
    var xmlDoc = libxmljs.parseXml( xml );
    return xmlDoc.root().get( '*' ).toString( false );
}

function _replaceMediaSources( form, manifest ) {
    var formDoc;

    if ( !manifest ) {
        return form;
    }

    formDoc = libxmljs.parseXml( form );

    // iterate through each media element
    formDoc.find( '//*[@src]' ).forEach( function( mediaEl ) {
        manifest.some( function( file ) {
            if ( file.filename === mediaEl.attr( 'src' ).value() ) {
                mediaEl.attr( 'src', _toLocalMediaUrl( file.downloadUrl ) );
                return true;
            }
            return false;
        } );
    } );

    // add form logo if existing in manifest
    manifest.some( function( file ) {
        if ( file.filename === 'form_logo.png' ) {
            formDoc.get( '//*[@class="form-logo"]' )
                .node( 'img' )
                .attr( 'src', _toLocalMediaUrl( file.downloadUrl ) );
            return true;
        }
    } );

    //TODO: probably result in selfclosing tags for empty elements where not allowed in HTML. Check this.
    return formDoc.toString();
}

function _toLocalMediaUrl( url ) {
    var localUrl = '/media/get/' + url.replace( /(https?):\/\//, '$1/' );
    localUrl = localUrl.replace( /:/, '%3A' );

    return localUrl;
}

exports.transform = _transform;
