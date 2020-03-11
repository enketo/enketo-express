/**
 * Deals with storing the app using service workers.
 */

import events from './event';
import settings from './settings';

function init( survey ) {

    if ( 'serviceWorker' in navigator ) {
        window.addEventListener( 'load', function() {
            navigator.serviceWorker.register( `${settings.basePath}/x/offline-app-worker.js` )
                .then( function( registration ) {
                    // Registration was successful
                    console.log( 'Offline application service worker registration successful with scope: ', registration.scope );
                    setInterval( () => {
                        console.log( 'Checking for offlince application cache service worker update' );
                        registration.update();
                    }, 60 * 60 * 1000 );

                    if ( registration.active ) {
                        _reportOfflineLaunchCapable( true );
                    }
                    registration.addEventListener( 'updatefound', () => {
                        const newWorker = registration.installing;

                        newWorker.addEventListener( 'statechange', () => {

                            if ( newWorker.state === 'activated' ) {
                                console.log( 'New offline application service worker activated!' );
                                document.dispatchEvent( events.ApplicationUpdated() );
                            }

                        } );
                    } );

                }, function( err ) {
                    // registration failed :(
                    console.error( 'Offline application service worker registration failed: ', err );
                    _reportOfflineLaunchCapable( true );
                } );
        } );
    } else {
        console.error( 'Service workers not supported on this browser. This form cannot launch online' );
        _reportOfflineLaunchCapable( false );
    }
    return Promise.resolve( survey );

}

function _reportOfflineLaunchCapable( capable = true ) {
    document.dispatchEvent( events.OfflineLaunchCapable( { capable } ) );
}

export default {
    init,
    get serviceWorkerScriptUrl() {
        if ( 'serviceWorker' in navigator && navigator.serviceWorker.controller ) {
            return navigator.serviceWorker.controller.scriptURL;
        }
        return null;
    }
};
