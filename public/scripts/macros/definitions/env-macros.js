import { MacroRegistry, MacroCategory, MacroValueType } from '../engine/MacroRegistry.js';
import { isMobile } from '../../RossAscends-mods.js';
import { parseMesExamples, main_api } from '../../../script.js';
import { power_user } from '../../power-user.js';
import { formatInstructModeExamples } from '../../instruct-mode.js';

/** @typedef {import('../engine/MacroEnv.types.js').MacroEnv} MacroEnv */

/**
 * Registers macros that mostly act as simple accessors to MacroEnv fields
 * (names, character card fields, system metadata, extras) or basic
 * environment flags.
 */
export function registerEnvMacros() {
    // Names and participant macros (from MacroEnv.names)
    MacroRegistry.registerMacro('user', {
        category: MacroCategory.NAMES,
        description: 'Your current Persona username.',
        returns: 'Persona username.',
        handler: ({ env }) => env.names.user,
    });

    MacroRegistry.registerMacro('char', {
        category: MacroCategory.NAMES,
        description: 'The character\'s name.',
        returns: 'Character name.',
        handler: ({ env }) => env.names.char,
    });

    MacroRegistry.registerMacro('group', {
        aliases: [{ alias: 'charIfNotGroup', visible: false }],
        category: MacroCategory.NAMES,
        description: 'Comma-separated list of group member names (including muted) or the character name in solo chats.',
        returns: 'List of group member names.',
        handler: ({ env }) => env.names.group ?? '',
    });

    MacroRegistry.registerMacro('groupNotMuted', {
        category: MacroCategory.NAMES,
        description: 'Comma-separated list of group member names excluding muted members.',
        returns: 'List of group member names excluding muted members.',
        handler: ({ env }) => env.names.groupNotMuted ?? '',
    });

    MacroRegistry.registerMacro('notChar', {
        category: MacroCategory.NAMES,
        description: 'Comma-separated list of all participants except the current speaker.',
        returns: 'List of all participants except the current speaker.',
        handler: ({ env }) => env.names.notChar ?? '',
    });

    // Character card field macros (from MacroEnv.character)
    MacroRegistry.registerMacro('charPrompt', {
        category: MacroCategory.CHARACTER,
        description: 'The character\'s Main Prompt override.',
        returns: 'Character Main Prompt override.',
        handler: ({ env }) => env.character.charPrompt ?? '',
    });

    MacroRegistry.registerMacro('charInstruction', {
        category: MacroCategory.CHARACTER,
        description: 'The character\'s Post-History Instructions override.',
        returns: 'Character Post-History Instructions override.',
        handler: ({ env }) => env.character.charInstruction ?? '',
    });

    MacroRegistry.registerMacro('charDescription', {
        aliases: [{ alias: 'description' }],
        category: MacroCategory.CHARACTER,
        description: 'The character\'s description.',
        returns: 'Character description.',
        handler: ({ env }) => env.character.description ?? '',
    });

    MacroRegistry.registerMacro('charPersonality', {
        aliases: [{ alias: 'personality' }],
        category: MacroCategory.CHARACTER,
        description: 'The character\'s personality.',
        returns: 'Character personality.',
        handler: ({ env }) => env.character.personality ?? '',
    });

    MacroRegistry.registerMacro('charScenario', {
        aliases: [{ alias: 'scenario' }],
        category: MacroCategory.CHARACTER,
        description: 'The character\'s scenario.',
        returns: 'Character scenario.',
        handler: ({ env }) => env.character.scenario ?? '',
    });

    MacroRegistry.registerMacro('persona', {
        category: MacroCategory.CHARACTER,
        description: 'Your current Persona description.',
        returns: 'Persona description.',
        handler: ({ env }) => env.character.persona ?? '',
    });

    MacroRegistry.registerMacro('mesExamplesRaw', {
        category: MacroCategory.CHARACTER,
        description: 'Unformatted dialogue examples from the character card.',
        returns: 'Unformatted dialogue examples.',
        handler: ({ env }) => env.character.mesExamplesRaw ?? '',
    });

    MacroRegistry.registerMacro('mesExamples', {
        category: MacroCategory.CHARACTER,
        description: 'The character\'s dialogue examples, formatted for instruct mode when enabled.',
        returns: 'Formatted dialogue examples.',
        handler: ({ env }) => {
            const raw = env.character.mesExamplesRaw ?? '';
            if (!raw) return '';

            const isInstruct = !!power_user?.instruct?.enabled && main_api !== 'openai';
            const parsed = parseMesExamples(raw, isInstruct);

            if (!Array.isArray(parsed) || parsed.length === 0) {
                return '';
            }
            if (!isInstruct) {
                return parsed.join('');
            }

            const formatted = formatInstructModeExamples(parsed, env.names.user, env.names.char);
            return Array.isArray(formatted) ? formatted.join('') : '';
        },
    });

    MacroRegistry.registerMacro('charDepthPrompt', {
        category: MacroCategory.CHARACTER,
        description: 'The character\'s @ Depth Note.',
        returns: 'Character @ Depth Note.',
        handler: ({ env }) => env.character.charDepthPrompt ?? '',
    });

    MacroRegistry.registerMacro('charCreatorNotes', {
        aliases: [{ alias: 'creatorNotes' }],
        category: MacroCategory.CHARACTER,
        description: 'Creator notes from the character card.',
        returns: 'Creator notes.',
        handler: ({ env }) => env.character.creatorNotes ?? '',
    });

    // Character version macros (legacy variants and documented {{charVersion}})
    MacroRegistry.registerMacro('charVersion', {
        aliases: [
            { alias: 'version', visible: false }, // Legacy alias
            { alias: 'char_version', visible: false }, // Legacy underscore variant
        ],
        category: MacroCategory.CHARACTER,
        description: 'The character\'s version number.',
        returns: 'Character version number.',
        handler: ({ env }) => env.character.version ?? '',
    });

    // System / env extras macros (from MacroEnv.system / MacroEnv.extra)
    MacroRegistry.registerMacro('model', {
        category: MacroCategory.STATE,
        description: 'Model name for the currently selected API (Chat Completion or Chat Completion).',
        returns: 'Model name.',
        handler: ({ env }) => env.system.model,
    });

    MacroRegistry.registerMacro('original', {
        category: MacroCategory.CHARACTER,
        description: 'Original message content for {{original}} substitution in in character prompt overrides.',
        returns: 'Original message content.',
        handler: ({ env }) => {
            const value = env.functions.original();
            return value;
        },
    });

    // Device / environment macros
    MacroRegistry.registerMacro('isMobile', {
        category: MacroCategory.STATE,
        description: '"true" if currently running in a mobile environment, "false" otherwise.',
        returns: 'Whether the environment is mobile.',
        returnType: MacroValueType.BOOLEAN,
        handler: () => String(isMobile()),
    });
}
