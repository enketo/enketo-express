/**
 * @preserve Copyright 2014 Martijn van de Rijdt & Harvard Humanitarian Initiative
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Deals with the main high level survey controls: saving, submitting etc.
 */

define( [ 'gui', 'connection', 'settings', 'enketo-js/Form', 'enketo-js/FormModel', 'file-manager', 'q', 'translator', 'records-queue', 'jquery' ],
    function( gui, connection, settings, Form, FormModel, fileManager, Q, t, records, $ ) {
        "use strict";
        var form, formSelector, formData, $formprogress;

        function init( selector, data ) {
            var loadErrors, advice;

            connection.init();

            formSelector = selector;
            formData = data;
            form = new Form( formSelector, formData );

            // DEBUG
            // window.form = form;
            // window.gui = gui;
            // window.store = store;

            //initialize form and check for load errors
            loadErrors = form.init();

            if ( settings.offline ) {
                records.init();
            }

            if ( form.getEncryptionKey() ) {
                loadErrors.unshift( '<strong>' + t( 'error.encryptionnotsupported' ) + '</strong>' );
            }

            if ( loadErrors.length > 0 ) {
                console.error( 'load errors:', loadErrors );
                advice = ( formData.instanceStr ) ? t( 'alert.loaderror.editadvice' ) : t( 'alert.loaderror.entryadvice' );
                gui.alertLoadErrors( loadErrors, advice );
            }

            $formprogress = $( '.form-progress' );

            _setEventHandlers();
        }

        /**
         * Controller function to reset to a blank form. Checks whether all changes have been saved first
         * @param  {boolean=} confirmed Whether unsaved changes can be discarded and lost forever
         */
        function _resetForm( confirmed ) {
            var message, choices;

            if ( !confirmed && form.getEditStatus() ) {
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
                } );
                form.init();
                // formreset event will update the form media:
                form.getView().$.trigger( 'formreset' );
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
            var texts, choices, loadErrors;

            if ( !confirmed && form.getEditStatus() ) {
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
                            unsubmitted: true
                        } );
                        loadErrors = form.init();
                        // formreset event will update the form media:
                        form.getView().$.trigger( 'formreset' );
                        _setDraftStatus( true );
                        form.setRecordName( record.name );
                        records.setActive( record.instanceId );

                        if ( loadErrors.length > 0 ) {
                            console.error( 'load errors:', loadErrors );
                            gui.showLoadErrors( loadErrors, t( 'alert.loaderror.editadvice' ) );
                        } else {
                            gui.feedback( t( 'alert.recordloadsuccess.msg', {
                                recordName: record.name
                            } ), 2 );
                        }
                        $( '.side-slider__toggle.close' ).click();
                    } );
            }
        }

        /**
         * Used to submit a form.
         * This function does not save the record in localStorage
         * and is not used in offline-capable views.
         */
        function _submitRecord() {
            var record, redirect, beforeMsg, authLink, level,
                msg = [];

            form.getView().$.trigger( 'beforesave' );

            if ( !form.isValid() ) {
                gui.alert( t( 'alert.validationerror.msg' ) );
                return;
            }
            beforeMsg = ( redirect ) ? t( 'alert.submission.redirectmsg' ) : '';
            authLink = '<a href="/login" target="_blank">' + t( 'here' ) + '</a>';

            gui.alert( beforeMsg + '<br />' +
                '<div class="loader-animation-small" style="margin: 10px auto 0 auto;"/>', t( 'alert.submission.msg' ), 'bare' );

            record = {
                'xml': form.getDataStr( false, true ),
                'files': fileManager.getCurrentFiles()
            };

            connection.uploadRecord( record )
                .then( function( result ) {
                    result = result || {};
                    level = 'success';

                    if ( result.failedFiles && result.failedFiles.length > 0 ) {
                        msg = [ t( 'alert.submissionerror.fnfmsg', {
                            failedFiles: result.failedFiles.join( ', ' ),
                            supportEmail: settings.supportEmail
                        } ) ];
                        level = 'warning';
                    }

                    // this event is used in communicating back to iframe parent window
                    $( document ).trigger( 'submissionsuccess' );

                    if ( settings.returnUrl ) {
                        msg += '<br/>' + t( 'alert.submissionsuccess.redirectmsg' );
                        gui.alert( msg, t( 'alert.submissionsuccess.heading' ), level );
                        setTimeout( function() {
                            location.href = settings.returnUrl;
                        }, 1500 );
                    } else {
                        msg = ( msg.length > 0 ) ? msg : t( 'alert.submissionsuccess.msg' );
                        gui.alert( msg, t( 'alert.submissionsuccess.heading' ), level );
                        _resetForm( true );
                    }
                } )
                .fail( function( result ) {
                    result = result || {};
                    console.error( 'submission failed', result );
                    if ( result.status && result.status === 401 ) {
                        gui.alert( t( 'alert.submissionerror.authrequiredmsg', {
                            here: authLink
                        } ), t( 'alert.submissionerror.heading' ) );
                    } else {
                        gui.alert( gui.getErrorResponseMsg( result.status ), t( 'alert.submissionerror.heading' ) );
                    }
                } );
        }

        function _getRecordName() {
            return records.getCounterValue( settings.enketoId )
                .then( function( count ) {
                    return form.getInstanceName() || form.getRecordName() || form.getSurveyName() + ' - ' + count;
                } );
        }

        function _confirmRecordName( recordName, errorMsg ) {
            var deferred = Q.defer(),
                texts = {
                    msg: '',
                    heading: t( 'formfooter.savedraft.label' ),
                    errorMsg: errorMsg
                },
                choices = {
                    posButton: t( 'confirm.save.posButton' ),
                    negButton: t( 'confirm.default.negButton' ),
                    posAction: function( values ) {
                        deferred.resolve( values[ 'record-name' ] );
                    },
                    negAction: deferred.reject
                },
                inputs = '<label><span>' + t( 'confirm.save.name' ) + '</span>' +
                '<span class="or-hint active">' + t( 'confirm.save.hint' ) + '</span>' +
                '<input name="record-name" type="text" value="' + recordName + '"required />' + '</label>';

            gui.prompt( texts, choices, inputs );

            return deferred.promise;
        }

        function _confirmRecordRename( oldName, newName, errMsg ) {
            var deferred = Q.defer();

            gui.prompt( {
                    msg: t( 'confirm.save.renamemsg', {
                        currentName: '"' + oldName + '"',
                        newName: '"' + newName + '"'
                    } )
                }, {
                    posAction: deferred.resolve,
                    negAction: deferred.reject
                }, '<label><span>' + t( 'confirm.save.name' ) + '</span><span>' + t( 'confirm.save.hint' ) + '</span>' +
                '<input name="record-name" type="text" required /></label>' );
            return deferred.promise;
        }

        function _saveRecord( recordName, confirmed, errorMsg ) {
            var record, saveMethod,
                draft = _getDraftStatus();

            console.log( 'saveRecord called with recordname:', recordName, 'confirmed:', confirmed, "error:", errorMsg, 'draft:', draft );

            // triggering "beforesave" event to update possible "timeEnd" meta data in form
            form.getView().$.trigger( 'beforesave' );

            // check validity of record if necessary
            if ( !draft && !form.validate() ) {
                gui.alert( 'Form contains errors <br/>(please see fields marked in red)' );
                return;
            }

            // check recordName
            if ( !recordName ) {
                return _getRecordName()
                    .then( function( name ) {
                        _saveRecord( name, false, errorMsg );
                    } );
            }

            // check whether record name is confirmed if necessary
            if ( draft && !confirmed ) {
                return _confirmRecordName( recordName, errorMsg )
                    .then( function( name ) {
                        _saveRecord( name, true );
                    } );
            }

            // build the record object
            record = {
                'draft': draft,
                'xml': form.getDataStr( false, true ),
                'name': recordName,
                'instanceId': form.getInstanceID(),
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
            saveMethod = form.getRecordName() ? 'update' : 'set';

            // save the record
            records[ saveMethod ]( record )
                .then( function() {
                    console.log( 'XML save successful!' );

                    _resetForm( true );

                    if ( draft ) {
                        gui.feedback( t( 'alert.recordsavesuccess.draftmsg' ), 3 );
                    } else {
                        gui.feedback( t( 'alert.recordsavesuccess.finalmsg' ), 3 );
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

        function _setEventHandlers() {

            $( 'button#submit-form' ).click( function() {
                var $button = $( this );
                $button.btnBusyState( true );
                setTimeout( function() {
                    if ( settings.offline ) {
                        _saveRecord();
                    } else {
                        form.validate();
                        _submitRecord();
                    }
                    $button.btnBusyState( false );
                    return false;
                }, 100 );
            } );

            $( 'button#validate-form:not(.disabled)' ).click( function() {
                if ( typeof form !== 'undefined' ) {
                    var $button = $( this );
                    $button.btnBusyState( true );
                    setTimeout( function() {
                        form.validate();
                        $button.btnBusyState( false );
                        if ( !form.isValid() ) {
                            gui.alert( t( 'alert.validationerror.msg' ) );
                            return;
                        } else {
                            gui.alert( t( 'alert.validationsuccess.msg' ), t( 'alert.validationsuccess.heading' ), 'success' );
                        }
                    }, 100 );
                }
            } );

            $( '.record-list__button-bar__button.upload' ).on( 'click', function() {
                records.uploadQueue();
            } );

            $( document ).on( 'click', '.record-list__records__record[data-draft="true"]', function() {
                _loadRecord( $( this ).attr( 'data-id' ), false );
            } );

            $( document ).on( 'click', '.record-list__records__record', function() {
                $( this ).next( '.record-list__records__msg' ).toggle( 100 );
            } );

            $( document ).on( 'progressupdate', 'form.or', function( event, status ) {
                if ( $formprogress.length > 0 ) {
                    $formprogress.css( 'width', status + '%' );
                }
            } );

            if ( _inIframe() && settings.parentWindowOrigin ) {
                $( document ).on( 'submissionsuccess edited', _postEventAsMessageToParentWindow );
            }

            $( document ).on( 'queuesubmissionsuccess', function() {
                var successes = Array.prototype.slice.call( arguments ).slice( 1 );
                gui.feedback( t( 'alert.queuesubmissionsuccess.msg', {
                    count: successes.length,
                    recordNames: successes.join( ', ' )
                } ), 7 );
            } );

            $( '.form-footer [name="draft"]' ).on( 'change', function() {
                var text = ( $( this ).prop( 'checked' ) ) ? t( "formfooter.savedraft.btn" ) : t( "formfooter.submit.btn" );
                $( '#submit-form i' ).text( ' ' + text );
            } ).closest( '.draft' ).toggleClass( 'hide', !settings.offline );
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
        function _inIframe() {
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
        function _postEventAsMessageToParentWindow( event ) {
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



        return {
            init: init
        };
    } );
