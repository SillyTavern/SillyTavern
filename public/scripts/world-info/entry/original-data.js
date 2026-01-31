/**
 * World Info Original Data Management
 * Contains functions for managing the original data values of world info entries.
 */

import { setValueByPath } from '../../utils.js';

/**
 * Mapping from internal field names to their original data key paths.
 * This needs to be used when updating JSON data fields.
 */
export const originalWIDataKeyMap = {
    'displayIndex': 'extensions.display_index',
    'excludeRecursion': 'extensions.exclude_recursion',
    'preventRecursion': 'extensions.prevent_recursion',
    'delayUntilRecursion': 'extensions.delay_until_recursion',
    'selectiveLogic': 'selectiveLogic',
    'comment': 'comment',
    'constant': 'constant',
    'order': 'insertion_order',
    'depth': 'extensions.depth',
    'probability': 'extensions.probability',
    'position': 'extensions.position',
    'role': 'extensions.role',
    'content': 'content',
    'enabled': 'enabled',
    'key': 'keys',
    'keysecondary': 'secondary_keys',
    'selective': 'selective',
    'matchWholeWords': 'extensions.match_whole_words',
    'useGroupScoring': 'extensions.use_group_scoring',
    'caseSensitive': 'extensions.case_sensitive',
    'matchPersonaDescription': 'extensions.match_persona_description',
    'matchCharacterDescription': 'extensions.match_character_description',
    'matchCharacterPersonality': 'extensions.match_character_personality',
    'matchCharacterDepthPrompt': 'extensions.match_character_depth_prompt',
    'matchScenario': 'extensions.match_scenario',
    'matchCreatorNotes': 'extensions.match_creator_notes',
    'scanDepth': 'extensions.scan_depth',
    'automationId': 'extensions.automation_id',
    'vectorized': 'extensions.vectorized',
    'groupOverride': 'extensions.group_override',
    'groupWeight': 'extensions.group_weight',
    'sticky': 'extensions.sticky',
    'cooldown': 'extensions.cooldown',
    'delay': 'extensions.delay',
    'triggers': 'extensions.triggers',
    'ignoreBudget': 'extensions.ignore_budget',
};

/**
 * Sets the value of a specific key in the original data entry corresponding to the given uid
 * This needs to be called whenever you update JSON data fields.
 * Use `originalWIDataKeyMap` to find the correct value to be set.
 *
 * @param {object} data - The data object containing the original data entries.
 * @param {number} uid - The unique identifier of the data entry.
 * @param {string} key - The key of the value to be set.
 * @param {any} value - The value to be set.
 */
export function setWIOriginalDataValue(data, uid, key, value) {
    if (data.originalData && Array.isArray(data.originalData.entries)) {
        let originalEntry = data.originalData.entries.find(x => x.uid === uid);

        if (!originalEntry) {
            return;
        }

        setValueByPath(originalEntry, key, value);
    }
}

/**
 * Deletes the original data entry corresponding to the given uid from the provided data object
 *
 * @param {object} data - The data object containing the original data entries
 * @param {string} uid - The unique identifier of the data entry to be deleted
 */
export function deleteWIOriginalDataValue(data, uid) {
    if (data.originalData && Array.isArray(data.originalData.entries)) {
        // Non-strict equality is used here to allow for both string and number comparisons
        // @eslint-disable-next-line eqeqeq
        const originalIndex = data.originalData.entries.findIndex(x => x.uid == uid);

        if (originalIndex >= 0) {
            data.originalData.entries.splice(originalIndex, 1);
        }
    }
}
