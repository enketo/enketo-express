/**
 * @typedef {import('../../public/js/src/module/store')} ClientStore
 */

/**
 * @typedef EnketoRecord Enketo's Record representation of an Instance
 * @property { string } enketoId - identifier for the form the record is associated with
 * @property { string } instanceId - the record's primary key identifier
 * @property { string } name - a unique name assigned to the record by a user
 * @property { string } xml - the serialized representation of the record's current state
 * @property { string } [created] - when the record was created in the store
 * @property { string } [updated] - when the record was most recently updated in the store
 * @property { string } [deprecatedId] - deprecated (previous) ID of record
 * @property { boolean } [draft] - whether the record was saved either as a draft or auto-saved
 * @property { window.File[] } [files] - any files attached to the record
 * @see {@link https://getodk.github.io/xforms-spec/#instance}
 * @see {ClientStore}
 */

/** Note: currently this module exists to provide a type definition for EnketoRecord
 * in a place consistent with where other data model types are defined. This export
 * is only present because an ESM module (if this is treated as one) must import
 * or export _something_.
 */
export {};
