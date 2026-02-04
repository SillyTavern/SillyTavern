import { test } from '@playwright/test';

// Common fantasy/RPG words that would appear in real lorebooks
const REALISTIC_KEYWORDS = [
    // Characters & Races
    'dragon', 'dragonborn', 'dragonfire', 'dragonflight', 'dragonlord',
    'elf', 'elven', 'elvenkind', 'elfish', 'elfstone',
    'dwarf', 'dwarven', 'dwarfhold', 'dwarfish',
    'orc', 'orcish', 'orc chieftain', 'orc warband',
    'human', 'humanity', 'humankind',
    'wizard', 'wizardry', 'wizard tower', 'wizard staff',
    'knight', 'knighthood', 'knight commander', 'knight errant',
    'king', 'kingdom', 'kingship', 'king\'s guard',
    'queen', 'queenship', 'queen\'s court',
    'prince', 'princess', 'princeling',
    'lord', 'lordship', 'lord commander',
    'lady', 'ladyship',
    'warrior', 'warband', 'warlord', 'warcraft',
    'mage', 'magic', 'magical', 'magician', 'mage tower',
    'sorcerer', 'sorcery', 'sorceress',
    'paladin', 'paladinhood',
    'ranger', 'rangerhood',
    'rogue', 'roguish',
    'bard', 'bardic', 'bard college',
    'cleric', 'clergy',
    'monk', 'monastery', 'monastic',
    'druid', 'druidic', 'druid circle',
    'barbarian', 'barbaric',
    'assassin', 'assassination',
    'thief', 'thieves guild',
    'merchant', 'merchant guild',
    'blacksmith', 'smith', 'smithy',
    'innkeeper', 'tavern', 'tavern keeper',
    'guard', 'guardsman', 'guard captain',
    'soldier', 'soldiery',
    'archer', 'archery',
    'healer', 'healing', 'heal',

    // Locations
    'castle', 'castle wall', 'castle gate', 'castle tower',
    'tower', 'tower of', 'watchtower',
    'dungeon', 'dungeon master', 'dungeon keeper',
    'forest', 'forest path', 'dark forest', 'enchanted forest',
    'mountain', 'mountain pass', 'mountain peak', 'mountain range',
    'river', 'riverbank', 'river crossing',
    'lake', 'lakeside', 'lake town',
    'ocean', 'oceanside', 'ocean voyage',
    'cave', 'cavern', 'cave system',
    'temple', 'temple of', 'ancient temple',
    'shrine', 'shrine of',
    'village', 'villager', 'village square',
    'town', 'township', 'town square', 'town hall',
    'city', 'cityscape', 'city gate', 'city wall',
    'capital', 'capital city',
    'palace', 'palace guard', 'royal palace',
    'throne', 'throne room', 'throne hall',
    'guild', 'guild hall', 'guild master',
    'academy', 'academy of',
    'library', 'ancient library',
    'crypt', 'cryptkeeper',
    'graveyard', 'cemetery',
    'market', 'marketplace', 'market square',
    'harbor', 'port', 'port city',
    'bridge', 'drawbridge', 'stone bridge',
    'road', 'roadside', 'king\'s road',
    'path', 'pathway', 'forest path',
    'inn', 'roadside inn',

    // Items & Objects
    'sword', 'swordsman', 'sword of', 'longsword', 'shortsword', 'greatsword',
    'shield', 'shieldmaiden', 'shield wall',
    'armor', 'armored', 'plate armor', 'chain armor',
    'helm', 'helmet', 'great helm',
    'bow', 'bowstring', 'longbow', 'shortbow', 'crossbow',
    'arrow', 'arrowhead', 'quiver',
    'staff', 'wizard staff', 'quarterstaff',
    'wand', 'magic wand',
    'ring', 'ring of', 'magic ring',
    'amulet', 'amulet of',
    'potion', 'potion of', 'healing potion', 'mana potion',
    'scroll', 'scroll of', 'ancient scroll',
    'book', 'spellbook', 'ancient book', 'tome',
    'gem', 'gemstone', 'precious gem',
    'gold', 'golden', 'gold coin',
    'silver', 'silvery', 'silver coin',
    'copper', 'copper coin',
    'treasure', 'treasure chest', 'treasure hoard',
    'artifact', 'ancient artifact',
    'relic', 'holy relic',
    'crown', 'royal crown',
    'scepter', 'royal scepter',
    'orb', 'crystal orb',
    'crystal', 'crystal ball',
    'key', 'ancient key', 'master key',
    'lock', 'locked', 'lockpick',
    'chest', 'treasure chest', 'wooden chest',
    'door', 'doorway', 'secret door',
    'gate', 'gateway', 'city gate',
    'torch', 'torchlight',
    'lantern', 'lantern light',
    'rope', 'climbing rope',
    'map', 'treasure map', 'ancient map',

    // Magic & Abilities
    'spell', 'spellcast', 'spellcaster', 'spell component',
    'curse', 'cursed', 'curse of',
    'blessing', 'blessed', 'blessing of',
    'enchant', 'enchanted', 'enchantment',
    'summon', 'summoning', 'summoner',
    'conjure', 'conjuration', 'conjurer',
    'illusion', 'illusionist', 'illusory',
    'necromancy', 'necromancer', 'necromantic',
    'divination', 'diviner',
    'transmutation', 'transmuter',
    'evocation', 'evoker',
    'abjuration', 'abjurer',
    'fire', 'fireball', 'fire spell', 'flame',
    'ice', 'ice spell', 'frozen', 'frost',
    'lightning', 'lightning bolt', 'thunder',
    'earth', 'earthquake', 'stone',
    'water', 'water spell', 'wave',
    'wind', 'windstorm', 'gust',
    'light', 'holy light', 'radiant',
    'dark', 'darkness', 'shadow', 'shadowy',
    'life', 'lifeforce', 'living',
    'death', 'deathly', 'undead',
    'soul', 'soulless', 'soul gem',
    'spirit', 'spiritual', 'spirit realm',
    'demon', 'demonic', 'demon lord',
    'angel', 'angelic', 'archangel',
    'god', 'goddess', 'godly', 'divine',
    'devil', 'devilish',
    'vampire', 'vampiric',
    'werewolf', 'lycanthrope',
    'ghost', 'ghostly', 'phantom',
    'skeleton', 'skeletal',
    'zombie', 'zombified',
    'golem', 'stone golem', 'iron golem',
    'elemental', 'fire elemental', 'water elemental',

    // Actions & Events
    'battle', 'battlefield', 'battle cry',
    'war', 'warfare', 'wartime',
    'fight', 'fighter', 'fighting',
    'attack', 'attacker', 'attacking',
    'defend', 'defender', 'defense',
    'quest', 'questgiver', 'side quest', 'main quest',
    'adventure', 'adventurer', 'adventuring',
    'journey', 'journeyman',
    'travel', 'traveler', 'traveling',
    'hunt', 'hunter', 'hunting',
    'explore', 'explorer', 'exploration',
    'discover', 'discovery',
    'find', 'finder',
    'search', 'searching',
    'rescue', 'rescuer',
    'save', 'savior',
    'protect', 'protector', 'protection',
    'destroy', 'destroyer', 'destruction',
    'create', 'creator', 'creation',
    'build', 'builder', 'building',
    'craft', 'crafter', 'crafting',
    'forge', 'forging', 'forged',
    'trade', 'trader', 'trading',
    'steal', 'stealer', 'stealing',
    'kill', 'killer', 'killing',
    'murder', 'murderer',
    'betray', 'betrayal', 'betrayer',
    'ally', 'alliance', 'allied',
    'enemy', 'enemies', 'enmity',
    'friend', 'friendship', 'friendly',
    'love', 'lover', 'loving',
    'hate', 'hatred', 'hating',
    'fear', 'fearful', 'fearless',
    'courage', 'courageous',
    'honor', 'honorable', 'honored',
    'glory', 'glorious',
    'victory', 'victorious', 'victor',
    'defeat', 'defeated',
    'death', 'dead', 'dying',
    'birth', 'born', 'newborn',
    'marriage', 'married', 'wedding',
    'coronation', 'crowned',
    'funeral', 'burial',
    'feast', 'feasting', 'banquet',
    'celebration', 'celebrate',
    'ritual', 'ritualistic',
    'ceremony', 'ceremonial',
    'prophecy', 'prophetic', 'prophet',
    'legend', 'legendary', 'legends',
    'myth', 'mythical', 'mythology',
    'history', 'historical', 'ancient history',
    'secret', 'secretly', 'hidden secret',
    'mystery', 'mysterious', 'mystical',
];

// Generate realistic chat text that would appear in an RP
function generateRealisticChat(wordCount) {
    const sentences = [
        'The dragon soared over the mountain peaks, its scales glinting in the sunlight.',
        'The elven ranger crept through the dark forest, bow at the ready.',
        'In the kingdom\'s capital, the king held court with his advisors.',
        'The wizard\'s tower stood alone on the cliff, overlooking the stormy ocean.',
        'A group of adventurers gathered at the tavern, planning their next quest.',
        'The knight drew his longsword and faced the orc warband.',
        'Ancient magic filled the temple as the cleric performed the ritual.',
        'The thief slipped through the shadows of the castle wall.',
        'Fire and lightning clashed as the two sorcerers dueled.',
        'The dwarven blacksmith hammered at his forge, creating a legendary blade.',
        'Princess Elena fled through the palace gardens, guards in pursuit.',
        'The necromancer raised an army of undead from the ancient graveyard.',
        'A mysterious stranger arrived at the village, cloaked in shadow.',
        'The merchant caravan traveled the dangerous road to the port city.',
        'Deep in the dungeon, treasure awaited those brave enough to seek it.',
        'The paladin\'s holy light banished the demonic presence.',
        'War drums echoed across the battlefield as armies clashed.',
        'The bard sang tales of legendary heroes and their glorious victories.',
        'A secret door revealed a hidden passage beneath the throne room.',
        'The healing potion restored the warrior\'s strength for the final battle.',
    ];

    let text = '';
    let currentWords = 0;
    while (currentWords < wordCount) {
        const sentence = sentences[Math.floor(Math.random() * sentences.length)];
        text += sentence + ' ';
        currentWords += sentence.split(' ').length;
    }
    return text.trim();
}

// Create a realistic lorebook entry
function createRealisticEntry(uid, worldName) {
    // Pick 3-8 related keywords
    const numKeywords = 3 + Math.floor(Math.random() * 6);
    const startIdx = Math.floor(Math.random() * (REALISTIC_KEYWORDS.length - numKeywords));
    const keywords = REALISTIC_KEYWORDS.slice(startIdx, startIdx + numKeywords);

    return {
        uid,
        key: keywords,
        keysecondary: [],
        content: `Lore about ${keywords[0]}: This is detailed information about ${keywords.join(', ')}.`,
        comment: `Entry for ${keywords[0]}`,
        constant: false,
        selective: true,
        selectiveLogic: 0,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: false,
        probability: 100,
        useProbability: false,
        group: '',
        groupOverride: false,
        groupWeight: 100,
        scanDepth: null,
        caseSensitive: null,
        matchWholeWords: null,
        useGroupScoring: null,
        automationId: '',
        role: 0,
        sticky: null,
        cooldown: null,
        delay: null,
        depth: 4,
        world: worldName,
        decorators: [],
    };
}

// Create lorebook with realistic entries
function createRealisticLorebook(name, entryCount) {
    const entries = {};
    for (let i = 0; i < entryCount; i++) {
        entries[i] = createRealisticEntry(i, name);
    }
    return { entries };
}

test.describe('Realistic Lorebook Benchmark', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#world_info_button', { state: 'visible', timeout: 10000 });
    });

    test('10k entries with realistic keywords and chat', async ({ page }) => {
        // Create realistic lorebook
        const lorebook = createRealisticLorebook('realistic_test', 10000);

        // Create realistic chat (4 messages x 250 words each)
        const chat = [
            generateRealisticChat(250),
            generateRealisticChat(250),
            generateRealisticChat(250),
            generateRealisticChat(250),
        ];

        // Run the scan
        const result = await page.evaluate(async ({ lorebook, chat }) => {
            const { checkWorldInfo } = await import('/scripts/world-info/scanning/index.js');

            // Register the lorebook
            // eslint-disable-next-line no-undef
            window.worldInfoMap = window.worldInfoMap || new Map();
            // eslint-disable-next-line no-undef
            window.worldInfoMap.set('realistic_test', lorebook);

            // Warm up
            await checkWorldInfo(chat.slice(0, 1), 8000, true, { trigger: 'normal' });

            // Time the actual run
            const start = performance.now();
            const activated = await checkWorldInfo(chat, 8000, true, {
                trigger: 'normal',
                personaDescription: '',
                characterDescription: 'A brave knight serving the kingdom.',
                characterPersonality: '',
                characterDepthPrompt: '',
                scenario: '',
                creatorNotes: '',
            });
            const elapsed = performance.now() - start;

            return {
                elapsed: elapsed.toFixed(2),
                activatedCount: activated.allActivatedEntries?.size || 0,
            };
        }, { lorebook, chat });

        console.log(`10k Realistic Keywords: ${result.elapsed}ms, activated: ${result.activatedCount}`);
        console.log(`  [PERF] 10k realistic keywords: ${(parseFloat(result.elapsed) / 1000).toFixed(2)}s`);
    });

    test('25k entries with realistic keywords and chat', async ({ page }) => {
        const lorebook = createRealisticLorebook('realistic_test_25k', 25000);
        const chat = [
            generateRealisticChat(250),
            generateRealisticChat(250),
            generateRealisticChat(250),
            generateRealisticChat(250),
        ];

        const result = await page.evaluate(async ({ lorebook, chat }) => {
            const { checkWorldInfo } = await import('/scripts/world-info/scanning/index.js');

            // eslint-disable-next-line no-undef
            window.worldInfoMap = window.worldInfoMap || new Map();
            // eslint-disable-next-line no-undef
            window.worldInfoMap.set('realistic_test_25k', lorebook);

            const start = performance.now();
            const activated = await checkWorldInfo(chat, 8000, true, {
                trigger: 'normal',
                personaDescription: '',
                characterDescription: 'A brave knight serving the kingdom.',
                characterPersonality: '',
                characterDepthPrompt: '',
                scenario: '',
                creatorNotes: '',
            });
            const elapsed = performance.now() - start;

            return {
                elapsed: elapsed.toFixed(2),
                activatedCount: activated.allActivatedEntries?.size || 0,
            };
        }, { lorebook, chat });

        console.log(`25k Realistic Keywords: ${result.elapsed}ms, activated: ${result.activatedCount}`);
        console.log(`  [PERF] 25k realistic keywords: ${(parseFloat(result.elapsed) / 1000).toFixed(2)}s`);
    });
});
