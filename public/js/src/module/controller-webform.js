/**
 * Deals with the main high level survey controls: saving, submitting etc.
 */

'use strict';

var gui = require( './gui' );
var connection = require( './connection' );
var Promise = require( 'lie' );
var settings = require( './settings' );
var Form = require( 'enketo-core' );
var fileManager = require( './file-manager' );
var t = require( './translator' ).t;
var records = require( './records-queue' );
var $ = require( 'jquery' );

var form;
var formSelector;
var formData;
var $formprogress;
var formOptions = {
    clearIrrelevantImmediately: false,
    printRelevantOnly: settings.printRelevantOnly
};

function init( selector, data ) {
    var advice;
    var loadErrors = [];

    formSelector = selector;
    formData = data;

    return _initializeRecords()
        .then( _checkAutoSavedRecord )
        .then( function( record ) {
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
            $( 'body > .main-loader' ).remove();

            if ( settings.goTo && location.hash ) {
                console.log( 'going to ', location.hash.substring( 1 ) );
                loadErrors = loadErrors.concat( form.goTo( location.hash.substring( 1 ) ) );
            }

            if ( form.encryptionKey ) {
                loadErrors.unshift( '<strong>' + t( 'error.encryptionnotsupported' ) + '</strong>' );
            }

            $formprogress = $( '.form-progress' );

            _setEventHandlers();
            setLogoutLinkVisibility();

            if ( loadErrors.length > 0 ) {
                throw loadErrors;
            }
            return form;
        } )
        .catch( function( error ) {
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
    if ( !settings.offline ) {
        return Promise.resolve();
    }
    return records.getAutoSavedRecord()
        .then( function( record ) {
            return new Promise( function( resolve ) {
                if ( record ) {
                    gui.confirm( {
                        heading: t( 'confirm.autosaveload.heading' ),
                        msg: t( 'confirm.autosaveload.msg' ),

                    }, {
                        posButton: t( 'confirm.autosaveload.posButton' ),
                        negButton: t( 'confirm.autosaveload.negButton' ),
                        posAction: function() {
                            resolve( record );
                        },
                        negAction: function() {
                            records.removeAutoSavedRecord();
                            resolve();
                        },
                        allowAlternativeClose: false
                    } );
                } else {
                    resolve();
                }
            } );
        } );
}

/**
 * Controller function to reset to a blank form. Checks whether all changes have been saved first
 * @param  {boolean=} confirmed Whether unsaved changes can be discarded and lost forever
 */
function _resetForm( confirmed ) {
    var message;
    var choices;

    if ( !confirmed && form.editStatus ) {
        message = t( 'confirm.save.msg' );
        choices = {
            posAction: function() {
                _resetForm( true );
            }
        };
        gui.confirm( message, choices );
    } else {
        _setDraftStatus( false );
        form.resetView();
        form = new Form( formSelector, {
            modelStr: formData.modelStr,
            external: formData.external
        }, formOptions );
        form.init();
        // formreset event will update the form media:
        form.view.$.trigger( 'formreset' );
        if ( records ) {
            records.setActive( null );
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
    var texts;
    var choices;
    var loadErrors;

    if ( !confirmed && form.editStatus ) {
        texts = {
            msg: t( 'confirm.discardcurrent.msg' ),
            heading: t( 'confirm.discardcurrent.heading' )
        };
        choices = {
            posButton: t( 'confirm.discardcurrent.posButton' ),
            posAction: function() {
                _loadRecord( instanceId, true );
            }
        };
        gui.confirm( texts, choices );
    } else {
        records.get( instanceId )
            .then( function( record ) {
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
            .catch( function( errors ) {
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
    var record;
    var redirect = settings.type === 'single' || settings.type === 'edit' || settings.type === 'view';
    var beforeMsg;
    var authLink;
    var level;
    var msg = '';
    var include = {
        irrelevant: false
    };

    form.view.$.trigger( 'beforesave' );

    beforeMsg = ( redirect ) ? t( 'alert.submission.redirectmsg' ) : '';
    authLink = '<a href="' + settings.loginUrl + '" target="_blank">' + t( 'here' ) + '</a>';

    gui.alert( beforeMsg +
        '<div class="loader-animation-small" style="margin: 40px auto 0 auto;"/>', t( 'alert.submission.msg' ), 'bare' );

    record = {
        'xml': form.getDataStr( include ),
        'files': fileManager.getCurrentFiles(),
        'instanceId': form.instanceID,
        'deprecatedId': form.deprecatedID
    };

    return connection.uploadRecord( record )
        .then( function( result ) {
            result = result || {};
            level = 'success';

            if ( result.failedFiles && result.failedFiles.length > 0 ) {
                msg = t( 'alert.submissionerror.fnfmsg', {
                    failedFiles: result.failedFiles.join( ', ' ),
                    supportEmail: settings.supportEmail
                } ) + '<br/>';
                level = 'warning';
            }

            // this event is used in communicating back to iframe parent window
            $( document ).trigger( 'submissionsuccess' );

            if ( redirect ) {
                if ( !settings.multipleAllowed ) {
                    var now = new Date();
                    var age = 31536000;
                    var d = new Date();
                    /**
                     * Manipulate the browser history to work around potential ways to 
                     * circumvent protection against multiple submissions:
                     * 1. After redirect, click Back button to load cached version.
                     */
                    history.replaceState( {}, '', settings.defaultReturnUrl + '?taken=' + now.getTime() );
                    /**
                     * The above replaceState doesn't work in Safari and probably in 
                     * some other browsers (mobile). It shows the 
                     * final submission dialog when clicking Back.
                     * So we remove the form...
                     */
                    $( 'form.or' ).empty();
                    $( 'button#submit-form' ).remove();
                    d.setTime( d.getTime() + age * 1000 );
                    document.cookie = settings.enketoId + '=' + now.getTime() + ';path=/single;max-age=' + age + ';expires=' + d.toGMTString() + ';';
                }
                msg += t( 'alert.submissionsuccess.redirectmsg' );
                gui.alert( msg, t( 'alert.submissionsuccess.heading' ), level );
                setTimeout( function() {
                    location.href = decodeURIComponent( settings.returnUrl || settings.defaultReturnUrl );
                }, 1200 );
            } else {
                msg = ( msg.length > 0 ) ? msg : t( 'alert.submissionsuccess.msg' );
                gui.alert( msg, t( 'alert.submissionsuccess.heading' ), level );
                _resetForm( true );
            }
        } )
        .catch( function( result ) {
            var message;
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
        .then( function( count ) {
            return form.instanceName || form.recordName || form.surveyName + ' - ' + count;
        } );
}

function _confirmRecordName( recordName, errorMsg ) {
    return new Promise( function( resolve, reject ) {
        var texts = {
            msg: '',
            heading: t( 'formfooter.savedraft.label' ),
            errorMsg: errorMsg
        };
        var choices = {
            posButton: t( 'confirm.save.posButton' ),
            negButton: t( 'confirm.default.negButton' ),
            posAction: function( values ) {
                resolve( values[ 'record-name' ] );
            },
            negAction: reject
        };
        var inputs = '<label><span>' + t( 'confirm.save.name' ) + '</span>' +
            '<span class="or-hint active">' + t( 'confirm.save.hint' ) + '</span>' +
            '<input name="record-name" type="text" value="' + recordName + '"required />' + '</label>';

        gui.prompt( texts, choices, inputs );
    } );
}

// save the translation in case ever required in the future
// t( 'confirm.save.renamemsg', {} )

function _saveRecord( recordName, confirmed, errorMsg ) {
    var record;
    var saveMethod;
    var draft = _getDraftStatus();
    var include = ( draft ) ? {
        irrelevant: true
    } : {
        irrelevant: false
    };

    // triggering "beforesave" event to update possible "timeEnd" meta data in form
    form.view.$.trigger( 'beforesave' );

    // check recordName
    if ( !recordName ) {
        return _getRecordName()
            .then( function( name ) {
                return _saveRecord( name, false, errorMsg );
            } );
    }

    // check whether record name is confirmed if necessary
    if ( draft && !confirmed ) {
        return _confirmRecordName( recordName, errorMsg )
            .then( function( name ) {
                return _saveRecord( name, true );
            } );
    }

    // build the record object
    record = {
        'draft': draft,
        'xml': form.getDataStr( include ),
        'name': recordName,
        'instanceId': form.instanceID,
        'deprecateId': form.deprecatedID,
        'enketoId': settings.enketoId,
        'files': fileManager.getCurrentFiles().map( function( file ) {
            return ( typeof file === 'string' ) ? {
                name: file
            } : {
                name: file.name,
                item: file
            };
        } )
    };

    // determine the save method
    saveMethod = form.recordName ? 'update' : 'set';

    // save the record
    return records[ saveMethod ]( record )
        .then( function() {

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
        .catch( function( error ) {
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
    var record;

    // do not auto-save a record if the record was loaded from storage
    if ( form.recordName ) {
        return Promise.resolve();
    }

    // build the variable portions of the record object
    record = {
        'xml': form.getDataStr(),
        'files': fileManager.getCurrentFiles().map( function( file ) {
            return ( typeof file === 'string' ) ? {
                name: file
            } : {
                name: file.name,
                item: file
            };
        } )
    };

    // save the record
    return records.updateAutoSavedRecord( record )
        .then( function() {
            console.log( 'autosave successful' );
        } )
        .catch( function( error ) {
            console.error( 'autosave error', error );
        } );
}

function _setEventHandlers() {
    var $doc = $( document );

    $( 'button#submit-form' ).click( function() {
        var $button = $( this );
        var draft = _getDraftStatus();
        $button.btnBusyState( true );
        setTimeout( function() {
            if ( settings.offline && draft ) {
                _saveRecord()
                    .then( function() {
                        $button.btnBusyState( false );
                    } )
                    .catch( function( e ) {
                        $button.btnBusyState( false );
                        throw e;
                    } );
            } else {
                form.validate()
                    .then( function( valid ) {
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
                    .catch( function( e ) {
                        gui.alert( e.message );
                    } )
                    .then( function() {
                        $button.btnBusyState( false );
                    } );
            }
        }, 100 );
        return false;
    } );

    $( 'button#validate-form:not(.disabled)' ).click( function() {
        if ( typeof form !== 'undefined' ) {
            var $button = $( this );
            $button.btnBusyState( true );
            setTimeout( function() {
                form.validate()
                    .then( function( valid ) {
                        $button.btnBusyState( false );
                        if ( !valid ) {
                            gui.alert( t( 'alert.validationerror.msg' ) );
                        } else {
                            gui.alert( t( 'alert.validationsuccess.msg' ), t( 'alert.validationsuccess.heading' ), 'success' );
                        }
                    } )
                    .catch( function( e ) {
                        gui.alert( e.message );
                    } )
                    .then( function() {
                        $button.btnBusyState( false );
                    } );
            }, 100 );
        }
        return false;
    } );

    $( 'button#close-form:not(.disabled)' ).click( function() {
        var msg = t( 'alert.submissionsuccess.redirectmsg' );
        $doc.trigger( 'close' );
        gui.alert( msg, t( 'alert.closing.heading' ), 'warning' );
        setTimeout( function() {
            location.href = decodeURIComponent( settings.returnUrl || settings.defaultReturnUrl );
        }, 300 );
        return false;
    } );

    $( '.record-list__button-bar__button.upload' ).on( 'click', function() {
        records.uploadQueue();
    } );

    $( '.record-list__button-bar__button.export' ).on( 'click', function() {
        var createDownloadLink = '<a class="vex-dialog-link" id="download-export-create" href="#">' +
            t( 'alert.export.alternativequestion' ) + '</a>';

        records.exportToZip( form.surveyName )
            .then( function( zipFile ) {
                // Hack for stupid Safari and iOS browsers
                $( document ).off( 'click.export' ).one( 'click.export', '#download-export-create', function( event ) {
                    _handleAlternativeDownloadRequest.call( this, event, zipFile );
                } );

                gui.alert( t( 'alert.export.success.msg' ) + createDownloadLink, t( 'alert.export.success.heading' ), 'normal' );
            } )
            .catch( function( error ) {
                var message = t( 'alert.export.error.msg', {
                    errors: error.message
                } );
                if ( error.exportFile ) {
                    // Hack for stupid Safari and iOS browsers
                    $( document ).off( 'click.export' ).one( 'click.export', '#download-export-create', function( event ) {
                        _handleAlternativeDownloadRequest.call( this, event, error.exportFile );
                    } );
                    message += '<p>' + t( 'alert.export.error.filecreatedmsg' ) + '</p>' + createDownloadLink;
                }
                gui.alert( message, t( 'alert.export.error.heading' ) );
            } );
    } );

    $doc.on( 'click', '.record-list__records__record[data-draft="true"]', function() {
        _loadRecord( $( this ).attr( 'data-id' ), false );
    } );

    $doc.on( 'click', '.record-list__records__record', function() {
        $( this ).next( '.record-list__records__msg' ).toggle( 100 );
    } );

    $doc.on( 'progressupdate.enketo', 'form.or', function( event, status ) {
        if ( $formprogress.length > 0 ) {
            $formprogress.css( 'width', status + '%' );
        }
    } );

    if ( inIframe() && settings.parentWindowOrigin ) {
        $doc.on( 'submissionsuccess edited.enketo close', postEventAsMessageToParentWindow );
    }

    $doc.on( 'queuesubmissionsuccess', function() {
        var successes = Array.prototype.slice.call( arguments ).slice( 1 );
        gui.feedback( t( 'alert.queuesubmissionsuccess.msg', {
            count: successes.length,
            recordNames: successes.join( ', ' )
        } ), 7 );
    } );

    if ( settings.draftEnabled !== false ) {
        $( '.form-footer [name="draft"]' ).on( 'change', function() {
            var text = ( $( this ).prop( 'checked' ) ) ? t( 'formfooter.savedraft.btn' ) : t( 'formfooter.submit.btn' );
            $( '#submit-form' ).get( 0 ).lastChild.textContent = text;
        } ).closest( '.draft' ).toggleClass( 'hide', !settings.offline );
    }

    if ( settings.offline ) {
        $doc.on( 'valuechange.enketo', _autoSaveRecord );
    }
}

function _handleAlternativeDownloadRequest( event, zipFile ) {
    var $loader;
    var $link;

    event.preventDefault();

    $loader = $( '<div class="loader-animation-small" style="margin: 20px auto 0 auto;"/>' );
    $( event.target ).replaceWith( $loader );

    connection.getDownloadUrl( zipFile )
        .then( function( downloadUrl ) {
            $link = $( '<a class="vex-dialog-link" href="' + downloadUrl +
                '" download target="_blank">' + zipFile.name + '</a>' );
            $loader.replaceWith( $link );
            $link.one( 'click', function() {
                this.remove();
                return true;
            } );
        } )
        .catch( function() {
            gui.alert( t( 'alert.export.error.linknotcreated' ) );
        } );

    return false;
}

function setLogoutLinkVisibility() {
    var visible = document.cookie.split( '; ' ).some( function( rawCookie ) {
        return rawCookie.indexOf( '__enketo_logout=' ) !== -1;
    } );
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

module.exports = {
    init: init,
    setLogoutLinkVisibility: setLogoutLinkVisibility,
    inIframe: inIframe,
    postEventAsMessageToParentWindow: postEventAsMessageToParentWindow
};
