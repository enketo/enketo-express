/**
 * Deals with the main GUI elements (but not the survey form)
 */

import support from 'enketo-core/src/js/support';

import settings from './settings';
import * as printHelper from 'enketo-core/src/js/print';
import { init as initTranslator, t } from './translator';
import sniffer from './sniffer';
import vex from 'vex-js';
import $ from 'jquery';
import './plugin';
import vexEnketoDialog from 'vex-dialog-enketo';

let pages;
let homeScreenGuidance;
let updateStatus;
let feedbackBar;
let formTheme;

// Customize vex
vex.registerPlugin( vexEnketoDialog );
vex.defaultOptions.className = 'vex-theme-plain';

/**
 * Initializes the GUI module
 */
function init() {
    initTranslator()
        .then( setEventHandlers );

    // avoid Windows console errors
    if ( typeof window.console === 'undefined' ) {
        window.console = {
            log() {}
        };
    }
    if ( typeof window.console.debug === 'undefined' ) {
        console.debug = console.log;
    }

    // override feature detection (for development purposes)
    if ( settings.touch ) {
        support.touch = true;
        $( 'html' ).addClass( 'touch' );
    } else if ( settings.touch === false ) {
        support.touch = false;
        $( 'html' ).removeClass( 'touch' );
    }
}

/**
 * Sets the default (common) UI eventhandlers (extended in each class for custom handlers)
 */
function setEventHandlers() {
    const $doc = $( document );

    $doc.on( 'click', '#feedback-bar .close, .touch #feedback-bar', () => {
        feedbackBar.hide();
        return false;
    } );

    $doc.on( 'click', '.side-slider .close, .slider-overlay', () => {
        $( 'body' ).removeClass( 'show-side-slider' );
    } );

    $( '.form-header__button--print' ).on( 'click', printForm );

    $( '.side-slider__toggle, .offline-enabled__queue-length' ).on( 'click', () => {
        const $body = $( 'body' );
        window.scrollTo( 0, 0 );
        $body.toggleClass( 'show-side-slider' );
    } );

    $( '.offline-enabled__icon' ).on( 'click', () => {
        const msg = t( 'alert.offlinesupported.msg' );
        alert( msg, t( 'alert.offlinesupported.heading' ), 'normal' );
    } );

    // use delegated handler because btnBusyState removes button content
    $( '#save-draft' ).on( 'click', '.save-draft-info', () => {
        //const icon1 = document.querySelector( '.offline-enabled__queue-length' ).cloneNode( true );
        //icon1.style.border = '1px solid #ccc';
        const icon = document.querySelector( '.side-slider__toggle' ).cloneNode( true );
        icon.removeAttribute( 'aria-label' );
        icon.style.position = 'static';
        icon.style[ 'margin' ] = '10px auto';
        icon.style.display = 'block';
        icon.disabled = true;
        const msg = t( 'alert.savedraftinfo.msg', {
            icon: icon.outerHTML,
            // switch off escaping just for this known safe value
            interpolation: {
                escapeValue: false
            }
        } );
        alert( msg, t( 'alert.savedraftinfo.heading' ), 'normal' );

    } );

    $( 'a.branding' ).on( 'click', function() {
        const href = this.getAttribute( 'href' );
        return ( !href || href === '#' ) ? false : true;
    } );

    if ( _getHomeScreenGuidance() ) {
        $( '.form-header__button--homescreen' ).removeClass( 'hide' ).on( 'click', alertHomeScreenGuidance );
    }

    $doc.on( 'xpatherror', ( ev, error ) => {
        const email = settings[ 'supportEmail' ];
        const link = `<a href="mailto:${email}?subject=xpath errors for: ${encodeURIComponent( location.href )}&body=${encodeURIComponent( error )}" target="_blank" >${email}</a>`;

        alert( `${t( 'alert.xpatherror.msg', {
    emailLink: link,
    // switch off escaping just for this known safe value
    interpolation: {
        escapeValue: false
    }
} )}<ul class="error-list"><li>${error}</li></ul>`, t( 'alert.xpatherror.heading' ) );
    } );

    $( '.side-slider__app-version' ).on( 'click', () => {
        $( '.side-slider__advanced' ).toggleClass( 'hide' );
    } );
}

function swapTheme( formParts ) {
    const requestedTheme = formParts.theme;
    const $styleSheets = $( 'link[rel=stylesheet][href*=theme-]' );
    const matches = /\/theme-([A-z]+)(\.print)?\.css/.exec( $styleSheets.eq( 0 ).attr( 'href' ) );

    formTheme = matches !== null ? matches[ 1 ] : null;

    return new Promise( resolve => {
        if ( requestedTheme && requestedTheme !== formTheme && settings.themesSupported.some( supportedTheme => requestedTheme === supportedTheme ) ) {
            const $replacementSheets = [];
            $styleSheets.each( function() {
                $replacementSheets.push( $( this.outerHTML.replace( /(href=.*\/theme-)[A-z]+((\.print)?\.css)/, `$1${requestedTheme}$2` ) ) );
            } );
            console.log( 'Swapping theme to', requestedTheme );
            $replacementSheets[ 0 ].on( 'load', () => {
                formTheme = requestedTheme;
                resolve( formParts );
            } );

            $styleSheets.each( function( index ) {
                $( this ).replaceWith( $replacementSheets[ index ] );
            } );

        } else {
            console.log( 'Keeping default theme.' );
            delete formParts.theme;
            resolve( formParts );
        }
    } );
}

feedbackBar = {
    /**
     * Shows an unobtrusive feedback bar to the user.
     *
     * @param {string} message
     * @param {number=} duration duration in seconds for the message to show
     */
    show( message, duration ) {
        let $msg;
        const $fbBar = $( '#feedback-bar' );

        duration = ( duration ) ? duration * 1000 : 10 * 1000;

        // max 2 messages displayed
        $fbBar.addClass( 'feedback-bar--show' )
            .find( 'p' ).eq( 1 ).remove();

        // if an already shown message isn't exactly the same
        if ( $fbBar.find( 'p' ).html() !== message ) {
            $msg = $( '<p></p>' ).append( message );
            $fbBar.prepend( $msg );
        }

        // automatically remove feedback after a period
        setTimeout( () => {
            let siblings;
            if ( typeof $msg !== 'undefined' ) {
                siblings = $msg.siblings( 'p' ).length;
                $msg.remove();
                if ( siblings === 0 ) {
                    feedbackBar.hide();
                }
            }
        }, duration );
    },
    hide() {
        $( '#feedback-bar' ).removeClass( 'feedback-bar--show' )
            .find( 'p' ).remove();
    }
};

/**
 * Select what type of unobtrusive feedback message to show to the user.
 *
 * @param {string}  message
 * @param {number=} duration duration in seconds for the message to show
 */
function feedback( message, duration ) {
    if ( !support.touch ) {
        feedbackBar.show( message, duration );
    } else {
        alert( message, t( 'feedback.header' ), 'info', duration );
    }
}

/**
 * Shows a modal alert dialog.
 * TODO: parameters should change to (content, options)
 *
 * @param {string} message
 * @param {string=} heading
 * @param {string=} level css class or normal (no styling) ('alert', 'info', 'warning', 'error', 'success')
 * @param {number=} duration duration in secondsafter which dialog should self-destruct
 */
function alert( message, heading, level, duration ) {
    level = level || 'error';
    vex.closeAll();
    vex.dialog.alert( {
        unsafeMessage: message,
        title: heading || t( 'alert.default.heading' ),
        messageClassName: ( level === 'normal' ) ? '' : `alert-box ${level}`,
        buttons: [ {
            text: t( 'alert.validationsuccess.heading' ),
            type: 'submit',
            className: 'btn btn-primary small'
        } ],
        autoClose: duration,
        showCloseButton: true
    } );
    return Promise.resolve();
}

/**
 * Shows a confirmation dialog
 *
 * @param {?(Object.<string, (string|boolean)>|string)=} content - In its simplest form this is just a string but it can
 *                                                         also an object with parameters msg, heading and errorMsg.
 * @param {Object=} choices - [type/description]
 */
function confirm( content, choices ) {
    let errorMsg = '';
    const message = ( typeof content === 'string' ) ? content : content.msg;

    if ( content.errorMsg ) {
        errorMsg = `<p class="alert-box error">${content.errorMsg}</p>`;
    }

    return new Promise( resolve => {
        choices = choices || {};
        choices.allowAlternativeClose = ( typeof choices.allowAlternativeClose !== 'undefined' ) ? choices.allowAlternativeClose : true;

        vex.closeAll();
        vex.dialog.confirm( {
            unsafeMessage: errorMsg + ( message || t( 'confirm.default.msg' ) ),
            title: content.heading || t( 'confirm.default.heading' ),
            buttons: [
                $.extend( {}, vex.dialog.buttons.YES, {
                    text: choices.posButton || t( 'confirm.default.posButton' ),
                    className: 'btn btn-primary small'
                } ),
                $.extend( {}, vex.dialog.buttons.NO, {
                    text: choices.negButton || t( 'confirm.default.negButton' ),
                    className: 'btn btn-default small'
                } )
            ],
            callback: resolve,
            afterClose: resolve,
            showCloseButton: choices.allowAlternativeClose,
            escapeButtonCloses: choices.allowAlternativeClose,
            overlayClosesOnClick: choices.allowAlternativeClose
        } );
    } );
}

function prompt( content, choices, inputs ) {
    let errorMsg = '';
    const message = ( typeof content === 'string' ) ? content : content.msg;

    if ( content.errorMsg ) {
        errorMsg = `<p class="alert-box error">${content.errorMsg}</p>`;
    }

    return new Promise( resolve => {
        choices = choices || {};

        vex.closeAll();
        vex.dialog.prompt( {
            unsafeMessage: errorMsg + ( message || '' ),
            title: content.heading || t( 'prompt.default.heading' ),
            buttons: [
                $.extend( {}, vex.dialog.buttons.YES, {
                    text: choices.posButton || t( 'confirm.default.posButton' ),
                    className: 'btn btn-primary small'
                } ),
                $.extend( {}, vex.dialog.buttons.NO, {
                    text: choices.negButton || t( 'confirm.default.negButton' ),
                    className: 'btn btn-default small'
                } )
            ],
            input: inputs,
            callback: resolve,
            showCloseButton: true
        } );
    } );
}

/**
 * Shows modal asking for confirmation to redirect to login screen
 * 
 * @param  {string=} msg       message to show
 * @param  {string=} serverURL serverURL for which authentication is required
 */
function confirmLogin( msg /*, serverURL*/ ) {
    msg = msg || t( 'confirm.login.msg' );

    confirm( {
            msg,
            heading: t( 'confirm.login.heading' )
        }, {
            posButton: t( 'confirm.login.posButton' ),
            negButton: t( 'confirm.login.negButton' )
        } )
        .then( confirmed => {
            if ( !confirmed ) {
                return;
            }
            let search = `?return_url=${encodeURIComponent( location.href )}`;
            search += ( settings.touch ) ? `&touch=${settings.touch}` : '';
            search += ( settings.debug ) ? `&debug=${settings.debug}` : '';
            location.href = `${location.protocol}//${location.host}${settings.loginUrl}${search}`;
        } );

}

/**
 * Shows modal with load errors
 * @param  {Array.<string>} loadErrors  load error messagesg
 * @param  {string=}        advice  a string with advice
 */
function alertLoadErrors( loadErrors, advice ) {
    const errorStringHTML = `<ul class="error-list"><li>${loadErrors.join( '</li><li>' )}</li></ul>`;
    const errorStringEmail = `* ${loadErrors.join( '\n* ' )}`;
    const email = settings[ 'supportEmail' ];
    const link = `<a href="mailto:${email}?subject=loading errors for: ${encodeURIComponent( location.href )}&body=${encodeURIComponent( errorStringEmail )}" target="_blank" >${email}</a>`;
    const params = {
        emailLink: link,
        count: loadErrors.length,
        // switch off escaping just for this known safe value
        interpolation: {
            escapeValue: false
        }
    };

    advice = advice || '';

    alert(
        `<p>${t( 'alert.loaderror.msg1', params )} ${advice}</p><p>${t( 'alert.loaderror.msg2', params )}</p>${errorStringHTML}`, t( 'alert.loaderror.heading', params )
    );
}

function alertHomeScreenGuidance() {
    alert( _getHomeScreenGuidance(), t( 'alert.addtohomescreen.heading' ), 'normal' );
}

function _getHomeScreenGuidance() {
    let imageClass1;
    const browser = sniffer.browser;
    const os = sniffer.os;

    if ( homeScreenGuidance ) {
        // keep calm
    } else if ( os.ios && browser.safari ) {
        imageClass1 = 'ios-safari';
        homeScreenGuidance = t( 'alert.addtohomescreen.iossafari.msg', _getHomeScreenGuidanceObj( imageClass1 ) );
    } else if ( os.android && browser.chrome ) {
        imageClass1 = 'android-chrome';
        homeScreenGuidance = t( 'alert.addtohomescreen.androidchrome.msg', _getHomeScreenGuidanceObj( imageClass1 ) );
    } else if ( os.android && browser.firefox ) {
        homeScreenGuidance = t( 'alert.addtohomescreen.androidfirefox.msg', _getHomeScreenGuidanceObj() );
    }

    return homeScreenGuidance;
}

function _getHomeScreenGuidanceObj( imageClass1, imageClass2 ) {
    return {
        image1: ( imageClass1 ) ? `<span class="${imageClass1}"/>` : '',
        image2: ( imageClass2 ) ? `<span class="${imageClass2}"/>` : '',
        // switch off escaping just for these known safe values
        interpolation: {
            escapeValue: false
        }
    };
}

/**
 * Prompts for print settings (for Grid Theme) and prints from the regular view of the form.
 */
function printForm() {
    const components = getPrintDialogComponents();
    const texts = {
        heading: components.heading,
        msg: components.msg
    };
    const options = {
        posButton: components.posButton,
        negButton: components.negButton,
    };
    const inputs = components.gridInputs + components.gridWarning;

    if ( formTheme === 'grid' || ( !formTheme && printHelper.isGrid() ) ) {
        printHelper.openAllDetails();
        return prompt( texts, options, inputs )
            .then( values => {
                if ( values ) {
                    printGrid( values );
                }
            } )
            .then( printHelper.closeAllDetails );
    } else {
        printHelper.openAllDetails();
        window.print();
        printHelper.closeAllDetails();
        return Promise.resolve();
    }
}

/**
 * Separated this to allow using parts in custom print dialogs.
 * 
 */
function getPrintDialogComponents() {
    // used function because i18next needs to be initalized for t() to work
    return {
        heading: t( 'confirm.print.heading' ),
        msg: t( 'confirm.print.msg' ),
        posButton: t( 'confirm.print.posButton' ),
        negButton: t( 'alert.default.button' ),
        gridInputs: `<fieldset><legend>${t( 'confirm.print.psize' )}</legend><label><input name="format" type="radio" value="A4" required checked/><span>${t( 'confirm.print.a4' )}</span></label><label><input name="format" type="radio" value="Letter" required/><span>${t( 'confirm.print.letter' )}</span></label></fieldset><fieldset><legend>${t( 'confirm.print.orientation' )}</legend><label><input name="orientation" type="radio" value="portrait" required checked/><span>${t( 'confirm.print.portrait' )}</span></label><label><input name="orientation" type="radio" value="landscape" required/><span>${t( 'confirm.print.landscape' )}</span></label></fieldset>`,
        gridWarning: `<p class="alert-box info" >${t( 'confirm.print.reminder' )}</p>`,
    };
}

function printGrid( format ) {
    const swapped = printHelper.styleToAll();
    return printHelper.fixGrid( format, 800 )
        .then( _delay )
        .then( window.print )
        .catch( console.error )
        .then( () => {
            if ( swapped ) {
                return new Promise( resolve => {
                    setTimeout( () => {
                        printHelper.styleReset();
                        resolve();
                    }, 500 );
                } );
            }
        } );
}

function _delay( delay = 400 ) {
    return new Promise( ( resolve ) => {
        setTimeout( resolve, delay );
    } );
}

/**
 * This is function is used by PDF creation functionality from a special print view of the form..
 */
function applyPrintStyle() {
    imagesLoaded()
        .then( () => {
            if ( formTheme === 'grid' || ( !formTheme && printHelper.isGrid() ) ) {
                const paper = { format: settings.format, landscape: settings.landscape, scale: settings.scale, margin: settings.margin };
                return printHelper.fixGrid( paper );
            }
        } )
        .then( () => // allow some time for repainting
            new Promise( resolve => {
                setTimeout( resolve, 300 );
            } ) )
        .then( () => {
            window.printReady = true;
        } )
        .catch( console.error );
}

function imagesLoaded() {
    return new Promise( resolve => {
        let images = Array.prototype.slice.call( document.images );
        const interval = setInterval( () => {
            images = images.filter( image => !image.complete );
            if ( images.length === 0 ) {
                clearInterval( interval );
                resolve();
            }
        }, 150 );
    } );
}

function alertCacheUnsupported() {
    const message = t( 'alert.offlineunsupported.msg' );
    const choices = {
        posButton: t( 'alert.offlineunsupported.posButton' ),
        negButton: t( 'alert.offlineunsupported.negButton' )
    };
    confirm( {
            msg: message,
            heading: t( 'alert.offlineunsupported.heading' )
        }, choices )
        .then( confirmed => {
            if ( confirmed ) {
                window.location = settings[ 'modernBrowsersURL' ];
            }
        } );
}

/**
 * Updates various statuses in the GUI (connection, form-edited, browsersupport)
 *
 * @type {Object}
 */
updateStatus = {
    offlineCapable( offlineCapable ) {
        if ( offlineCapable ) {

            $( '.offline-enabled__icon.not-enabled' ).removeClass( 'not-enabled' );
        } else {
            $( '.offline-enabled__icon' ).addClass( 'not-enabled' );
        }
    },
    applicationVersion( version ) {
        $( '.side-slider__app-version__value' ).text( version );
    }
};

function getErrorResponseMsg( statusCode ) {
    let msg;
    const supportEmailObj = {
        supportEmail: settings.supportEmail
    };
    const contactSupport = t( 'contact.support', supportEmailObj );
    const contactAdmin = t( 'contact.admin' );
    const statusMap = {
        '0': t( 'submission.http0' ),
        '200': `${t( 'submission.http2xx' )}<br/>${contactSupport}`,
        '2xx': `${t( 'submission.http2xx' )}<br/>${contactSupport}`,
        '400': `${t( 'submission.http400' )}<br/>${contactAdmin}`,
        '401': t( 'submission.http401' ),
        '403': `${t( 'submission.http403' )}<br/>${contactAdmin}`,
        '404': t( 'submission.http404' ),
        '408': t( 'submission.http408' ),
        '4xx': t( 'submission.http4xx' ),
        '413': `${t( 'submission.http413' )}<br/>${contactSupport}`,
        '500': t( 'submission.http500', supportEmailObj ),
        '503': t( 'submission.http500', supportEmailObj ),
        '504': t( 'submission.http504', supportEmailObj ),
        '5xx': t( 'submission.http500', supportEmailObj )
    };

    statusCode = ( typeof statusCode !== 'undefined' ) ? statusCode.toString() : 'undefined';

    if ( statusMap[ statusCode ] ) {
        msg = `${statusMap[ statusCode ]} (${statusCode})`;
    } else if ( statusMap[ statusCode.replace( statusCode.substring( 1 ), 'xx' ) ] ) {
        msg = `${statusMap[ statusCode.replace( statusCode.substring( 1 ), 'xx' ) ]} (${statusCode})`;
    } else {
        msg = `${t( 'error.unknown' )} (${statusCode})`;
    }

    return msg;
}

$( document ).ready( () => {
    init();
} );

export default {
    alert,
    confirm,
    prompt,
    feedback,
    updateStatus,
    pages,
    swapTheme,
    confirmLogin,
    alertLoadErrors,
    alertCacheUnsupported,
    getErrorResponseMsg,
    applyPrintStyle,
    getPrintDialogComponents,
    printForm,
};
