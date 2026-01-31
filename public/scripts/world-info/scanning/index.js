/**
 * World Info Scanning Module
 * Contains the main scanning logic for world info.
 */

import { substituteParams, getExtensionPromptByName, eventSource, event_types, this_chid, extension_prompt_roles } from '../../../script.js';
import { getContext } from '../../extensions.js';
import { NOTE_MODULE_NAME, metadata_keys, shouldWIAddPrompt } from '../../authors-note.js';
import { extension_settings } from '../../extensions.js';
import { getCharaFilename } from '../../utils.js';
import { getTagKeyForEntity } from '../../tags.js';
import { getTokenCountAsync } from '../../tokenizers.js';
import { getRegexedString, regex_placement } from '../../extensions/regex/engine.js';
import { chat_metadata } from '../../../script.js';
import {
    world_info_budget,
    world_info_budget_cap,
    world_info_recursive,
    world_info_overflow_alert,
    world_info_min_activations,
    world_info_min_activations_depth_max,
    world_info_max_recursion_steps,
    world_info_use_aho_corasick,
    sortFn,
} from '../state.js';
import {
    scan_state,
    world_info_logic,
    world_info_position,
    wi_anchor_position,
    DEFAULT_DEPTH,
    defaultGlobalScanData,
} from '../constants.js';
import { WorldInfoBuffer } from '../WorldInfoBuffer.js';
import { WorldInfoTimedEffects } from '../WorldInfoTimedEffects.js';
import { getSortedEntries } from './entry-collection.js';
import { filterByInclusionGroups } from './filtering.js';
import { groupEntriesBySignature } from './BufferSignature.js';
import { acCacheManager } from './ACCacheManager.js';
import { applyStaticFilters, getEntryId, getRecursionDelayLevels } from '../pure-functions.js';

// Re-export entry collection functions
export { getSortedEntries, getCharacterLore, getGlobalLore, getChatLore, getPersonaLore } from './entry-collection.js';
// Re-export filtering functions
export { filterByInclusionGroups, filterGroupsByScoring, filterGroupsByTimedEffects } from './filtering.js';
// Re-export cache manager for testing/debugging
export { acCacheManager } from './ACCacheManager.js';

/**
 * Lightweight profiling helper with zero overhead when disabled.
 */
class ProfilingCollector {
    /**
     * @param {boolean} enabled Whether profiling is enabled
     */
    constructor(enabled) {
        this.enabled = enabled;
        this.buildMs = 0;
        this.searchMs = 0;
        this.filterMs = 0;
        this.promptMs = 0;
        this.recursionRounds = 0;
        this.cacheHit = null;
        this.entryCounts = { total: 0, eligible: 0, activated: 0 };
        this.totalStart = enabled ? performance.now() : 0;
    }

    /** @returns {number} Current timestamp if enabled, 0 otherwise */
    startTimer() {
        return this.enabled ? performance.now() : 0;
    }

    /** @param {number} start Timer start value from startTimer() */
    addBuildTime(start) {
        if (this.enabled) this.buildMs += performance.now() - start;
    }

    /** @param {number} start Timer start value from startTimer() */
    addSearchTime(start) {
        if (this.enabled) this.searchMs += performance.now() - start;
    }

    /** @param {number} start Timer start value from startTimer() */
    addFilterTime(start) {
        if (this.enabled) this.filterMs += performance.now() - start;
    }

    /** @param {number} start Timer start value from startTimer() */
    addPromptTime(start) {
        if (this.enabled) this.promptMs += performance.now() - start;
    }

    incrementRound() {
        if (this.enabled) this.recursionRounds++;
    }

    /** @param {boolean|null} hit Whether cache was hit (null if AC disabled) */
    setCacheHit(hit) {
        if (this.enabled) this.cacheHit = hit;
    }

    /**
     * @param {number} total Total entries scanned
     * @param {number} eligible Entries passing static filters
     * @param {number} activated Entries that were activated
     */
    setEntryCounts(total, eligible, activated) {
        if (this.enabled) {
            this.entryCounts = { total, eligible, activated };
        }
    }

    /**
     * Finalize profiling and return results.
     * @returns {import('../constants.js').WIProfilingResult|null} Profiling data or null if disabled
     */
    finalize() {
        if (!this.enabled) return null;
        return {
            buildMs: Math.round(this.buildMs * 100) / 100,
            searchMs: Math.round(this.searchMs * 100) / 100,
            filterMs: Math.round(this.filterMs * 100) / 100,
            promptMs: Math.round(this.promptMs * 100) / 100,
            totalMs: Math.round((performance.now() - this.totalStart) * 100) / 100,
            recursionRounds: this.recursionRounds,
            cacheHit: this.cacheHit,
            entryCounts: this.entryCounts,
        };
    }
}

/**
 * Gets the world info based on chat messages.
 * @param {string[]} chat - The chat messages to scan, in reverse order.
 * @param {number} maxContext - The maximum context size of the generation.
 * @param {boolean} isDryRun - If true, the function will not emit any events.
 * @param {import('../constants.js').WIGlobalScanData} globalScanData Chat independent context to be scanned
 * @returns {Promise<import('../constants.js').WIPromptResult>} The world info string and depth.
 */
export async function getWorldInfoPrompt(chat, maxContext, isDryRun, globalScanData) {
    let worldInfoString = '', worldInfoBefore = '', worldInfoAfter = '';

    const activatedWorldInfo = await checkWorldInfo(chat, maxContext, isDryRun, globalScanData);
    worldInfoBefore = activatedWorldInfo.worldInfoBefore;
    worldInfoAfter = activatedWorldInfo.worldInfoAfter;
    worldInfoString = worldInfoBefore + worldInfoAfter;

    if (!isDryRun && activatedWorldInfo.allActivatedEntries && activatedWorldInfo.allActivatedEntries.size > 0) {
        const arg = Array.from(activatedWorldInfo.allActivatedEntries.values());
        await eventSource.emit(event_types.WORLD_INFO_ACTIVATED, arg);
    }

    return {
        worldInfoString,
        worldInfoBefore,
        worldInfoAfter,
        worldInfoExamples: activatedWorldInfo.EMEntries ?? [],
        worldInfoDepth: activatedWorldInfo.WIDepthEntries ?? [],
        anBefore: activatedWorldInfo.ANBeforeEntries ?? [],
        anAfter: activatedWorldInfo.ANAfterEntries ?? [],
        outletEntries: activatedWorldInfo.outletEntries ?? {},
    };
}

/**
 * Performs a scan on the chat and returns the world info activated.
 * @param {string[]} chat The chat messages to scan, in reverse order.
 * @param {number} maxContext The maximum context size of the generation.
 * @param {boolean} isDryRun Whether to perform a dry run.
 * @param {import('../constants.js').WIGlobalScanData} globalScanData Chat independent context to be scanned
 * @param {{returnProfiling?: boolean}} [options] Optional configuration
 * @returns {Promise<import('../constants.js').WIActivated>} The world info activated.
 */
export async function checkWorldInfo(chat, maxContext, isDryRun, globalScanData = defaultGlobalScanData, options = {}) {
    const profiler = new ProfilingCollector(options.returnProfiling === true);
    const context = getContext();
    const buffer = new WorldInfoBuffer(chat, globalScanData);

    console.debug(`[WI] --- START WI SCAN (on ${chat.length} messages, trigger = ${globalScanData.trigger})${isDryRun ? ' (DRY RUN)' : ''} ---`);

    // Combine the chat

    // Add the depth or AN if enabled
    // Put this code here since otherwise, the chat reference is modified
    for (const key of Object.keys(context.extensionPrompts)) {
        if (context.extensionPrompts[key]?.scan) {
            const prompt = await getExtensionPromptByName(key);
            if (prompt) {
                buffer.addInject(prompt);
            }
        }
    }

    /** @type {scan_state} */
    let scanState = scan_state.INITIAL;
    let token_budget_overflowed = false;
    let count = 0;
    let allActivatedEntries = new Map();
    let failedProbabilityChecks = new Set();
    let allActivatedText = '';

    let budget = Math.round(world_info_budget * maxContext / 100) || 1;

    if (world_info_budget_cap > 0 && budget > world_info_budget_cap) {
        console.debug(`[WI] Budget ${budget} exceeds cap ${world_info_budget_cap}, using cap`);
        budget = world_info_budget_cap;
    }

    console.debug(`[WI] Context size: ${maxContext}; WI budget: ${budget} (max% = ${world_info_budget}%, cap = ${world_info_budget_cap})`);
    const sortedEntries = await getSortedEntries();
    const timedEffects = new WorldInfoTimedEffects(chat, sortedEntries, isDryRun);

    timedEffects.checkTimedEffects();

    if (sortedEntries.length === 0) {
        return { worldInfoBefore: '', worldInfoAfter: '', WIDepthEntries: [], EMEntries: [], ANBeforeEntries: [], ANAfterEntries: [], outletEntries: {}, allActivatedEntries: new Set() };
    }

    /** @type {number[]} Represents the delay levels for entries that are delayed until recursion */
    const availableRecursionDelayLevels = getRecursionDelayLevels(sortedEntries);
    // Already preset with the first level
    let currentRecursionDelayLevel = availableRecursionDelayLevels.shift() ?? 0;
    if (currentRecursionDelayLevel > 0 && availableRecursionDelayLevels.length) {
        console.debug('[WI] Preparing first delayed recursion level', currentRecursionDelayLevel, '. Still delayed:', availableRecursionDelayLevels);
    }

    console.debug(`[WI] --- SEARCHING ENTRIES (on ${sortedEntries.length} entries) ---`);

    // Build static filter context once - these values don't change during scanning
    const staticFilterContext = {
        trigger: globalScanData.trigger,
        charaFilename: getCharaFilename(),
        charaTags: (() => {
            const tagKey = getTagKeyForEntity(this_chid);
            return tagKey && context.tagMap[tagKey] ? context.tagMap[tagKey] : null;
        })(),
    };

    // Pre-compute static filter results for all entries (cache for reuse in main loop)
    /** @type {Map<string, import('../pure-functions.js').StaticFilterResult>} */
    const staticFilterCache = new Map();
    for (const entry of sortedEntries) {
        const entryId = getEntryId(entry);
        staticFilterCache.set(entryId, applyStaticFilters(entry, staticFilterContext));
    }

    // Pre-compute stable entries for AC matching (entries that pass static filters)
    // These don't change during recursion, allowing us to reuse the AC automaton
    /** @type {import('../constants.js').WIScanEntry[]} */
    const stableKeywordEntries = [];
    for (const entry of sortedEntries) {
        const entryId = getEntryId(entry);
        const filterResult = staticFilterCache.get(entryId);

        // Skip entries that fail static filters
        if (!filterResult.passed) continue;

        // Skip entries without keys (they can't be keyword matched)
        if (!Array.isArray(entry.key) || !entry.key.length) continue;

        // This entry could potentially be keyword-matched, add to stable set
        stableKeywordEntries.push(entry);
    }

    // Pre-group stable entries by signature and pre-build AC matchers
    // This allows us to reuse the same automaton across recursion rounds
    /** @type {Map<string, import('../constants.js').WIScanEntry[]>} */
    let stableEntryGroups = null;
    if (world_info_use_aho_corasick && stableKeywordEntries.length > 0) {
        stableEntryGroups = groupEntriesBySignature(stableKeywordEntries);
        console.debug(`[WI] Pre-computed ${stableKeywordEntries.length} stable entries for AC in ${stableEntryGroups.size} signature groups`);
    }

    while (scanState) {
        //if world_info_max_recursion_steps is non-zero min activations are disabled, and vice versa
        if (world_info_max_recursion_steps && world_info_max_recursion_steps <= count) {
            console.debug('[WI] Search stopped by reaching max recursion steps', world_info_max_recursion_steps);
            break;
        }

        // Track how many times the loop has run. May be useful for debugging.
        count++;
        profiler.incrementRound();

        console.debug(`[WI] --- LOOP #${count} START ---`);
        console.debug('[WI] Scan state', Object.entries(scan_state).find(x => x[1] === scanState));

        // Until decided otherwise, we set the loop to stop scanning after this
        let nextScanState = scan_state.NONE;

        // Loop and find all entries that can activate here
        let activatedNow = new Set();

        // Entries that pass preliminary filters and need keyword matching
        /** @type {{entry: import('../constants.js').WIScanEntry, log: function}[]} */
        const entriesToMatch = [];

        const filterStart = profiler.startTimer();
        for (const entry of sortedEntries) {
            // Logging preparation
            let headerLogged = false;
            function log(...args) {
                if (!headerLogged) {
                    console.debug(`[WI] Entry ${entry.uid}`, `from '${entry.world}' processing`, entry);
                    headerLogged = true;
                }
                console.debug(`[WI] Entry ${entry.uid}`, ...args);
            }

            const entryId = getEntryId(entry);

            // Already processed, considered and then skipped entries should still be skipped
            if (failedProbabilityChecks.has(entry) || allActivatedEntries.has(entryId)) {
                continue;
            }

            // Use cached static filter results (disabled, triggers, character filters)
            const staticFilterResult = staticFilterCache.get(entryId);
            if (!staticFilterResult.passed) {
                log(staticFilterResult.reason);
                continue;
            }

            const isSticky = timedEffects.isEffectActive('sticky', entry);
            const isCooldown = timedEffects.isEffectActive('cooldown', entry);
            const isDelay = timedEffects.isEffectActive('delay', entry);

            if (isDelay) {
                log('suppressed by delay');
                continue;
            }

            if (isCooldown && !isSticky) {
                log('suppressed by cooldown');
                continue;
            }

            // Only use checks for recursion flags if the scan step was activated by recursion
            if (scanState !== scan_state.RECURSION && entry.delayUntilRecursion && !isSticky) {
                log('suppressed by delay until recursion');
                continue;
            }

            if (scanState === scan_state.RECURSION && entry.delayUntilRecursion && entry.delayUntilRecursion > currentRecursionDelayLevel && !isSticky) {
                log('suppressed by delay until recursion level', entry.delayUntilRecursion, '. Currently', currentRecursionDelayLevel);
                continue;
            }

            if (scanState === scan_state.RECURSION && world_info_recursive && entry.excludeRecursion && !isSticky) {
                log('suppressed by exclude recursion');
                continue;
            }

            if (entry.decorators.includes('@@activate')) {
                log('activated by @@activate decorator');
                activatedNow.add(entry);
                continue;
            }

            if (entry.decorators.includes('@@dont_activate')) {
                log('suppressed by @@dont_activate decorator');
                continue;
            }

            if (buffer.getExternallyActivated(entry)) {
                log('externally activated');
                activatedNow.add(buffer.getExternallyActivated(entry));
                continue;
            }

            // Now do checks for immediate activations
            if (entry.constant) {
                log('activated because of constant');
                activatedNow.add(entry);
                continue;
            }

            if (isSticky) {
                log('activated because active sticky');
                activatedNow.add(entry);
                continue;
            }

            if (!Array.isArray(entry.key) || !entry.key.length) {
                log('has no keys defined, skipped');
                continue;
            }

            // Entry needs keyword matching - add to the list for bulk AC processing
            entriesToMatch.push({ entry, log });
        }
        profiler.addFilterTime(filterStart);

        // Bulk keyword matching
        /** @type {Map<string, import('./AhoCorasickMatcher.js').MatchResult[]>} entryId -> matches */
        const allMatches = new Map();

        // Build a set of entry IDs that are eligible this round (for filtering AC results)
        const eligibleEntryIds = new Set(entriesToMatch.map(e => `${e.entry.world}.${e.entry.uid}`));

        if (world_info_use_aho_corasick && stableEntryGroups) {
            // Aho-Corasick bulk matching using stable entry groups
            // The automaton is built once with all eligible entries and reused across recursion rounds
            console.debug(`[WI] Using Aho-Corasick matching (${entriesToMatch.length} eligible this round, ${stableKeywordEntries.length} in automaton)`);
            let _t0 = 0, _t1 = 0, _buildTime = 0, _searchTime = 0;

            _t0 = performance.now();

            for (const [signature, groupEntries] of stableEntryGroups) {
                // Get the text to scan for this group (all entries in a group have same buffer config)
                const textToScan = buffer.get(groupEntries[0], scanState);

                // Get or build AC matcher for this signature (uses stable entries, so cache hit on recursion)
                const _tb0 = performance.now();
                const buildStart = profiler.startTimer();
                const matcher = acCacheManager.getOrBuild(signature, groupEntries);
                profiler.addBuildTime(buildStart);
                _buildTime += performance.now() - _tb0;

                // Run the search
                const _ts0 = performance.now();
                const searchStart = profiler.startTimer();
                const matches = matcher.search(textToScan);
                profiler.addSearchTime(searchStart);
                _searchTime += performance.now() - _ts0;

                // Merge results into allMatches, but only for entries eligible this round
                for (const [entryId, entryMatches] of matches) {
                    if (eligibleEntryIds.has(entryId)) {
                        allMatches.set(entryId, entryMatches);
                    }
                }
            }
            _t1 = performance.now();

            // Set cache hit status for profiling (build < 10ms generally indicates cache hit)
            profiler.setCacheHit(_buildTime < 10);

            if (stableKeywordEntries.length > 1000) {
                // Store timing for debugging - accessible via window.WI_AC_TIMING
                window.WI_AC_TIMING = {
                    stableEntries: stableKeywordEntries.length,
                    eligibleThisRound: entriesToMatch.length,
                    cacheHit: _buildTime < 10, // Build < 10ms means cache hit
                    buildMs: _buildTime,
                    searchMs: _searchTime,
                    totalMs: _t1 - _t0,
                };
            }
        } else if (world_info_use_aho_corasick) {
            // AC enabled but no stable entries (shouldn't happen normally)
            console.debug('[WI] AC enabled but no stable keyword entries');
        } else {
            // Legacy per-entry matching
            console.debug(`[WI] Using legacy matching for ${entriesToMatch.length} entries`);
            profiler.setCacheHit(null); // AC not used
            const legacySearchStart = profiler.startTimer();
            for (const { entry } of entriesToMatch) {
                const entryId = getEntryId(entry);
                // For delayUntilRecursion entries during RECURSION, only search recursion buffer
                const useRecurseOnly = entry.delayUntilRecursion && scanState === scan_state.RECURSION;
                const textToScan = useRecurseOnly ? buffer.getRecurseOnly() : buffer.get(entry, scanState);
                /** @type {import('./AhoCorasickMatcher.js').MatchResult[]} */
                const matches = [];

                // Check primary keys
                if (Array.isArray(entry.key)) {
                    for (let i = 0; i < entry.key.length; i++) {
                        const key = entry.key[i];
                        if (buffer.matchKeys(textToScan, key, entry)) {
                            matches.push({
                                entryId,
                                keyType: 'primary',
                                keyIndex: i,
                                matchedKeyword: key,
                            });
                        }
                    }
                }

                // Check secondary keys
                if (Array.isArray(entry.keysecondary)) {
                    for (let i = 0; i < entry.keysecondary.length; i++) {
                        const key = entry.keysecondary[i];
                        if (buffer.matchKeys(textToScan, key, entry)) {
                            matches.push({
                                entryId,
                                keyType: 'secondary',
                                keyIndex: i,
                                matchedKeyword: key,
                            });
                        }
                    }
                }

                if (matches.length > 0) {
                    allMatches.set(entryId, matches);
                }
            }
            profiler.addSearchTime(legacySearchStart);
        }

        // For delayUntilRecursion entries during RECURSION, re-compute matches using ONLY recursion buffer
        // This is necessary because AC/legacy matching above may have matched against original chat text
        if (scanState === scan_state.RECURSION) {
            const recurseOnlyText = buffer.getRecurseOnly();
            for (const { entry } of entriesToMatch) {
                if (!entry.delayUntilRecursion) continue;

                const entryId = getEntryId(entry);
                /** @type {import('./AhoCorasickMatcher.js').MatchResult[]} */
                const matches = [];

                // Re-check primary keys against recursion buffer only
                if (Array.isArray(entry.key)) {
                    for (let i = 0; i < entry.key.length; i++) {
                        const key = entry.key[i];
                        if (buffer.matchKeys(recurseOnlyText, key, entry)) {
                            matches.push({
                                entryId,
                                keyType: 'primary',
                                keyIndex: i,
                                matchedKeyword: key,
                            });
                        }
                    }
                }

                // Re-check secondary keys against recursion buffer only
                if (Array.isArray(entry.keysecondary)) {
                    for (let i = 0; i < entry.keysecondary.length; i++) {
                        const key = entry.keysecondary[i];
                        if (buffer.matchKeys(recurseOnlyText, key, entry)) {
                            matches.push({
                                entryId,
                                keyType: 'secondary',
                                keyIndex: i,
                                matchedKeyword: key,
                            });
                        }
                    }
                }

                // Replace matches - only matches from recursion buffer count
                if (matches.length > 0) {
                    allMatches.set(entryId, matches);
                } else {
                    allMatches.delete(entryId);
                }
            }
        }

        // Store matches for scoring (used by filtering.js)
        buffer.setPrecomputedMatches(allMatches);

        // Process entries using pre-computed matches
        const secondaryFilterStart = profiler.startTimer();
        for (const { entry, log } of entriesToMatch) {
            const entryId = getEntryId(entry);
            const matches = allMatches.get(entryId) || [];

            // Check for primary key match
            const primaryMatches = matches.filter(m => m.keyType === 'primary');
            if (primaryMatches.length === 0) {
                // No primary key match - skip without logging (common case)
                continue;
            }

            const primaryKeyMatch = primaryMatches[0].matchedKeyword;

            const hasSecondaryKeywords = (
                entry.selective && //all entries are selective now
                Array.isArray(entry.keysecondary) && //always true
                entry.keysecondary.length //ignore empties
            );

            if (!hasSecondaryKeywords) {
                // Handle cases where secondary is empty
                log('activated by primary key match', primaryKeyMatch);
                activatedNow.add(entry);
                continue;
            }

            // SECONDARY KEYWORDS
            const selectiveLogic = entry.selectiveLogic ?? 0;
            log('Entry with primary key match', primaryKeyMatch, 'has secondary keywords. Checking with logic', Object.entries(world_info_logic).find(x => x[1] === entry.selectiveLogic));

            // Get secondary key matches from pre-computed results
            const secondaryMatches = matches.filter(m => m.keyType === 'secondary');
            const matchedSecondaryIndices = new Set(secondaryMatches.map(m => m.keyIndex));

            /** @type {() => boolean} */
            function matchSecondaryKeys() {
                const totalSecondaryKeys = entry.keysecondary.length;
                const hasAnyMatch = matchedSecondaryIndices.size > 0;
                const hasAllMatch = matchedSecondaryIndices.size === totalSecondaryKeys;

                // For AND_ANY: Need at least one secondary match
                if (selectiveLogic === world_info_logic.AND_ANY && hasAnyMatch) {
                    const matchedKey = secondaryMatches[0]?.matchedKeyword || entry.keysecondary[0];
                    log('activated. (AND ANY) Found match secondary keyword', matchedKey);
                    return true;
                }

                // For NOT_ALL: Need at least one secondary NOT matching
                if (selectiveLogic === world_info_logic.NOT_ALL && !hasAllMatch) {
                    // Find first non-matching key for logging
                    const nonMatchingKey = entry.keysecondary.find((_, idx) => !matchedSecondaryIndices.has(idx));
                    log('activated. (NOT ALL) Found not matching secondary keyword', nonMatchingKey);
                    return true;
                }

                // Handle NOT ANY logic: None of the secondary keys should match
                if (selectiveLogic === world_info_logic.NOT_ANY && !hasAnyMatch) {
                    log('activated. (NOT ANY) No secondary keywords found', entry.keysecondary);
                    return true;
                }

                // Handle AND ALL logic: All secondary keys must match
                if (selectiveLogic === world_info_logic.AND_ALL && hasAllMatch) {
                    log('activated. (AND ALL) All secondary keywords found', entry.keysecondary);
                    return true;
                }

                return false;
            }

            const matched = matchSecondaryKeys();
            if (!matched) {
                log('skipped. Secondary keywords not satisfied', entry.keysecondary);
                continue;
            }

            // Success logging was already done inside the function, so just add the entry
            activatedNow.add(entry);
        }
        profiler.addFilterTime(secondaryFilterStart);

        console.debug(`[WI] Search done. Found ${activatedNow.size} possible entries.`);

        // Sort the entries for the probability and the budget limit checks
        const newEntries = [...activatedNow]
            .sort((a, b) => {
                const isASticky = timedEffects.isEffectActive('sticky', a) ? 1 : 0;
                const isBSticky = timedEffects.isEffectActive('sticky', b) ? 1 : 0;
                return isBSticky - isASticky || sortedEntries.indexOf(a) - sortedEntries.indexOf(b);
            });


        const textToScanTokens = await getTokenCountAsync(allActivatedText);

        filterByInclusionGroups(newEntries, allActivatedEntries, buffer, timedEffects);

        console.debug('[WI] --- PROBABILITY CHECKS ---');
        !newEntries.length && console.debug('[WI] No probability checks to do');

        // Pre-compute token counts for all potential entries to avoid sequential awaits in the budget loop
        // This batches the async operations upfront for better performance
        /** @type {Map<string, {content: string, tokens: number}>} */
        const entryTokenCounts = new Map();
        for (const entry of newEntries) {
            const entryId = getEntryId(entry);
            const content = substituteParams(entry.content);
            const tokens = await getTokenCountAsync(content);
            entryTokenCounts.set(entryId, { content, tokens });
        }

        let ignoresBudget = newEntries.filter(e => e.ignoreBudget).length;
        // Track running token total instead of re-counting accumulated string
        let runningTokenCount = 0;

        for (const entry of newEntries) {
            ignoresBudget -= (entry.ignoreBudget ? 1 : 0);
            if (token_budget_overflowed && !entry.ignoreBudget) {
                if (ignoresBudget > 0) {
                    continue;
                }
                break;
            }

            function verifyProbability() {
                // If we don't need to roll, it's always true
                if (!entry.useProbability || entry.probability === 100) {
                    console.debug(`WI entry ${entry.uid} does not use probability`);
                    return true;
                }

                const isSticky = timedEffects.isEffectActive('sticky', entry);
                if (isSticky) {
                    console.debug(`WI entry ${entry.uid} is sticky, does not need to re-roll probability`);
                    return true;
                }

                const rollValue = Math.random() * 100;
                if (rollValue <= entry.probability) {
                    console.debug(`WI entry ${entry.uid} passed probability check of ${entry.probability}%`);
                    return true;
                }

                failedProbabilityChecks.add(entry);
                return false;
            }

            const success = verifyProbability();
            if (!success) {
                console.debug(`WI entry ${entry.uid} failed probability check, removing from activated entries`, entry);
                continue;
            }

            // Get pre-computed content and token count
            const entryId = getEntryId(entry);
            const precomputed = entryTokenCounts.get(entryId);
            const entryTokens = precomputed?.tokens || 0;

            // Use substituted content from pre-computation
            entry.content = precomputed?.content || substituteParams(entry.content);

            // Check budget using running total instead of re-counting entire accumulated string
            if (!entry.ignoreBudget && (textToScanTokens + runningTokenCount + entryTokens) >= budget) {
                if (!token_budget_overflowed) {
                    console.debug('[WI] --- BUDGET OVERFLOW CHECK ---');
                    if (world_info_overflow_alert) {
                        console.warn(`[WI] budget of ${budget} reached, stopping after ${allActivatedEntries.size} entries`);
                        toastr.warning(`World info budget reached after ${allActivatedEntries.size} entries.`, 'World Info');
                    } else {
                        console.debug(`[WI] budget of ${budget} reached, stopping after ${allActivatedEntries.size} entries`);
                    }
                    token_budget_overflowed = true;
                }
                continue;
            }

            // Add this entry's tokens to the running total
            runningTokenCount += entryTokens;

            allActivatedEntries.set(entryId, entry);
            console.debug(`[WI] Entry ${entry.uid} activation successful, adding to prompt`, entry);
        }

        const successfulNewEntries = newEntries.filter(x => !failedProbabilityChecks.has(x));
        const successfulNewEntriesForRecursion = successfulNewEntries.filter(x => !x.preventRecursion);

        console.debug(`[WI] --- LOOP #${count} RESULT ---`);
        if (!newEntries.length) {
            console.debug('[WI] No new entries activated.');
        } else if (!successfulNewEntries.length) {
            console.debug('[WI] Probability checks failed for all activated entries. No new entries activated.');
        } else {
            console.debug(`[WI] Successfully activated ${successfulNewEntries.length} new entries to prompt. ${allActivatedEntries.size} total entries activated.`, successfulNewEntries);
        }

        function logNextState(...args) {
            args.length && console.debug(args.shift(), ...args);
            console.debug('[WI] Setting scan state', Object.entries(scan_state).find(x => x[1] === scanState));
        }

        // After processing and rolling entries is done, see if we should continue with normal recursion
        if (world_info_recursive && !token_budget_overflowed && successfulNewEntriesForRecursion.length) {
            nextScanState = scan_state.RECURSION;
            logNextState('[WI] Found', successfulNewEntriesForRecursion.length, 'new entries for recursion');
        }

        // If we are inside min activations scan, and we have recursive buffer, we should do a recursive scan before increasing the buffer again
        // There might be recurse-trigger-able entries that match the buffer, so we need to check that
        if (world_info_recursive && !token_budget_overflowed && scanState === scan_state.MIN_ACTIVATIONS && buffer.hasRecurse()) {
            nextScanState = scan_state.RECURSION;
            logNextState('[WI] Min Activations run done, whill will always be followed by a recursive scan');
        }

        // If scanning is planned to stop, but min activations is set and not satisfied, check if we should continue
        const minActivationsNotSatisfied = world_info_min_activations > 0 && (allActivatedEntries.size < world_info_min_activations);
        if (!nextScanState && !token_budget_overflowed && minActivationsNotSatisfied) {
            console.debug('[WI] --- MIN ACTIVATIONS CHECK ---');

            let over_max = (
                world_info_min_activations_depth_max > 0 &&
                buffer.getDepth() > world_info_min_activations_depth_max
            ) || (buffer.getDepth() > chat.length);

            if (!over_max) {
                nextScanState = scan_state.MIN_ACTIVATIONS; // loop
                logNextState(`[WI] Min activations not reached (${allActivatedEntries.size}/${world_info_min_activations}), advancing depth to ${buffer.getDepth() + 1}, starting another scan`);
                buffer.advanceScan();
            } else {
                console.debug(`[WI] Min activations not reached (${allActivatedEntries.size}/${world_info_min_activations}), but reached on of depth. Stopping`);
            }
        }

        // If the scan is done, but we still have open "delay until recursion" levels, we should continue with the next one
        // Only transition if there's actual recursion content to trigger delayed entries
        if (nextScanState === scan_state.NONE && availableRecursionDelayLevels.length && buffer.hasRecurse()) {
            nextScanState = scan_state.RECURSION;
            currentRecursionDelayLevel = availableRecursionDelayLevels.shift();
            logNextState('[WI] Open delayed recursion levels left. Preparing next delayed recursion level', currentRecursionDelayLevel, '. Still delayed:', availableRecursionDelayLevels);
        }

        // Final check if we should really continue scan, and extend the current WI recurse buffer
        const curScanState = scanState;
        scanState = nextScanState;
        if (scanState) {
            const text = successfulNewEntriesForRecursion
                .map(x => x.content).join('\n');
            if (text) {
                buffer.addRecurse(text);
                allActivatedText = (text + '\n' + allActivatedText);
            }
        } else {
            logNextState('[WI] Scan done. No new entries to prompt. Stopping.');
        }

        // Fire an event after each scan loop, so extensions can hook into the current scanning state
        const args = {
            state: {
                current: curScanState,
                next: scanState,
                loopCount: count,
            },
            new: {
                all: newEntries,
                successful: successfulNewEntries,
            },
            activated: {
                entries: allActivatedEntries,
                text: allActivatedText,
            },
            sortedEntries,
            recursionDelay: {
                availableLevels: availableRecursionDelayLevels,
                currentLevel: currentRecursionDelayLevel,
            },
            budget: {
                current: budget,
                overflowed: token_budget_overflowed,
            },
            timedEffects,
        };
        await eventSource.emit(event_types.WORLDINFO_SCAN_DONE, args);

        // Some fields are allowed to be changed by listeners, those will be handled here manually. They can be updated via changed the args from the listeners.
        // Any array provided directly can be modified by updating it's elements, adding or removing elements. This has to be done consistently.
        if (args.state.next !== scanState) {
            logNextState('[WI] Scan state changed from', scanState, 'to', args.state.next);
            scanState = args.state.next;
        }
        allActivatedText = args.activated.text;
        currentRecursionDelayLevel = args.recursionDelay.currentLevel;
        budget = args.budget.current;
        token_budget_overflowed = args.budget.overflowed;
    }

    console.debug('[WI] --- BUILDING PROMPT ---');
    const promptStart = profiler.startTimer();

    // Forward-sorted list of entries for joining
    const WIBeforeEntries = [];
    const WIAfterEntries = [];
    const EMEntries = [];
    const ANTopEntries = [];
    const ANBottomEntries = [];
    const WIDepthEntries = [];
    /** @type {{[key: string]: string[]}} */
    const WIOutletEntries = {};

    // Appends from insertion order 999 to 1. Use unshift for this purpose
    // TODO (kingbri): Change to use WI Anchor positioning instead of separate top/bottom arrays
    [...allActivatedEntries.values()].sort(sortFn).forEach((entry) => {
        const regexDepth = entry.position === world_info_position.atDepth ? (entry.depth ?? DEFAULT_DEPTH) : null;
        const content = getRegexedString(entry.content, regex_placement.WORLD_INFO, { depth: regexDepth, isMarkdown: false, isPrompt: true });

        if (!content) {
            console.debug(`[WI] Entry ${entry.uid}`, 'skipped adding to prompt due to empty content', entry);
            return;
        }

        switch (entry.position) {
            case world_info_position.before:
                WIBeforeEntries.unshift(content);
                break;
            case world_info_position.after:
                WIAfterEntries.unshift(content);
                break;
            case world_info_position.EMTop:
                EMEntries.unshift(
                    { position: wi_anchor_position.before, content: content },
                );
                break;
            case world_info_position.EMBottom:
                EMEntries.unshift(
                    { position: wi_anchor_position.after, content: content },
                );
                break;
            case world_info_position.ANTop:
                ANTopEntries.unshift(content);
                break;
            case world_info_position.ANBottom:
                ANBottomEntries.unshift(content);
                break;
            case world_info_position.atDepth: {
                const existingDepthIndex = WIDepthEntries.findIndex((e) => e.depth === (entry.depth ?? DEFAULT_DEPTH) && e.role === (entry.role ?? extension_prompt_roles.SYSTEM));
                if (existingDepthIndex !== -1) {
                    WIDepthEntries[existingDepthIndex].entries.unshift(content);
                } else {
                    WIDepthEntries.push({
                        depth: entry.depth,
                        entries: [content],
                        role: entry.role ?? extension_prompt_roles.SYSTEM,
                    });
                }
                break;
            }
            case world_info_position.outlet: {
                if (!entry.outletName) {
                    console.warn(`[WI] Entry ${entry.uid} has position 'outlet' but no outlet name. Skipping.`);
                    break;
                }
                if (Array.isArray(WIOutletEntries[entry.outletName])) {
                    WIOutletEntries[entry.outletName].push(content);
                } else {
                    WIOutletEntries[entry.outletName] = [content];
                }
                break;
            }
            default:
                break;
        }
    });

    const worldInfoBefore = WIBeforeEntries.length ? WIBeforeEntries.join('\n') : '';
    const worldInfoAfter = WIAfterEntries.length ? WIAfterEntries.join('\n') : '';

    if (shouldWIAddPrompt) {
        const originalAN = context.extensionPrompts[NOTE_MODULE_NAME].value;
        const ANWithWI = `${ANTopEntries.join('\n')}\n${originalAN}\n${ANBottomEntries.join('\n')}`.replace(/(^\n)|(\n$)/g, '');
        context.setExtensionPrompt(NOTE_MODULE_NAME, ANWithWI, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth], extension_settings.note.allowWIScan, chat_metadata[metadata_keys.role]);
    }
    profiler.addPromptTime(promptStart);

    timedEffects.setTimedEffects(Array.from(allActivatedEntries.values()));
    buffer.resetExternalEffects();
    timedEffects.cleanUp();

    // Set entry counts for profiling
    profiler.setEntryCounts(sortedEntries.length, stableKeywordEntries.length, allActivatedEntries.size);

    console.log(`[WI] ${isDryRun ? 'Hypothetically adding' : 'Adding'} ${allActivatedEntries.size} entries to prompt`, Array.from(allActivatedEntries.values()));
    console.debug(`[WI] --- DONE${isDryRun ? ' (DRY RUN)' : ''} ---`);

    const result = { worldInfoBefore, worldInfoAfter, EMEntries, WIDepthEntries, ANBeforeEntries: ANTopEntries, ANAfterEntries: ANBottomEntries, outletEntries: WIOutletEntries, allActivatedEntries: new Set(allActivatedEntries.values()) };
    const profilingData = profiler.finalize();
    if (profilingData) result.profiling = profilingData;
    return result;
}
