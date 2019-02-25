/**
 * Deals with browser storage
 */

import store from './store';
import events from 'enketo-core/src/js/event';
import settings from './settings';
import connection from './connection';
import $ from 'jquery';
import assign from 'lodash/assign';

let hash;

function init( survey ) {
    return store.init()
        .then( () => get( survey ) )
        .then( _removeQueryString )
        .then( result => {
            if ( result ) {
                return result;
            } else {
                return set( survey );
            }
        } )
        .then( _processDynamicData )
        .then( _setUpdateIntervals )
        .then( _setResetListener );
}

function get( survey ) {
    return store.survey.get( survey.enketoId );
}

function set( survey ) {
    return connection.getFormParts( survey )
        .then( _swapMediaSrc )
        .then( store.survey.set );
}

function remove( survey ) {
    return store.survey.remove( survey.enketoId );
}

function _removeQueryString( survey ) {
    const bareUrl = window.location.pathname + window.location.hash;

    history.replaceState( null, '', bareUrl );

    return survey;
}

function _processDynamicData( survey ) {
    // TODO: In the future this method could perhaps be used to also store
    // dynamic defaults. However, the issue would be to figure out how to clear
    // those defaults.
    if ( !survey ) {
        return survey;
    }
    return store.dynamicData.get( survey.enketoId )
        .then( data => {
            const newData = {
                enketoId: survey.enketoId
            };
            assign( newData, data );
            // Carefully compare settings data with stored data to determine what to update.

            // submissionParameter
            if ( settings.submissionParameter.name ) {
                if ( settings.submissionParameter.value ) {
                    // use the settings value
                    newData.submissionParameter = settings.submissionParameter;
                } else if ( settings.submissionParameter.value === '' ) {
                    // delete value
                    delete newData.submissionParameter;
                } else if ( data && data.submissionParameter && data.submissionParameter.value ) {
                    // use the stored value
                    settings.submissionParameter.value = data.submissionParameter.value;
                }
            } else {
                delete newData.submissionParameter;
            }

            // parentWindowOrigin
            if ( typeof settings.parentWindowOrigin !== 'undefined' ) {
                if ( settings.parentWindowOrigin ) {
                    // use the settings value
                    newData.parentWindowOrigin = settings.parentWindowOrigin;
                } else if ( settings.parentWindowOrigin === '' ) {
                    // delete value
                    delete newData.parentWindowOrigin;
                } else if ( data && data.parentWindowOrigin ) {
                    // use the stored value
                    settings.parentWindowOrigin = data.parentWindowOrigin;
                }
            } else {
                delete newData.parentWindowOrigin;
            }

            return store.dynamicData.update( newData );
        } )
        .then( () => survey );
}

function _setUpdateIntervals( survey ) {
    hash = survey.hash;

    // Check for form update upon loading.
    // Note that for large Xforms where the XSL transformation takes more than 30 seconds, 
    // the first update make take 20 minutes to propagate to the browser of the very first user(s) 
    // that open the form right after the XForm update.
    setTimeout( () => {
        _updateCache( survey );
    }, 3 * 1000 );
    // check for form update every 20 minutes
    setInterval( () => {
        _updateCache( survey );
    }, 20 * 60 * 1000 );

    return Promise.resolve( survey );
}

/**
 * Form resets require reloading the form media.
 * This makes form resets slower, but it makes initial form loads faster.
 *
 * @param {[type]} survey [description]
 */
function _setResetListener( survey ) {

    $( document ).on( 'formreset', function( event ) {
        if ( event.target.nodeName.toLowerCase() === 'form' ) {
            survey.$form = $( this );
            updateMedia( survey );
        }
    } );

    return Promise.resolve( survey );
}

/**
 * Handles loading form media for newly added repeats.
 *
 * @param {[type]} survey [description]
 */
function _setRepeatListener( survey ) {
    //Instantiate only once, after loadMedia has been completed (once)
    survey.$form[ 0 ].addEventListener( events.AddRepeat().type, event => {
        _loadMedia( survey, $( event.target ) );
    } );
    return Promise.resolve( survey );
}

function _swapMediaSrc( survey ) {
    survey.form = survey.form.replace( /(src="[^"]*")/g, 'data-offline-$1 src=""' );

    return Promise.resolve( survey );
}

/**
 * Updates maximum submission size if this hasn't been defined yet.
 * The first time this function is called is when the user is online.
 * If the form/data server updates their max size setting, this value
 * will be updated the next time the cache is refreshed.
 *
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function updateMaxSubmissionSize( survey ) {

    if ( !survey.maxSize ) {
        return connection.getMaximumSubmissionSize()
            .then( maxSize => {
                if ( maxSize ) {
                    survey.maxSize = maxSize;
                    // Ignore resources. These should not be updated.
                    delete survey.resources;
                    return store.survey.update( survey );
                }
                return survey;
            } );
    } else {
        return Promise.resolve( survey );
    }
}

/**
 * Loads survey resources either from the store or via HTTP (and stores them).
 *
 * @param  {[type]} survey [description]
 * @return {Promise}        [description]
 */
function updateMedia( survey ) {
    const requests = [];

    // if survey.resources exists, the resources are available in the store
    if ( survey.resources ) {
        return _loadMedia( survey )
            .then( _setRepeatListener );
    }

    survey.resources = [];

    _getElementsGroupedBySrc( survey.$form.add( $( '.form-header' ) ) ).forEach( elements => {
        const src = elements[ 0 ].dataset.offlineSrc;
        requests.push( connection.getMediaFile( src ) );
    } );

    return Promise.all( requests.map( _reflect ) )
        .then( resources => {
            // filter out the failed requests (undefined)
            resources = resources.filter( resource => !!resource );
            survey.resources = resources;
            return survey;
        } )
        // store any resources that were succesful
        .then( store.survey.update )
        .then( _loadMedia )
        .then( _setRepeatListener )
        .catch( error => {
            console.error( 'loadMedia failed', error );
            // Let the flow continue. 
            return survey;
        } );
}

/**
 * To be used with Promise.all if you want the results to be returned even if some 
 * have failed. Failed tasks will return undefined.
 *
 * @param  {Promise} task [description]
 * @return {*}         [description]
 */
function _reflect( task ) {
    return task
        .then( response => response,
            error => {
                console.error( error );
                return;
            } );
}

function _loadMedia( survey, $target ) {
    let resourceUrl;
    const URL = window.URL || window.webkitURL;

    $target = $target || survey.$form.add( $( '.form-header' ) );

    _getElementsGroupedBySrc( $target ).forEach( elements => {
        const src = elements[ 0 ].dataset.offlineSrc;

        store.survey.resource.get( survey.enketoId, src )
            .then( resource => {
                if ( !resource || !resource.item ) {
                    console.error( 'resource not found or not complete', src );
                    return;
                }
                // create a resourceURL
                resourceUrl = URL.createObjectURL( resource.item );
                // add this resourceURL as the src for all elements in the group
                elements.forEach( element => {
                    element.src = resourceUrl;
                } );
            } );
    } );

    // TODO: revoke objectURL if not inside a repeat
    // add eventhandler to last element in a group?
    // $( element ).one( 'load', function() {
    //    console.log( 'revoking object URL to free up memory' );
    //    URL.revokeObjectURL( resourceUrl );
    // } );
    return Promise.resolve( survey );
}

function _getElementsGroupedBySrc( $target ) {
    const groupedElements = [];
    const urls = {};
    let $els = $target.find( '[data-offline-src]' );

    $els.each( function() {
        if ( !urls[ this.dataset.offlineSrc ] ) {
            const src = this.dataset.offlineSrc;
            const $group = $els.filter( function() {
                if ( this.dataset.offlineSrc === src ) {
                    // remove from $els to improve performance
                    $els = $els.not( `[data-offline-src="${src}"]` );
                    return true;
                }
            } );

            urls[ src ] = true;
            groupedElements.push( $.makeArray( $group ) );
        }
    } );

    return groupedElements;
}

function _updateCache( survey ) {

    console.log( 'Checking for survey update...' );

    connection.getFormPartsHash( survey )
        .then( version => {
            if ( hash === version ) {
                console.log( 'Cached survey is up to date!', hash );
            } else {
                console.log( 'Cached survey is outdated! old:', hash, 'new:', version );
                return connection.getFormParts( survey )
                    .then( formParts => {
                        // media will be updated next time the form is loaded if resources is undefined
                        formParts.resources = undefined;
                        return formParts;
                    } )
                    .then( _swapMediaSrc )
                    .then( store.survey.update )
                    .then( result => {
                        // set the hash so that subsequent update checks won't redownload the form
                        hash = result.hash;
                        console.log( 'Survey is now updated in the store. Need to refresh.' );
                        $( document ).trigger( 'formupdated' );
                    } );
            }
        } )
        .catch( error => {
            // if the form has been de-activated or removed from the server
            if ( error.status === 404 ) {
                // remove it from the store
                remove( survey )
                    .then( () => {
                        // TODO notify user to refresh or trigger event on form
                        console.log( `survey ${survey.enketoId} removed from storage` );
                    } )
                    .catch( e => {
                        console.error( 'an error occurred when attempting to remove the survey from storage', e );
                    } );
            } else {
                console.log( 'Could not obtain latest survey or hash from server or failed to save it. Probably offline.', error.stack );
            }
        } );
}

/**
 * Completely flush the form cache (not the data storage)
 *
 * @return {Promise} [description]
 */
function flush() {
    return store.survey.removeAll()
        .then( () => {
            console.log( 'Done! The form cache is empty now. (Records have not been removed)' );
            return;
        } );
}

export default {
    init,
    get,
    updateMaxSubmissionSize,
    updateMedia,
    remove,
    flush
};
