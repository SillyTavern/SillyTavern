/**
 * World Info Pure Functions
 * Contains pure utility functions with no external dependencies, designed for unit testing.
 * These functions are re-exported from their original modules for production use.
 */

/**
 * Escapes special characters in a string for use in a regular expression.
 * @param {string} string The string to escape.
 * @returns {string} The escaped string.
 */
function escapeRegex(string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * @typedef {Object} GlobalMatchSettings
 * @property {boolean} caseSensitive - Global case sensitivity setting
 * @property {boolean} matchWholeWords - Global whole word matching setting
 */

/**
 * Known WI entry decorators
 */
export const KNOWN_DECORATORS = ['@@activate', '@@dont_activate'];

// ============================================================================
// Regex Utilities
// ============================================================================

/**
 * Gets a real regex object from a slash-delimited regex string
 *
 * This function works with `/` as delimiter, and each occurrence of it inside the regex has to be escaped.
 * Flags are optional, but can only be valid flags supported by JavaScript's `RegExp` (`g`, `i`, `m`, `s`, `u`, `y`).
 *
 * @param {string} input - A delimited regex string
 * @returns {RegExp|null} The regex object, or null if not a valid regex
 */
export function parseRegexFromString(input) {
    // Handle null/undefined input
    if (input == null) {
        return null;
    }

    // Extracting the regex pattern and flags
    let match = input.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);
    if (!match) {
        return null; // Not a valid regex format
    }

    let [, pattern, flags] = match;

    // If we find any unescaped slash delimiter, we also exit out.
    // JS doesn't care about delimiters inside regex patterns, but for this to be a valid regex outside of our implementation,
    // we have to make sure that our delimiter is correctly escaped. Or every other engine would fail.
    if (pattern.match(/(^|[^\\])\//)) {
        return null;
    }

    // Now we need to actually unescape the slash delimiters, because JS doesn't care about delimiters
    pattern = pattern.replace('\\/', '/');

    // Then we return the regex. If it fails, it was invalid syntax.
    try {
        return new RegExp(pattern, flags);
    } catch (e) {
        return null;
    }
}

/**
 * Validates if a string is a valid slash-delimited regex, that can be parsed and executed
 *
 * This is a wrapper around `parseRegexFromString`
 *
 * @param {string} input - A delimited regex string
 * @returns {boolean} Whether this would be a valid regex that can be parsed and executed
 */
export function isValidRegex(input) {
    return parseRegexFromString(input) !== null;
}

// ============================================================================
// Decorator Parsing
// ============================================================================

/**
 * Parse decorators from worldinfo content
 * @param {string} content The content to parse
 * @returns {[string[],string]} The decorators found in the content and the content without decorators
 */
export function parseDecorators(content) {
    /**
     * Check if the decorator is known
     * @param {string} data string to check
     * @returns {boolean} true if the decorator is known
     */
    const isKnownDecorator = (data) => {
        if (data.startsWith('@@@')) {
            data = data.substring(1);
        }

        for (let i = 0; i < KNOWN_DECORATORS.length; i++) {
            if (data.startsWith(KNOWN_DECORATORS[i])) {
                return true;
            }
        }
        return false;
    };

    if (content.startsWith('@@')) {
        let newContent = content;
        const splited = content.split('\n');
        let decorators = [];
        let fallbacked = false;

        for (let i = 0; i < splited.length; i++) {
            if (splited[i].startsWith('@@')) {
                if (splited[i].startsWith('@@@') && !fallbacked) {
                    continue;
                }

                if (isKnownDecorator(splited[i])) {
                    decorators.push(splited[i].startsWith('@@@') ? splited[i].substring(1) : splited[i]);
                    fallbacked = false;
                }
                else {
                    fallbacked = true;
                }
            } else {
                newContent = splited.slice(i).join('\n');
                break;
            }
        }
        return [decorators, newContent];
    }

    return [[], content];
}

// ============================================================================
// Keyword Utilities
// ============================================================================

/**
 * Gets the next free UID for a new world info entry.
 * @param {object} data - The world info data object
 * @returns {number|null} The next free UID, or null if none available
 */
export function getFreeWorldEntryUid(data) {
    if (!data || !('entries' in data)) {
        return null;
    }

    const MAX_UID = 1_000_000; // <- should be safe enough :)
    for (let uid = 0; uid < MAX_UID; uid++) {
        if (uid in data.entries) {
            continue;
        }
        return uid;
    }

    return null;
}

// ============================================================================
// String Matching
// ============================================================================

/**
 * Transforms a string based on case sensitivity settings.
 * Pure function for testing.
 * @param {string} str The string to transform
 * @param {{caseSensitive?: boolean|null}} entry The entry that triggered the scan
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
 * @param {{caseSensitive?: boolean|null, matchWholeWords?: boolean|null}} entry The entry that triggered the scan
 * @param {GlobalMatchSettings} globalSettings The global matching settings
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
    const transformedNeedle = transformString(needle, entry, globalCaseSensitive);
    const matchWholeWords = entry.matchWholeWords ?? globalMatchWholeWords;

    if (matchWholeWords) {
        const keyWords = transformedNeedle.split(/\s+/);

        if (keyWords.length > 1) {
            return haystack.includes(transformedNeedle);
        }
        else {
            // Use custom boundaries to include punctuation and other non-alphanumeric characters
            const regex = new RegExp(`(?:^|\\W)(${escapeRegex(transformedNeedle)})(?:$|\\W)`);
            if (regex.test(haystack)) {
                return true;
            }
        }
    } else {
        return haystack.includes(transformedNeedle);
    }

    return false;
}

// ============================================================================
// Aho-Corasick Helpers
// ============================================================================

/**
 * Checks if a match is a whole-word match (pure function).
 * For multi-word keywords, uses substring match (consistent with original behavior).
 * For single words, checks word boundaries.
 * @param {string} text - The text being searched
 * @param {number} startIndex - The start index of the match
 * @param {number} endIndex - The end index of the match (inclusive)
 * @param {string} keyword - The keyword that matched
 * @returns {boolean} Whether this is a valid whole-word match
 */
export function isWholeWordMatch(text, startIndex, endIndex, keyword) {
    // Check if keyword has multiple words
    const keyWords = keyword.split(/\s+/);
    if (keyWords.length > 1) {
        // Multi-word keywords just need to be found (substring match)
        return true;
    }

    // Single word - check word boundaries
    // Use custom boundaries to include punctuation and other non-alphanumeric characters
    // This matches the original behavior in WorldInfoBuffer.matchKeys
    const charBefore = startIndex > 0 ? text[startIndex - 1] : '';
    const charAfter = endIndex < text.length - 1 ? text[endIndex + 1] : '';

    const isWordBoundaryBefore = startIndex === 0 || /\W/.test(charBefore);
    const isWordBoundaryAfter = endIndex === text.length - 1 || /\W/.test(charAfter);

    return isWordBoundaryBefore && isWordBoundaryAfter;
}

// ============================================================================
// Buffer Signature Utilities
// ============================================================================

/**
 * @typedef {Object} BufferSignatureData
 * @property {number} scanDepth - The scan depth for this group
 * @property {boolean} matchPersonaDescription - Whether to match persona description
 * @property {boolean} matchCharacterDescription - Whether to match character description
 * @property {boolean} matchCharacterPersonality - Whether to match character personality
 * @property {boolean} matchCharacterDepthPrompt - Whether to match character depth prompt
 * @property {boolean} matchScenario - Whether to match scenario
 * @property {boolean} matchCreatorNotes - Whether to match creator notes
 */

/**
 * Simple string hash function for cache keys.
 * @param {string} str - The string to hash
 * @returns {string} A hex hash string
 */
export function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
}

/**
 * Gets the buffer signature for an entry (pure function).
 * Entries with the same signature can share the same text buffer for scanning.
 * @param {object} entry - The entry to get signature for
 * @param {number} globalDepth - The global scan depth setting
 * @returns {string} A JSON string key representing the buffer configuration
 */
export function getBufferSignaturePure(entry, globalDepth) {
    /** @type {BufferSignatureData} */
    const signature = {
        scanDepth: entry.scanDepth ?? globalDepth,
        matchPersonaDescription: entry.matchPersonaDescription ?? false,
        matchCharacterDescription: entry.matchCharacterDescription ?? false,
        matchCharacterPersonality: entry.matchCharacterPersonality ?? false,
        matchCharacterDepthPrompt: entry.matchCharacterDepthPrompt ?? false,
        matchScenario: entry.matchScenario ?? false,
        matchCreatorNotes: entry.matchCreatorNotes ?? false,
    };
    return JSON.stringify(signature);
}

/**
 * Groups entries by their buffer signature.
 * @param {object[]} entries - The entries to group
 * @param {number} [globalDepth=4] - The global scan depth setting
 * @returns {Map<string, object[]>} Map of signature to entries
 */
export function groupEntriesBySignaturePure(entries, globalDepth = 4) {
    /** @type {Map<string, object[]>} */
    const groups = new Map();

    for (const entry of entries) {
        const signature = getBufferSignaturePure(entry, globalDepth);
        if (!groups.has(signature)) {
            groups.set(signature, []);
        }
        groups.get(signature).push(entry);
    }

    return groups;
}

/**
 * Computes a hash for a set of entries for cache invalidation (pure function).
 * The hash includes keywords (after parameter substitution), case sensitivity,
 * and whole word matching settings.
 * @param {object[]} entries - The entries to hash
 * @param {(s: string) => string} substitutor - Function to substitute parameters in keywords
 * @returns {string} A hash string representing the entries' keyword configuration
 */
export function computeEntriesHashPure(entries, substitutor = (s) => s) {
    const hashParts = [];

    for (const entry of entries) {
        const entryId = getEntryId(entry);

        // Include primary keys with parameter substitution
        const primaryKeys = (entry.key || []).map(k => substitutor(k) || '').sort();

        // Include secondary keys with parameter substitution
        const secondaryKeys = (entry.keysecondary || []).map(k => substitutor(k) || '').sort();

        // Include settings that affect matching behavior
        const caseSensitive = entry.caseSensitive ?? null; // null means use global
        const matchWholeWords = entry.matchWholeWords ?? null;

        hashParts.push(JSON.stringify({
            id: entryId,
            primary: primaryKeys,
            secondary: secondaryKeys,
            caseSensitive,
            matchWholeWords,
        }));
    }

    // Simple hash by joining and using a basic string hash
    const combined = hashParts.join('|');
    return simpleHash(combined);
}

// ============================================================================
// Scoring Utilities
// ============================================================================

/**
 * World info logic constants (matching constants.js)
 */
export const world_info_logic = {
    AND_ANY: 0,
    NOT_ALL: 1,
    NOT_ANY: 2,
    AND_ALL: 3,
};

/**
 * @typedef {Object} MatchResult
 * @property {string} entryId - The unique entry identifier
 * @property {'primary'|'secondary'} keyType - Whether this is a primary or secondary key
 * @property {number} keyIndex - The index of the key that matched
 * @property {string} matchedKeyword - The keyword that was matched
 */

// ============================================================================
// Static Entry Filtering
// ============================================================================

/**
 * @typedef {Object} StaticFilterContext
 * @property {string} trigger - The generation trigger type
 * @property {string} charaFilename - The current character filename
 * @property {string[]|null} charaTags - The current character's tags, or null if none
 */

/**
 * @typedef {Object} StaticFilterResult
 * @property {boolean} passed - Whether the entry passed static filters
 * @property {string|null} reason - The reason for filtering, or null if passed
 */

/**
 * Applies static filters to a world info entry.
 * These filters don't change during a scan (disabled, triggers, character filters).
 * Pure function for testing.
 * @param {object} entry The entry to filter
 * @param {StaticFilterContext} filterContext The filter context
 * @returns {StaticFilterResult} The filter result
 */
export function applyStaticFilters(entry, filterContext) {
    const { trigger, charaFilename, charaTags } = filterContext;

    // Use loose equality to match original behavior (disable: 1 should also disable)
    if (entry.disable == true) {
        return { passed: false, reason: 'disabled' };
    }

    if (Array.isArray(entry.triggers) && entry.triggers.length > 0) {
        if (!entry.triggers.includes(trigger)) {
            return { passed: false, reason: 'trigger filter' };
        }
    }

    if (entry.characterFilter?.names?.length > 0) {
        const nameIncluded = entry.characterFilter.names.includes(charaFilename);
        const filtered = entry.characterFilter.isExclude ? nameIncluded : !nameIncluded;
        if (filtered) {
            return { passed: false, reason: 'character name filter' };
        }
    }

    if (entry.characterFilter?.tags?.length > 0 && charaTags) {
        const includesTag = charaTags.some(tag => entry.characterFilter.tags.includes(tag));
        const filtered = entry.characterFilter.isExclude ? includesTag : !includesTag;
        if (filtered) {
            return { passed: false, reason: 'character tag filter' };
        }
    }

    return { passed: true, reason: null };
}

// ============================================================================
// Inclusion Group Utilities
// ============================================================================

/**
 * Pre-parses an inclusion group string into an array of group names.
 * This avoids repeated regex splitting during scanning.
 * @param {string|null|undefined} groupString The comma-separated group string
 * @returns {string[]} Array of trimmed, non-empty group names
 */
export function parseInclusionGroups(groupString) {
    if (!groupString) return [];
    return groupString.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Gets the match score for the given entry from pre-computed matches.
 * @param {object} entry Entry to check
 * @param {MatchResult[]} matches The pre-computed matches
 * @returns {number} The number of key activations for the given entry
 */
export function getScoreFromMatches(entry, matches) {
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

/**
 * Computes scores for all entries in a group using precomputed matches.
 * Pure function for testing.
 * @param {object[]} group Array of entries in the inclusion group
 * @param {Map<string, MatchResult[]>} precomputedMatches Map of entryId to match results
 * @returns {number[]} Array of scores for each entry in the group
 */
export function computeGroupScoresPure(group, precomputedMatches) {
    return group.map(entry => {
        const entryId = getEntryId(entry);
        const matches = precomputedMatches.get(entryId) || [];
        return getScoreFromMatches(entry, matches);
    });
}

// ============================================================================
// Entry ID Utilities
// ============================================================================

/**
 * Gets the unique identifier for an entry.
 * @param {object} entry The entry to get the ID for
 * @returns {string} The unique entry identifier in format "world.uid"
 */
export function getEntryId(entry) {
    return `${entry.world}.${entry.uid}`;
}

// ============================================================================
// Recursion Delay Utilities
// ============================================================================

/**
 * Gets sorted unique recursion delay levels from entries.
 * Entries with delayUntilRecursion=true are treated as level 1.
 * @param {object[]} entries The entries to check for delay levels
 * @returns {number[]} Sorted array of unique delay levels
 */
export function getRecursionDelayLevels(entries) {
    return [...new Set(
        entries
            .filter(e => e.delayUntilRecursion)
            .map(e => e.delayUntilRecursion === true ? 1 : Number(e.delayUntilRecursion)),
    )].sort((a, b) => a - b);
}
