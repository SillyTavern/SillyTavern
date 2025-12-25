import { seedrandom, droll } from '../../../lib.js';
import { chat_metadata, main_api, getMaxContextSize, extension_prompts, getCurrentChatId } from '../../../script.js';
import { getStringHash } from '../../utils.js';
import { textgenerationwebui_banned_in_macros } from '../../textgen-settings.js';
import { inject_ids } from '../../constants.js';
import { MacroRegistry, MacroCategory, MacroValueType } from '../engine/MacroRegistry.js';

/**
 * Registers SillyTavern's core built-in macros in the MacroRegistry.
 *
 * These macros correspond to the main {{...}} macros that are available
 * in prompts (time/date/chat info, utility macros, etc.). They are
 * intended to preserve the behavior of the existing regex-based macros
 * in macros.js while using the new MacroRegistry/MacroEngine pipeline.
 */
export function registerCoreMacros() {
    // {{space}} -> ' '
    MacroRegistry.registerMacro('space', {
        category: MacroCategory.UTILITY,
        unnamedArgs: [
            {
                name: 'count',
                optional: true,
                defaultValue: '1',
                type: MacroValueType.INTEGER,
                description: 'Number of spaces to insert.',
            },
        ],
        description: 'Returns one or more spaces. One space by default, more if the count argument is specified.',
        returns: 'One or more spaces.',
        exampleUsage: ['{{space}}', '{{space::4}}'],
        handler: ({ unnamedArgs: [count] }) => ' '.repeat(Number(count ?? 1)),
    });

    // {{newline}} -> '\n'
    MacroRegistry.registerMacro('newline', {
        category: MacroCategory.UTILITY,
        unnamedArgs: [
            {
                name: 'count',
                optional: true,
                defaultValue: '1',
                type: MacroValueType.INTEGER,
                description: 'Number of newlines to insert.',
            },
        ],
        description: 'Inserts one or more newlines. One newline by default, more if the count argument is specified.',
        returns: 'One or more \\n.',
        exampleUsage: ['{{newline}}', '{{newline::2}}'],
        handler: ({ unnamedArgs: [count] }) => '\n'.repeat(Number(count ?? 1)),
    });

    // {{noop}} -> ''
    MacroRegistry.registerMacro('noop', {
        category: MacroCategory.UTILITY,
        description: 'Does nothing and produces an empty string.',
        returns: '',
        handler: () => '',
    });

    // {{trim}} -> macro will currently replace itself with itself. Trimming is handled in post-processing.
    MacroRegistry.registerMacro('trim', {
        category: MacroCategory.UTILITY,
        description: 'Trims all whitespaces around the trim macro.',
        returns: '',
        handler: () => '{{trim}}',
    });

    // {{input}} -> current textarea content
    MacroRegistry.registerMacro('input', {
        category: MacroCategory.UTILITY,
        description: 'Current text from the send textarea.',
        returns: 'Current text from the send textarea.',
        handler: () => (/** @type {HTMLTextAreaElement} */(document.querySelector('#send_textarea')))?.value ?? '',
    });

    // {{maxPrompt}} -> max context size
    MacroRegistry.registerMacro('maxPrompt', {
        category: MacroCategory.STATE,
        description: 'Maximum prompt context size.',
        returns: 'Maximum prompt context size.',
        returnType: MacroValueType.INTEGER,
        handler: () => String(getMaxContextSize()),
    });

    // String utilities
    MacroRegistry.registerMacro('reverse', {
        category: MacroCategory.UTILITY,
        unnamedArgs: [
            {
                name: 'value',
                type: MacroValueType.STRING,
                description: 'The string to reverse.',
            },
        ],
        description: 'Reverses the characters of the argument provided.',
        returns: 'Reversed string.',
        exampleUsage: ['{{reverse::I am Lana}}'],
        handler: ({ unnamedArgs: [value] }) => Array.from(value).reverse().join(''),
    });

    // Comment macro: {{// ...}} -> '' (consumes any arguments)
    MacroRegistry.registerMacro('//', {
        aliases: [{ alias: 'comment' }],
        category: MacroCategory.UTILITY,
        list: true,         // We consume any arguments as if this is a list, but we'll ignore them in the handler anyway
        strictArgs: false,  // and we also always remove it, even if the parsing might say it's invalid
        description: 'Comment macro that produces an empty string. Can be used for writing into prompt definitions, without being passed to the context.',
        returns: '',
        displayOverride: '{{// ...}}',
        exampleUsage: ['{{// This is a comment}}'],
        handler: () => '',
    });

    // Time and date macros
    // Dice roll macro: {{roll 1d6}} or {{roll: 1d6}}
    MacroRegistry.registerMacro('roll', {
        category: MacroCategory.RANDOM,
        unnamedArgs: [
            {
                name: 'formula',
                sampleValue: '1d20',
                description: 'Dice roll formula using droll syntax (e.g. 1d20).',
                type: 'string',
            },
        ],
        description: 'Rolls dice using droll syntax (e.g. {{roll 1d20}}).',
        returns: 'Dice roll result.',
        returnType: MacroValueType.INTEGER,
        exampleUsage: [
            '{{roll::1d20}}',
            '{{roll::6}}',
            '{{roll::3d6+4}}',
        ],
        handler: ({ unnamedArgs: [formula] }) => {
            // If only digits were provided, treat it as `1dX`.
            if (/^\d+$/.test(formula)) {
                formula = `1d${formula}`;
            }

            const isValid = droll.validate(formula);
            if (!isValid) {
                console.debug(`Invalid roll formula: ${formula}`);
                return '';
            }

            const result = droll.roll(formula);
            if (result === false) return '';
            return String(result.total);
        },
    });

    // Random choice macro: {{random::a::b}} or {{random a,b}}
    MacroRegistry.registerMacro('random', {
        category: MacroCategory.RANDOM,
        list: true,
        description: 'Picks a random item from a list. Will be re-rolled every time macros are resolved.',
        returns: 'Randomly selected item from the list.',
        exampleUsage: ['{{random::blonde::brown::red::black::blue}}'],
        handler: ({ list }) => {
            // Handle old legacy cases, where we have to split the list manually
            if (list.length === 1) {
                list = readSingleArgsRandomList(list[0]);
            }

            if (list.length === 0) {
                return '';
            }

            const rng = seedrandom('added entropy.', { entropy: true });
            const randomIndex = Math.floor(rng() * list.length);
            return list[randomIndex];
        },
    });

    // Deterministic choice macro: {{pick::a::b}} or {{pick a,b}}
    MacroRegistry.registerMacro('pick', {
        category: MacroCategory.RANDOM,
        list: true,
        description: 'Picks a random item from a list, but keeps the choice stable for a given chat and macro position.',
        returns: 'Stable randomly selected item from the list.',
        exampleUsage: ['{{pick::blonde::brown::red::black::blue}}'],
        handler: ({ list, range, env }) => {
            // Handle old legacy cases, where we have to split the list manually
            if (list.length === 1) {
                list = readSingleArgsRandomList(list[0]);
            }

            if (!list.length) {
                return '';
            }

            const chatIdHash = getChatIdHash();

            // Use the full original input string for deterministic behavior
            const rawContentHash = env.contentHash;

            const offset = typeof range?.startOffset === 'number' ? range.startOffset : 0;

            const combinedSeedString = `${chatIdHash}-${rawContentHash}-${offset}`;
            const finalSeed = getStringHash(combinedSeedString);
            const rng = seedrandom(String(finalSeed));
            const randomIndex = Math.floor(rng() * list.length);
            return list[randomIndex];
        },
    });

    /** @param {string} listString @return {string[]} */
    function readSingleArgsRandomList(listString) {
        // If it contains double colons, those will have precedence over comma-seperated lists.
        // This can only happen if the macro only had a single colon to introduce the list...
        // like, {{random:a::b::c}}
        if (listString.includes('::')) {
            return listString.split('::').map((/** @type {string} */ item) => item.trim());
        }
        // Otherwise, we fall back and split by commas that may be present
        return listString
            .replace(/\\,/g, '##�COMMA�##')
            .split(',')
            .map((/** @type {string} */ item) => item.trim().replace(/##�COMMA�##/g, ','));
    }

    // Banned words macro: {{banned "word"}}
    MacroRegistry.registerMacro('banned', {
        category: MacroCategory.UTILITY,
        unnamedArgs: [
            {
                name: 'word',
                sampleValue: 'word',
                description: 'Word to ban for textgenerationwebui backend.',
                type: 'string',
            },
        ],
        description: 'Bans a word for textgenerationwebui backend. (Strips quotes surrounding the banned word, if present)',
        returns: '',
        exampleUsage: ['{{banned::delve}}'],
        handler: ({ unnamedArgs: [bannedWord] }) => {
            // Strip quotes via regex, which were allowed in legacy syntax
            bannedWord = bannedWord.replace(/^"|"$/g, '');
            if (main_api === 'textgenerationwebui') {
                console.log('Found banned word in macros: ' + bannedWord);
                textgenerationwebui_banned_in_macros.push(bannedWord);
            }
            return '';
        },
    });

    // Outlet macro: {{outlet::key}}
    MacroRegistry.registerMacro('outlet', {
        category: MacroCategory.UTILITY,
        unnamedArgs: [
            {
                name: 'key',
                sampleValue: 'my-outlet-key',
                description: 'Outlet key.',
                type: 'string',
            },
        ],
        description: 'Returns the world info outlet prompt for a given outlet key.',
        returns: 'World info outlet prompt.',
        exampleUsage: ['{{outlet::character-achievements}}'],
        handler: ({ unnamedArgs: [outlet] }) => {
            if (!outlet) return '';
            const value = extension_prompts[inject_ids.CUSTOM_WI_OUTLET(outlet)]?.value;
            return value || '';
        },
    });
}

function getChatIdHash() {
    const cachedIdHash = chat_metadata['chat_id_hash'];
    if (typeof cachedIdHash === 'number') {
        return cachedIdHash;
    }

    const chatId = chat_metadata['main_chat'] ?? getCurrentChatId();
    const chatIdHash = getStringHash(chatId);
    chat_metadata['chat_id_hash'] = chatIdHash;
    return chatIdHash;
}
