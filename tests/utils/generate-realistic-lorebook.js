#!/usr/bin/env node
/**
 * Generate a truly realistic lorebook for benchmarking
 *
 * - 10,000 entries
 * - 3-8 keywords each (mix of single and multi-word)
 * - Real English words from a large vocabulary
 * - Proper prefix sharing like real lorebooks
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../.test-data/default-user/worlds');

// Large vocabulary of realistic fantasy/RP words organized by category
// This creates natural prefix sharing (all "dragon" words, all "shadow" words, etc.)
const VOCABULARY = {
    // Characters (with variations)
    characters: [
        'dragon', 'dragon lord', 'dragon rider', 'dragonborn', 'dragonkin', 'dragon priest', 'dragon slayer',
        'elf', 'elven', 'elf mage', 'elf warrior', 'high elf', 'dark elf', 'wood elf', 'elf queen',
        'dwarf', 'dwarven', 'dwarf king', 'dwarf smith', 'mountain dwarf', 'hill dwarf',
        'orc', 'orcish', 'orc chief', 'orc shaman', 'orc warrior', 'half orc',
        'human', 'humanity', 'human king', 'human mage', 'human warrior',
        'goblin', 'goblin chief', 'goblin shaman', 'hobgoblin',
        'troll', 'troll king', 'cave troll', 'forest troll',
        'giant', 'frost giant', 'fire giant', 'hill giant', 'storm giant',
        'demon', 'demon lord', 'demon prince', 'lesser demon', 'greater demon',
        'angel', 'archangel', 'fallen angel', 'guardian angel',
        'vampire', 'vampire lord', 'vampire spawn', 'ancient vampire',
        'werewolf', 'werewolf alpha', 'werewolf pack',
        'ghost', 'ghostly', 'ghost knight', 'vengeful ghost',
        'skeleton', 'skeleton warrior', 'skeleton mage', 'skeleton king',
        'zombie', 'zombie horde', 'zombie lord',
        'lich', 'lich king', 'lich lord',
        'golem', 'stone golem', 'iron golem', 'flesh golem', 'clay golem',
        'elemental', 'fire elemental', 'water elemental', 'earth elemental', 'air elemental',
        'spirit', 'nature spirit', 'ancestral spirit', 'evil spirit',
        'fairy', 'fairy queen', 'dark fairy',
        'nymph', 'water nymph', 'forest nymph',
        'centaur', 'centaur chief', 'centaur warrior',
        'minotaur', 'minotaur lord',
        'harpy', 'harpy queen',
        'medusa', 'gorgon',
        'hydra', 'hydra head',
        'phoenix', 'phoenix fire',
        'unicorn', 'unicorn horn',
        'griffin', 'griffon rider',
        'basilisk', 'cockatrice',
        'wyvern', 'wyvern rider',
        'kraken', 'sea serpent', 'leviathan',
    ],

    // Professions/Classes
    classes: [
        'knight', 'knight commander', 'knight captain', 'dark knight', 'holy knight', 'death knight',
        'wizard', 'wizard tower', 'arch wizard', 'battle wizard', 'court wizard',
        'mage', 'arch mage', 'battle mage', 'war mage', 'blood mage', 'fire mage', 'ice mage',
        'sorcerer', 'sorcerer king', 'dark sorcerer',
        'sorceress', 'enchantress',
        'warlock', 'warlock pact',
        'witch', 'witch coven', 'sea witch', 'swamp witch',
        'necromancer', 'necromancy', 'necromancer lord',
        'paladin', 'paladin order', 'fallen paladin',
        'cleric', 'high cleric', 'war cleric',
        'priest', 'high priest', 'dark priest',
        'monk', 'monk order', 'shadow monk',
        'druid', 'arch druid', 'druid circle',
        'ranger', 'ranger guild', 'forest ranger',
        'rogue', 'master rogue', 'shadow rogue',
        'assassin', 'assassin guild', 'master assassin', 'shadow assassin',
        'thief', 'master thief', 'thieves guild',
        'bard', 'master bard', 'bard college',
        'warrior', 'warrior chief', 'elite warrior',
        'soldier', 'soldier captain', 'veteran soldier',
        'guard', 'guard captain', 'palace guard', 'city guard', 'night guard',
        'archer', 'master archer', 'elven archer',
        'hunter', 'monster hunter', 'bounty hunter', 'witch hunter',
        'mercenary', 'mercenary captain', 'mercenary guild',
        'gladiator', 'gladiator champion',
        'berserker', 'berserker rage',
        'barbarian', 'barbarian chief', 'barbarian horde',
        'samurai', 'ronin',
        'ninja', 'ninja clan',
        'pirate', 'pirate captain', 'pirate king',
        'sailor', 'ship captain',
        'blacksmith', 'master smith', 'weapon smith', 'armor smith',
        'alchemist', 'master alchemist',
        'healer', 'master healer', 'battlefield healer',
        'scholar', 'royal scholar',
        'sage', 'elder sage',
        'merchant', 'merchant guild', 'traveling merchant',
        'innkeeper', 'tavern keeper',
        'farmer', 'village elder',
        'noble', 'nobleman', 'noblewoman',
        'king', 'high king', 'king of',
        'queen', 'queen of', 'queen mother',
        'prince', 'crown prince', 'dark prince',
        'princess', 'princess of',
        'lord', 'high lord', 'dark lord', 'lord of',
        'lady', 'high lady', 'lady of',
        'duke', 'duchess',
        'count', 'countess',
        'baron', 'baroness',
        'emperor', 'empress',
    ],

    // Locations
    locations: [
        'castle', 'castle gate', 'castle wall', 'castle tower', 'ruined castle', 'haunted castle',
        'fortress', 'mountain fortress', 'dark fortress',
        'tower', 'wizard tower', 'dark tower', 'watch tower', 'bell tower', 'ivory tower',
        'dungeon', 'dungeon depths', 'dungeon master', 'dungeon entrance',
        'cave', 'dark cave', 'crystal cave', 'ice cave', 'dragon cave',
        'cavern', 'underground cavern', 'crystal cavern',
        'mine', 'abandoned mine', 'gold mine', 'silver mine', 'dwarf mine',
        'temple', 'ancient temple', 'ruined temple', 'dark temple', 'holy temple',
        'shrine', 'forest shrine', 'mountain shrine', 'ancient shrine',
        'church', 'abandoned church', 'village church',
        'cathedral', 'grand cathedral',
        'monastery', 'mountain monastery', 'hidden monastery',
        'library', 'ancient library', 'forbidden library', 'grand library',
        'academy', 'magic academy', 'knight academy',
        'palace', 'royal palace', 'ice palace', 'crystal palace',
        'throne', 'throne room', 'iron throne',
        'guild', 'guild hall', 'thieves guild', 'merchant guild', 'mage guild',
        'tavern', 'village tavern', 'roadside tavern',
        'inn', 'crossroads inn', 'forest inn',
        'market', 'black market', 'market square', 'night market',
        'village', 'fishing village', 'mountain village', 'hidden village',
        'town', 'port town', 'border town', 'ghost town',
        'city', 'capital city', 'port city', 'holy city', 'lost city', 'underground city',
        'kingdom', 'lost kingdom', 'fallen kingdom', 'northern kingdom', 'southern kingdom',
        'empire', 'fallen empire', 'ancient empire',
        'realm', 'shadow realm', 'spirit realm', 'demon realm',
        'forest', 'dark forest', 'enchanted forest', 'forbidden forest', 'ancient forest',
        'woods', 'haunted woods', 'deep woods',
        'jungle', 'lost jungle', 'ancient jungle',
        'swamp', 'cursed swamp', 'dead swamp',
        'marsh', 'foggy marsh',
        'mountain', 'sacred mountain', 'cursed mountain', 'dragon mountain',
        'peak', 'frozen peak', 'mountain peak',
        'valley', 'hidden valley', 'death valley', 'shadow valley',
        'canyon', 'grand canyon',
        'cliff', 'sea cliff', 'mountain cliff',
        'river', 'sacred river', 'blood river', 'frozen river',
        'lake', 'crystal lake', 'cursed lake', 'sacred lake',
        'ocean', 'endless ocean', 'dark ocean',
        'sea', 'frozen sea', 'dead sea',
        'island', 'mysterious island', 'prison island', 'treasure island',
        'desert', 'endless desert', 'cursed desert',
        'wasteland', 'frozen wasteland', 'barren wasteland',
        'plains', 'endless plains', 'battle plains',
        'field', 'battle field', 'wheat field',
        'road', 'king road', 'trade road', 'ancient road',
        'path', 'forest path', 'mountain path', 'hidden path',
        'bridge', 'stone bridge', 'rope bridge', 'broken bridge',
        'gate', 'city gate', 'castle gate', 'hell gate', 'portal gate',
        'portal', 'magic portal', 'demon portal',
        'graveyard', 'ancient graveyard', 'haunted graveyard',
        'cemetery', 'forgotten cemetery',
        'crypt', 'royal crypt', 'ancient crypt',
        'tomb', 'royal tomb', 'ancient tomb', 'cursed tomb',
        'ruins', 'ancient ruins', 'temple ruins', 'castle ruins',
    ],

    // Items/Objects
    items: [
        'sword', 'holy sword', 'cursed sword', 'fire sword', 'ice sword', 'demon sword',
        'blade', 'shadow blade', 'moon blade', 'sun blade',
        'dagger', 'poison dagger', 'assassin dagger', 'ritual dagger',
        'axe', 'battle axe', 'war axe', 'dwarven axe',
        'hammer', 'war hammer', 'thunder hammer',
        'mace', 'holy mace', 'spiked mace',
        'spear', 'dragon spear', 'holy spear',
        'lance', 'knight lance', 'dragon lance',
        'bow', 'long bow', 'elven bow', 'hunting bow',
        'crossbow', 'heavy crossbow',
        'arrow', 'fire arrow', 'poison arrow', 'silver arrow',
        'staff', 'wizard staff', 'dragon staff', 'holy staff',
        'wand', 'magic wand', 'elder wand',
        'rod', 'lightning rod', 'iron rod',
        'shield', 'tower shield', 'magic shield', 'dragon shield',
        'armor', 'plate armor', 'dragon armor', 'holy armor', 'cursed armor',
        'helmet', 'dragon helmet', 'horned helmet',
        'helm', 'great helm', 'demon helm',
        'gauntlet', 'power gauntlet', 'iron gauntlet',
        'boots', 'speed boots', 'iron boots',
        'cloak', 'invisibility cloak', 'shadow cloak', 'royal cloak',
        'robe', 'wizard robe', 'priest robe', 'royal robe',
        'ring', 'magic ring', 'cursed ring', 'power ring', 'wedding ring',
        'amulet', 'protection amulet', 'cursed amulet', 'holy amulet',
        'necklace', 'pearl necklace', 'ruby necklace',
        'crown', 'royal crown', 'iron crown', 'cursed crown',
        'scepter', 'royal scepter', 'power scepter',
        'orb', 'crystal orb', 'power orb', 'seeing orb',
        'gem', 'power gem', 'soul gem', 'fire gem', 'ice gem',
        'crystal', 'magic crystal', 'dark crystal', 'healing crystal',
        'stone', 'power stone', 'soul stone', 'moon stone', 'sun stone',
        'potion', 'healing potion', 'mana potion', 'strength potion', 'invisibility potion',
        'elixir', 'life elixir', 'immortality elixir',
        'scroll', 'magic scroll', 'ancient scroll', 'forbidden scroll',
        'tome', 'ancient tome', 'forbidden tome', 'spell tome',
        'book', 'spell book', 'ancient book', 'forbidden book',
        'map', 'treasure map', 'ancient map', 'world map',
        'key', 'skeleton key', 'master key', 'ancient key', 'golden key',
        'chest', 'treasure chest', 'locked chest', 'cursed chest',
        'coin', 'gold coin', 'silver coin', 'ancient coin',
        'gold', 'gold bar', 'gold dust',
        'silver', 'silver bar', 'silver dust',
        'treasure', 'dragon treasure', 'pirate treasure', 'lost treasure',
        'artifact', 'ancient artifact', 'cursed artifact', 'holy artifact',
        'relic', 'holy relic', 'cursed relic', 'ancient relic',
        'charm', 'luck charm', 'protection charm',
        'talisman', 'power talisman', 'protection talisman',
        'idol', 'golden idol', 'cursed idol',
        'mirror', 'magic mirror', 'cursed mirror',
        'lantern', 'magic lantern', 'ghost lantern',
        'torch', 'eternal torch',
        'candle', 'magic candle', 'cursed candle',
        'rope', 'magic rope', 'climbing rope',
        'chain', 'magic chain', 'cursed chain',
    ],

    // Magic/Abilities
    magic: [
        'magic', 'dark magic', 'light magic', 'blood magic', 'forbidden magic', 'ancient magic',
        'spell', 'fire spell', 'ice spell', 'lightning spell', 'healing spell', 'death spell',
        'curse', 'ancient curse', 'blood curse', 'death curse',
        'blessing', 'divine blessing', 'holy blessing',
        'enchantment', 'powerful enchantment', 'ancient enchantment',
        'ritual', 'dark ritual', 'blood ritual', 'summoning ritual',
        'incantation', 'ancient incantation',
        'summoning', 'demon summoning', 'spirit summoning',
        'conjuration', 'elemental conjuration',
        'necromancy', 'forbidden necromancy',
        'divination', 'ancient divination',
        'illusion', 'powerful illusion', 'mind illusion',
        'transmutation', 'forbidden transmutation',
        'evocation', 'fire evocation',
        'abjuration', 'protective abjuration',
        'fire', 'dragon fire', 'hell fire', 'sacred fire',
        'flame', 'eternal flame', 'dark flame',
        'ice', 'eternal ice', 'cursed ice',
        'frost', 'killing frost', 'deep frost',
        'lightning', 'chain lightning', 'thunder',
        'thunder', 'rolling thunder',
        'storm', 'ice storm', 'fire storm', 'thunder storm',
        'wind', 'howling wind', 'cutting wind',
        'water', 'holy water', 'cursed water',
        'earth', 'sacred earth',
        'light', 'holy light', 'divine light', 'blinding light',
        'darkness', 'eternal darkness', 'consuming darkness',
        'shadow', 'living shadow', 'death shadow',
        'void', 'endless void', 'dark void',
        'life', 'life force', 'life energy',
        'death', 'instant death', 'slow death',
        'soul', 'lost soul', 'trapped soul', 'soul bind',
        'mind', 'mind control', 'mind read',
        'time', 'time stop', 'time travel',
        'space', 'space tear', 'space warp',
        'healing', 'divine healing', 'mass healing',
        'resurrection', 'dark resurrection',
        'transformation', 'beast transformation',
        'teleportation', 'mass teleportation',
        'invisibility', 'greater invisibility',
        'flight', 'magical flight',
        'barrier', 'magic barrier', 'protective barrier',
        'shield', 'magic shield', 'fire shield', 'ice shield',
        'ward', 'protective ward', 'death ward',
        'seal', 'demon seal', 'magic seal',
        'bind', 'soul bind', 'demon bind',
        'banish', 'demon banish', 'spirit banish',
        'purify', 'holy purify', 'soul purify',
        'corrupt', 'soul corrupt', 'mind corrupt',
    ],

    // Actions/Events
    actions: [
        'battle', 'final battle', 'great battle', 'epic battle',
        'war', 'civil war', 'holy war', 'great war',
        'fight', 'death fight', 'honor fight',
        'duel', 'wizard duel', 'sword duel',
        'siege', 'castle siege', 'city siege',
        'invasion', 'demon invasion', 'orc invasion',
        'raid', 'pirate raid', 'bandit raid',
        'attack', 'surprise attack', 'night attack',
        'defense', 'last defense', 'city defense',
        'retreat', 'strategic retreat',
        'victory', 'great victory', 'pyrrhic victory',
        'defeat', 'crushing defeat', 'final defeat',
        'quest', 'holy quest', 'epic quest', 'side quest',
        'mission', 'secret mission', 'rescue mission',
        'adventure', 'great adventure', 'final adventure',
        'journey', 'long journey', 'perilous journey',
        'expedition', 'arctic expedition', 'jungle expedition',
        'hunt', 'monster hunt', 'witch hunt', 'treasure hunt',
        'search', 'desperate search', 'endless search',
        'rescue', 'daring rescue', 'princess rescue',
        'escape', 'prison escape', 'narrow escape',
        'chase', 'wild chase',
        'ambush', 'orc ambush', 'bandit ambush',
        'assassination', 'failed assassination',
        'betrayal', 'great betrayal', 'unexpected betrayal',
        'alliance', 'unholy alliance', 'temporary alliance',
        'treaty', 'peace treaty', 'broken treaty',
        'coronation', 'royal coronation',
        'wedding', 'royal wedding',
        'funeral', 'royal funeral', 'mass funeral',
        'festival', 'harvest festival', 'spring festival',
        'celebration', 'victory celebration',
        'ritual', 'dark ritual', 'ancient ritual',
        'ceremony', 'sacred ceremony',
        'sacrifice', 'blood sacrifice', 'human sacrifice',
        'summoning', 'demon summoning',
        'prophecy', 'ancient prophecy', 'dark prophecy',
        'vision', 'prophetic vision', 'dark vision',
        'dream', 'prophetic dream', 'nightmare',
        'nightmare', 'living nightmare',
        'curse', 'ancient curse', 'family curse',
        'blessing', 'divine blessing',
        'miracle', 'divine miracle',
        'disaster', 'natural disaster',
        'plague', 'deadly plague', 'undead plague',
        'famine', 'great famine',
        'flood', 'great flood',
        'earthquake', 'devastating earthquake',
        'storm', 'great storm', 'magic storm',
        'eclipse', 'solar eclipse', 'blood eclipse',
    ],

    // Concepts/Abstract
    concepts: [
        'power', 'ultimate power', 'dark power', 'divine power',
        'strength', 'inner strength', 'divine strength',
        'wisdom', 'ancient wisdom', 'divine wisdom',
        'knowledge', 'forbidden knowledge', 'ancient knowledge',
        'truth', 'hidden truth', 'ultimate truth',
        'secret', 'dark secret', 'ancient secret',
        'mystery', 'ancient mystery', 'unsolved mystery',
        'legend', 'ancient legend', 'living legend',
        'myth', 'ancient myth',
        'prophecy', 'ancient prophecy',
        'destiny', 'dark destiny', 'true destiny',
        'fate', 'cruel fate', 'twisted fate',
        'honor', 'lost honor', 'family honor',
        'glory', 'eternal glory', 'faded glory',
        'fame', 'legendary fame',
        'revenge', 'sweet revenge', 'bloody revenge',
        'justice', 'divine justice', 'dark justice',
        'mercy', 'divine mercy',
        'love', 'true love', 'forbidden love', 'lost love',
        'hate', 'eternal hate', 'burning hate',
        'fear', 'primal fear', 'mortal fear',
        'courage', 'true courage', 'foolish courage',
        'hope', 'last hope', 'false hope',
        'despair', 'utter despair', 'eternal despair',
        'faith', 'blind faith', 'lost faith',
        'doubt', 'growing doubt',
        'trust', 'broken trust', 'blind trust',
        'loyalty', 'eternal loyalty', 'blind loyalty',
        'treachery', 'great treachery',
        'greed', 'endless greed',
        'pride', 'false pride', 'wounded pride',
        'envy', 'burning envy',
        'wrath', 'divine wrath', 'terrible wrath',
        'sin', 'mortal sin', 'original sin',
        'virtue', 'lost virtue',
        'evil', 'pure evil', 'ancient evil',
        'good', 'greater good',
        'chaos', 'pure chaos', 'spreading chaos',
        'order', 'divine order', 'natural order',
        'balance', 'cosmic balance', 'lost balance',
        'death', 'sudden death', 'slow death',
        'life', 'eternal life', 'new life',
        'rebirth', 'spiritual rebirth',
        'immortality', 'cursed immortality',
        'mortality', 'fragile mortality',
    ],
};

// Flatten all keywords into a single array
const ALL_KEYWORDS = Object.values(VOCABULARY).flat();
console.log(`Total unique keywords: ${ALL_KEYWORDS.length}`);

function generateEntry(uid, keywords) {
    return {
        uid,
        key: keywords,
        keysecondary: [],
        comment: `Entry ${uid}: ${keywords[0]}`,
        content: `[ENTRY_${uid}] Lore about ${keywords.join(', ')}. This provides detailed information about these topics in the world setting.`,
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

function generateRealisticLorebook(entryCount) {
    const entries = {};
    const keywordCount = ALL_KEYWORDS.length;

    for (let i = 0; i < entryCount; i++) {
        // Each entry gets 3-8 keywords
        const numKeywords = 3 + Math.floor(Math.random() * 6);
        const keywords = [];

        // Pick keywords from random positions to ensure variety
        // but with some locality to simulate themed entries
        const baseIdx = Math.floor(Math.random() * keywordCount);
        for (let k = 0; k < numKeywords; k++) {
            // Mix of nearby (themed) and random keywords
            const idx = k < 2
                ? (baseIdx + k) % keywordCount  // First 2 are themed/related
                : Math.floor(Math.random() * keywordCount);  // Rest are random
            keywords.push(ALL_KEYWORDS[idx]);
        }

        entries[i] = generateEntry(i, keywords);
    }

    return { entries };
}

// Generate the realistic lorebook
console.log('Generating 10k realistic lorebook...');
const lorebook10k = generateRealisticLorebook(10000);
writeFileSync(
    join(OUTPUT_DIR, 'Benchmark 10k Realistic Words.json'),
    JSON.stringify(lorebook10k),
);
console.log('Generated: Benchmark 10k Realistic Words.json');

console.log('Generating 25k realistic lorebook...');
const lorebook25k = generateRealisticLorebook(25000);
writeFileSync(
    join(OUTPUT_DIR, 'Benchmark 25k Realistic Words.json'),
    JSON.stringify(lorebook25k),
);
console.log('Generated: Benchmark 25k Realistic Words.json');

console.log('\nDone! Keywords per entry: 3-8');
console.log(`Total unique keywords in vocabulary: ${ALL_KEYWORDS.length}`);
