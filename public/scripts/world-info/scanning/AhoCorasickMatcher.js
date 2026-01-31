/**
 * World Info Aho-Corasick Matcher
 * Core wrapper class for Aho-Corasick keyword matching with support for
 * case sensitivity, whole-word matching, and regex bypass.
 */

import { AhoCorasick } from '../../../lib.js';
import { substituteParams } from '../../../script.js';
import { parseRegexFromString } from '../utilities.js';
import { getEntryId } from '../pure-functions.js';
import {
    world_info_case_sensitive,
    world_info_match_whole_words,
} from '../state.js';

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

/**
 * @typedef {Object} KeywordMapping
 * @property {string} entryId - The unique entry identifier ("world.uid")
 * @property {'primary'|'secondary'} keyType - Whether this is a primary or secondary key
 * @property {number} keyIndex - The index of the key in the entry's key array
 * @property {boolean} matchWholeWords - Whether this keyword requires whole-word matching
 * @property {string} originalKeyword - The original keyword (before lowercasing)
 */

/**
 * @typedef {Object} MatchResult
 * @property {string} entryId - The unique entry identifier
 * @property {'primary'|'secondary'} keyType - Whether this is a primary or secondary key
 * @property {number} keyIndex - The index of the key that matched
 * @property {string} matchedKeyword - The keyword that was matched
 */

/**
 * @typedef {Object} RegexPattern
 * @property {RegExp} regex - The compiled regex
 * @property {KeywordMapping} mapping - The keyword mapping for this regex
 */

/**
 * Aho-Corasick based keyword matcher for World Info entries.
 * Builds two automata (case-sensitive and case-insensitive) and handles
 * regex patterns separately.
 */
export class AhoCorasickMatcher {
    /** @type {AhoCorasick|null} */
    #caseSensitiveAC = null;

    /** @type {AhoCorasick|null} */
    #caseInsensitiveAC = null;

    /** @type {Map<string, KeywordMapping[]>} keyword -> mappings for case-sensitive */
    #caseSensitiveIndex = new Map();

    /** @type {Map<string, KeywordMapping[]>} lowercase keyword -> mappings for case-insensitive */
    #caseInsensitiveIndex = new Map();

    /** @type {RegexPattern[]} */
    #regexPatterns = [];

    /**
     * Builds the Aho-Corasick automata from the given entries.
     * @param {import('../constants.js').WIScanEntry[]} entries - The entries to build from
     */
    build(entries) {
        this.#caseSensitiveIndex.clear();
        this.#caseInsensitiveIndex.clear();
        this.#regexPatterns = [];

        const caseSensitiveKeywords = [];
        const caseInsensitiveKeywords = [];

        for (const entry of entries) {
            const entryId = getEntryId(entry);
            const entryCaseSensitive = entry.caseSensitive ?? world_info_case_sensitive;
            const entryMatchWholeWords = entry.matchWholeWords ?? world_info_match_whole_words;

            // Process primary keys
            this.#processKeys(
                entry.key || [],
                entryId,
                'primary',
                entryCaseSensitive,
                entryMatchWholeWords,
                caseSensitiveKeywords,
                caseInsensitiveKeywords,
            );

            // Process secondary keys
            this.#processKeys(
                entry.keysecondary || [],
                entryId,
                'secondary',
                entryCaseSensitive,
                entryMatchWholeWords,
                caseSensitiveKeywords,
                caseInsensitiveKeywords,
            );
        }

        // Build automata only if we have keywords
        if (caseSensitiveKeywords.length > 0) {
            console.debug(`[WI] Building case-sensitive AC automaton: ${caseSensitiveKeywords.length} keywords`);
            this.#caseSensitiveAC = new AhoCorasick(caseSensitiveKeywords);
        }

        if (caseInsensitiveKeywords.length > 0) {
            console.debug(`[WI] Building case-insensitive AC automaton: ${caseInsensitiveKeywords.length} keywords`);
            this.#caseInsensitiveAC = new AhoCorasick(caseInsensitiveKeywords);
        }

        console.debug(`[WI] AC automaton built: ${this.getKeywordCount()} total keywords, ${this.#regexPatterns.length} regex patterns`);
    }

    /**
     * Processes an array of keys and adds them to the appropriate index.
     * @param {string[]} keys - The keys to process
     * @param {string} entryId - The entry identifier
     * @param {'primary'|'secondary'} keyType - The type of key
     * @param {boolean} caseSensitive - Whether the entry uses case-sensitive matching
     * @param {boolean} matchWholeWords - Whether the entry uses whole-word matching
     * @param {string[]} caseSensitiveKeywords - Array to add case-sensitive keywords to
     * @param {string[]} caseInsensitiveKeywords - Array to add case-insensitive keywords to
     */
    #processKeys(keys, entryId, keyType, caseSensitive, matchWholeWords, caseSensitiveKeywords, caseInsensitiveKeywords) {
        for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
            const rawKey = keys[keyIndex];
            const substituted = substituteParams(rawKey);
            if (!substituted) continue;

            const keyword = substituted.trim();
            if (!keyword) continue;

            // Check if this is a regex pattern
            const regex = parseRegexFromString(keyword);
            if (regex) {
                this.#regexPatterns.push({
                    regex,
                    mapping: {
                        entryId,
                        keyType,
                        keyIndex,
                        matchWholeWords: false, // Regex handles its own matching
                        originalKeyword: keyword,
                    },
                });
                continue;
            }

            // Create the mapping
            /** @type {KeywordMapping} */
            const mapping = {
                entryId,
                keyType,
                keyIndex,
                matchWholeWords,
                originalKeyword: keyword,
            };

            if (caseSensitive) {
                // Add to case-sensitive index
                if (!this.#caseSensitiveIndex.has(keyword)) {
                    this.#caseSensitiveIndex.set(keyword, []);
                    caseSensitiveKeywords.push(keyword);
                }
                this.#caseSensitiveIndex.get(keyword).push(mapping);
            } else {
                // Add to case-insensitive index (use lowercase)
                const lowerKeyword = keyword.toLowerCase();
                if (!this.#caseInsensitiveIndex.has(lowerKeyword)) {
                    this.#caseInsensitiveIndex.set(lowerKeyword, []);
                    caseInsensitiveKeywords.push(lowerKeyword);
                }
                this.#caseInsensitiveIndex.get(lowerKeyword).push(mapping);
            }
        }
    }

    /**
     * Searches the text for all matching keywords.
     * @param {string} text - The text to search in
     * @returns {Map<string, MatchResult[]>} Map of entryId -> array of matches
     */
    search(text) {
        /** @type {Map<string, MatchResult[]>} */
        const resultsByEntry = new Map();

        // Search case-sensitive keywords
        if (this.#caseSensitiveAC) {
            const matches = this.#caseSensitiveAC.search(text);
            this.#processMatches(matches, text, this.#caseSensitiveIndex, resultsByEntry, false);
        }

        // Search case-insensitive keywords
        if (this.#caseInsensitiveAC) {
            const lowerText = text.toLowerCase();
            const matches = this.#caseInsensitiveAC.search(lowerText);
            this.#processMatches(matches, lowerText, this.#caseInsensitiveIndex, resultsByEntry, true);
        }

        // Test regex patterns
        for (const { regex, mapping } of this.#regexPatterns) {
            if (regex.test(text)) {
                if (!resultsByEntry.has(mapping.entryId)) {
                    resultsByEntry.set(mapping.entryId, []);
                }
                resultsByEntry.get(mapping.entryId).push({
                    entryId: mapping.entryId,
                    keyType: mapping.keyType,
                    keyIndex: mapping.keyIndex,
                    matchedKeyword: mapping.originalKeyword,
                });
            }
        }

        return resultsByEntry;
    }

    /**
     * Processes matches from the Aho-Corasick search.
     * @param {Array<[number, string[]]>} matches - The matches from AC search [endIndex, keywords[]]
     * @param {string} text - The text that was searched (may be lowercased)
     * @param {Map<string, KeywordMapping[]>} index - The keyword index to use
     * @param {Map<string, MatchResult[]>} resultsByEntry - The results map to populate
     * @param {boolean} isLowercase - Whether the text was lowercased for searching
     */
    #processMatches(matches, text, index, resultsByEntry, isLowercase) {
        // Track which entry+keyType+keyIndex combinations we've already matched
        // to avoid duplicate results for the same keyword appearing multiple times
        const seen = new Set();

        for (const [endIndex, keywords] of matches) {
            for (const keyword of keywords) {
                const mappings = index.get(keyword);
                if (!mappings) continue;

                for (const mapping of mappings) {
                    const key = `${mapping.entryId}|${mapping.keyType}|${mapping.keyIndex}`;
                    if (seen.has(key)) continue;

                    // Validate whole-word matching if required
                    if (mapping.matchWholeWords) {
                        const startIndex = endIndex - keyword.length + 1;
                        if (!this.#isWholeWordMatch(text, startIndex, endIndex, keyword)) {
                            continue;
                        }
                    }

                    seen.add(key);

                    if (!resultsByEntry.has(mapping.entryId)) {
                        resultsByEntry.set(mapping.entryId, []);
                    }

                    resultsByEntry.get(mapping.entryId).push({
                        entryId: mapping.entryId,
                        keyType: mapping.keyType,
                        keyIndex: mapping.keyIndex,
                        matchedKeyword: mapping.originalKeyword,
                    });
                }
            }
        }
    }

    /**
     * Checks if a match is a whole-word match.
     * For multi-word keywords, uses substring match (consistent with original behavior).
     * For single words, checks word boundaries.
     * @param {string} text - The text being searched
     * @param {number} startIndex - The start index of the match
     * @param {number} endIndex - The end index of the match
     * @param {string} keyword - The keyword that matched
     * @returns {boolean} Whether this is a valid whole-word match
     */
    #isWholeWordMatch(text, startIndex, endIndex, keyword) {
        return isWholeWordMatch(text, startIndex, endIndex, keyword);
    }

    /**
     * Gets the total number of keywords indexed (excluding regex patterns).
     * @returns {number} The total keyword count
     */
    getKeywordCount() {
        return this.#caseSensitiveIndex.size + this.#caseInsensitiveIndex.size;
    }

    /**
     * Gets the number of regex patterns.
     * @returns {number} The regex pattern count
     */
    getRegexCount() {
        return this.#regexPatterns.length;
    }
}
