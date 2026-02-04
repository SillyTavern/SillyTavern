/**
 * Synthetic Lorebook Generator for Benchmarking
 *
 * Generates large lorebooks with configurable entry counts and properties
 * for performance testing of World Info scanning.
 */

/**
 * Generate a synthetic lorebook with the specified number of entries
 * @param {number} entryCount Number of entries to generate
 * @param {Object} options Configuration options
 * @param {boolean} options.withSecondary Include secondary keys
 * @param {number} options.contentLength Content repetition count (default 10)
 * @param {number[]} options.constants Array of UIDs to mark as constant
 * @param {number} options.regexRatio Ratio of entries to use regex keys (0-1)
 * @param {boolean} options.withGroups Generate entries with groups
 * @param {number} options.groupCount Number of groups to distribute entries into
 * @param {boolean} options.withRecursion Generate entries that trigger recursion
 * @returns {Object} Lorebook JSON object
 */
export function generateSyntheticLorebook(entryCount, options = {}) {
    const entries = {};

    const {
        withSecondary = false,
        contentLength = 10,
        constants = [],
        regexRatio = 0,
        withGroups = false,
        groupCount = 10,
        withRecursion = false,
    } = options;

    for (let i = 0; i < entryCount; i++) {
        const isRegex = regexRatio > 0 && Math.random() < regexRatio;
        const primaryKey = isRegex ? `/keyword_${i}/i` : `keyword_${i}`;

        let content = `Entry ${i} content. `.repeat(contentLength);

        // Add recursion trigger for some entries
        if (withRecursion && i > 0 && i % 100 === 0) {
            content += ` keyword_${i + 1}`;
        }

        entries[i] = {
            uid: i,
            key: [primaryKey, `alt_${i}`],
            keysecondary: withSecondary ? [`secondary_${i}`] : [],
            comment: `Synthetic Entry ${i}`,
            content: content,
            constant: constants.includes(i),
            selective: withSecondary,
            selectiveLogic: 0, // AND_ANY
            order: Math.floor(Math.random() * 200),
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: false,
            matchWholeWords: false,
            ...(withGroups ? {
                group: `group_${i % groupCount}`,
                groupWeight: 50 + Math.floor(Math.random() * 100),
            } : {}),
        };
    }

    return { entries };
}

/**
 * Generate a lorebook where all entries match a specific pattern
 * @param {number} entryCount Number of entries to generate
 * @param {string} matchKeyword Keyword that all entries will match
 * @param {Object} options Additional options
 * @returns {Object} Lorebook JSON object
 */
export function generateAllMatchingLorebook(entryCount, matchKeyword = 'match_all', options = {}) {
    const entries = {};

    const {
        contentLength = 10,
        withGroups = false,
        groupCount = 10,
    } = options;

    for (let i = 0; i < entryCount; i++) {
        entries[i] = {
            uid: i,
            key: [matchKeyword, `extra_${i}`],
            keysecondary: [],
            comment: `All-Match Entry ${i}`,
            content: `[ENTRY_${i}] Content for matching entry. `.repeat(contentLength),
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: entryCount - i, // Higher order first
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: false,
            matchWholeWords: false,
            ...(withGroups ? {
                group: `group_${i % groupCount}`,
                groupWeight: 100,
            } : {}),
        };
    }

    return { entries };
}

/**
 * Generate a lorebook optimized for recursion depth testing
 * @param {number} chainLength Length of the recursion chain
 * @returns {Object} Lorebook JSON object
 */
export function generateRecursionChainLorebook(chainLength) {
    const entries = {};

    for (let i = 0; i < chainLength; i++) {
        const isLast = i === chainLength - 1;
        entries[i] = {
            uid: i,
            key: [`chain_${i}`],
            keysecondary: [],
            comment: `Chain Entry ${i}`,
            content: isLast
                ? `[CHAIN_END_${i}] End of chain.`
                : `[CHAIN_${i}] chain_${i + 1} triggered.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: false,
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a lorebook with grouped entries for group competition testing
 * @param {number} groupCount Number of groups
 * @param {number} entriesPerGroup Entries per group
 * @param {Object} options Additional options
 * @returns {Object} Lorebook JSON object
 */
export function generateGroupedLorebook(groupCount, entriesPerGroup, options = {}) {
    const entries = {};
    let uid = 0;

    const {
        useGroupScoring = false,
        contentLength = 5,
    } = options;

    for (let g = 0; g < groupCount; g++) {
        const groupName = `test_group_${g}`;
        const groupKeyword = `trigger_group_${g}`;

        for (let e = 0; e < entriesPerGroup; e++) {
            entries[uid] = {
                uid: uid,
                key: [groupKeyword],
                keysecondary: [],
                comment: `Group ${g} Entry ${e}`,
                content: `[GROUP_${g}_ENTRY_${e}] Content. `.repeat(contentLength),
                constant: false,
                selective: false,
                selectiveLogic: 0,
                order: 100 - e, // Vary order within group
                position: 0,
                disable: false,
                excludeRecursion: false,
                preventRecursion: false,
                delayUntilRecursion: false,
                probability: 100,
                depth: 4,
                caseSensitive: false,
                matchWholeWords: false,
                group: groupName,
                groupWeight: 50 + (e * 10), // Increasing weight
                useGroupScoring: useGroupScoring,
            };
            uid++;
        }
    }

    return { entries };
}

/**
 * Metrics collector for benchmark results
 */
export class BenchmarkMetrics {
    constructor() {
        this.reset();
    }

    reset() {
        this.totalTimeMs = 0;
        this.entryProcessingMs = 0;
        this.activatedCount = 0;
        this.peakMemoryMB = 0;
        this.iterations = 0;
    }

    record(metrics) {
        this.totalTimeMs += metrics.totalTimeMs || 0;
        this.activatedCount += metrics.activatedCount || 0;
        this.iterations++;
        if (metrics.peakMemoryMB > this.peakMemoryMB) {
            this.peakMemoryMB = metrics.peakMemoryMB;
        }
    }

    getAverages() {
        if (this.iterations === 0) return null;
        return {
            avgTotalTimeMs: this.totalTimeMs / this.iterations,
            avgActivatedCount: this.activatedCount / this.iterations,
            peakMemoryMB: this.peakMemoryMB,
            iterations: this.iterations,
        };
    }

    toCSV() {
        const avg = this.getAverages();
        if (!avg) return '';
        return `${avg.avgTotalTimeMs.toFixed(2)},${avg.avgActivatedCount},${avg.peakMemoryMB.toFixed(2)},${avg.iterations}`;
    }

    static csvHeader() {
        return 'avgTotalTimeMs,avgActivatedCount,peakMemoryMB,iterations';
    }
}

/**
 * Generate a lorebook with constant entries for comparison testing
 * @param {number} entryCount Number of constant entries
 * @returns {Object} Lorebook JSON object
 */
export function generateConstantLorebook(entryCount) {
    const entries = {};

    for (let i = 0; i < entryCount; i++) {
        entries[i] = {
            uid: i,
            key: [`constant_key_${i}`], // Keys that won't match, but constant=true
            keysecondary: [],
            comment: `Constant Entry ${i}`,
            content: `[CONSTANT_${i}] This entry is always active regardless of keywords.`,
            constant: true,
            selective: false,
            selectiveLogic: 0,
            order: 100 - i,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: false,
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a lorebook with regex entries for comparison testing
 * @param {number} entryCount Number of entries
 * @returns {Object} Lorebook JSON object
 */
export function generateRegexLorebook(entryCount) {
    const entries = {};

    const regexPatterns = [
        '/dragon\\d+/i',         // dragon123
        '/test\\d+/',            // test456
        '/pattern_[a-z]+/i',     // pattern_abc
        '/(fire|ice|lightning)/', // element types
        '/\\w+_magic/i',         // something_magic
    ];

    for (let i = 0; i < entryCount; i++) {
        const pattern = regexPatterns[i % regexPatterns.length];
        entries[i] = {
            uid: i,
            key: [pattern, `regex_alt_${i}`],
            keysecondary: [],
            comment: `Regex Entry ${i}`,
            content: `[REGEX_${i}] Entry matched by regex pattern ${pattern}.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: false,
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a lorebook with case-sensitive entries for comparison testing
 * @param {number} entryCount Number of entries
 * @returns {Object} Lorebook JSON object
 */
export function generateCaseSensitiveLorebook(entryCount) {
    const entries = {};

    const caseSensitiveWords = [
        'Knight', 'Castle', 'Dragon', 'Wizard', 'King',
        'Queen', 'Prince', 'Lord', 'Lady', 'Master',
    ];

    for (let i = 0; i < entryCount; i++) {
        const word = caseSensitiveWords[i % caseSensitiveWords.length];
        entries[i] = {
            uid: i,
            key: [word],
            keysecondary: [],
            comment: `Case Sensitive Entry ${i}`,
            content: `[CASE_SENSITIVE_${i}] Entry for ${word} with case sensitivity.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: true,
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a lorebook with secondary keys using all 4 logic types
 * @param {number} entryCount Number of entries (distributed evenly across logic types)
 * @returns {Object} Lorebook JSON object
 */
export function generateSecondaryKeysLorebook(entryCount) {
    const entries = {};

    // Logic types: AND_ANY=0, NOT_ALL=1, NOT_ANY=2, AND_ALL=3
    const logicTypes = [
        { logic: 0, name: 'AND_ANY', primary: 'wizard', secondary: ['wand', 'staff'] },
        { logic: 3, name: 'AND_ALL', primary: 'knight', secondary: ['armor', 'sword'] },
        { logic: 2, name: 'NOT_ANY', primary: 'elf', secondary: ['evil', 'dark'] },
        { logic: 1, name: 'NOT_ALL', primary: 'dwarf', secondary: ['evil', 'dark'] },
    ];

    for (let i = 0; i < entryCount; i++) {
        const type = logicTypes[i % logicTypes.length];
        entries[i] = {
            uid: i,
            key: [`${type.primary}_${i}`, type.primary],
            keysecondary: type.secondary,
            comment: `Secondary Keys ${type.name} Entry ${i}`,
            content: `[SECONDARY_${type.name}_${i}] Entry with ${type.name} logic.`,
            constant: false,
            selective: true,
            selectiveLogic: type.logic,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: i % 2 === 0, // Alternate case sensitivity
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a lorebook with various recursion settings
 * @param {number} entryCount Number of entries
 * @returns {Object} Lorebook JSON object
 */
export function generateRecursionLorebook(entryCount) {
    const entries = {};

    // Create a basic recursion chain
    for (let i = 0; i < Math.min(10, entryCount); i++) {
        entries[i] = {
            uid: i,
            key: [i === 0 ? 'recursion_start' : `recursion_chain_${i}`],
            keysecondary: [],
            comment: `Recursion Chain Entry ${i}`,
            content: i < 9
                ? `[CHAIN_${i}] recursion_chain_${i + 1} triggered.`
                : `[CHAIN_END_${i}] End of chain.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: false,
            matchWholeWords: false,
        };
    }

    // Add excludeRecursion entries
    let uid = 10;
    entries[uid] = {
        uid: uid,
        key: ['exclude_recursion_trigger'],
        keysecondary: [],
        comment: 'Exclude Recursion Source',
        content: '[EXCLUDE_RECURSION_SOURCE] This mentions exclude_recursion_target.',
        constant: false,
        selective: false,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: true, // Content not scanned during recursion
        preventRecursion: false,
        delayUntilRecursion: false,
        probability: 100,
        depth: 4,
        caseSensitive: false,
        matchWholeWords: false,
    };
    uid++;

    entries[uid] = {
        uid: uid,
        key: ['exclude_recursion_target'],
        keysecondary: [],
        comment: 'Exclude Recursion Target',
        content: '[EXCLUDE_RECURSION_TARGET] Should not trigger via recursion.',
        constant: false,
        selective: false,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: false,
        probability: 100,
        depth: 4,
        caseSensitive: false,
        matchWholeWords: false,
    };
    uid++;

    // Add preventRecursion entry
    entries[uid] = {
        uid: uid,
        key: ['prevent_recursion_trigger'],
        keysecondary: [],
        comment: 'Prevent Recursion Source',
        content: '[PREVENT_RECURSION_SOURCE] prevent_recursion_next mentioned.',
        constant: false,
        selective: false,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        preventRecursion: true, // Stops recursion buffer
        delayUntilRecursion: false,
        probability: 100,
        depth: 4,
        caseSensitive: false,
        matchWholeWords: false,
    };
    uid++;

    // Add delayUntilRecursion entries
    entries[uid] = {
        uid: uid,
        key: ['delay_recursion_trigger'],
        keysecondary: [],
        comment: 'Delay Until Recursion Entry',
        content: '[DELAY_RECURSION] Only activates during recursion.',
        constant: false,
        selective: false,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: 1, // Only during recursion
        probability: 100,
        depth: 4,
        caseSensitive: false,
        matchWholeWords: false,
    };
    uid++;

    entries[uid] = {
        uid: uid,
        key: ['delay_recursion_level2'],
        keysecondary: [],
        comment: 'Delay Until Recursion Level 2',
        content: '[DELAY_LEVEL_2] Only activates at recursion level 2+.',
        constant: false,
        selective: false,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: 2, // Only at recursion level 2+
        probability: 100,
        depth: 4,
        caseSensitive: false,
        matchWholeWords: false,
    };

    return { entries };
}

/**
 * Generate a lorebook with decorator entries (@@activate, @@dont_activate)
 * @param {number} entryCount Number of entries
 * @returns {Object} Lorebook JSON object
 */
export function generateDecoratorLorebook(entryCount) {
    const entries = {};

    for (let i = 0; i < entryCount; i++) {
        const useActivate = i % 3 === 0;
        const useDontActivate = i % 3 === 1;

        let content = `[DECORATOR_${i}] Entry content.`;
        if (useActivate) {
            content = `@@activate\n${content}`;
        } else if (useDontActivate) {
            content = `@@dont_activate\n${content}`;
        }

        entries[i] = {
            uid: i,
            key: useDontActivate ? ['dont_activate_keyword'] : [`decorator_key_${i}`],
            keysecondary: [],
            comment: `Decorator Entry ${i}`,
            content: content,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: false,
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a complex lorebook with mixed features for comprehensive testing
 * @param {number} entryCount Number of entries
 * @returns {Object} Lorebook JSON object
 */
export function generateComplexLorebook(entryCount) {
    const entries = {};

    const fantasyWords = [
        'knight', 'wizard', 'dragon', 'castle', 'sword', 'magic', 'elf', 'dwarf',
        'king', 'queen', 'forest', 'mountain', 'river', 'temple', 'dungeon', 'treasure',
    ];

    for (let i = 0; i < entryCount; i++) {
        const type = i % 10;
        let entry;

        switch (type) {
            case 0: // Constant entry
                entry = {
                    uid: i,
                    key: [`complex_const_${i}`],
                    keysecondary: [],
                    comment: `Complex Constant ${i}`,
                    content: `[COMPLEX_CONSTANT_${i}] Always active.`,
                    constant: true,
                    selective: false,
                    selectiveLogic: 0,
                    caseSensitive: false,
                    matchWholeWords: false,
                };
                break;

            case 1: // Regex entry
                entry = {
                    uid: i,
                    key: [`/pattern_${i}/i`, fantasyWords[i % fantasyWords.length]],
                    keysecondary: [],
                    comment: `Complex Regex ${i}`,
                    content: `[COMPLEX_REGEX_${i}] Regex pattern match.`,
                    constant: false,
                    selective: false,
                    selectiveLogic: 0,
                    caseSensitive: false,
                    matchWholeWords: false,
                };
                break;

            case 2: // Case sensitive
                entry = {
                    uid: i,
                    key: [fantasyWords[i % fantasyWords.length].charAt(0).toUpperCase() +
                          fantasyWords[i % fantasyWords.length].slice(1)],
                    keysecondary: [],
                    comment: `Complex Case Sensitive ${i}`,
                    content: `[COMPLEX_CASE_${i}] Case sensitive match.`,
                    constant: false,
                    selective: false,
                    selectiveLogic: 0,
                    caseSensitive: true,
                    matchWholeWords: false,
                };
                break;

            case 3: // AND_ANY secondary
                entry = {
                    uid: i,
                    key: [fantasyWords[i % fantasyWords.length]],
                    keysecondary: ['wand', 'staff', 'orb'],
                    comment: `Complex AND_ANY ${i}`,
                    content: `[COMPLEX_AND_ANY_${i}] Primary + any secondary.`,
                    constant: false,
                    selective: true,
                    selectiveLogic: 0,
                    caseSensitive: false,
                    matchWholeWords: false,
                };
                break;

            case 4: // AND_ALL secondary
                entry = {
                    uid: i,
                    key: [fantasyWords[i % fantasyWords.length]],
                    keysecondary: ['armor', 'sword'],
                    comment: `Complex AND_ALL ${i}`,
                    content: `[COMPLEX_AND_ALL_${i}] Primary + all secondary.`,
                    constant: false,
                    selective: true,
                    selectiveLogic: 3,
                    caseSensitive: false,
                    matchWholeWords: false,
                };
                break;

            case 5: // NOT_ANY secondary
                entry = {
                    uid: i,
                    key: [fantasyWords[i % fantasyWords.length]],
                    keysecondary: ['evil', 'dark', 'corrupt'],
                    comment: `Complex NOT_ANY ${i}`,
                    content: `[COMPLEX_NOT_ANY_${i}] Primary + no secondary.`,
                    constant: false,
                    selective: true,
                    selectiveLogic: 2,
                    caseSensitive: false,
                    matchWholeWords: false,
                };
                break;

            case 6: // NOT_ALL secondary
                entry = {
                    uid: i,
                    key: [fantasyWords[i % fantasyWords.length]],
                    keysecondary: ['evil', 'dark'],
                    comment: `Complex NOT_ALL ${i}`,
                    content: `[COMPLEX_NOT_ALL_${i}] Primary + not all secondary.`,
                    constant: false,
                    selective: true,
                    selectiveLogic: 1,
                    caseSensitive: false,
                    matchWholeWords: false,
                };
                break;

            case 7: // Whole word matching
                entry = {
                    uid: i,
                    key: [fantasyWords[i % fantasyWords.length]],
                    keysecondary: [],
                    comment: `Complex Whole Word ${i}`,
                    content: `[COMPLEX_WHOLE_WORD_${i}] Whole word match.`,
                    constant: false,
                    selective: false,
                    selectiveLogic: 0,
                    caseSensitive: false,
                    matchWholeWords: true,
                };
                break;

            case 8: // Recursion chain link
                entry = {
                    uid: i,
                    key: [`complex_chain_${i}`],
                    keysecondary: [],
                    comment: `Complex Chain ${i}`,
                    content: `[COMPLEX_CHAIN_${i}] complex_chain_${i + 1} next.`,
                    constant: false,
                    selective: false,
                    selectiveLogic: 0,
                    caseSensitive: false,
                    matchWholeWords: false,
                };
                break;

            case 9: // Combined features
            default:
                entry = {
                    uid: i,
                    key: [fantasyWords[i % fantasyWords.length], `/combo_${i}/i`],
                    keysecondary: ['power', 'ancient'],
                    comment: `Complex Combined ${i}`,
                    content: `[COMPLEX_COMBINED_${i}] Multiple features.`,
                    constant: false,
                    selective: true,
                    selectiveLogic: 0,
                    caseSensitive: false,
                    matchWholeWords: false,
                };
                break;
        }

        entries[i] = {
            ...entry,
            order: 100 - (i % 50),
            position: i % 2,
            disable: false,
            excludeRecursion: i % 20 === 0,
            preventRecursion: i % 25 === 0,
            delayUntilRecursion: i % 30 === 0 ? 1 : false,
            probability: 100,
            depth: 4 + (i % 3),
        };
    }

    return { entries };
}

/**
 * Generate a simple lorebook for cache invalidation testing
 * @param {number} entryCount Number of entries (default 10)
 * @returns {Object} Lorebook JSON object
 */
export function generateInvalidationTestLorebook(entryCount = 10) {
    const entries = {};

    for (let i = 0; i < entryCount; i++) {
        entries[i] = {
            uid: i,
            key: [`invalidation_key_${i}`, 'knight', 'tavern', 'forest'],
            keysecondary: [],
            comment: `Invalidation Test Entry ${i}`,
            content: `[INVALIDATION_${i}] Test entry for cache invalidation.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            caseSensitive: false,
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a lorebook with entries that have per-entry scan depths
 * @param {number} maxDepth Maximum scan depth to test
 * @returns {Object} Lorebook JSON object
 */
export function generateScanDepthLorebook(maxDepth = 10) {
    const entries = {};

    for (let i = 0; i < maxDepth; i++) {
        entries[i] = {
            uid: i,
            key: [`depth_${i + 1}_keyword`],
            keysecondary: [],
            comment: `Scan Depth ${i + 1} Entry`,
            content: `[SCAN_DEPTH_${i + 1}] Entry with scanDepth=${i + 1}.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            scanDepth: i + 1,
            caseSensitive: false,
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a lorebook with timed effects (sticky, cooldown, delay)
 * @param {number} maxValue Maximum value for timed effects
 * @returns {Object} Lorebook JSON object
 */
export function generateTimedEffectsLorebook(maxValue = 5) {
    const entries = {};
    let uid = 0;

    // Sticky entries
    for (let i = 1; i <= maxValue; i++) {
        entries[uid] = {
            uid: uid,
            key: [`sticky_${i}_keyword`],
            keysecondary: [],
            comment: `Sticky ${i} Entry`,
            content: `[STICKY_${i}] Entry stays active for ${i} turns.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            sticky: i,
            caseSensitive: false,
            matchWholeWords: false,
        };
        uid++;
    }

    // Cooldown entries
    for (let i = 1; i <= maxValue; i++) {
        entries[uid] = {
            uid: uid,
            key: [`cooldown_${i}_keyword`],
            keysecondary: [],
            comment: `Cooldown ${i} Entry`,
            content: `[COOLDOWN_${i}] Entry has ${i} turn cooldown.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            cooldown: i,
            caseSensitive: false,
            matchWholeWords: false,
        };
        uid++;
    }

    // Delay entries
    for (let i = 1; i <= maxValue; i++) {
        entries[uid] = {
            uid: uid,
            key: [`delay_${i}_keyword`],
            keysecondary: [],
            comment: `Delay ${i} Entry`,
            content: `[DELAY_${i}] Entry delays ${i} turns before activating.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: 4,
            delay: i,
            caseSensitive: false,
            matchWholeWords: false,
        };
        uid++;
    }

    return { entries };
}

/**
 * Generate a lorebook with entries at various probability levels
 * @returns {Object} Lorebook JSON object
 */
export function generateProbabilityLorebook() {
    const entries = {};
    const probabilities = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    for (let i = 0; i < probabilities.length; i++) {
        entries[i] = {
            uid: i,
            key: [`prob_${probabilities[i]}_keyword`],
            keysecondary: [],
            comment: `Probability ${probabilities[i]}% Entry`,
            content: `[PROB_${probabilities[i]}] Entry with ${probabilities[i]}% probability.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: 0,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: probabilities[i],
            depth: 4,
            caseSensitive: false,
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a lorebook with entries using all position types
 * @returns {Object} Lorebook JSON object
 */
export function generatePositionsLorebook() {
    const entries = {};
    // position values: 0=before, 1=after, 2=ANTop, 3=ANBottom, 4=atDepth, 5=EMTop, 6=EMBottom

    const positions = [
        { pos: 0, name: 'before', depth: null },
        { pos: 1, name: 'after', depth: null },
        { pos: 2, name: 'antop', depth: null },
        { pos: 3, name: 'anbottom', depth: null },
        { pos: 4, name: 'atdepth', depth: 2 },
        { pos: 5, name: 'emtop', depth: null },
        { pos: 6, name: 'embottom', depth: null },
    ];

    for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        entries[i] = {
            uid: i,
            key: [`pos_${p.name}_keyword`],
            keysecondary: [],
            comment: `Position ${p.name} Entry`,
            content: `[POS_${p.name.toUpperCase()}] Position=${p.pos}.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            order: 100,
            position: p.pos,
            disable: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            depth: p.depth !== null ? p.depth : 4,
            caseSensitive: false,
            matchWholeWords: false,
        };
    }

    return { entries };
}

/**
 * Generate a lorebook with entries that match global scan data
 * @returns {Object} Lorebook JSON object
 */
export function generateGlobalScanLorebook() {
    const entries = {};

    entries[0] = {
        uid: 0,
        key: ['persona_match'],
        keysecondary: [],
        comment: 'Persona Description Match',
        content: '[PERSONA_MATCH] Matches against persona description.',
        constant: false,
        selective: false,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: false,
        probability: 100,
        depth: 4,
        matchPersonaDescription: true,
        caseSensitive: false,
        matchWholeWords: false,
    };

    entries[1] = {
        uid: 1,
        key: ['char_desc_match'],
        keysecondary: [],
        comment: 'Character Description Match',
        content: '[CHAR_DESC_MATCH] Matches against character description.',
        constant: false,
        selective: false,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: false,
        probability: 100,
        depth: 4,
        matchCharacterDescription: true,
        caseSensitive: false,
        matchWholeWords: false,
    };

    entries[2] = {
        uid: 2,
        key: ['scenario_match'],
        keysecondary: [],
        comment: 'Scenario Match',
        content: '[SCENARIO_MATCH] Matches against scenario.',
        constant: false,
        selective: false,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: false,
        probability: 100,
        depth: 4,
        matchScenario: true,
        caseSensitive: false,
        matchWholeWords: false,
    };

    entries[3] = {
        uid: 3,
        key: ['chat_only_match'],
        keysecondary: [],
        comment: 'Chat Only Match',
        content: '[CHAT_ONLY_MATCH] Only matches chat messages.',
        constant: false,
        selective: false,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: false,
        probability: 100,
        depth: 4,
        caseSensitive: false,
        matchWholeWords: false,
    };

    return { entries };
}

export default {
    generateSyntheticLorebook,
    generateAllMatchingLorebook,
    generateRecursionChainLorebook,
    generateGroupedLorebook,
    generateConstantLorebook,
    generateRegexLorebook,
    generateCaseSensitiveLorebook,
    generateSecondaryKeysLorebook,
    generateRecursionLorebook,
    generateDecoratorLorebook,
    generateComplexLorebook,
    generateInvalidationTestLorebook,
    generateScanDepthLorebook,
    generateTimedEffectsLorebook,
    generateProbabilityLorebook,
    generatePositionsLorebook,
    generateGlobalScanLorebook,
    BenchmarkMetrics,
};
