import { seedrandom, droll } from '../../../lib.js';
import { chat_metadata, main_api, getMaxContextSize, extension_prompts, getCurrentChatId } from '../../../script.js';
import { getStringHash, isFalseBoolean } from '../../utils.js';
import { textgenerationwebui_banned_in_macros } from '../../textgen-settings.js';
import { inject_ids } from '../../constants.js';
import { MacroRegistry, MacroCategory, MacroValueType } from '../engine/MacroRegistry.js';
import { MACRO_VARIABLE_SHORTHAND_PATTERN } from '../engine/MacroLexer.js';
import { MacroParser } from '../engine/MacroParser.js';
import { MacroCstWalker } from '../engine/MacroCstWalker.js';

/**
 * Marker used by {{else}} to split content in {{if}} blocks.
 * Uses control characters to minimize collision with real content.
 *
 * This marker is used internally by the macro engine to separate if/else branches.
 * It should never appear in user-generated content.
 *
 * @type {string}
 */
export const ELSE_MARKER = '\u0000\u001FELSE\u001F\u0000';

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
    // Scoped: {{trim}}content{{/trim}} -> trims whitespace from content (handled by engine auto-trim)
    MacroRegistry.registerMacro('trim', {
        category: MacroCategory.UTILITY,
        description: 'Trims whitespace. Non-scoped: trims newlines around the macro (post-processing). Scoped: returns the content (auto-trimmed by the engine).',
        unnamedArgs: [
            {
                name: 'content',
                description: 'Content to trim (when used as scoped macro)',
                optional: true,
            },
        ],
        returns: '',
        handler: ({ unnamedArgs: [content], isScoped }) => {
            // Scoped usage: return content (already auto-trimmed by the engine)
            if (isScoped) return content ?? '';
            // Non-scoped: return marker for post-processing regex
            return '{{trim}}';
        },
    });

    /**
     * Splits raw content on the first {{else}} macro at nesting depth 0.
     * Tracks scoped {{if}}/{{/if}} pairs to find the correct top-level else.
     * Only {{if}} with 1 argument (condition only) are considered scoped blocks.
     *
     * @param {string} content - The raw content to split
     * @returns {{ thenBranch: string, elseBranch: string | undefined }}
     */
    function splitOnTopLevelElse(content) {
        const { cst } = MacroParser.parseDocument(content);
        const macroNodes = /** @type {import('chevrotain').CstNode[]} */ (cst?.children?.macro || []);

        let depth = 0;
        for (const macroNode of macroNodes) {
            const info = MacroCstWalker.extractMacroInfo(macroNode);
            if (!info) continue;

            // Only track scoped {{if}} blocks (1 arg = condition only, expects {{/if}})
            // Inline {{if condition::content}} has 2 args and doesn't affect depth
            if (info.name === 'if' && !info.isClosing && info.argCount === 1) {
                depth++;
            } else if (info.name === 'if' && info.isClosing) {
                depth--;
            } else if (info.name === 'else' && depth === 0) {
                return {
                    thenBranch: content.slice(0, info.startOffset),
                    elseBranch: content.slice(info.endOffset + 1),
                };
            }
        }

        return { thenBranch: content, elseBranch: undefined };
    }

    // {{if condition}}content{{/if}} -> conditional content
    // {{if condition}}then-content{{else}}else-content{{/if}} -> conditional with else branch
    // {{if !condition}}content{{/if}} -> inverted conditional (negated)
    // Condition can be a macro name (resolved automatically), variable shorthand (.var or $var), or any value
    MacroRegistry.registerMacro('if', {
        category: MacroCategory.UTILITY,
        description: 'Conditional macro. Returns the content if the condition is truthy, otherwise returns nothing (or the else branch if present). Prefix the condition with ! to invert. If the condition is a registered macro name (without braces), it will be resolved first. Variable shorthands (.varname for local, $varname for global) are also supported.',
        unnamedArgs: [
            {
                name: 'condition',
                description: 'The condition to evaluate. Prefix with ! to invert. Can be a macro name (auto-resolved), variable shorthand (.var or $var), or a value. Falsy: empty string, "false", "off", "0".',
            },
            {
                name: 'content',
                description: 'The content to return if condition is truthy (typically provided as scoped content). May contain {{else}} to define an else branch.',
            },
        ],
        displayOverride: '{{if condition}}then{{else}}other{{/if}}',
        exampleUsage: [
            '{{if description}}# Description\n{{description}}{{/if}}',
            '{{if charVersion}}{{charVersion}}{{else}}No version{{/if}}',
            '{{if !personality}}No personality defined{{/if}}',
            '{{if {{getvar::showHeader}}}}# Header{{/if}}',
            '{{if .myvar}}Local var exists{{/if}}',
            '{{if $globalFlag}}Global flag is set{{/if}}',
        ],
        returns: 'The content if condition is truthy, else branch or empty string otherwise.',
        // Delay argument resolution so nested macros are only evaluated in the chosen branch
        delayArgResolution: true,
        handler: ({ unnamedArgs: [rawCondition, rawContent], flags, resolve, trimContent }) => {
            // With delayArgResolution: true, args contain raw (unresolved) text.
            // We resolve the condition first, then only resolve the chosen branch.

            // Check if the condition starts with ! for inversion
            let inverted = false;
            let condition = rawCondition;
            if (/^\s*!/.test(rawCondition)) {
                inverted = true;
                condition = rawCondition.replace(/^\s*!\s*/, '');
            }

            // Resolve the condition (may contain nested macros like {{getvar::x}})
            condition = resolve(condition);

            // Check if condition is a variable shorthand (.varname or $varname)
            // If so, resolve it using the appropriate variable macro
            const varShorthandRegex = new RegExp(`^([.$])(${MACRO_VARIABLE_SHORTHAND_PATTERN.source})$`);
            const varShorthandMatch = condition.match(varShorthandRegex);
            if (varShorthandMatch) {
                const [, prefix, varName] = varShorthandMatch;
                const varMacro = prefix === '.' ? 'getvar' : 'getglobalvar';
                condition = resolve(`{{${varMacro}::${varName}}}`);
            } else {
                // Check if condition is a registered macro name (without braces)
                // If so, resolve it first (only for macros that accept 0 required args)
                const macroDef = MacroRegistry.getPrimaryMacro(condition);
                if (macroDef && macroDef.minArgs === 0) {
                    condition = resolve(`{{${condition}}}`);
                }
            }

            // Check if condition is falsy: empty string or isFalseBoolean
            let isFalsy = condition === '' || isFalseBoolean(condition);
            if (inverted) isFalsy = !isFalsy;

            // Split raw content on {{else}} macro at the top nesting level
            // We need to track nesting depth to find the correct {{else}} for this if
            const { thenBranch, elseBranch } = splitOnTopLevelElse(rawContent);

            // Only resolve the chosen branch
            const chosenBranch = !isFalsy ? thenBranch : elseBranch;
            if (chosenBranch === undefined) {
                return '';
            }

            // Resolve nested macros in the chosen branch
            // Trim result unless # flag is set (preserveWhitespace)
            let result = resolve(chosenBranch);
            if (!flags.preserveWhitespace) {
                result = trimContent(result);
            }
            return result;
        },
    });

    // {{else}} -> marker for else branch inside {{if}} blocks
    // Only meaningful inside a scoped {{if}} macro
    MacroRegistry.registerMacro('else', {
        category: MacroCategory.UTILITY,
        description: 'Marks the else branch inside a scoped {{if}} block. Only works inside {{if}}...{{/if}}. If used outside, returns an invisible marker.',
        exampleUsage: [
            '{{if condition}}true branch{{else}}false branch{{/if}}',
        ],
        returns: 'Invisible marker (consumed by the enclosing {{if}} macro).',
        handler: () => ELSE_MARKER,
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
        aliases: [{ alias: 'comment', visible: false }],
        category: MacroCategory.UTILITY,
        unnamedArgs: [
            {
                name: 'comment',
                type: MacroValueType.STRING,
                description: 'Any kind of text as comment. If you want multiline comments, consider using a scoped macro like {{//}}First\nSecond{{///}}.',
            },
        ],
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
        handler: ({ unnamedArgs: [formula], warn }) => {
            // If only digits were provided, treat it as `1dX`.
            if (/^\d+$/.test(formula)) {
                formula = `1d${formula}`;
            }

            const isValid = droll.validate(formula);
            if (!isValid) {
                warn(`Invalid roll formula: ${formula}`);
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
        description: 'Picks a random item from a list, but keeps the choice stable for a given chat and macro position. Can be rerolled via /reroll-pick slash command.',
        // TODO: add expanded documentation once HTML details are supported
        // descriptionDetails: `
        //     <p>Picks a random item from a list, but keeps the choice stable for a given chat and macro position.</p>
        //     <p>The choice can be reset per chat using the <code>/reroll-pick</code> slash command.</p>
        // `,
        returns: 'Stable randomly selected item from the list.',
        exampleUsage: ['{{pick::blonde::brown::red::black::blue}}'],
        handler: ({ list, globalOffset, env }) => {
            // Handle old legacy cases, where we have to split the list manually
            if (list.length === 1) {
                list = readSingleArgsRandomList(list[0]);
            }

            if (!list.length) {
                return '';
            }

            // NOTE:
            // When changing the hashing logic, make sure to update unit test functionality
            // in registerTestablePick() to be identical.

            const chatIdHash = getChatIdHash();

            // Use the full original input string for deterministic behavior
            const rawContentHash = env.contentHash;

            // Use globalOffset for deterministic seeding - this ensures identical macros
            // at different positions in the document produce different results, even when
            // nested inside arguments or scoped content
            const offset = globalOffset;

            // Reroll seed allows users to reset all picks in the chat via /reroll-pick command
            const rerollSeed = chat_metadata.pick_reroll_seed || null;

            const combinedSeedString = [chatIdHash, rawContentHash, offset, rerollSeed].filter(it => it !== null).join('-');
            const finalSeed = getStringHash(combinedSeedString);
            const rng = seedrandom(String(finalSeed));
            const randomIndex = Math.floor(rng() * list.length);
            return list[randomIndex];
        },
    });

    /** @param {string} listString @return {string[]} */
    function readSingleArgsRandomList(listString) {
        // If it contains double colons, those will have precedence over comma-separated lists.
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
                description: 'Word to ban for Text Completion backend.',
                type: 'string',
            },
        ],
        description: 'Bans a word for Text Completion backend. (Strips quotes surrounding the banned word, if present)',
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
    const cachedIdHash = chat_metadata.chat_id_hash;
    if (typeof cachedIdHash === 'number') {
        return cachedIdHash;
    }

    const chatId = chat_metadata.main_chat ?? getCurrentChatId();
    const chatIdHash = getStringHash(chatId);
    chat_metadata.chat_id_hash = chatIdHash;
    return chatIdHash;
}
