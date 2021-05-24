import settings from './settings';

/**
 * @typedef Record { import('./store').Record }
 */

/**
 * Obtains last-saved record key
 */
function getLastSavedKey() {
    return `__lastSaved_${settings.enketoId}`;
}

/**
 * Constructs a last-saved record payload.
 *
 * @param { Record } recordData - original record data which was most recently saved
 * @return { Record }
 */
function lastSavedRecordPayload( recordData ) {
    const lastSavedData = {
        // give an internal name
        name: `__lastSaved_${Date.now()}`,
        // use the pre-defined key
        instanceId: getLastSavedKey(),
    };

    return Object.assign( {}, recordData, lastSavedData );
}

export default {
    getLastSavedKey,
    lastSavedRecordPayload,
};
