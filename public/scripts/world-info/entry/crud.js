/**
 * World Info Entry CRUD Operations
 * Contains functions for creating, duplicating, and deleting world info entries.
 */

import { Popup } from '../../popup.js';
import { t } from '../../i18n.js';
import { getFreeWorldEntryUid } from '../utilities.js';
import { newWorldInfoEntryTemplate } from './definition.js';

/**
 * Creates a new world info entry from template.
 * @param {string} _name Name of the WI (unused)
 * @param {any} data WI data
 * @returns {object | undefined} New entry object or undefined if failed
 */
export function createWorldInfoEntry(_name, data) {
    const newUid = getFreeWorldEntryUid(data);

    if (!Number.isInteger(newUid)) {
        console.error('Couldn\'t assign UID to a new entry');
        return;
    }

    const newEntry = { uid: newUid, ...structuredClone(newWorldInfoEntryTemplate) };
    data.entries[newUid] = newEntry;

    return newEntry;
}

/**
 * Duplicate a WI entry by copying all of its properties and assigning a new uid
 * @param {*} data - The data of the book
 * @param {number} uid - The uid of the entry to copy in this book
 * @returns {*} The new WI duplicated entry
 */
export function duplicateWorldInfoEntry(data, uid) {
    if (!data || !('entries' in data) || !data.entries[uid]) {
        return;
    }

    // Exclude uid and gather the rest of the properties
    const originalData = structuredClone(data.entries[uid]);
    delete originalData.uid;

    // Create new entry and copy over data
    const entry = createWorldInfoEntry(data.name, data);
    Object.assign(entry, originalData);

    return entry;
}

/**
 * Deletes a WI entry, with a user confirmation dialog
 * @param {*[]} data - The data of the book
 * @param {number} uid - The uid of the entry to copy in this book
 * @param {object} [options={}] - Optional arguments
 * @param {boolean} [options.silent=false] - Whether to prompt the user for deletion or just do it
 * @returns {Promise<boolean>} Whether the entry deletion was successful
 */
export async function deleteWorldInfoEntry(data, uid, { silent = false } = {}) {
    if (!data || !('entries' in data)) {
        return;
    }

    const confirmation = silent || await Popup.show.confirm(t`Delete the entry with UID: ${uid}?`, t`This action is irreversible!`);
    if (!confirmation) {
        return false;
    }

    delete data.entries[uid];
    return true;
}
