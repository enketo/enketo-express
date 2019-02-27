/**
 * Deals with the main high level survey controls: saving, submitting etc.
 */

import gui from './gui';

import connection from './connection';
import settings from './settings';
import { Form } from 'enketo-core';
import { updateDownloadLink } from 'enketo-core/src/js/utils';
import events from './event';
import fileManager from './file-manager';
import { t } from './translator';
import records from './records-queue';
import $ from 'jquery';
import encryptor from './encryptor';

let form;
let formSelector;
let formData;
let formprogress;
const formOptions = {
    clearIrrelevantImmediately: false,
    printRelevantOnly: settings.printRelevantOnly
};

function init( selector, data ) {
    let advice;
    let loadErrors = [];

    formSelector = selector;
    formData = data;

    return _initializeRecords()
        .then( _checkAutoSavedRecord )
        .then( record => {
            if ( !data.instanceStr && record && record.xml ) {
                records.setActive( records.getAutoSavedKey() );
                data.instanceStr = record.xml;
            }

            if ( data.instanceAttachments ) {
                fileManager.setInstanceAttachments( data.instanceAttachments );
            }

            form = new Form( formSelector, data, formOptions );
            loadErrors = form.init();

            // Remove loader. This will make the form visible.
            // In order to aggregate regular loadErrors and GoTo loaderrors,
            // this is placed in between form.init() and form.goTo().
            $( '.main-loader' ).remove();

            if ( settings.goTo && location.hash ) {
                console.log( 'going to ', location.hash.substring( 1 ) );
                loadErrors = loadErrors.concat( form.goTo( location.hash.substring( 1 ) ) );
            }

            if ( form.encryptionKey && !encryptor.isSupported() ) {
                loadErrors.unshift( t( 'error.encryptionnotsupported' ) );
            }

            formprogress = document.querySelector( '.form-progress' );

            _setEventHandlers();
            setLogoutLinkVisibility();

            if ( loadErrors.length > 0 ) {
                throw loadErrors;
            }
            return form;
        } )
        .catch( error => {
            if ( Array.isArray( error ) ) {
                loadErrors = error;
            } else {
                loadErrors.unshift( error.message || t( 'error.unknown' ) );
            }

            advice = ( data.instanceStr ) ? t( 'alert.loaderror.editadvice' ) : t( 'alert.loaderror.entryadvice' );
            gui.alertLoadErrors( loadErrors, advice );
        } );
}

function _initializeRecords() {
    if ( !settings.offline ) {
        return Promise.resolve();
    }
    return records.init();
}

function _checkAutoSavedRecord() {
    let rec;
    if ( !settings.offline ) {
        return Promise.resolve();
    }
    return records.getAutoSavedRecord()
        .then( record => {
            if ( record ) {
                rec = record;
                return gui.confirm( {
                    heading: t( 'confirm.autosaveload.heading' ),
                    msg: t( 'confirm.autosaveload.msg' ),

                }, {
                    posButton: t( 'confirm.autosaveload.posButton' ),
                    negButton: t( 'confirm.autosaveload.negButton' ),
                    allowAlternativeClose: false
                } );
            }
        } )
        .then( confirmed => {
            if ( confirmed ) {
                return rec;
            }
            if ( rec ) {
                records.removeAutoSavedRecord();
            }
        } );
}

/**
 * Controller function to reset to a blank form. Checks whether all changes have been saved first
 * @param  {boolean=} confirmed Whether unsaved changes can be discarded and lost forever
 */
function _resetForm( confirmed ) {
    let message;

    if ( !confirmed && form.editStatus ) {
        message = t( 'confirm.save.msg' );
        gui.confirm( message )
            .then( confirmed => {
                if ( confirmed ) {
                    _resetForm( true );
                }
            } );
    } else {
        _setDraftStatus( false );
        form.resetView();
        form = new Form( formSelector, {
            modelStr: formData.modelStr,
            external: formData.external
        }, formOptions );
        const loadErrors = form.init();
        // formreset event will update the form media:
        form.view.$.trigger( 'formreset' );
        if ( records ) {
            records.setActive( null );
        }
        if ( loadErrors.length > 0 ) {
            gui.alertLoadErrors( loadErrors );
        }
    }
}

/**
 * Loads a record from storage
 *
 * @param  {string} instanceId [description]
 * @param  {=boolean?} confirmed  [description]
 */
function _loadRecord( instanceId, confirmed ) {
    let texts;
    let choices;
    let loadErrors;

    if ( !confirmed && form.editStatus ) {
        texts = {
            msg: t( 'confirm.discardcurrent.msg' ),
            heading: t( 'confirm.discardcurrent.heading' )
        };
        choices = {
            posButton: t( 'confirm.discardcurrent.posButton' ),
        };
        gui.confirm( texts, choices )
            .then( confirmed => {
                if ( confirmed ) {
                    _loadRecord( instanceId, true );
                }
            } );
    } else {
        records.get( instanceId )
            .then( record => {
                if ( !record || !record.xml ) {
                    return gui.alert( t( 'alert.recordnotfound.msg' ) );
                }

                form.resetView();
                form = new Form( formSelector, {
                    modelStr: formData.modelStr,
                    instanceStr: record.xml,
                    external: formData.external,
                    submitted: false
                }, formOptions );
                loadErrors = form.init();
                // formreset event will update the form media:
                form.view.$.trigger( 'formreset' );
                _setDraftStatus( true );
                form.recordName = record.name;
                records.setActive( record.instanceId );

                if ( loadErrors.length > 0 ) {
                    throw loadErrors;
                } else {
                    gui.feedback( t( 'alert.recordloadsuccess.msg', {
                        recordName: record.name
                    } ), 2 );
                }
                $( '.side-slider__toggle.close' ).click();
            } )
            .catch( errors => {
                console.error( 'load errors: ', errors );
                if ( !Array.isArray( errors ) ) {
                    errors = [ errors.message ];
                }
                gui.alertLoadErrors( errors, t( 'alert.loaderror.editadvice' ) );
            } );
    }
}

/**
 * Used to submit a form.
 * This function does not save the record in localStorage
 * and is not used in offline-capable views.
 */
function _submitRecord() {
    const redirect = settings.type === 'single' || settings.type === 'edit' || settings.type === 'view';
    let beforeMsg;
    let authLink;
    let level;
    let msg = '';
    const include = {
        irrelevant: false
    };

    form.view.$.trigger( 'beforesave' );

    beforeMsg = ( redirect ) ? t( 'alert.submission.redirectmsg' ) : '';
    authLink = `<a href="${settings.loginUrl}" target="_blank">${t( 'here' )}</a>`;

    gui.alert( `${beforeMsg}<div class="loader-animation-small" style="margin: 40px auto 0 auto;"/>`, t( 'alert.submission.msg' ), 'bare' );



    return new Promise( resolve => {
            const record = {
                'xml': form.getDataStr( include ),
                'files': fileManager.getCurrentFiles(),
                'instanceId': form.instanceID,
                'deprecatedId': form.deprecatedID
            };

            if ( form.encryptionKey ) {
                const formProps = {
                    encryptionKey: form.encryptionKey,
                    id: form.view.html.id, // TODO: after enketo-core support, use form.id
                    version: form.version,
                };
                resolve( encryptor.encryptRecord( formProps, record ) );
            } else {
                resolve( record );
            }
        } )
        .then( connection.uploadRecord )
        .then( result => {
            result = result || {};
            level = 'success';

            if ( result.failedFiles && result.failedFiles.length > 0 ) {
                msg = `${t( 'alert.submissionerror.fnfmsg', {
    failedFiles: result.failedFiles.join( ', ' ),
    supportEmail: settings.supportEmail
} )}<br/>`;
                level = 'warning';
            }

            // this event is used in communicating back to iframe parent window
            document.dispatchEvent( events.SubmissionSuccess() );

            if ( redirect ) {
                if ( !settings.multipleAllowed ) {
                    const now = new Date();
                    const age = 31536000;
                    const d = new Date();
                    /**
                     * Manipulate the browser history to work around potential ways to 
                     * circumvent protection against multiple submissions:
                     * 1. After redirect, click Back button to load cached version.
                     */
                    history.replaceState( {}, '', `${settings.defaultReturnUrl}?taken=${now.getTime()}` );
                    /**
                     * The above replaceState doesn't work in Safari and probably in 
                     * some other browsers (mobile). It shows the 
                     * final submission dialog when clicking Back.
                     * So we remove the form...
                     */
                    $( 'form.or' ).empty();
                    $( 'button#submit-form' ).remove();
                    d.setTime( d.getTime() + age * 1000 );
                    document.cookie = `${settings.enketoId}=${now.getTime()};path=/single;max-age=${age};expires=${d.toGMTString()};`;
                }
                msg += t( 'alert.submissionsuccess.redirectmsg' );
                gui.alert( msg, t( 'alert.submissionsuccess.heading' ), level );
                setTimeout( () => {
                    location.href = decodeURIComponent( settings.returnUrl || settings.defaultReturnUrl );
                }, 1200 );
            } else {
                msg = ( msg.length > 0 ) ? msg : t( 'alert.submissionsuccess.msg' );
                gui.alert( msg, t( 'alert.submissionsuccess.heading' ), level );
                _resetForm( true );
            }
        } )
        .catch( result => {
            let message;
            result = result || {};
            console.error( 'submission failed', result );
            if ( result.status === 401 ) {
                message = t( 'alert.submissionerror.authrequiredmsg', {
                    here: authLink,
                    // switch off escaping just for this known safe value
                    interpolation: {
                        escapeValue: false
                    }
                } );
            } else {
                message = result.message || gui.getErrorResponseMsg( result.status );
            }
            gui.alert( message, t( 'alert.submissionerror.heading' ) );
        } );
}

function _getRecordName() {
    return records.getCounterValue( settings.enketoId )
        .then( count => form.instanceName || form.recordName || `${form.surveyName} - ${count}` );
}

function _confirmRecordName( recordName, errorMsg ) {
    const texts = {
        msg: '',
        heading: t( 'formfooter.savedraft.label' ),
        errorMsg
    };
    const choices = {
        posButton: t( 'confirm.save.posButton' ),
        negButton: t( 'confirm.default.negButton' )
    };
    const inputs = `<label><span>${t( 'confirm.save.name' )}</span><span class="or-hint active">${t( 'confirm.save.hint' )}</span><input name="record-name" type="text" value="${recordName}"required /></label>`;

    return gui.prompt( texts, choices, inputs )
        .then( values => {
            if ( values ) {
                return values[ 'record-name' ];
            }
            throw new Error( 'Cancelled by user' );
        } );
}

// Save the translations in case ever required in the future, by leaving this comment in:
// t( 'confirm.save.renamemsg', {} )

function _saveRecord( recordName, confirmed, errorMsg ) {
    const draft = _getDraftStatus();
    const include = ( draft ) ? {
        irrelevant: true
    } : {
        irrelevant: false
    };

    // triggering "beforesave" event to update possible "timeEnd" meta data in form
    form.view.$.trigger( 'beforesave' );

    // check recordName
    if ( !recordName ) {
        return _getRecordName()
            .then( name => _saveRecord( name, false, errorMsg ) );
    }

    // check whether record name is confirmed if necessary
    if ( draft && !confirmed ) {
        return _confirmRecordName( recordName, errorMsg )
            .then( name => _saveRecord( name, true ) )
            .catch( () => {} );
    }

    return new Promise( resolve => {
            // build the record object
            const record = {
                'draft': draft,
                'xml': form.getDataStr( include ),
                'name': recordName,
                'instanceId': form.instanceID,
                'deprecateId': form.deprecatedID,
                'enketoId': settings.enketoId,
                'files': fileManager.getCurrentFiles()
            };

            // encrypt the record
            if ( form.encryptionKey && !draft ) {
                const formProps = {
                    encryptionKey: form.encryptionKey,
                    id: form.view.html.id, // TODO: after enketo-core support, use form.id
                    version: form.version,
                };
                resolve( encryptor.encryptRecord( formProps, record ) );
            } else {
                resolve( record );
            }
        } ).then( record => {
            // Change file object for database, not sure why this was chosen.
            record.files = record.files.map( file => ( typeof file === 'string' ) ? {
                name: file
            } : {
                name: file.name,
                item: file
            } );

            // Save the record, determine the save method
            const saveMethod = form.recordName ? 'update' : 'set';
            console.log( 'saving record with', saveMethod, record );
            return records[ saveMethod ]( record );
        } )
        .then( () => {

            records.removeAutoSavedRecord();
            _resetForm( true );

            if ( draft ) {
                gui.feedback( t( 'alert.recordsavesuccess.draftmsg' ), 3 );
            } else {
                gui.feedback( t( 'alert.recordsavesuccess.finalmsg' ), 3 );
                // The timeout simply avoids showing two messages at the same time:
                // 1. "added to queue"
                // 2. "successfully submitted"
                setTimeout( records.uploadQueue, 5 * 1000 );
            }
        } )
        .catch( error => {
            console.error( 'save error', error );
            errorMsg = error.message;
            if ( !errorMsg && error.target && error.target.error && error.target.error.name && error.target.error.name.toLowerCase() === 'constrainterror' ) {
                errorMsg = t( 'confirm.save.existingerror' );
            } else if ( !errorMsg ) {
                errorMsg = t( 'confirm.save.unkownerror' );
            }
            gui.alert( errorMsg, 'Save Error' );
        } );
}

function _autoSaveRecord() {
    // Do not auto-save a record if the record was loaded from storage
    // or if the form has enabled encryption
    if ( form.recordName || form.encryptionKey ) {
        return Promise.resolve();
    }

    // build the variable portions of the record object
    const record = {
        'xml': form.getDataStr(),
        'files': fileManager.getCurrentFiles().map( file => ( typeof file === 'string' ) ? {
            name: file
        } : {
            name: file.name,
            item: file
        } )
    };

    // save the record
    return records.updateAutoSavedRecord( record )
        .then( () => {
            console.log( 'autosave successful' );
        } )
        .catch( error => {
            console.error( 'autosave error', error );
        } );
}

function _setEventHandlers() {
    const $doc = $( document );

    $( 'button#submit-form' ).click( function() {
        const $button = $( this );
        const draft = _getDraftStatus();
        $button.btnBusyState( true );
        setTimeout( () => {
            if ( settings.offline && draft ) {
                _saveRecord()
                    .then( () => {
                        $button.btnBusyState( false );
                    } )
                    .catch( e => {
                        $button.btnBusyState( false );
                        throw e;
                    } );
            } else {
                form.validate()
                    .then( valid => {
                        if ( valid ) {
                            if ( settings.offline ) {
                                return _saveRecord();
                            } else {
                                return _submitRecord();
                            }
                        } else {
                            gui.alert( t( 'alert.validationerror.msg' ) );
                        }
                    } )
                    .catch( e => {
                        gui.alert( e.message );
                    } )
                    .then( () => {
                        $button.btnBusyState( false );
                    } );
            }
        }, 100 );
        return false;
    } );

    $( 'button#validate-form:not(.disabled)' ).click( function() {
        if ( typeof form !== 'undefined' ) {
            const $button = $( this );
            $button.btnBusyState( true );
            setTimeout( () => {
                form.validate()
                    .then( valid => {
                        $button.btnBusyState( false );
                        if ( !valid ) {
                            gui.alert( t( 'alert.validationerror.msg' ) );
                        } else {
                            gui.alert( t( 'alert.validationsuccess.msg' ), t( 'alert.validationsuccess.heading' ), 'success' );
                        }
                    } )
                    .catch( e => {
                        gui.alert( e.message );
                    } )
                    .then( () => {
                        $button.btnBusyState( false );
                    } );
            }, 100 );
        }
        return false;
    } );

    $( 'button#close-form:not(.disabled)' ).click( () => {
        const msg = t( 'alert.submissionsuccess.redirectmsg' );
        document.dispatchEvent( events.Close() );
        gui.alert( msg, t( 'alert.closing.heading' ), 'warning' );
        setTimeout( () => {
            location.href = decodeURIComponent( settings.returnUrl || settings.defaultReturnUrl );
        }, 300 );
        return false;
    } );

    $( '.record-list__button-bar__button.upload' ).on( 'click', () => {
        records.uploadQueue();
    } );

    $( '.record-list__button-bar__button.export' ).on( 'click', () => {
        const downloadLink = '<a class="vex-dialog-link" id="download-export" href="#">download</a>';

        records.exportToZip( form.surveyName )
            .then( zipFile => {
                gui.alert( t( 'alert.export.success.msg' ) + downloadLink, t( 'alert.export.success.heading' ), 'normal' );
                updateDownloadLinkAndClick( document.querySelector( '#download-export' ), zipFile );
            } )
            .catch( error => {
                let message = t( 'alert.export.error.msg', {
                    errors: error.message,
                    interpolation: {
                        escapeValue: false
                    }
                } );
                if ( error.exportFile ) {
                    message += `<p>${t( 'alert.export.error.filecreatedmsg' )}</p>${downloadLink}`;
                }
                gui.alert( message, t( 'alert.export.error.heading' ) );
                if ( error.exportFile ) {
                    updateDownloadLinkAndClick( document.querySelector( '#download-export' ), error.exportFile );
                }
            } );
    } );

    $doc.on( 'click', '.record-list__records__record[data-draft="true"]', function() {
        _loadRecord( $( this ).attr( 'data-id' ), false );
    } );

    $doc.on( 'click', '.record-list__records__record', function() {
        $( this ).next( '.record-list__records__msg' ).toggle( 100 );
    } );

    document.addEventListener( events.ProgressUpdate().type, event => {
        if ( event.target.classList.contains( 'or' ) && formprogress && event.detail ) {
            formprogress.style.width = `${event.detail}%`;
        }
    } );

    if ( inIframe() && settings.parentWindowOrigin ) {
        document.addEventListener( events.SubmissionSuccess().type, postEventAsMessageToParentWindow );
        document.addEventListener( events.Edited().type, postEventAsMessageToParentWindow );
        document.addEventListener( events.Close().type, postEventAsMessageToParentWindow );
    }

    document.addEventListener( events.QueueSubmissionSuccess().type, event => {
        const successes = event.detail;
        gui.feedback( t( 'alert.queuesubmissionsuccess.msg', {
            count: successes.length,
            recordNames: successes.join( ', ' )
        } ), 7 );
    } );

    if ( settings.draftEnabled !== false && !form.encryptionKey ) {
        $( '.form-footer [name="draft"]' ).on( 'change', function() {
            const text = ( $( this ).prop( 'checked' ) ) ? t( 'formfooter.savedraft.btn' ) : t( 'formfooter.submit.btn' );
            // Note: using .btnText plugin because button may be in a busy state => https://github.com/kobotoolbox/enketo-express/issues/1043
            $( '#submit-form' ).btnText( text );

        } ).closest( '.draft' ).toggleClass( 'hide', !settings.offline );
    }

    if ( settings.offline ) {
        $doc.on( 'valuechange', _autoSaveRecord );
    }
}

function updateDownloadLinkAndClick( anchor, file ) {
    const objectUrl = URL.createObjectURL( file );

    anchor.textContent = file.name;
    updateDownloadLink( anchor, objectUrl, file.name );
    anchor.click();
}

function setLogoutLinkVisibility() {
    const visible = document.cookie.split( '; ' ).some( rawCookie => rawCookie.indexOf( '__enketo_logout=' ) !== -1 );
    $( '.form-footer .logout' ).toggleClass( 'hide', !visible );
}

function _setDraftStatus( status ) {
    status = status || false;
    $( '.form-footer [name="draft"]' ).prop( 'checked', status ).trigger( 'change' );
}

function _getDraftStatus() {
    return $( '.form-footer [name="draft"]' ).prop( 'checked' );
}

/** 
 * Determines whether the page is loaded inside an iframe
 * @return {boolean} [description]
 */
function inIframe() {
    try {
        return window.self !== window.top;
    } catch ( e ) {
        return true;
    }
}

/**
 * Attempts to send a message to the parent window, useful if the webform is loaded inside an iframe.
 * @param  {{type: string}} event
 */
function postEventAsMessageToParentWindow( event ) {
    if ( event && event.type ) {
        try {
            window.parent.postMessage( JSON.stringify( {
                enketoEvent: event.type
            } ), settings.parentWindowOrigin );
        } catch ( error ) {
            console.error( error );
        }
    }
}

export default {
    init,
    setLogoutLinkVisibility,
    inIframe,
    postEventAsMessageToParentWindow
};
