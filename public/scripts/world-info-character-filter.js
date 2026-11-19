/**
 * Data model of the World Info character filter: which characters, tags and personas an entry applies to.
 * This module has no imports, so the migration and the matching rules can be tested on their own.
 * The editor and the scan loop that use it live in world-info.js.
 */

/**
 * @enum {string} Types for character filter items
 */
export const CHARACTER_FILTER_TYPES = {
    CHARACTER: 'character',
    TAG: 'tag',
    PERSONA: 'persona',
};

/**
 * @enum {string} Filter states for individual character filter items.
 * - ONE_OF: At least one item with this state must match (OR logic). This is the default.
 * - REQUIRED: This specific item must match (AND logic).
 * - EXCLUDED: If this item matches, the entry is filtered out (NOT logic).
 */
export const CHARACTER_FILTER_STATES = {
    ONE_OF: 'oneOf',
    REQUIRED: 'required',
    EXCLUDED: 'excluded',
};

/**
 * One item of an entry's character filter.
 * @typedef {object} CharacterFilterItem
 * @property {string} type One of CHARACTER_FILTER_TYPES
 * @property {string} name Character file name without extension, tag ID, or persona avatar ID
 * @property {string} state One of CHARACTER_FILTER_STATES
 */

/**
 * Migrates an entry's characterFilter from old formats to the current format.
 * Handles: legacy object with isExclude/names/tags, and intermediate array with boolean exclude.
 * Target format: array of `{ type, name, state }` items.
 * @param {object} entry - The WI entry to migrate
 * @returns {boolean} - Whether anything was migrated
 */
export function migrateCharacterFilter(entry) {
    // Legacy object format: { isExclude, names, tags }
    if (entry.characterFilter && !Array.isArray(entry.characterFilter) && typeof entry.characterFilter === 'object') {
        const oldFilter = entry.characterFilter;
        const newFilter = [];
        const hasNames = Array.isArray(oldFilter.names) && oldFilter.names.length > 0;
        const hasTags = Array.isArray(oldFilter.tags) && oldFilter.tags.length > 0;

        if (oldFilter.isExclude) {
            // Exclude mode: all items become EXCLUDED
            if (hasNames) {
                for (const name of oldFilter.names) {
                    newFilter.push({ type: CHARACTER_FILTER_TYPES.CHARACTER, name, state: CHARACTER_FILTER_STATES.EXCLUDED });
                }
            }
            if (hasTags) {
                for (const tag of oldFilter.tags) {
                    newFilter.push({ type: CHARACTER_FILTER_TYPES.TAG, name: tag, state: CHARACTER_FILTER_STATES.EXCLUDED });
                }
            }
        } else if (hasNames && hasTags) {
            // Both names and tags in include mode: old logic was AND between groups.
            // Names → ONE_OF (character must be one of these)
            // Tags → REQUIRED (preserves AND relationship: tags must also match)
            for (const name of oldFilter.names) {
                newFilter.push({ type: CHARACTER_FILTER_TYPES.CHARACTER, name, state: CHARACTER_FILTER_STATES.ONE_OF });
            }
            for (const tag of oldFilter.tags) {
                newFilter.push({ type: CHARACTER_FILTER_TYPES.TAG, name: tag, state: CHARACTER_FILTER_STATES.REQUIRED });
            }
        } else {
            // Only names or only tags: ONE_OF preserves exact old behavior
            if (hasNames) {
                for (const name of oldFilter.names) {
                    newFilter.push({ type: CHARACTER_FILTER_TYPES.CHARACTER, name, state: CHARACTER_FILTER_STATES.ONE_OF });
                }
            }
            if (hasTags) {
                for (const tag of oldFilter.tags) {
                    newFilter.push({ type: CHARACTER_FILTER_TYPES.TAG, name: tag, state: CHARACTER_FILTER_STATES.ONE_OF });
                }
            }
        }
        console.debug('[WI] Migrated old characterFilter object format for entry', entry.uid);
        entry.characterFilter = newFilter;
        return true;
    }

    // Normalize non-array to empty array
    if (!Array.isArray(entry.characterFilter)) {
        entry.characterFilter = [];
        return true;
    }

    // Intermediate array format: items may have boolean 'exclude' instead of 'state'
    for (const item of entry.characterFilter) {
        if (!item.state || !Object.values(CHARACTER_FILTER_STATES).includes(item.state)) {
            item.state = item.exclude ? CHARACTER_FILTER_STATES.EXCLUDED : CHARACTER_FILTER_STATES.ONE_OF;
            delete item.exclude;
        }
    }

    return false;
}

/**
 * Decides whether an entry's character filter lets the entry through for the current chat.
 * Excluded items are checked first, then required ones, then the "one of" group.
 * @param {CharacterFilterItem[]} filter The entry's character filter
 * @param {object} current What is active right now
 * @param {string} [current.character] File name of the active character, without extension
 * @param {string[]} [current.tags] Tag IDs of the active character
 * @param {string} [current.persona] Avatar ID of the active persona
 * @returns {{pass: boolean, reason: string}} Whether the entry applies, and why not if it does not
 */
export function evaluateCharacterFilter(filter, { character = '', tags = [], persona = '' } = {}) {
    if (!Array.isArray(filter) || filter.length === 0) {
        return { pass: true, reason: '' };
    }

    /** @param {CharacterFilterItem} item */
    const matchesItem = (item) => {
        switch (item.type) {
            case CHARACTER_FILTER_TYPES.CHARACTER:
                return Boolean(character) && item.name === character;
            case CHARACTER_FILTER_TYPES.TAG:
                return tags.includes(item.name);
            case CHARACTER_FILTER_TYPES.PERSONA:
                return Boolean(persona) && item.name === persona;
            default:
                return false;
        }
    };

    const oneOfItems = filter.filter(item => item.state === CHARACTER_FILTER_STATES.ONE_OF);
    const requiredItems = filter.filter(item => item.state === CHARACTER_FILTER_STATES.REQUIRED);
    const excludedItems = filter.filter(item => item.state === CHARACTER_FILTER_STATES.EXCLUDED);

    if (excludedItems.some(matchesItem)) {
        return { pass: false, reason: 'excluded item matched' };
    }
    if (!requiredItems.every(matchesItem)) {
        return { pass: false, reason: 'required item not matched' };
    }
    if (oneOfItems.length > 0 && !oneOfItems.some(matchesItem)) {
        return { pass: false, reason: 'no oneOf item matched' };
    }
    return { pass: true, reason: '' };
}
