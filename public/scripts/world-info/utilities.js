/**
 * World Info Utilities
 * Contains utility functions for the world info module.
 * Pure functions are re-exported from pure-functions.js for convenience.
 */

import { getSelect2OptionId } from '../utils.js';
import { world_names } from './state.js';
import { t } from '../i18n.js';
import { newWorldInfoEntryTemplate } from './entry/definition.js';

// Re-export pure functions for backwards compatibility
import { isValidRegex } from './pure-functions.js';
export {
    parseRegexFromString,
    isValidRegex,
    parseDecorators,
    getFreeWorldEntryUid,
} from './pure-functions.js';

/** @typedef {import('../utils.js').Select2Option} Select2Option */

/**
 * Tokenizer parsing input and splitting it into keywords and regexes
 *
 * @param {{_type: string, term: string}} input - The typed input
 * @param {{options: object}} _selection - The selection even object (?)
 * @param {function(Select2Option):void} callback - The original callback function to call if an item should be inserted
 * @returns {{term: string}} - The remaining part that is untokenized in the textbox
 */
export function customTokenizer(input, _selection, callback) {
    let current = input.term;

    let insideRegex = false, regexClosed = false;

    // Go over the input and check the current state, if we can get a token
    for (let i = 0; i < current.length; i++) {
        let char = current[i];

        // If we find an unascaped slash, set the current regex state
        if (char === '/' && (i === 0 || current[i - 1] !== '\\')) {
            if (!insideRegex) insideRegex = true;
            else if (!regexClosed) regexClosed = true;
        }

        // If a comma is typed, we tokenize the input.
        // unless we are inside a possible regex, which would allow commas inside
        if (char === ',') {
            // We take everything up till now and consider this a token
            const token = current.slice(0, i).trim();

            // Now how we test if this is a regex? And not a finished one, but a half-finished one?
            // We use the state remembered from above to check whether the delimiter was opened but not closed yet.
            // We don't check validity here if we are inside a regex, because it might only get valid after its finished. (Closing brackets, etc)
            // Validity will be finally checked when the next comma is typed.
            if (insideRegex && !regexClosed) {
                continue;
            }

            // So now the comma really means the token is done.
            // We take the token up till now, and insert it. Empty will be skipped.
            if (token) {
                const isRegex = isValidRegex(token);

                // Last chance to check for valid regex again. Because it might have been valid while typing, but now is not valid anymore and contains commas we need to split.
                if (token.startsWith('/') && !isRegex) {
                    const tokens = token.split(',').map(x => x.trim());
                    tokens.forEach(x => callback({ id: getSelect2OptionId(x), text: x }));
                } else {
                    callback({ id: getSelect2OptionId(token), text: token });
                }
            }

            // Now remove the token from the current input, and the comma too
            current = current.slice(i + 1);
            insideRegex = false;
            regexClosed = false;
            i = 0;
        }
    }

    // At the end, just return the left-over input
    return { term: current };
}

/**
 * Splits a given input string that contains one or more keywords or regexes, separated by commas.
 *
 * Each part can be a valid regex following the pattern `/myregex/flags` with optional flags. Commas inside the regex are allowed, slashes have to be escaped like this: `\/`
 * If a regex doesn't stand alone, it is not treated as a regex.
 *
 * @param {string} input - One or multiple keywords or regexes, separated by commas
 * @returns {string[]} An array of keywords and regexes
 */
export function splitKeywordsAndRegexes(input) {
    /** @type {string[]} */
    let keywordsAndRegexes = [];

    // We can make this easy. Instead of writing another function to find and parse regexes,
    // we gonna utilize the custom tokenizer that also handles the input.
    // No need for validation here
    const addFindCallback = (/** @type {Select2Option} */ item) => {
        keywordsAndRegexes.push(item.text);
    };

    const { term } = customTokenizer({ _type: 'custom_call', term: input }, undefined, addFindCallback);
    const finalTerm = term.trim();
    if (finalTerm) {
        addFindCallback({ id: getSelect2OptionId(finalTerm), text: finalTerm });
    }

    return keywordsAndRegexes;
}

/**
 * Generates a free world name based on the given input name.
 * If the input name is null, a default name is used.
 * If the input name already exists, a numbered suffix is added.
 *
 * @param {string|null} worldName - The name to base the new world name on. If null, a default name is used.
 * @param {Object} [options={}] - Optional parameters.
 * @param {boolean} [options.stripIndex=true] - Whether to strip any numbered suffix from the input name before generating the new name.
 * @return {string|undefined} The generated free world name, or undefined if no free name could be found after trying 100,000 times.
 */
export function getFreeWorldName(worldName = null, { stripIndex = true } = {}) {
    worldName ??= t`New World`;
    if (stripIndex) {
        worldName = worldName.replace(/\s*\(\d+\)$/, '');
    }
    const MAX_FREE_NAME = 100_000;
    for (let index = 1; index < MAX_FREE_NAME; index++) {
        const newName = `${worldName} (${index})`;
        if (world_names.includes(newName)) {
            continue;
        }
        return newName;
    }

    return undefined;
}

/**
 * Adds missing fields to WI entries that are present in the entry template, but not in the data.
 * Additionally verify that array/object fields are of the expected type.
 * @param {any[]} data WI entries
 * @param {object} template The template to use for backfilling
 * @returns {any[]} Data with backfilled fields
 */
export function addMissingWorldInfoFields(data) {
    data.forEach((entry) => {
        // Add missing fields from the template
        Object.entries(newWorldInfoEntryTemplate).forEach(([key, value]) => {
            if (!Object.hasOwn(entry, key)) {
                entry[key] = structuredClone(value);
            }
        });

        // Ensure that the key is always an array
        if (!Array.isArray(entry.key)) {
            console.debug('[WI] Fixing invalid "key" field for entry', entry);
            entry.key = [];
        }

        // Ensure that the keysecondary is always an array
        if (!Array.isArray(entry.keysecondary)) {
            console.debug('[WI] Fixing invalid "keysecondary" field for entry', entry);
            entry.keysecondary = [];
        }

        // Ensure that the characterFilter is an object with the expected structure
        if (!entry.characterFilter || typeof entry.characterFilter !== 'object' || Array.isArray(entry.characterFilter)) {
            entry.characterFilter = {
                isExclude: false,
                names: [],
                tags: [],
            };
        }
    });

    return data;
}
