/* global setTimeout */
"use strict";

var version, xslModel, xslForm,
    Q = require( 'q' ),
    fs = require( 'fs' ),
    transformer = require( 'node_xslt' ),
    libxmljs = require( "libxmljs" ),
    utils = require( '../utils' ),
    path = require( 'path' ),
    debug = require( 'debug' )( 'transformer' ),
    xslModelPath = path.resolve( __dirname, './enketo-xslt/openrosa2xmlmodel.xsl' ),
    xslFormPath = path.resolve( __dirname, './enketo-xslt/openrosa2html5form.xsl' );

_setVersion();

/**
 * Performs XSLT transformation on XForm asynchronously.
 * @param  {string} xform XForm string
 * @return {Function}     promise
 */
function _transform( survey ) {
    var error, errorMsg, doc, formStylesheet, instanceStylesheet, xsltEndTime,
        deferred = Q.defer(),
        result = {},
        startTime = new Date().getTime();

    _setXslStrings();

    // make this asynchronous, sort of
    setTimeout( function() {
        try {
            doc = transformer.readXmlString( survey.xform );

            formStylesheet = transformer.readXsltString( xslForm );
            result.form = _stripRoot( transformer.transform( formStylesheet, doc, [ 'wtf', 'why' ] ) );

            instanceStylesheet = transformer.readXsltString( xslModel );
            survey.model = _stripRoot( transformer.transform( instanceStylesheet, doc, [ 'wtf', 'why' ] ) );

            xsltEndTime = new Date().getTime();
            debug( 'form and instance XSLT transformation took ' + ( xsltEndTime - startTime ) / 1000 + ' seconds' );

            survey.form = _replaceMediaSources( result.form, survey.manifest );
            debug( 'post-processing transformation result took ' + ( new Date().getTime() - xsltEndTime ) / 1000 + ' seconds' );

            deferred.resolve( survey );
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
                .attr( 'src', _toLocalMediaUrl( file.downloadUrl ) )
                .attr( 'alt', 'form logo' );
            return true;
        }
    } );

    //TODO: probably result in selfclosing tags for empty elements where not allowed in HTML. Check this.
    return formDoc.toString();
}

function _toLocalMediaUrl( url ) {
    var localUrl = '/media/get/' + url.replace( /(https?):\/\//, '$1/' );

    return localUrl;
}

function _setXslStrings() {
    // only read stylesheets once after app (re)starts
    xslModel = xslModel || fs.readFileSync( xslModelPath );
    xslForm = xslForm || fs.readFileSync( xslFormPath );
}

/**
 * gets a hash of the 2 XSL stylesheets
 * @return {string} hash representing version of XSL stylesheets - NOT A PROMISE
 */
function _setVersion() {
    // only perform this expensive check once after (re)starting application
    if ( !version ) {
        _setXslStrings();
        debug( 'performing expensive check to obtain XSL stylesheets version' );
        version = utils.md5( xslForm + xslModel );
    }
}

module.exports = {
    transform: _transform,
    version: version
};
