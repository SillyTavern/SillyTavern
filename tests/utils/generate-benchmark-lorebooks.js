#!/usr/bin/env node
/**
 * Generate Benchmark Lorebook JSON Files
 *
 * Run this script to generate benchmark lorebooks for performance testing:
 *   node tests/utils/generate-benchmark-lorebooks.js
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../.test-data/default-user/worlds');

function generateEntry(uid, options = {}) {
    const {
        key = [`keyword_${uid}`],
        keysecondary = [],
        content = `[ENTRY_${uid}] Content.`,
        constant = false,
        selective = false,
        selectiveLogic = 0,
        order = 100,
        position = 0,
        group = null,
        groupWeight = 100,
        excludeRecursion = false,
        preventRecursion = false,
        delayUntilRecursion = false,
    } = options;

    return {
        uid,
        key: Array.isArray(key) ? key : [key],
        keysecondary,
        comment: `Entry ${uid}`,
        content,
        constant,
        selective,
        selectiveLogic,
        order,
        position,
        disable: false,
        excludeRecursion,
        preventRecursion,
        delayUntilRecursion,
        probability: 100,
        depth: 4,
        caseSensitive: false,
        matchWholeWords: false,
        ...(group ? { group, groupWeight } : {}),
    };
}

// Generate partial match benchmark (100 entries, 10 match)
function generatePartialMatchBenchmark() {
    const entries = {};
    for (let i = 0; i < 100; i++) {
        entries[i] = generateEntry(i, {
            key: i < 10 ? ['benchmark_match_key'] : [`no_match_${i}`],
            content: `[ENTRY_${i}] Benchmark content for partial match test.`,
            order: 100 - i,
        });
    }
    return { entries };
}

// Generate group competition benchmark (10 groups x 5 entries)
function generateGroupBenchmark() {
    const entries = {};
    let uid = 0;
    for (let g = 0; g < 10; g++) {
        for (let e = 0; e < 5; e++) {
            entries[uid] = generateEntry(uid, {
                key: [`trigger_group_${g}`],
                content: `[GROUP_${g}_ENTRY_${e}] Group competition content.`,
                group: `benchmark_group_${g}`,
                groupWeight: 50 + (e * 20),
                order: 100 - e,
            });
            uid++;
        }
    }
    return { entries };
}

// Generate recursion chain benchmark (20-deep chain)
function generateRecursionChainBenchmark() {
    const entries = {};
    const chainLength = 20;
    for (let i = 0; i < chainLength; i++) {
        const isLast = i === chainLength - 1;
        entries[i] = generateEntry(i, {
            key: [`chain_${i}`],
            content: isLast
                ? `[CHAIN_END_${i}] End of recursion chain.`
                : `[CHAIN_${i}] chain_${i + 1} triggered next.`,
            order: 100,
        });
    }
    return { entries };
}

// Generate secondary keys benchmark (50 entries with AND_ALL)
function generateSecondaryKeysBenchmark() {
    const entries = {};
    for (let i = 0; i < 50; i++) {
        entries[i] = generateEntry(i, {
            key: [`primary_${i}`],
            keysecondary: [`secondary_a_${i}`, `secondary_b_${i}`],
            content: `[SECONDARY_${i}] AND_ALL secondary keys test.`,
            selective: true,
            selectiveLogic: 3, // AND_ALL
        });
    }
    return { entries };
}

// Generate budget overflow benchmark (50 matching entries with large content)
function generateBudgetBenchmark() {
    const entries = {};
    for (let i = 0; i < 50; i++) {
        entries[i] = generateEntry(i, {
            key: ['budget_test_match'],
            content: `[BUDGET_${i}] ${'X'.repeat(200)}`,
            order: 50 - i, // Higher order first
        });
    }
    return { entries };
}

// Generate no-match benchmark (100 entries, none match)
function generateNoMatchBenchmark() {
    const entries = {};
    for (let i = 0; i < 100; i++) {
        entries[i] = generateEntry(i, {
            key: [`unique_keyword_${i}`],
            content: `[ENTRY_${i}] No match benchmark content.`,
        });
    }
    return { entries };
}

// Generate regex benchmark (50 entries with regex patterns)
function generateRegexBenchmark() {
    const entries = {};
    for (let i = 0; i < 50; i++) {
        entries[i] = generateEntry(i, {
            key: [`/regex_pattern_${i}/i`],
            content: `[REGEX_${i}] Regex pattern test.`,
        });
    }
    return { entries };
}

// Realistic keywords that might appear in fantasy/roleplay chat
// These share prefixes (dragon, dragonborn, dragonfire) which is realistic
const REALISTIC_KEYWORDS = [
    // Characters - shares prefixes
    'dragon', 'dragonborn', 'dragonfire', 'dragonlord', 'dragonflight',
    'elf', 'elven', 'elvenkind', 'elfish',
    'dwarf', 'dwarven', 'dwarfhold',
    'orc', 'orcish', 'orc chieftain',
    'knight', 'knighthood', 'knight commander',
    'wizard', 'wizardry', 'wizard tower',
    'king', 'kingdom', 'kingship',
    'queen', 'queenship', 'queen\'s court',
    'prince', 'princess', 'princeling',
    'lord', 'lordship', 'lord commander',
    'warrior', 'warband', 'warlord', 'warcraft',
    'mage', 'magic', 'magical', 'magician',
    'sorcerer', 'sorcery', 'sorceress',
    'paladin', 'ranger', 'rogue', 'bard', 'cleric', 'monk', 'druid',
    'assassin', 'thief', 'merchant', 'blacksmith', 'innkeeper',
    'guard', 'guardsman', 'soldier', 'archer', 'healer',
    // Locations - shares prefixes
    'castle', 'castle wall', 'castle gate', 'castle tower',
    'tower', 'watchtower', 'tower of',
    'dungeon', 'dungeon master',
    'forest', 'forest path', 'dark forest',
    'mountain', 'mountain pass', 'mountain peak',
    'river', 'riverbank', 'river crossing',
    'village', 'villager', 'village square',
    'town', 'township', 'town square',
    'city', 'cityscape', 'city gate',
    'temple', 'ancient temple', 'temple of',
    'cave', 'cavern', 'cave system',
    'palace', 'palace guard', 'royal palace',
    'guild', 'guild hall', 'guild master',
    // Items - shares prefixes
    'sword', 'swordsman', 'longsword', 'shortsword', 'greatsword',
    'shield', 'shieldmaiden', 'shield wall',
    'armor', 'armored', 'plate armor',
    'bow', 'longbow', 'shortbow', 'crossbow',
    'staff', 'wizard staff', 'quarterstaff',
    'potion', 'healing potion', 'mana potion',
    'scroll', 'ancient scroll', 'scroll of',
    'ring', 'magic ring', 'ring of',
    'amulet', 'amulet of',
    'treasure', 'treasure chest', 'treasure hoard',
    'gold', 'golden', 'gold coin',
    'silver', 'silvery', 'silver coin',
    // Magic - shares prefixes
    'spell', 'spellcast', 'spellcaster',
    'curse', 'cursed', 'curse of',
    'enchant', 'enchanted', 'enchantment',
    'summon', 'summoning', 'summoner',
    'fire', 'fireball', 'flame',
    'ice', 'frozen', 'frost',
    'lightning', 'thunder', 'storm',
    'light', 'holy light', 'radiant',
    'dark', 'darkness', 'shadow',
    'demon', 'demonic', 'demon lord',
    'angel', 'angelic', 'archangel',
    'undead', 'vampire', 'ghost', 'skeleton', 'zombie',
    // Actions - shares prefixes
    'battle', 'battlefield', 'battle cry',
    'war', 'warfare', 'wartime',
    'quest', 'questgiver', 'side quest',
    'adventure', 'adventurer', 'adventuring',
    'journey', 'travel', 'traveler',
    'hunt', 'hunter', 'hunting',
    'explore', 'explorer', 'exploration',
    'rescue', 'protect', 'defend', 'attack',
    'victory', 'defeat', 'death', 'glory',
    'tavern', 'inn', 'road', 'bridge', 'path',
];

// Keywords that definitely appear in REALISTIC_CHAT (from the test file)
const CHAT_KEYWORDS = [
    'tavern', 'merchant', 'battle', 'forest', 'village', 'castle',
    'knight', 'dungeon', 'sword', 'shield', 'wizard', 'dragon',
    'kingdom', 'princess', 'quest', 'treasure', 'ranger', 'cave',
    'magic', 'dwarf', 'blacksmith', 'forge', 'armor', 'elf',
    'healer', 'warrior', 'temple', 'potion', 'bridge', 'tower',
    'lightning', 'paladin', 'thief', 'demon', 'angel', 'orc', 'river',
];

// Themed keyword groups for more realistic multi-keyword entries
const KEYWORD_THEMES = {
    dragons: ['dragon', 'dragonborn', 'dragonfire', 'dragonlord', 'dragonflight', 'fire', 'flame', 'scale', 'wing'],
    castles: ['castle', 'castle wall', 'castle gate', 'castle tower', 'fortress', 'keep', 'moat', 'battlements'],
    knights: ['knight', 'knighthood', 'knight commander', 'armor', 'sword', 'shield', 'lance', 'joust'],
    magic: ['wizard', 'wizardry', 'magic', 'magical', 'spell', 'spellcast', 'enchant', 'enchanted'],
    elves: ['elf', 'elven', 'elvenkind', 'forest', 'bow', 'longbow', 'nature', 'ancient'],
    dwarves: ['dwarf', 'dwarven', 'dwarfhold', 'mountain', 'forge', 'hammer', 'mine', 'gem'],
    undead: ['undead', 'vampire', 'ghost', 'skeleton', 'zombie', 'dark', 'darkness', 'curse'],
    royalty: ['king', 'queen', 'prince', 'princess', 'throne', 'crown', 'royal', 'palace'],
    combat: ['battle', 'battlefield', 'war', 'warfare', 'warrior', 'fight', 'victory', 'defeat'],
    quests: ['quest', 'adventure', 'adventurer', 'journey', 'travel', 'explore', 'treasure', 'reward'],
};
const THEME_NAMES = Object.keys(KEYWORD_THEMES);

// Generate realistic benchmark with fixed match count
// ALL entries use realistic keywords (with prefix sharing) for proper AC trie testing
// Now with 3-8 keywords per entry and ~5% recursion chains
function generateRealisticBenchmark(totalEntries, matchCount = 12) {
    const entries = {};
    const keywordCount = REALISTIC_KEYWORDS.length;

    // Calculate how many entries should be recursion triggers (~5%)
    const recursionCount = Math.floor(totalEntries * 0.05);

    // First N entries use keywords that WILL match the chat content
    // These also get 3-8 keywords from themed groups
    for (let i = 0; i < matchCount; i++) {
        const primaryKeyword = CHAT_KEYWORDS[i % CHAT_KEYWORDS.length];
        // Pick a theme that contains or relates to the primary keyword
        const themeIdx = i % THEME_NAMES.length;
        const theme = KEYWORD_THEMES[THEME_NAMES[themeIdx]];

        // Generate 3-8 keywords: primary + 2-7 from theme
        const numExtraKeys = 2 + (i % 6); // 2-7 extra keywords
        const keys = [primaryKeyword];
        for (let k = 0; k < numExtraKeys; k++) {
            const themeKeyword = theme[k % theme.length];
            if (!keys.includes(themeKeyword)) {
                keys.push(themeKeyword);
            }
        }

        // Some matched entries trigger recursion by mentioning other keywords in content
        let content = `[MATCHED_${i}] Information about ${primaryKeyword}. This entry provides context and lore about the ${primaryKeyword} in the world setting.`;
        if (i < recursionCount && i + 1 < matchCount) {
            // This entry's content mentions another matched entry's keyword
            const nextKeyword = CHAT_KEYWORDS[(i + 1) % CHAT_KEYWORDS.length];
            content += ` The ${primaryKeyword} is often associated with ${nextKeyword}.`;
        }

        entries[i] = generateEntry(i, {
            key: keys,
            content,
            order: 200 - i, // Higher priority for matched entries
        });
    }

    // Remaining entries use realistic keywords that WON'T match the chat
    // These are still real words with prefix sharing for proper AC trie efficiency
    // We add "xq" prefix to prevent matching but keep realistic word structure
    for (let i = matchCount; i < totalEntries; i++) {
        // Pick 3-8 related keywords from a themed group
        const themeIdx = i % THEME_NAMES.length;
        const theme = KEYWORD_THEMES[THEME_NAMES[themeIdx]];
        const numKeys = 3 + (i % 6); // 3-8 keywords

        const keys = [];
        for (let k = 0; k < numKeys && k < theme.length; k++) {
            // Add "xq" prefix to prevent matching but keep realistic word structure
            keys.push(`xq${theme[k]}`);
        }

        // Add some additional non-themed keywords for variety
        const startIdx = i % keywordCount;
        while (keys.length < numKeys) {
            const keyword = REALISTIC_KEYWORDS[(startIdx + keys.length) % keywordCount];
            keys.push(`xq${keyword}`);
        }

        // ~5% of non-matching entries have content that triggers other non-matching entries
        // This creates 2-3 level recursion chains for testing
        let content = `[ENTRY_${i}] Background lore entry about ${THEME_NAMES[themeIdx]}.`;
        const isRecursionTrigger = (i - matchCount) < recursionCount && (i + 1) < totalEntries;
        if (isRecursionTrigger) {
            // Reference next entry's keyword to create chain
            const nextThemeIdx = (i + 1) % THEME_NAMES.length;
            const nextTheme = KEYWORD_THEMES[THEME_NAMES[nextThemeIdx]];
            content += ` This relates to xq${nextTheme[0]}.`;
        }

        entries[i] = generateEntry(i, {
            key: keys,
            content,
            order: 100,
        });
    }

    return { entries };
}

/**
 * Generate a long realistic chat for benchmarking (~10k words by default).
 * Uses vocabulary from REALISTIC_KEYWORDS and CHAT_KEYWORDS to simulate real RP chats.
 * Keyword density is ~2-5% to match real usage patterns.
 * @param {number} targetWordCount Target number of words
 * @returns {string[]} Array of chat messages
 */
export function generateLongRealisticChat(targetWordCount = 10000) {
    // Fantasy-themed sentence templates with placeholders
    const templates = [
        'The {adj} {noun} stood before the {location}, contemplating the {noun2} ahead.',
        '{name} drew their {weapon} and faced the {creature} with determination.',
        'In the {location}, the {adj} {noun} whispered secrets of ancient {magic}.',
        'The {creature} emerged from the shadows, its {adj} eyes gleaming.',
        '"We must find the {noun}," {name} declared, pointing toward the {location}.',
        'A {adj} wind swept through the {location}, carrying the scent of {noun}.',
        'The {class} prepared their {magic}, channeling power through the {item}.',
        '{name} remembered the tales of the {adj} {creature} that once roamed these lands.',
        'Beyond the {location}, the {noun} waited, guarded by {creature}s.',
        'The {item} glowed with {adj} light as {name} approached the {location}.',
        'Years of {action} had prepared {name} for this moment.',
        'The {class} spoke words of {magic}, and the {noun} began to transform.',
        'In ancient times, the {creature}s and {class}s lived in harmony.',
        'The {location} held many secrets, including the legendary {item}.',
        '{name} knew that only a true {class} could wield the {item}.',
        'The {adj} {noun} was said to grant immense power to its bearer.',
        'Shadows danced across the {location} as the sun set behind the mountains.',
        'The {creature} let out a {adj} roar that echoed through the {location}.',
        '{name} felt the weight of the {item} in their hands, sensing its {magic}.',
        'The path to the {location} was treacherous, filled with {creature}s.',
    ];

    const adjectives = ['ancient', 'mystical', 'dark', 'golden', 'silver', 'crimson', 'emerald', 'shadow', 'radiant', 'cursed', 'blessed', 'forgotten', 'legendary', 'enchanted', 'fierce', 'noble', 'wise', 'brave'];
    const nouns = ['sword', 'shield', 'treasure', 'secret', 'power', 'destiny', 'prophecy', 'artifact', 'relic', 'crystal', 'gem', 'crown', 'throne', 'scroll', 'tome', 'staff', 'ring', 'amulet'];
    const locations = ['castle', 'tower', 'dungeon', 'forest', 'cave', 'temple', 'village', 'mountain', 'river', 'bridge', 'tavern', 'palace', 'guild hall', 'ancient ruins'];
    const creatures = ['dragon', 'orc', 'elf', 'dwarf', 'demon', 'ghost', 'skeleton', 'vampire', 'wolf', 'griffin', 'troll', 'goblin', 'serpent', 'phoenix'];
    const classes = ['knight', 'wizard', 'paladin', 'ranger', 'rogue', 'warrior', 'mage', 'healer', 'archer', 'sorcerer', 'cleric', 'bard', 'druid', 'assassin'];
    const names = ['Aldric', 'Elena', 'Theron', 'Lyra', 'Marcus', 'Sera', 'Viktor', 'Aria', 'Kael', 'Mira', 'Dante', 'Isolde'];
    const weapons = ['sword', 'bow', 'staff', 'dagger', 'axe', 'spear', 'crossbow', 'mace', 'longsword', 'greatsword'];
    const magicTypes = ['fire', 'ice', 'lightning', 'shadow', 'light', 'healing', 'summoning', 'enchantment', 'illusion', 'divination'];
    const items = ['sword', 'shield', 'armor', 'potion', 'scroll', 'ring', 'amulet', 'staff', 'crystal', 'gem'];
    const actions = ['training', 'battling', 'adventuring', 'questing', 'exploring', 'fighting', 'hunting', 'studying', 'traveling', 'searching'];

    // Seeded random for reproducibility
    let seed = 42;
    function seededRandom() {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    }

    function pick(arr) {
        return arr[Math.floor(seededRandom() * arr.length)];
    }

    function fillTemplate(template) {
        return template
            .replace(/{adj}/g, () => pick(adjectives))
            .replace(/{noun}/g, () => pick(nouns))
            .replace(/{noun2}/g, () => pick(nouns))
            .replace(/{location}/g, () => pick(locations))
            .replace(/{creature}/g, () => pick(creatures))
            .replace(/{class}/g, () => pick(classes))
            .replace(/{name}/g, () => pick(names))
            .replace(/{weapon}/g, () => pick(weapons))
            .replace(/{magic}/g, () => pick(magicTypes))
            .replace(/{item}/g, () => pick(items))
            .replace(/{action}/g, () => pick(actions));
    }

    const messages = [];
    let totalWords = 0;

    while (totalWords < targetWordCount) {
        // Generate a paragraph of 3-7 sentences
        const sentenceCount = 3 + Math.floor(seededRandom() * 5);
        const sentences = [];

        for (let i = 0; i < sentenceCount; i++) {
            const template = pick(templates);
            sentences.push(fillTemplate(template));
        }

        const paragraph = sentences.join(' ');
        messages.push(paragraph);
        totalWords += paragraph.split(/\s+/).length;
    }

    return messages;
}

// Generate large no-match benchmark with realistic keywords (prefix sharing)
function generateLargeNoMatchBenchmark(size) {
    const entries = {};
    const keywordCount = REALISTIC_KEYWORDS.length;

    for (let i = 0; i < size; i++) {
        // Use realistic keywords with "nomatch:" prefix
        const startIdx = i % keywordCount;
        const numKeys = 2 + (i % 3);
        const keys = [];
        for (let k = 0; k < numKeys; k++) {
            const keyword = REALISTIC_KEYWORDS[(startIdx + k) % keywordCount];
            keys.push(`nomatch:${keyword}`);
        }

        entries[i] = generateEntry(i, {
            key: keys,
            content: `[ENTRY_${i}] Background content.`,
        });
    }
    return { entries };
}

// ============================================
// Comparison Test Lorebooks (for AC vs Legacy)
// ============================================

// Generate constant entries lorebook for comparison testing
function generateComparisonConstant() {
    const entries = {};
    for (let i = 0; i < 10; i++) {
        entries[i] = generateEntry(i, {
            key: [`constant_nomatch_${i}`],
            content: `[CONSTANT_${i}] This entry is always active regardless of keywords.`,
            constant: true,
        });
    }
    return { entries };
}

// Generate regex entries lorebook for comparison testing
function generateComparisonRegex() {
    const entries = {};
    const patterns = [
        { key: ['/dragon\\d+/i', 'dragon'], content: '[REGEX_DRAGON] Dragon with number.' },
        { key: ['/test\\d+/'], content: '[REGEX_TEST] Test with number.' },
        { key: ['/pattern_[a-z]+/i'], content: '[REGEX_PATTERN] Pattern with letters.' },
        { key: ['/(fire|ice|lightning)/i'], content: '[REGEX_ELEMENT] Element type.' },
        { key: ['/\\w+_magic/i'], content: '[REGEX_MAGIC] Something magic.' },
    ];

    for (let i = 0; i < 20; i++) {
        const p = patterns[i % patterns.length];
        entries[i] = generateEntry(i, {
            key: p.key,
            content: `${p.content} Entry ${i}.`,
        });
    }
    return { entries };
}

// Generate case-sensitive entries lorebook for comparison testing
function generateComparisonCaseSensitive() {
    const entries = {};
    const words = ['Knight', 'Castle', 'Dragon', 'Wizard', 'King', 'Queen', 'Prince', 'Lord', 'Lady', 'Master'];

    for (let i = 0; i < 50; i++) {
        const word = words[i % words.length];
        entries[i] = {
            ...generateEntry(i, {
                key: [word],
                content: `[CASE_SENSITIVE_${i}] Entry for ${word} with case sensitivity.`,
            }),
            caseSensitive: true,
        };
    }
    return { entries };
}

// Generate secondary keys lorebook with all 4 logic types
function generateComparisonSecondaryKeys() {
    const entries = {};
    // AND_ANY=0, NOT_ALL=1, NOT_ANY=2, AND_ALL=3
    const configs = [
        { logic: 0, name: 'AND_ANY', primary: 'wizard', secondary: ['wand', 'staff'] },
        { logic: 3, name: 'AND_ALL', primary: 'knight', secondary: ['armor', 'sword'] },
        { logic: 2, name: 'NOT_ANY', primary: 'elf', secondary: ['evil', 'dark'] },
        { logic: 1, name: 'NOT_ALL', primary: 'dwarf', secondary: ['evil', 'dark'] },
    ];

    for (let i = 0; i < 50; i++) {
        const cfg = configs[i % configs.length];
        entries[i] = {
            ...generateEntry(i, {
                key: [cfg.primary],
                keysecondary: cfg.secondary,
                content: `[SECONDARY_${cfg.name}_${i}] Entry with ${cfg.name} logic.`,
                selective: true,
                selectiveLogic: cfg.logic,
            }),
            caseSensitive: i % 2 === 0,
        };
    }
    return { entries };
}

// Generate recursion lorebook for comparison testing
function generateComparisonRecursion() {
    const entries = {};
    let uid = 0;

    // Basic recursion chain (10 entries)
    for (let i = 0; i < 10; i++) {
        entries[uid] = generateEntry(uid, {
            key: [i === 0 ? 'recursion_start' : `recursion_chain_${i}`],
            content: i < 9
                ? `[CHAIN_${i}] recursion_chain_${i + 1} triggered.`
                : `[CHAIN_END_${i}] End of chain.`,
        });
        uid++;
    }

    // excludeRecursion entries
    // Entry A triggers Entry B's keyword via recursion, but B has excludeRecursion=true
    // so B should NOT activate during recursion
    entries[uid] = generateEntry(uid, {
        key: ['exclude_test_trigger'],
        content: '[EXCLUDE_TEST_SOURCE] exclude_test_target is mentioned here.',
    });
    uid++;

    entries[uid] = generateEntry(uid, {
        key: ['exclude_test_target'],
        content: '[EXCLUDE_TEST_TARGET] This has excludeRecursion=true, should not activate via recursion.',
        excludeRecursion: true,
    });
    uid++;

    // preventRecursion entries
    entries[uid] = generateEntry(uid, {
        key: ['prevent_recursion_trigger'],
        content: '[PREVENT_RECURSION_SOURCE] prevent_next mentioned.',
        preventRecursion: true,
    });
    uid++;

    entries[uid] = generateEntry(uid, {
        key: ['prevent_next'],
        content: '[PREVENT_NEXT] Chained entry.',
    });
    uid++;

    // delayUntilRecursion entries
    // Source entry that triggers the delayed entry's keyword via recursion
    entries[uid] = generateEntry(uid, {
        key: ['delay_source_trigger'],
        content: '[DELAY_SOURCE] This triggers delay_target_keyword via recursion.',
    });
    uid++;

    // Delayed entry - should only activate via recursion (turn 2+), not when keyword is directly in chat
    entries[uid] = generateEntry(uid, {
        key: ['delay_target_keyword'],
        content: '[DELAY_TARGET] This has delayUntilRecursion=1, only activates on turn 2+.',
        delayUntilRecursion: 1,
    });
    uid++;

    entries[uid] = generateEntry(uid, {
        key: ['delay_level2_trigger'],
        content: '[DELAY_LEVEL_2] Only at recursion level 2+.',
        delayUntilRecursion: 2,
    });
    uid++;

    // Unrelated recursion trigger - activates and adds to recursion buffer,
    // but its content does NOT contain "delay_target_keyword"
    // Used to test that delayUntilRecursion entries only match recursion buffer, not original chat
    entries[uid] = generateEntry(uid, {
        key: ['unrelated_recursion_trigger'],
        content: '[UNRELATED_RECURSION] This content does NOT mention the delay target keyword at all.',
    });
    uid++;

    return { entries };
}

// Generate decorator lorebook for comparison testing
function generateComparisonDecorators() {
    const entries = {};

    // @@activate entries (force activation regardless of keywords)
    for (let i = 0; i < 5; i++) {
        entries[i] = generateEntry(i, {
            key: [`no_match_activate_${i}`],
            content: `@@activate\n[ACTIVATE_${i}] This entry is force-activated.`,
        });
    }

    // @@dont_activate entries (prevent activation even with keyword match)
    for (let i = 5; i < 10; i++) {
        entries[i] = generateEntry(i, {
            key: ['dont_activate_keyword'],
            content: `@@dont_activate\n[DONT_ACTIVATE_${i}] This entry should not activate.`,
        });
    }

    // Normal entries for comparison
    for (let i = 10; i < 20; i++) {
        entries[i] = generateEntry(i, {
            key: ['normal_keyword'],
            content: `[NORMAL_${i}] Normal entry without decorators.`,
        });
    }

    return { entries };
}

// Generate complex mixed lorebook for comparison testing
function generateComparisonComplex() {
    const entries = {};
    const words = ['knight', 'wizard', 'dragon', 'castle', 'sword', 'magic', 'elf', 'dwarf', 'king', 'queen'];

    for (let i = 0; i < 100; i++) {
        const type = i % 10;
        let entry;

        switch (type) {
            case 0: // Constant
                entry = generateEntry(i, {
                    key: [`complex_const_${i}`],
                    content: `[COMPLEX_CONSTANT_${i}] Always active.`,
                    constant: true,
                });
                break;
            case 1: // Regex
                entry = generateEntry(i, {
                    key: [`/pattern_${i}/i`, words[i % words.length]],
                    content: `[COMPLEX_REGEX_${i}] Regex match.`,
                });
                break;
            case 2: // Case sensitive
                entry = {
                    ...generateEntry(i, {
                        key: [words[i % words.length].charAt(0).toUpperCase() + words[i % words.length].slice(1)],
                        content: `[COMPLEX_CASE_${i}] Case sensitive.`,
                    }),
                    caseSensitive: true,
                };
                break;
            case 3: // AND_ANY
                entry = generateEntry(i, {
                    key: [words[i % words.length]],
                    keysecondary: ['wand', 'staff'],
                    content: `[COMPLEX_AND_ANY_${i}] AND_ANY logic.`,
                    selective: true,
                    selectiveLogic: 0,
                });
                break;
            case 4: // AND_ALL
                entry = generateEntry(i, {
                    key: [words[i % words.length]],
                    keysecondary: ['armor', 'sword'],
                    content: `[COMPLEX_AND_ALL_${i}] AND_ALL logic.`,
                    selective: true,
                    selectiveLogic: 3,
                });
                break;
            case 5: // NOT_ANY
                entry = generateEntry(i, {
                    key: [words[i % words.length]],
                    keysecondary: ['evil', 'dark'],
                    content: `[COMPLEX_NOT_ANY_${i}] NOT_ANY logic.`,
                    selective: true,
                    selectiveLogic: 2,
                });
                break;
            case 6: // NOT_ALL
                entry = generateEntry(i, {
                    key: [words[i % words.length]],
                    keysecondary: ['evil', 'dark'],
                    content: `[COMPLEX_NOT_ALL_${i}] NOT_ALL logic.`,
                    selective: true,
                    selectiveLogic: 1,
                });
                break;
            case 7: // Whole word
                entry = {
                    ...generateEntry(i, {
                        key: [words[i % words.length]],
                        content: `[COMPLEX_WHOLE_${i}] Whole word match.`,
                    }),
                    matchWholeWords: true,
                };
                break;
            case 8: // Chain entry
                entry = generateEntry(i, {
                    key: [`complex_chain_${i}`],
                    content: `[COMPLEX_CHAIN_${i}] complex_chain_${i + 1} next.`,
                });
                break;
            case 9: // Combined
            default:
                entry = generateEntry(i, {
                    key: [words[i % words.length], `/combo_${i}/i`],
                    keysecondary: ['power', 'ancient'],
                    content: `[COMPLEX_COMBINED_${i}] Multiple features.`,
                    selective: true,
                    selectiveLogic: 0,
                });
                break;
        }

        entries[i] = entry;
    }

    return { entries };
}

// Generate simple lorebook for cache invalidation testing
function generateInvalidationTest() {
    const entries = {};
    for (let i = 0; i < 10; i++) {
        entries[i] = generateEntry(i, {
            key: [`invalidation_key_${i}`, 'knight', 'tavern', 'forest'],
            content: `[INVALIDATION_${i}] Test entry for cache invalidation.`,
        });
    }
    return { entries };
}

// Generate entries with per-entry scan depth for comparison testing
function generateComparisonScanDepth() {
    const entries = {};

    // Entries with different scan depths
    for (let i = 0; i < 10; i++) {
        entries[i] = {
            ...generateEntry(i, {
                key: [`depth_${i + 1}_keyword`],
                content: `[SCAN_DEPTH_${i + 1}] Entry with scanDepth=${i + 1}.`,
            }),
            scanDepth: i + 1, // 1-10 depths
        };
    }

    // Entry with very deep scan depth
    entries[10] = {
        ...generateEntry(10, {
            key: ['deep_scan_keyword'],
            content: '[DEEP_SCAN] Entry with scanDepth=100.',
        }),
        scanDepth: 100,
    };

    // Entry with null scanDepth (uses global)
    entries[11] = generateEntry(11, {
        key: ['global_depth_keyword'],
        content: '[GLOBAL_DEPTH] Entry uses global scan depth.',
    });

    return { entries };
}

// Generate entries with timed effects (sticky, cooldown, delay)
function generateComparisonTimedEffects() {
    const entries = {};
    let uid = 0;

    // Sticky entries (stay active for N turns after triggered)
    for (let i = 1; i <= 5; i++) {
        entries[uid] = {
            ...generateEntry(uid, {
                key: [`sticky_${i}_keyword`],
                content: `[STICKY_${i}] Entry stays active for ${i} turns.`,
            }),
            sticky: i,
        };
        uid++;
    }

    // Cooldown entries (can't reactivate for N turns)
    for (let i = 1; i <= 5; i++) {
        entries[uid] = {
            ...generateEntry(uid, {
                key: [`cooldown_${i}_keyword`],
                content: `[COOLDOWN_${i}] Entry has ${i} turn cooldown.`,
            }),
            cooldown: i,
        };
        uid++;
    }

    // Delay entries (waits N turns before activating)
    for (let i = 1; i <= 5; i++) {
        entries[uid] = {
            ...generateEntry(uid, {
                key: [`delay_${i}_keyword`],
                content: `[DELAY_${i}] Entry delays ${i} turns before activating.`,
            }),
            delay: i,
        };
        uid++;
    }

    // Combined effects
    entries[uid] = {
        ...generateEntry(uid, {
            key: ['sticky_cooldown_keyword'],
            content: '[STICKY_COOLDOWN] Entry with both sticky=3 and cooldown=2.',
        }),
        sticky: 3,
        cooldown: 2,
    };

    return { entries };
}

// Generate entries with probability settings
function generateComparisonProbability() {
    const entries = {};

    // 0% probability (should never activate)
    entries[0] = {
        ...generateEntry(0, {
            key: ['prob_zero_keyword'],
            content: '[PROB_0] This entry has 0% probability.',
        }),
        probability: 0,
        useProbability: true,
    };

    // 50% probability
    entries[1] = {
        ...generateEntry(1, {
            key: ['prob_fifty_keyword'],
            content: '[PROB_50] This entry has 50% probability.',
        }),
        probability: 50,
        useProbability: true,
    };

    // 100% probability (default, always activates)
    entries[2] = {
        ...generateEntry(2, {
            key: ['prob_hundred_keyword'],
            content: '[PROB_100] This entry has 100% probability.',
        }),
        probability: 100,
        useProbability: true,
    };

    // Various probabilities
    for (let i = 3; i < 13; i++) {
        const prob = (i - 3) * 10; // 0, 10, 20, ... 90
        entries[i] = {
            ...generateEntry(i, {
                key: [`prob_${prob}_keyword`],
                content: `[PROB_${prob}] Entry with ${prob}% probability.`,
            }),
            probability: prob,
            useProbability: true,
        };
    }

    // useProbability: false entries (should ALWAYS activate, probability is ignored)
    // 0% probability but useProbability is false
    entries[13] = {
        ...generateEntry(13, {
            key: ['prob_disabled_zero'],
            content: '[PROB_DISABLED_0] Entry with 0% probability but useProbability=false.',
        }),
        probability: 0,
        useProbability: false,
    };

    // 50% probability but useProbability is false
    entries[14] = {
        ...generateEntry(14, {
            key: ['prob_disabled_fifty'],
            content: '[PROB_DISABLED_50] Entry with 50% probability but useProbability=false.',
        }),
        probability: 50,
        useProbability: false,
    };

    // Multiple entries with useProbability: false to verify consistent behavior
    for (let i = 15; i < 20; i++) {
        entries[i] = {
            ...generateEntry(i, {
                key: [`prob_disabled_${i}`],
                content: `[PROB_DISABLED_${i}] Probability disabled, should always activate.`,
            }),
            probability: 0,
            useProbability: false,
        };
    }

    return { entries };
}

// Generate entries with group competition settings
function generateComparisonGroups() {
    const entries = {};
    let uid = 0;

    // Group A: 5 entries with varying weights
    for (let i = 0; i < 5; i++) {
        entries[uid] = {
            ...generateEntry(uid, {
                key: ['group_a_trigger'],
                content: `[GROUP_A_${i}] Group A entry with weight ${50 + i * 25}.`,
            }),
            group: 'group_alpha',
            groupWeight: 50 + i * 25, // 50, 75, 100, 125, 150
        };
        uid++;
    }

    // Group B: 5 entries with varying weights
    for (let i = 0; i < 5; i++) {
        entries[uid] = {
            ...generateEntry(uid, {
                key: ['group_b_trigger'],
                content: `[GROUP_B_${i}] Group B entry with weight ${100 - i * 20}.`,
            }),
            group: 'group_beta',
            groupWeight: 100 - i * 20, // 100, 80, 60, 40, 20
        };
        uid++;
    }

    // No group (should all activate)
    for (let i = 0; i < 3; i++) {
        entries[uid] = generateEntry(uid, {
            key: ['no_group_trigger'],
            content: `[NO_GROUP_${i}] Entry without group.`,
        });
        uid++;
    }

    // Group with useGroupScoring
    for (let i = 0; i < 3; i++) {
        entries[uid] = {
            ...generateEntry(uid, {
                key: ['scoring_group_trigger'],
                content: `[SCORING_${i}] Group with scoring, weight ${100 + i * 50}.`,
            }),
            group: 'scoring_group',
            groupWeight: 100 + i * 50,
            useGroupScoring: true,
        };
        uid++;
    }

    return { entries };
}

// Generate entries with all position types
function generateComparisonPositions() {
    const entries = {};

    // position: 0 = before
    entries[0] = {
        ...generateEntry(0, {
            key: ['pos_before_keyword'],
            content: '[POS_BEFORE] Position=0 (before prompt).',
        }),
        position: 0,
    };

    // position: 1 = after
    entries[1] = {
        ...generateEntry(1, {
            key: ['pos_after_keyword'],
            content: '[POS_AFTER] Position=1 (after prompt).',
        }),
        position: 1,
    };

    // position: 2 = ANTop (before Author's Note)
    entries[2] = {
        ...generateEntry(2, {
            key: ['pos_antop_keyword'],
            content: '[POS_ANTOP] Position=2 (before AN).',
        }),
        position: 2,
    };

    // position: 3 = ANBottom (after Author's Note)
    entries[3] = {
        ...generateEntry(3, {
            key: ['pos_anbottom_keyword'],
            content: '[POS_ANBOTTOM] Position=3 (after AN).',
        }),
        position: 3,
    };

    // position: 4 = atDepth (with depth value)
    entries[4] = {
        ...generateEntry(4, {
            key: ['pos_atdepth_keyword'],
            content: '[POS_ATDEPTH] Position=4 (at depth 2).',
        }),
        position: 4,
        depth: 2,
    };

    // position: 5 = EMTop (in-chat example - top)
    entries[5] = {
        ...generateEntry(5, {
            key: ['pos_emtop_keyword'],
            content: '[POS_EMTOP] Position=5 (example messages top).',
        }),
        position: 5,
    };

    // position: 6 = EMBottom (in-chat example - bottom)
    entries[6] = {
        ...generateEntry(6, {
            key: ['pos_embottom_keyword'],
            content: '[POS_EMBOTTOM] Position=6 (example messages bottom).',
        }),
        position: 6,
    };

    // Multiple atDepth entries at different depths
    for (let i = 0; i < 5; i++) {
        entries[7 + i] = {
            ...generateEntry(7 + i, {
                key: [`atdepth_${i}_keyword`],
                content: `[ATDEPTH_${i}] At depth ${i}.`,
            }),
            position: 4,
            depth: i,
        };
    }

    return { entries };
}

// Generate entries that scan global data (persona, character description, etc.)
function generateComparisonGlobalScan() {
    const entries = {};

    // Matches persona description
    entries[0] = {
        ...generateEntry(0, {
            key: ['persona_match'],
            content: '[PERSONA_MATCH] Matches against persona description.',
        }),
        matchPersonaDescription: true,
    };

    // Matches character description
    entries[1] = {
        ...generateEntry(1, {
            key: ['char_desc_match'],
            content: '[CHAR_DESC_MATCH] Matches against character description.',
        }),
        matchCharacterDescription: true,
    };

    // Matches character personality
    entries[2] = {
        ...generateEntry(2, {
            key: ['char_personality_match'],
            content: '[CHAR_PERSONALITY_MATCH] Matches against character personality.',
        }),
        matchCharacterPersonality: true,
    };

    // Matches scenario
    entries[3] = {
        ...generateEntry(3, {
            key: ['scenario_match'],
            content: '[SCENARIO_MATCH] Matches against scenario.',
        }),
        matchScenario: true,
    };

    // Matches character depth prompt
    entries[4] = {
        ...generateEntry(4, {
            key: ['depth_prompt_match'],
            content: '[DEPTH_PROMPT_MATCH] Matches against character depth prompt.',
        }),
        matchCharacterDepthPrompt: true,
    };

    // Matches creator notes
    entries[5] = {
        ...generateEntry(5, {
            key: ['creator_notes_match'],
            content: '[CREATOR_NOTES_MATCH] Matches against creator notes.',
        }),
        matchCreatorNotes: true,
    };

    // Matches multiple global fields
    entries[6] = {
        ...generateEntry(6, {
            key: ['multi_global_match'],
            content: '[MULTI_GLOBAL_MATCH] Matches persona and character description.',
        }),
        matchPersonaDescription: true,
        matchCharacterDescription: true,
    };

    // Chat only (default - no global matching)
    entries[7] = generateEntry(7, {
        key: ['chat_only_match'],
        content: '[CHAT_ONLY_MATCH] Only matches chat messages.',
    });

    return { entries };
}

// Write all benchmarks
const benchmarks = {
    'Benchmark Partial Match': generatePartialMatchBenchmark(),
    'Benchmark Groups': generateGroupBenchmark(),
    'Benchmark Recursion': generateRecursionChainBenchmark(),
    'Benchmark Secondary': generateSecondaryKeysBenchmark(),
    'Benchmark Budget': generateBudgetBenchmark(),
    'Benchmark No Match': generateNoMatchBenchmark(),
    'Benchmark Regex': generateRegexBenchmark(),
};

// Comparison test lorebooks (for AC vs Legacy tests)
const comparisonBenchmarks = {
    'Comparison Constant': generateComparisonConstant(),
    'Comparison Regex': generateComparisonRegex(),
    'Comparison Case Sensitive': generateComparisonCaseSensitive(),
    'Comparison Secondary Keys': generateComparisonSecondaryKeys(),
    'Comparison Recursion': generateComparisonRecursion(),
    'Comparison Decorators': generateComparisonDecorators(),
    'Comparison Complex': generateComparisonComplex(),
    'Comparison Scan Depth': generateComparisonScanDepth(),
    'Comparison Timed Effects': generateComparisonTimedEffects(),
    'Comparison Probability': generateComparisonProbability(),
    'Comparison Groups': generateComparisonGroups(),
    'Comparison Positions': generateComparisonPositions(),
    'Comparison Global Scan': generateComparisonGlobalScan(),
    'Invalidation Test': generateInvalidationTest(),
};

// Realistic large scale benchmarks (12 matches each, simulating real usage)
const largeBenchmarks = {
    'Benchmark 100 Realistic': generateRealisticBenchmark(100, 12),
    'Benchmark 5k Realistic': generateRealisticBenchmark(5000, 12),
    'Benchmark 25k Realistic': generateRealisticBenchmark(25000, 12),
    'Benchmark 100k Realistic': generateRealisticBenchmark(100000, 12),
    // Keep no-match for baseline comparison
    'Benchmark 5k No Match': generateLargeNoMatchBenchmark(5000),
    'Benchmark 25k No Match': generateLargeNoMatchBenchmark(25000),
    'Benchmark 100k No Match': generateLargeNoMatchBenchmark(100000),
};

for (const [name, data] of Object.entries(benchmarks)) {
    const filename = join(OUTPUT_DIR, `${name}.json`);
    writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Generated: ${name}.json (${Object.keys(data.entries).length} entries)`);
}

console.log('\nGenerating comparison test lorebooks...');

for (const [name, data] of Object.entries(comparisonBenchmarks)) {
    const filename = join(OUTPUT_DIR, `${name}.json`);
    writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Generated: ${name}.json (${Object.keys(data.entries).length} entries)`);
}

console.log('\nGenerating large scale benchmarks (this may take a moment)...');

for (const [name, data] of Object.entries(largeBenchmarks)) {
    const filename = join(OUTPUT_DIR, `${name}.json`);
    // Use compact JSON for large files
    writeFileSync(filename, JSON.stringify(data));
    console.log(`Generated: ${name}.json (${Object.keys(data.entries).length} entries)`);
}

console.log('\nAll benchmark lorebooks generated successfully!');
