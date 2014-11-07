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

define( [ 'gui', 'connection', 'settings', 'enketo-js/Form', 'enketo-js/FormModel', 'file-manager', 'q', 'jquery' ],
    function( gui, connection, settings, Form, FormModel, fileManager, Q, $ ) {
        "use strict";
        var form, $form, $formprogress, formSelector, defaultModelStr, store;

        function init( selector, modelStr, instanceStrToEdit, options ) {
            var loadErrors, purpose;

            formSelector = selector;
            defaultModelStr = modelStr;
            options = options || {};
            instanceStrToEdit = instanceStrToEdit || null;

            connection.init( true );

            form = new Form( formSelector, defaultModelStr, instanceStrToEdit );

            // DEBUG
            //window.form = form;
            //window.gui = gui;

            //initialize form and check for load errors
            loadErrors = form.init();

            if ( form.getEncryptionKey() ) {
                console.error( 'This form requires encryption of local records but this is not supported yet in Enketo.', loadErrors );
                loadErrors.unshift( '<strong>This form requires local encryption of records. ' +
                    'Unfortunately this not yet supported. ' +
                    'We recommend using ODK Collect ' +
                    'for data collection with this form.</strong>'
                );
            }

            if ( loadErrors.length > 0 ) {
                console.error( 'load errors:', loadErrors );
                purpose = ( instanceStrToEdit ) ? 'to edit data' : 'for data entry';
                gui.showLoadErrors( loadErrors, 'It is recommended <strong>not to use this form</strong> ' + purpose + ' until this is resolved.' );
            }

            $form = form.getView().$;
            $formprogress = $( '.form-progress' );

            setEventHandlers();
        }

        /**
         * Controller function to reset to a blank form. Checks whether all changes have been saved first
         * @param  {boolean=} confirmed Whether unsaved changes can be discarded and lost forever
         */

        function resetForm( confirmed ) {
            var message, choices;

            if ( !confirmed && form.getEditStatus() ) {
                message = 'There are unsaved changes, would you like to continue <strong>without</strong> saving those?';
                choices = {
                    posAction: function() {
                        resetForm( true );
                    }
                };
                gui.confirm( message, choices );
            } else {
                setDraftStatus( false );
                //updateActiveRecord( null );
                form.resetView();
                form = new Form( 'form.or:eq(0)', defaultModelStr );
                //DEBUG
                window.form = form;
                form.init();
                $form = form.getView().$;
                $formprogress = $( '.form-progress' );
                //$( 'button#delete-form' ).button( 'disable' );
            }
        }

        /**
         * Used to submit a form with data that was loaded by POST. This function does not save the record in localStorage
         * and is not used in offline-capable views.
         */

        function submitRecord() {
            var name, record, saveResult, redirect, beforeMsg, callbacks;

            //$form.trigger( 'beforesave' );
            if ( !form.isValid() ) {
                gui.alert( 'Form contains errors <br/>(please see fields marked in red)' );
                return;
            }
            redirect = ( typeof settings !== 'undefined' && typeof settings[ 'returnURL' ] !== 'undefined' && settings[ 'returnURL' ] ) ? true : false;
            beforeMsg = ( redirect ) ? 'You will be automatically redirected after submission. ' : '';

            gui.alert( beforeMsg + '<br />' +
                '<div class="loader-animation-small" style="margin: 10px auto 0 auto;"/>', 'Submitting...', 'bare' );

            callbacks = {
                error: function() {
                    gui.alert( 'Please try submitting again.', 'Submission Failed' );
                },
                success: function() {
                    $( document ).trigger( 'submissionsuccess' ); // since connection.processOpenRosaResponse is bypassed
                    if ( redirect ) {
                        gui.alert( 'You will now be redirected.', 'Submission Successful!', 'success' );
                        setTimeout( function() {
                            location.href = settings.returnURL;
                        }, 1500 );
                    }
                    //also use for iframed forms
                    else {
                        gui.alert( 'Your data was submitted!', 'Submission Successful!', 'success' );
                        resetForm( true );
                    }
                },
                complete: function() {}
            };

            record = {
                key: 'record',
                data: form.getDataStr( true, true ),
                files: fileManager.getCurrentFiles()
            };

            prepareFormDataArray( record ).forEach( function( batch ) {
                connection.uploadRecords( batch, true, callbacks );
            } );
        }

        /**
         * Builds up a record array including media files, divided into batches
         *
         * @param { { name: string, data: string } } record[ description ]
         */
        function prepareFormDataArray( record ) {
            var model = new FormModel( record.data ),
                instanceID = model.getInstanceID(),
                $fileNodes = model.$.find( '[type="file"]' ).removeAttr( 'type' ),
                xmlData = model.getStr( false, true ),
                xmlSubmissionBlob = new Blob( [ xmlData ], {
                    type: 'text/xml'
                } ),
                availableFiles = record.files || [],
                sizes = [],
                failedFiles = [],
                files = [],
                batches = [
                    []
                ],
                batchesPrepped = [],
                maxSize = connection.getMaxSubmissionSize();

            $fileNodes.each( function() {
                var file,
                    $node = $( this ),
                    nodeName = $node.prop( 'nodeName' ),
                    fileName = $node.text();

                // check if file is actually available
                availableFiles.some( function( f ) {
                    if ( f.name === fileName ) {
                        file = f;
                        return true;
                    }
                    return false;
                } );

                // add the file if it is available
                if ( file ) {
                    files.push( {
                        nodeName: nodeName,
                        file: file
                    } );
                    sizes.push( file.size );
                } else {
                    failedFiles.push( file.name );
                    console.error( 'Error occured when trying to retrieve ' + file.name );
                }
            } );

            if ( files.length > 0 ) {
                batches = divideIntoBatches( sizes, maxSize );
            }

            // console.debug( 'splitting record into ' + batches.length + ' batches to reduce submission size ', batches );

            batches.forEach( function( batch, index ) {
                var batchPrepped,
                    fd = new FormData();

                fd.append( 'xml_submission_file', xmlSubmissionBlob );

                // batch with XML data
                batchPrepped = {
                    name: record.key,
                    instanceID: instanceID,
                    formData: fd,
                    batches: batches.length,
                    batchIndex: index
                };

                // add any media files to the batch
                batch.forEach( function( fileIndex ) {
                    batchPrepped.formData.append( files[ fileIndex ].nodeName, files[ fileIndex ].file );
                } );

                // push the batch to the array
                batchesPrepped.push( batchPrepped );
            } );

            // notify user if files could not be found, but let submission go ahead anyway
            if ( failedFiles.length > 0 ) {
                gui.alert( '<p>The following media files could not be retrieved: ' + failedFiles.join( ', ' ) + '. ' +
                    'The submission will go ahead and show the missing filenames in the data, but without the actual file(s).</p>' +
                    '<p>please contact ' + settings.supportEmail + ' to report a bug and if possible explain how the issue can be reproduced.</p>', 'File(s) not Found' );
            }

            return batchesPrepped;
        }


        function setEventHandlers() {

            $( 'button#submit-form' )
                .click( function() {
                    var $button = $( this );
                    $button.btnBusyState( true );
                    setTimeout( function() {
                        form.validate();
                        submitRecord();
                        $button.btnBusyState( false );
                        return false;
                    }, 100 );
                } );

            $( document ).on( 'click', 'button#validate-form:not(.disabled)', function() {
                if ( typeof form !== 'undefined' ) {
                    var $button = $( this );
                    $button.btnBusyState( true );
                    setTimeout( function() {
                        form.validate();
                        $button.btnBusyState( false );
                        if ( !form.isValid() ) {
                            gui.alert( 'Form contains errors <br/>(please see fields marked in red)' );
                            return;
                        } else {
                            gui.alert( 'Form is valid!', 'OK', 'success' );
                        }
                    }, 100 );
                }
            } );

            $( document ).on( 'progressupdate', 'form.or', function( event, status ) {
                if ( $formprogress.length > 0 ) {
                    $formprogress.css( 'width', status + '%' );
                }
            } );

            if ( inIframe() && settings.parentWindowOrigin ) {
                $( document ).on( 'submissionsuccess edited', postEventAsMessageToParentWindow );
            }
        }

        function setDraftStatus( status ) {
            status = status || false;
            $( '.form-footer [name="draft"]' ).prop( 'checked', status ).trigger( 'change' );
        }

        function getDraftStatus() {
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

        /**
         * splits an array of file sizes into batches (for submission) based on a limit
         * @param  {Array.<number>} fileSizes   array of file sizes
         * @param  {number}     limit   limit in byte size of one chunk (can be exceeded for a single item)
         * @return {Array.<Array.<number>>} array of arrays with index, each secondary array of indices represents a batch
         */

        function divideIntoBatches( fileSizes, limit ) {
            var i, j, batch, batchSize,
                sizes = [],
                batches = [];
            //limit = limit || 5 * 1024 * 1024;
            for ( i = 0; i < fileSizes.length; i++ ) {
                sizes.push( {
                    'index': i,
                    'size': fileSizes[ i ]
                } );
            }
            while ( sizes.length > 0 ) {
                batch = [ sizes[ 0 ].index ];
                batchSize = sizes[ 0 ].size;
                if ( sizes[ 0 ].size < limit ) {
                    for ( i = 1; i < sizes.length; i++ ) {
                        if ( ( batchSize + sizes[ i ].size ) < limit ) {
                            batch.push( sizes[ i ].index );
                            batchSize += sizes[ i ].size;
                        }
                    }
                }
                batches.push( batch );
                for ( i = 0; i < sizes.length; i++ ) {
                    for ( j = 0; j < batch.length; j++ ) {
                        if ( sizes[ i ].index === batch[ j ] ) {
                            sizes.splice( i, 1 );
                        }
                    }
                }
            }
            return batches;
        }

        return {
            init: init,
            divideIntoBatches: divideIntoBatches
        };
    } );
