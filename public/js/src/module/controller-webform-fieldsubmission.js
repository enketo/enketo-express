/**
 * Deals with the main high level survey controls for the special online-only auto-fieldsubmission view.
 *
 * Field values are automatically submitted upon change to a special OpenClinica Field Submission API.
 */

'use strict';

var gui = require( './gui' );
var settings = require( './settings' );
var Form = require( 'enketo-core' );
var fileManager = require( './file-manager' );
var t = require( './translator' ).t;
var $ = require( 'jquery' );
var FieldSubmissionQueue = require( './field-submission-queue' );
var fieldSubmissionQueue;
var rc = require( './controller-webform' );
var DEFAULT_THANKS_URL = '/thanks';
var reasonForChangeFeature = false;
var reasonForChange = '';
var form;
var formSelector;
var formData;
var $formprogress;
var ignoreBeforeUnload = false;
var formOptions = {
    clearIrrelevantImmediately: true
};

require( './Form-model' );

function init( selector, data ) {
    var advice;
    var loadErrors = [];

    formSelector = selector;
    formData = data;

    return new Promise( function( resolve, reject ) {
            $formprogress = $( '.form-progress' );
            form = new Form( formSelector, data, formOptions );
            fieldSubmissionQueue = new FieldSubmissionQueue();
            // remove submit button before event handlers are set
            _removeCompleteButtonIfNeccessary();

            // set eventhandlers before initializing form
            _setEventHandlers( selector );

            loadErrors = form.init();

            if ( form.getEncryptionKey() ) {
                loadErrors.unshift( '<strong>' + t( 'error.encryptionnotsupported' ) + '</strong>' );
            }

            _setReasonForChangeUi();


            rc.setLogoutLinkVisibility();

            if ( loadErrors.length > 0 ) {
                throw loadErrors;
            }
            resolve();
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

/**
 * Controller function to reset to a blank form. Checks whether all changes have been saved first
 * @param  {boolean=} confirmed Whether unsaved changes can be discarded and lost forever
 */
function _resetForm( confirmed ) {
    var message;
    var choices;

    if ( !confirmed && form.getEditStatus() ) {
        message = t( 'confirm.save.msg' );
        choices = {
            posAction: function() {
                _resetForm( true );
            }
        };
        gui.confirm( message, choices );
    } else {
        //_setDraftStatus( false );
        form.resetView();
        ignoreBeforeUnload = false;
        form = new Form( formSelector, {
            modelStr: formData.modelStr,
            external: formData.external
        }, formOptions );
        reasonForChange = '';
        form.init();
        form.getView().$
            .trigger( 'formreset' );
    }
}

/**
 * Closes the form after checking that the queue is empty.
 * 
 * @return {Promise} [description]
 */
function _close( bypassAutoQuery ) {
    var msg = '';
    var tAlertCloseMsg = t( 'fieldsubmission.alert.close.msg1' );
    var tAlertCloseHeading = t( 'fieldsubmission.alert.close.heading1' );
    var authLink = '<a href="/login" target="_blank">' + t( 'here' ) + '</a>';
    var $violated = form.getView().$.find( '.invalid-constraint' );

    // First check if any constraints have been violated and prompt option to generate automatic queries
    if ( !bypassAutoQuery && $violated.length ) {
        return new Promise( function( resolve, reject ) {
            gui.confirm( {
                heading: t( 'alert.default.heading' ),
                errorMsg: t( 'fieldsubmission.confirm.autoquery.msg1' ),
                msg: t( 'fieldsubmission.confirm.autoquery.msg2' )
            }, {
                posButton: t( 'fieldsubmission.confirm.autoquery.automatic' ),
                negButton: t( 'fieldsubmission.confirm.autoquery.manual' ),
                posAction: function() {
                    _autoAddQueries( $violated );
                    resolve( true );
                },
                negAction: function() {
                    resolve( false );
                }
            } );
        } );
    }

    // Start with actually closing, but only proceed once the queue is emptied.
    gui.alert( tAlertCloseMsg + '<br/>' +
        '<div class="loader-animation-small" style="margin: 40px auto 0 auto;"/>', tAlertCloseHeading, 'bare' );

    return fieldSubmissionQueue.submitAll()
        .then( function() {
            if ( reasonForChangeFeature && !reasonForChange ) {
                return new Promise( function( resolve, reject ) {
                    _showReasonForChangeDialog( function( reason ) {
                        if ( reasonForChange ) {
                            resolve();
                        } else {
                            reject( new Error( t( 'fieldsubmission.alert.close.msg3' ) ) );
                        }
                    } );
                } );
            }
        } )
        .then( function() {
            return fieldSubmissionQueue.submitAll();
        } )
        .then( function() {
            if ( Object.keys( fieldSubmissionQueue.get() ).length > 0 ) {
                throw new Error( t( 'fieldsubmission.alert.close.msg2' ) );
            } else {
                // this event is used in communicating back to iframe parent window
                $( document ).trigger( 'close' );

                msg += t( 'alert.submissionsuccess.redirectmsg' );
                gui.alert( msg, t( 'alert.submissionsuccess.heading' ), 'success' );
                ignoreBeforeUnload = true;
                setTimeout( function() {
                    location.href = decodeURIComponent( settings.returnUrl || DEFAULT_THANKS_URL );
                }, 1200 );
            }
        } )
        .catch( function( error ) {
            error = error || {};

            console.error( 'close error', error );
            if ( error.status === 401 ) {
                msg = t( 'alert.submissionerror.authrequiredmsg', {
                    here: authLink
                } );
            } else {
                msg = error.message || gui.getErrorResponseMsg( error.status );
            }
            gui.alert( msg, t( 'alert.submissionerror.heading' ) );
        } );
}

/**
 * Finishes a submission
 */
function _complete( updated ) {
    var beforeMsg;
    var authLink;
    var instanceId;
    var deprecatedId;
    var msg = '';

    form.getView().$.trigger( 'beforesave' );

    beforeMsg = t( 'alert.submission.redirectmsg' );
    authLink = '<a href="/login" target="_blank">' + t( 'here' ) + '</a>';

    gui.alert( beforeMsg +
        '<div class="loader-animation-small" style="margin: 40px auto 0 auto;"/>', t( 'alert.submission.msg' ), 'bare' );

    return fieldSubmissionQueue.submitAll()
        .then( function() {
            var queueLength = Object.keys( fieldSubmissionQueue.get() ).length;

            if ( queueLength === 0 ) {
                instanceId = form.getInstanceID();
                deprecatedId = form.getDeprecatedID();
                return fieldSubmissionQueue.complete( instanceId, deprecatedId );
            } else {
                throw new Error( t( 'fieldsubmission.alert.complete.msg' ) );
            }
        } )
        .then( function() {
            // this event is used in communicating back to iframe parent window
            $( document ).trigger( 'submissionsuccess' );

            msg += t( 'alert.submissionsuccess.redirectmsg' );
            gui.alert( msg, t( 'alert.submissionsuccess.heading' ), 'success' );
            ignoreBeforeUnload = true;
            setTimeout( function() {
                location.href = decodeURIComponent( settings.returnUrl || DEFAULT_THANKS_URL );
            }, 1200 );
        } )
        .catch( function( result ) {
            result = result || {};
            console.error( 'submission failed' );
            if ( result.status === 401 ) {
                msg = t( 'alert.submissionerror.authrequiredmsg', {
                    here: authLink
                } );
            } else {
                msg = result.message || gui.getErrorResponseMsg( result.status );
            }
            gui.alert( msg, t( 'alert.submissionerror.heading' ) );
        } );
}

function _setReasonForChangeUi() {
    var $rfcButton;
    reasonForChangeFeature = settings.type === 'edit' && settings.reasonForChange === true;

    if ( reasonForChangeFeature ) {
        $rfcButton = $( '<button class="form-header__button--reason btn-icon-only">' +
                '<i class="icon icon-pencil"></i></button>' )
            .on( 'click', _showReasonForChangeDialog );
        $( '.form-header__button--print' ).before( $rfcButton );
    }
}

function _removeCompleteButtonIfNeccessary() {
    if ( settings.type === 'edit' && !settings.completeButton ) {
        $( 'button#finish-form' ).remove();
    }
}

function _showReasonForChangeDialog( postAction ) {
    var inputs = '<label><span>' + t( 'fieldsubmission.prompt.rfc.label' ) + '</span>' +
        '<textarea style="min-height: 120px;" name="reason" type="text">' + reasonForChange + '</textarea>' + '</label>';
    var content = {
        msg: '',
        heading: t( 'fieldsubmission.prompt.rfc.heading' ),
    };
    var choices = {
        posAction: function( data ) {
            reasonForChange = data.reason;
            fieldSubmissionQueue.addReasonForChange( reasonForChange, form.getInstanceID(), form.getDeprecatedID() );
            fieldSubmissionQueue.submitAll();
            if ( typeof postAction === 'function' ) {
                postAction.call();
            }
        }
    };
    gui.prompt( content, choices, inputs );
}

function _autoAddQueries( $questions ) {
    $questions.trigger( 'addquery.oc' );
}

function _setEventHandlers( selector ) {
    var $doc = $( document );
    $doc
        .on( 'progressupdate.enketo', selector, function( event, status ) {
            if ( $formprogress.length > 0 ) {
                $formprogress.css( 'width', status + '%' );
            }
        } )
        // Repeat removal
        .on( 'removed.enketo', function( event, updated ) {
            var instanceId = form.getInstanceID();
            if ( !updated.xmlFragment ) {
                console.error( 'Could not submit repeat removal fieldsubmission. XML fragment missing.' );
                return;
            }
            if ( !instanceId ) {
                console.error( 'Could not submit repeat removal fieldsubmission. InstanceID missing' );
            }

            fieldSubmissionQueue.addRepeatRemoval( updated.xmlFragment, instanceId, form.getDeprecatedID() );
            fieldSubmissionQueue.submitAll();
        } )
        // Field is changed
        .on( 'dataupdate.enketo', selector, function( event, updated ) {
            var instanceId = form.getInstanceID();
            var file;
            var update;

            if ( !updated.xmlFragment ) {
                console.error( 'Could not submit field. XML fragment missing.' );
                return;
            }
            if ( !instanceId ) {
                console.error( 'Could not submit field. InstanceID missing' );
                return;
            }
            if ( !updated.fullPath ) {
                console.error( 'Could not submit field. Path missing.' );
            }

            if ( updated.file ) {
                file = fileManager.getCurrentFile( updated.file );
            }
            // Only now will we check for the deprecatedID value, which at this point should be (?) 
            // populated at the time the instanceID validated.enketo event is processed and added to the fieldSubmission queue.
            fieldSubmissionQueue.addFieldSubmission( updated.fullPath, updated.xmlFragment, instanceId, form.getDeprecatedID(), file );
            fieldSubmissionQueue.submitAll();

        } );

    $( 'button#close-form' ).click( function() {
        var $button = $( this ).btnBusyState( true );

        _close()
            .then( function( again ) {
                if ( again ) {
                    return _close( true );
                }
            } )
            .catch( function( e ) {
                console.error( e );
            } )
            .then( function() {
                $button.btnBusyState( false );
            } );

        return false;
    } );

    $( 'button#finish-form' ).click( function() {
        var $button = $( this ).btnBusyState( true );

        // form.validate() will trigger fieldsubmissions for timeEnd before it resolves

        form.validate()
            .then( function( valid ) {
                if ( valid ) {
                    return _complete();
                } else {
                    gui.alert( t( 'fieldsubmission.alert.validationerror.msg' ) );
                }
            } )
            .catch( function( e ) {
                gui.alert( e.message );
            } )
            .then( function() {
                $button.btnBusyState( false );
            } );

        return false;
    } );

    if ( rc.inIframe() && settings.parentWindowOrigin ) {
        $doc.on( 'submissionsuccess edited.enketo close', rc.postEventAsMessageToParentWindow );
    }

    window.onbeforeunload = function() {
        if ( !ignoreBeforeUnload ) {
            _autoAddQueries( form.getView().$.find( '.invalid-constraint' ) );
            if ( Object.keys( fieldSubmissionQueue.get() ).length > 0 ) {
                return 'Any unsaved data will be lost';
            }
        }
    };
}

module.exports = {
    init: init
};
