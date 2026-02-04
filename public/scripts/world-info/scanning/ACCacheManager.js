/**
 * World Info AC Cache Manager
 * Singleton cache manager for Aho-Corasick matchers.
 * Handles caching by buffer signature and cache invalidation on chat/character changes.
 * Supports pre-building automatons on chat change for instant warm cache.
 */

import { eventSource, event_types, this_chid } from '../../../script.js';
import { GENERATION_TYPE_TRIGGERS } from '../../constants.js';
import { getContext } from '../../extensions.js';
import { getCharaFilename } from '../../utils.js';
import { getTagKeyForEntity } from '../../tags.js';
import { AhoCorasickMatcher } from './AhoCorasickMatcher.js';
import { groupEntriesBySignature } from './BufferSignature.js';
import { getSortedEntries } from './entry-collection.js';
import { world_info_use_aho_corasick } from '../state.js';

/**
 * @typedef {Object} CachedMatcher
 * @property {number} entryCount - Number of entries (for quick validation)
 * @property {AhoCorasickMatcher} matcher - The AC matcher instance
 */

/**
 * Singleton cache manager for Aho-Corasick matchers.
 * Maintains a cache keyed by buffer signature (scanDepth + global scan flags).
 */
class ACCacheManager {
    /** @type {Map<string, CachedMatcher>} */
    #cache = new Map();

    /** @type {boolean} */
    #initialized = false;

    /** @type {number|null} */
    #prebuildTimeout = null;

    /** @type {boolean} */
    #isPrebuildInProgress = false;

    constructor() {
        this.#initEventListeners();
    }

    /**
     * Initializes event listeners for cache invalidation and pre-building.
     */
    #initEventListeners() {
        if (this.#initialized) return;
        this.#initialized = true;

        // Pre-build cache when chat changes (character is now stable)
        eventSource.on(event_types.CHAT_CHANGED, () => {
            if (this.#cache.size > 0) {
                console.log('[WI] AC cache invalidated: chat changed');
            }
            this.clear();
            this.#schedulePrebuild('chat changed');
        });

        // Rebuild cache when world info settings are updated
        eventSource.on(event_types.WORLDINFO_SETTINGS_UPDATED, () => {
            if (this.#cache.size > 0) {
                console.log('[WI] AC cache invalidated: settings updated');
            }
            this.clear();
            this.#schedulePrebuild('settings updated');
        });

        // Rebuild cache when world info entries are updated
        eventSource.on(event_types.WORLDINFO_UPDATED, () => {
            if (this.#cache.size > 0) {
                console.log('[WI] AC cache invalidated: lorebook updated');
            }
            this.clear();
            this.#schedulePrebuild('lorebook updated');
        });
    }

    /**
     * Schedule a pre-build after a short delay (debounced).
     * @param {string} reason - Why the prebuild was triggered
     */
    #schedulePrebuild(reason) {
        // Cancel any pending prebuild
        if (this.#prebuildTimeout) {
            clearTimeout(this.#prebuildTimeout);
        }

        // Schedule new prebuild with a short delay to batch rapid changes
        this.#prebuildTimeout = setTimeout(() => {
            this.#prebuildTimeout = null;
            this.prebuildAutomatons(reason);
        }, 100);
    }

    /**
     * Pre-build automatons for all trigger types in the background.
     * This ensures scans are always fast (warm cache).
     * @param {string} [reason] - Optional reason for logging
     * @returns {Promise<void>}
     */
    async prebuildAutomatons(reason = '') {
        // Skip if AC is disabled
        if (!world_info_use_aho_corasick) {
            console.debug('[WI] AC prebuild skipped: AC disabled');
            return;
        }

        // Skip if already in progress
        if (this.#isPrebuildInProgress) {
            console.debug('[WI] AC prebuild skipped: already in progress');
            return;
        }

        this.#isPrebuildInProgress = true;
        const startTime = performance.now();

        try {
            console.log(`[WI] AC prebuild starting${reason ? ` (${reason})` : ''}...`);

            // Get all sorted entries once
            const sortedEntries = await getSortedEntries();
            if (!sortedEntries.length) {
                console.debug('[WI] AC prebuild skipped: no entries');
                return;
            }

            // Get current character context for filtering
            const context = getContext();
            const charaFilename = getCharaFilename();
            const tagKey = getTagKeyForEntity(this_chid);
            const tagMapEntry = tagKey ? context.tagMap[tagKey] : null;

            // Build for each trigger type
            let totalBuilt = 0;
            let totalCacheHits = 0;

            for (const trigger of GENERATION_TYPE_TRIGGERS) {
                // Filter entries for this trigger type (same logic as checkWorldInfo)
                const stableEntries = this.#filterStableEntries(sortedEntries, trigger, charaFilename, tagMapEntry);

                if (!stableEntries.length) continue;

                // Group by signature and build automatons
                const signatureGroups = groupEntriesBySignature(stableEntries);

                for (const [signature, groupEntries] of signatureGroups) {
                    // Check if already cached
                    const cached = this.#cache.get(signature);
                    if (cached && cached.entryCount === groupEntries.length) {
                        totalCacheHits++;
                        continue;
                    }

                    // Build and cache
                    const matcher = new AhoCorasickMatcher();
                    matcher.build(groupEntries);

                    this.#cache.set(signature, {
                        entryCount: groupEntries.length,
                        matcher,
                    });
                    totalBuilt++;
                }

                // Yield to UI between trigger types
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const elapsed = performance.now() - startTime;
            console.log(`[WI] AC prebuild complete: ${totalBuilt} built, ${totalCacheHits} cache hits, ${elapsed.toFixed(0)}ms`);

        } catch (error) {
            console.error('[WI] AC prebuild error:', error);
        } finally {
            this.#isPrebuildInProgress = false;
        }
    }

    /**
     * Filter entries to get stable keyword entries for a given trigger type.
     * Mirrors the filtering logic in checkWorldInfo.
     * @param {import('../constants.js').WIScanEntry[]} entries
     * @param {string} trigger
     * @param {string} charaFilename
     * @param {string[]|null} tagMapEntry
     * @returns {import('../constants.js').WIScanEntry[]}
     */
    #filterStableEntries(entries, trigger, charaFilename, tagMapEntry) {
        const stableEntries = [];

        for (const entry of entries) {
            // Skip disabled entries
            if (entry.disable === true) continue;

            // Check trigger filter
            if (Array.isArray(entry.triggers) && entry.triggers.length > 0) {
                if (!entry.triggers.includes(trigger)) continue;
            }

            // Check character name filter
            if (entry.characterFilter?.names?.length > 0) {
                const nameIncluded = entry.characterFilter.names.includes(charaFilename);
                const filtered = entry.characterFilter.isExclude ? nameIncluded : !nameIncluded;
                if (filtered) continue;
            }

            // Check character tag filter
            if (entry.characterFilter?.tags?.length > 0 && Array.isArray(tagMapEntry)) {
                const includesTag = tagMapEntry.some(tag => entry.characterFilter.tags.includes(tag));
                const filtered = entry.characterFilter.isExclude ? includesTag : !includesTag;
                if (filtered) continue;
            }

            // Skip entries without keys
            if (!Array.isArray(entry.key) || !entry.key.length) continue;

            stableEntries.push(entry);
        }

        return stableEntries;
    }

    /**
     * Gets a cached matcher or builds a new one for the given signature and entries.
     * Cache is invalidated by events (CHAT_CHANGED, WORLDINFO_UPDATED, etc.)
     * We use entry count as a quick sanity check in case entries change without events.
     * @param {string} signature - The buffer signature (from getBufferSignature)
     * @param {import('../constants.js').WIScanEntry[]} entries - The entries to match
     * @returns {AhoCorasickMatcher} The matcher (cached or newly built)
     */
    getOrBuild(signature, entries) {
        // Check if we have a cached matcher with matching entry count
        const cached = this.#cache.get(signature);
        if (cached && cached.entryCount === entries.length) {
            // Store cache hit info for debugging
            window.WI_AC_CACHE_HIT = true;
            console.debug('[WI] AC cache hit:', signature);
            return cached.matcher;
        }

        // Store cache miss info for debugging
        window.WI_AC_CACHE_HIT = false;
        window.WI_AC_CACHE_MISS_REASON = cached
            ? `count mismatch: ${cached.entryCount} vs ${entries.length}`
            : `no cache for signature (cache size: ${this.#cache.size})`;

        // Build a new matcher
        const matcher = new AhoCorasickMatcher();
        matcher.build(entries);

        // Cache it
        this.#cache.set(signature, {
            entryCount: entries.length,
            matcher,
        });

        console.log(`[WI] AC cache built: ${entries.length} entries, ${matcher.getKeywordCount()} keywords, ${matcher.getRegexCount()} regex patterns`);

        return matcher;
    }

    /**
     * Clears all cached matchers.
     */
    clear() {
        this.#cache.clear();
    }

    /**
     * Gets the number of cached matchers.
     * @returns {number} The cache size
     */
    get size() {
        return this.#cache.size;
    }
}

// Export singleton instance
export const acCacheManager = new ACCacheManager();
