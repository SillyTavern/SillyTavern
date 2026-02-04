/**
 * World Info Buffer
 * Represents a scanning buffer for one evaluation of World Info.
 */

import { escapeRegex } from '../utils.js';
import { parseRegexFromString } from './utilities.js';
import { getEntryId } from './pure-functions.js';
import {
    world_info_depth,
    world_info_case_sensitive,
    world_info_match_whole_words,
} from './state.js';
import { MAX_SCAN_DEPTH, scan_state, world_info_logic } from './constants.js';

/**
 * Transforms a string based on case sensitivity settings.
 * Pure function for testing.
 * @param {string} str The string to transform
 * @param {import('./constants.js').WIScanEntry} entry The entry that triggered the scan
 * @param {boolean} globalCaseSensitive The global case sensitivity setting
 * @returns {string} The transformed string
 */
export function transformString(str, entry, globalCaseSensitive) {
    const caseSensitive = entry.caseSensitive ?? globalCaseSensitive;
    return caseSensitive ? str : str.toLowerCase();
}

/**
 * Matches keywords against a haystack.
 * Pure function for testing.
 * @param {string} haystack The string to search in
 * @param {string} needle The string to search for
 * @param {import('./constants.js').WIScanEntry} entry The entry that triggered the scan
 * @param {{caseSensitive: boolean, matchWholeWords: boolean}} globalSettings The global matching settings
 * @returns {boolean} True if the string was found in the buffer
 */
export function matchKeysPure(haystack, needle, entry, globalSettings) {
    const { caseSensitive: globalCaseSensitive, matchWholeWords: globalMatchWholeWords } = globalSettings;

    // Empty or whitespace-only keywords should never match
    if (!needle || !needle.trim()) {
        return false;
    }

    // Trim the needle to match AC behavior (AhoCorasickMatcher trims keywords)
    needle = needle.trim();

    // If the needle is a regex, we do regex pattern matching and override all the other options
    const keyRegex = parseRegexFromString(needle);
    if (keyRegex) {
        return keyRegex.test(haystack);
    }

    // Otherwise we do normal matching of plaintext with the chosen entry settings
    haystack = transformString(haystack, entry, globalCaseSensitive);
    const transformedString = transformString(needle, entry, globalCaseSensitive);
    const matchWholeWords = entry.matchWholeWords ?? globalMatchWholeWords;

    if (matchWholeWords) {
        const keyWords = transformedString.split(/\s+/);

        if (keyWords.length > 1) {
            return haystack.includes(transformedString);
        }
        else {
            // Use custom boundaries to include punctuation and other non-alphanumeric characters
            const regex = new RegExp(`(?:^|\\W)(${escapeRegex(transformedString)})(?:$|\\W)`);
            if (regex.test(haystack)) {
                return true;
            }
        }
    } else {
        return haystack.includes(transformedString);
    }

    return false;
}

/**
 * Represents a scanning buffer for one evaluation of World Info.
 */
export class WorldInfoBuffer {
    /**
     * @type {Map<string, object>} Map of entries that need to be activated no matter what
     */
    static externalActivations = new Map();

    /**
     * @type {import('./constants.js').WIGlobalScanData} Chat independent data to be scanned, such as persona and character descriptions
     */
    #globalScanData = null;

    /**
     * @type {string[]} Array of messages sorted by ascending depth
     */
    #depthBuffer = [];

    /**
     * @type {string[]} Array of strings added by recursive scanning
     */
    #recurseBuffer = [];

    /**
     * @type {string[]} Array of strings added by prompt injections that are valid for the current scan
     */
    #injectBuffer = [];

    /**
     * @type {number} The skew of the global scan depth. Used in "min activations"
     */
    #skew = 0;

    /**
     * @type {number} The starting depth of the global scan depth.
     */
    #startDepth = 0;

    /**
     * @type {Map<string, import('./scanning/AhoCorasickMatcher.js').MatchResult[]>|null}
     * Pre-computed matches from AC search, keyed by entryId
     */
    #precomputedMatches = null;

    /**
     * Initialize the buffer with the given messages.
     * @param {string[]} messages Array of messages to add to the buffer
     * @param {import('./constants.js').WIGlobalScanData} globalScanData Chat independent context to be scanned
     */
    constructor(messages, globalScanData) {
        this.#initDepthBuffer(messages);
        this.#globalScanData = globalScanData;
    }

    /**
     * Populates the buffer with the given messages.
     * @param {string[]} messages Array of messages to add to the buffer
     * @returns {void} Hardly seen nothing down here
     */
    #initDepthBuffer(messages) {
        for (let depth = 0; depth < MAX_SCAN_DEPTH; depth++) {
            if (messages[depth]) {
                this.#depthBuffer[depth] = messages[depth].trim();
            }
            // break if last message is reached
            if (depth === messages.length - 1) {
                break;
            }
        }
    }

    /**
     * Gets a string that respects the case sensitivity setting
     * @param {string} str The string to transform
     * @param {import('./constants.js').WIScanEntry} entry The entry that triggered the scan
     * @returns {string} The transformed string
    */
    #transformString(str, entry) {
        return transformString(str, entry, world_info_case_sensitive);
    }

    /**
     * Gets all messages up to the given depth + recursion buffer.
     * @param {import('./constants.js').WIScanEntry} entry The entry that triggered the scan
     * @param {number} scanState The state of the scan
     * @returns {string} A slice of buffer until the given depth (inclusive)
     */
    get(entry, scanState) {
        let depth = entry.scanDepth ?? this.getDepth();
        if (depth <= this.#startDepth) {
            return '';
        }

        if (depth < 0) {
            console.error(`[WI] Invalid WI scan depth ${depth}. Must be >= 0`);
            return '';
        }

        if (depth > MAX_SCAN_DEPTH) {
            console.warn(`[WI] Invalid WI scan depth ${depth}. Truncating to ${MAX_SCAN_DEPTH}`);
            depth = MAX_SCAN_DEPTH;
        }

        const MATCHER = '\x01';
        const JOINER = '\n' + MATCHER;
        let result = MATCHER + this.#depthBuffer.slice(this.#startDepth, depth).join(JOINER);

        if (entry.matchPersonaDescription && this.#globalScanData.personaDescription) {
            result += JOINER + this.#globalScanData.personaDescription;
        }
        if (entry.matchCharacterDescription && this.#globalScanData.characterDescription) {
            result += JOINER + this.#globalScanData.characterDescription;
        }
        if (entry.matchCharacterPersonality && this.#globalScanData.characterPersonality) {
            result += JOINER + this.#globalScanData.characterPersonality;
        }
        if (entry.matchCharacterDepthPrompt && this.#globalScanData.characterDepthPrompt) {
            result += JOINER + this.#globalScanData.characterDepthPrompt;
        }
        if (entry.matchScenario && this.#globalScanData.scenario) {
            result += JOINER + this.#globalScanData.scenario;
        }
        if (entry.matchCreatorNotes && this.#globalScanData.creatorNotes) {
            result += JOINER + this.#globalScanData.creatorNotes;
        }

        if (this.#injectBuffer.length > 0) {
            result += JOINER + this.#injectBuffer.join(JOINER);
        }

        // Min activations should not include the recursion buffer
        if (this.#recurseBuffer.length > 0 && scanState !== scan_state.MIN_ACTIVATIONS) {
            result += JOINER + this.#recurseBuffer.join(JOINER);
        }

        return result;
    }

    /**
     * Matches the given string against the buffer.
     * @param {string} haystack The string to search in
     * @param {string} needle The string to search for
     * @param {import('./constants.js').WIScanEntry} entry The entry that triggered the scan
     * @returns {boolean} True if the string was found in the buffer
     */
    matchKeys(haystack, needle, entry) {
        return matchKeysPure(haystack, needle, entry, {
            caseSensitive: world_info_case_sensitive,
            matchWholeWords: world_info_match_whole_words,
        });
    }

    /**
     * Adds a message to the recursion buffer.
     * @param {string} message The message to add
     */
    addRecurse(message) {
        this.#recurseBuffer.push(message);
    }

    /**
     * Adds an injection to the buffer.
     * @param {string} message The injection to add
     */
    addInject(message) {
        this.#injectBuffer.push(message);
    }

    /**
     * Checks if the recursion buffer is not empty.
     * @returns {boolean} Returns true if the recursion buffer is not empty, otherwise false
     */
    hasRecurse() {
        return this.#recurseBuffer.length > 0;
    }

    /**
     * Gets ONLY the recursion buffer content, without chat messages or global data.
     * Used for entries with delayUntilRecursion that should only match recursion content.
     * @returns {string} The recursion buffer content
     */
    getRecurseOnly() {
        if (this.#recurseBuffer.length === 0) {
            return '';
        }
        const MATCHER = '\x01';
        const JOINER = '\n' + MATCHER;
        return MATCHER + this.#recurseBuffer.join(JOINER);
    }

    /**
     * Increments skew to advance the scan range.
     */
    advanceScan() {
        this.#skew++;
    }

    /**
     * @returns {number} Settings' depth + current skew.
     */
    getDepth() {
        return world_info_depth + this.#skew;
    }

    /**
     * Get the externally activated version of the entry, if there is one.
     * @param {object} entry WI entry to check
     * @returns {object|undefined} the external version if the entry is forcefully activated, undefined otherwise
     */
    getExternallyActivated(entry) {
        return WorldInfoBuffer.externalActivations.get(getEntryId(entry));
    }

    /**
     * Clean-up the external effects for entries.
     */
    resetExternalEffects() {
        WorldInfoBuffer.externalActivations = new Map();
    }

    /**
     * Sets the pre-computed matches from AC search.
     * @param {Map<string, import('./scanning/AhoCorasickMatcher.js').MatchResult[]>} matches The matches map
     */
    setPrecomputedMatches(matches) {
        this.#precomputedMatches = matches;
    }

    /**
     * Gets the pre-computed matches for an entry.
     * @param {import('./constants.js').WIScanEntry} entry The entry to get matches for
     * @returns {import('./scanning/AhoCorasickMatcher.js').MatchResult[]|null} The matches or null if not available
     */
    getPrecomputedMatches(entry) {
        if (!this.#precomputedMatches) return null;
        const entryId = getEntryId(entry);
        return this.#precomputedMatches.get(entryId) || null;
    }

    /**
     * Gets the full precomputed matches map.
     * Used by filtering functions that need to compute scores for multiple entries efficiently.
     * @returns {Map<string, import('./scanning/AhoCorasickMatcher.js').MatchResult[]>} The matches map
     */
    getPrecomputedMatchesMap() {
        return this.#precomputedMatches || new Map();
    }

    /**
     * Gets the match score for the given entry using pre-computed matches if available.
     * @param {import('./constants.js').WIScanEntry} entry Entry to check
     * @param {number} scanState The state of the scan
     * @param {boolean} [recurseOnly=false] If true, only match against recursion buffer (for delayUntilRecursion entries)
     * @returns {number} The number of key activations for the given entry
     */
    getScore(entry, scanState, recurseOnly = false) {
        // For delayUntilRecursion entries during RECURSION, only match against recursion buffer
        // Skip pre-computed matches since they were computed against the full buffer
        if (recurseOnly) {
            const bufferState = this.getRecurseOnly();
            return this.#computeScore(entry, bufferState);
        }

        // Try to use pre-computed matches first
        const precomputed = this.getPrecomputedMatches(entry);
        if (precomputed !== null) {
            return this.getScoreFromMatches(entry, precomputed);
        }

        // Fallback to original scanning method
        const bufferState = this.get(entry, scanState);
        return this.#computeScore(entry, bufferState);
    }

    /**
     * Computes the match score for the given entry against the given buffer.
     * @param {import('./constants.js').WIScanEntry} entry Entry to check
     * @param {string} bufferState The buffer content to search in
     * @returns {number} The number of key activations for the given entry
     */
    #computeScore(entry, bufferState) {
        let numberOfPrimaryKeys = 0;
        let numberOfSecondaryKeys = 0;
        let primaryScore = 0;
        let secondaryScore = 0;

        // Increment score for every key found in the buffer
        if (Array.isArray(entry.key)) {
            numberOfPrimaryKeys = entry.key.length;
            for (const key of entry.key) {
                if (this.matchKeys(bufferState, key, entry)) {
                    primaryScore++;
                }
            }
        }

        // Increment score for every secondary key found in the buffer
        if (Array.isArray(entry.keysecondary)) {
            numberOfSecondaryKeys = entry.keysecondary.length;
            for (const key of entry.keysecondary) {
                if (this.matchKeys(bufferState, key, entry)) {
                    secondaryScore++;
                }
            }
        }

        // No keys == no score
        if (!numberOfPrimaryKeys) {
            return 0;
        }

        // Only positive logic influences the score
        if (numberOfSecondaryKeys > 0) {
            switch (entry.selectiveLogic) {
                // AND_ANY: Add both scores
                case world_info_logic.AND_ANY:
                    return primaryScore + secondaryScore;
                // AND_ALL: Add both scores if all secondary keys are found, otherwise only primary score
                case world_info_logic.AND_ALL:
                    return secondaryScore === numberOfSecondaryKeys ? primaryScore + secondaryScore : primaryScore;
            }
        }

        return primaryScore;
    }

    /**
     * Gets the match score for the given entry from pre-computed matches.
     * @param {import('./constants.js').WIScanEntry} entry Entry to check
     * @param {import('./scanning/AhoCorasickMatcher.js').MatchResult[]} matches The pre-computed matches
     * @returns {number} The number of key activations for the given entry
     */
    getScoreFromMatches(entry, matches) {
        const numberOfPrimaryKeys = Array.isArray(entry.key) ? entry.key.length : 0;
        const numberOfSecondaryKeys = Array.isArray(entry.keysecondary) ? entry.keysecondary.length : 0;

        // No keys == no score
        if (!numberOfPrimaryKeys) {
            return 0;
        }

        // Count unique primary key indices that matched
        const primaryMatches = matches.filter(m => m.keyType === 'primary');
        const primaryMatchedIndices = new Set(primaryMatches.map(m => m.keyIndex));
        const primaryScore = primaryMatchedIndices.size;

        // Count unique secondary key indices that matched
        const secondaryMatches = matches.filter(m => m.keyType === 'secondary');
        const secondaryMatchedIndices = new Set(secondaryMatches.map(m => m.keyIndex));
        const secondaryScore = secondaryMatchedIndices.size;

        // Only positive logic influences the score
        if (numberOfSecondaryKeys > 0) {
            switch (entry.selectiveLogic) {
                // AND_ANY: Add both scores
                case world_info_logic.AND_ANY:
                    return primaryScore + secondaryScore;
                // AND_ALL: Add both scores if all secondary keys are found, otherwise only primary score
                case world_info_logic.AND_ALL:
                    return secondaryScore === numberOfSecondaryKeys ? primaryScore + secondaryScore : primaryScore;
            }
        }

        return primaryScore;
    }
}
