import encryptor from './encryptor';
import settings from './settings';
import store from './store';

/**
 * @typedef {import('../../../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyObject} Survey
 */

export const LAST_SAVED_VIRTUAL_ENDPOINT = 'jr://instance/last-saved';

/**
 * @typedef IsLastSaveEnabledOptions
 * @property {boolean} [checkStoreAvailability]
 */

/**
 * @param {Survey} survey
 * @param {IsLastSaveEnabledOptions} [options]
 */
export const isLastSaveEnabled = ( survey, options = { checkStoreAvailability: true } ) => {
    return (
        ( options.checkStoreAvailability === false || store.available ) &&
        Array.isArray( survey.externalData ) &&
        survey.externalData.some( item => item.src === LAST_SAVED_VIRTUAL_ENDPOINT ) &&
        !encryptor.isEncryptionEnabled( survey )
    );
};

/**
 * @param {string} enketoId
 * @return {Promise<EnketoRecord | void>}
 */
export const getLastSavedRecord = ( enketoId ) => {
    if ( !store.available || settings.type !== 'other' ) {
        return Promise.resolve();
    }

    return store.lastSavedRecords
        .get( enketoId )
        .then( lastSavedRecord => {
            if ( lastSavedRecord != null ) {
                delete lastSavedRecord._enketoId;

                return Object.assign( lastSavedRecord, { enketoId } );
            }
        } );
};

/**
 * @param {string} enketoId
 * @return {Promise<void>}
 */
export const removeLastSavedRecord = async ( enketoId ) => {
    if ( store.available ) {
        await store.lastSavedRecords.remove( enketoId );
    }
};

const domParser = new DOMParser();


const getLastSavedInstanceDocument = ( survey, lastSavedRecord ) => {
    if ( !store.available || lastSavedRecord == null || settings.type !== 'other' ) {
        const model = domParser.parseFromString( survey.model, 'text/xml' );
        const modelDefault = model.querySelector( 'model > instance > *' ).cloneNode( true );

        let doc = document.implementation.createDocument( null, '', null );

        doc.appendChild( modelDefault );

        return doc;
    } else {
        return domParser.parseFromString( lastSavedRecord.xml, 'text/xml' );
    }
};

/**
 * @param {Survey} survey
 * @param {EnketoRecord} [lastSavedRecord]
 * @return {Survey}
 */
export const populateLastSavedInstances = ( survey, lastSavedRecord ) => {
    if ( !isLastSaveEnabled( survey, { checkStoreAvailability: false } ) ) {
        return survey;
    }

    const lastSavedInstance = getLastSavedInstanceDocument( survey, lastSavedRecord );

    const externalData = survey.externalData.map( item => {
        if ( item.src === LAST_SAVED_VIRTUAL_ENDPOINT ) {
            return Object.assign( {}, item, { xml: lastSavedInstance } );
        }

        return item;
    } );

    return Object.assign( {}, survey, { externalData } );
};

/**
 * @typedef SetLastSavedRecordResult
 * @property {Survey} survey
 * @property {EnketoRecord} [lastSavedRecord]
 */

/**
 * @param {Survey} survey
 * @param {EnketoRecord} record
 * @return {Promise<SetLastSavedRecordResult>}
 */
export const setLastSavedRecord = ( survey, record ) => {
    if ( !store.available || settings.type !== 'other' ) {
        return Promise.resolve( {
            survey: populateLastSavedInstances( survey ),
        } );
    }

    const lastSavedRecord = isLastSaveEnabled( survey )
        ? Object.assign( {}, record, {
            _enketoId: record.enketoId,
        } )
        : null;

    return (
        lastSavedRecord == null
            ? removeLastSavedRecord( survey.enketoId )
            : store.lastSavedRecords.update( lastSavedRecord )
    ).then( ( [ lastSavedRecord ] = [] ) => ( {
        survey: populateLastSavedInstances( survey, lastSavedRecord ),
        lastSavedRecord,
    } ) );
};
