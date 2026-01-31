/**
 * World Info Buffer Signature Utilities
 * Contains functions for grouping entries by their buffer signature (scanDepth + global scan flags)
 * and computing hashes for cache invalidation.
 */

import { substituteParams } from '../../../script.js';
import { world_info_depth } from '../state.js';
import {
    getBufferSignaturePure,
    computeEntriesHashPure,
} from '../pure-functions.js';

// Re-export pure functions for backwards compatibility
export { simpleHash, getBufferSignaturePure, computeEntriesHashPure } from '../pure-functions.js';

/**
 * Gets the buffer signature for an entry using global state.
 * Entries with the same signature can share the same text buffer for scanning.
 * @param {import('../constants.js').WIScanEntry} entry - The entry to get signature for
 * @returns {string} A JSON string key representing the buffer configuration
 */
export function getBufferSignature(entry) {
    return getBufferSignaturePure(entry, world_info_depth);
}

/**
 * Groups entries by their buffer signature.
 * @param {import('../constants.js').WIScanEntry[]} entries - The entries to group
 * @returns {Map<string, import('../constants.js').WIScanEntry[]>} Map of signature to entries
 */
export function groupEntriesBySignature(entries) {
    /** @type {Map<string, import('../constants.js').WIScanEntry[]>} */
    const groups = new Map();

    for (const entry of entries) {
        const signature = getBufferSignature(entry);
        if (!groups.has(signature)) {
            groups.set(signature, []);
        }
        groups.get(signature).push(entry);
    }

    return groups;
}

/**
 * Computes a hash for a set of entries for cache invalidation.
 * The hash includes keywords (after parameter substitution), case sensitivity,
 * and whole word matching settings.
 * @param {import('../constants.js').WIScanEntry[]} entries - The entries to hash
 * @returns {string} A hash string representing the entries' keyword configuration
 */
export function computeEntriesHash(entries) {
    return computeEntriesHashPure(entries, substituteParams);
}
