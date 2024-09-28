import { chat_metadata, characters, substituteParams, chat, extension_prompt_roles, extension_prompt_types, name2, neutralCharacterName } from '../../script.js';
import { extension_settings } from '../extensions.js';
import { getGroupMembers, groups } from '../group-chats.js';
import { power_user } from '../power-user.js';
import { searchCharByName, getTagsList, tags } from '../tags.js';
import { world_names } from '../world-info.js';
import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandEnumValue, enumTypes } from './SlashCommandEnumValue.js';

/** @typedef {import('./SlashCommandExecutor.js').SlashCommandExecutor} SlashCommandExecutor */
/** @typedef {import('./SlashCommandScope.js').SlashCommandScope} SlashCommandScope */

/**
 * A collection of regularly used enum icons
 */
export const enumIcons = {
    default: '◊',

    // Variables
    variable: '𝑥',
    localVariable: 'L',
    globalVariable: 'G',
    scopeVariable: 'S',

    // Common types
    character: '👤',
    group: '🧑‍🤝‍🧑',
    persona: '🧙‍♂️',
    qr: 'QR',
    closure: '𝑓',
    macro: '{{',
    tag: '🏷️',
    world: '🌐',
    preset: '⚙️',
    file: '📄',
    message: '💬',
    voice: '🎤',
    server: '🖥️',

    true: '✔️',
    false: '❌',
    null: '🚫',
    undefined: '❓',

    // Value types
    boolean: '🔲',
    string: '📝',
    number: '1️⃣',
    array: '[]',
    enum: '📚',
    dictionary: '{}',

    // Roles
    system: '⚙️',
    user: '👤',
    assistant: '🤖',

    // WI Icons
    constant: '🔵',
    normal: '🟢',
    disabled: '❌',
    vectorized: '🔗',

    /**
     * Returns the appropriate state icon based on a boolean
     *
     * @param {boolean} state - The state to determine the icon for
     * @returns {string} The corresponding state icon
     */
    getStateIcon: (state) => {
        return state ? enumIcons.true : enumIcons.false;
    },

    /**
     * Returns the appropriate WI icon based on the entry
     *
     * @param {Object} entry - WI entry
     * @returns {string} The corresponding WI icon
     */
    getWiStatusIcon: (entry) => {
        if (entry.constant) return enumIcons.constant;
        if (entry.disable) return enumIcons.disabled;
        if (entry.vectorized) return enumIcons.vectorized;
        return enumIcons.normal;
    },

    /**
     * Returns the appropriate icon based on the role
     *
     * @param {extension_prompt_roles} role - The role to get the icon for
     * @returns {string} The corresponding icon
     */
    getRoleIcon: (role) => {
        switch (role) {
            case extension_prompt_roles.SYSTEM: return enumIcons.system;
            case extension_prompt_roles.USER: return enumIcons.user;
            case extension_prompt_roles.ASSISTANT: return enumIcons.assistant;
            default: return enumIcons.default;
        }
    },

    /**
     * A function to get the data type icon
     *
     * @param {string} type - The type of the data
     * @returns {string} The corresponding data type icon
     */
    getDataTypeIcon: (type) => {
        // Remove possible nullable types definition to match type icon
        type = type.replace(/\?$/, '');
        return enumIcons[type] ?? enumIcons.default;
    },
};

/**
 * A collection of common enum providers
 *
 * Can be used on `SlashCommandNamedArgument` and `SlashCommandArgument` and their `enumProvider` property.
 */
export const commonEnumProviders = {
    /**
     * Enum values for booleans. Either using true/false or on/off
     * Optionally supports "toggle".
     *
     * @param {('onOff'|'onOffToggle'|'trueFalse')?} [mode='trueFalse'] - The mode to use. Default is 'trueFalse'.
     * @returns {() => SlashCommandEnumValue[]}
     */
    boolean: (mode = 'trueFalse') => () => {
        switch (mode) {
            case 'onOff': return [new SlashCommandEnumValue('on', null, 'macro', enumIcons.true), new SlashCommandEnumValue('off', null, 'macro', enumIcons.false)];
            case 'onOffToggle': return [new SlashCommandEnumValue('on', null, 'macro', enumIcons.true), new SlashCommandEnumValue('off', null, 'macro', enumIcons.false), new SlashCommandEnumValue('toggle', null, 'macro', enumIcons.boolean)];
            case 'trueFalse': return [new SlashCommandEnumValue('true', null, 'macro', enumIcons.true), new SlashCommandEnumValue('false', null, 'macro', enumIcons.false)];
            default: throw new Error(`Invalid boolean enum provider mode: ${mode}`);
        }
    },

    /**
     * All possible variable names
     *
     * Can be filtered by `type` to only show global or local variables
     *
     * @param {...('global'|'local'|'scope'|'all')} type - The type of variables to include in the array. Can be 'all', 'global', or 'local'.
     * @returns {(executor:SlashCommandExecutor, scope:SlashCommandScope) => SlashCommandEnumValue[]}
     */
    variables: (...type) => (_, scope) => {
        const types = type.flat();
        const isAll = types.includes('all');
        return [
            ...isAll || types.includes('scope') ? scope.allVariableNames.map(name => new SlashCommandEnumValue(name, null, enumTypes.variable, enumIcons.scopeVariable)) : [],
            ...isAll || types.includes('local') ? Object.keys(chat_metadata.variables ?? []).map(name => new SlashCommandEnumValue(name, null, enumTypes.name, enumIcons.localVariable)) : [],
            ...isAll || types.includes('global') ? Object.keys(extension_settings.variables.global ?? []).map(name => new SlashCommandEnumValue(name, null, enumTypes.macro, enumIcons.globalVariable)) : [],
        ].filter((item, idx, list)=>idx == list.findIndex(it=>it.value == item.value));
    },

    /**
     * All possible char entities, like characters and groups. Can be filtered down to just one type.
     *
     * @param {('all' | 'character' | 'group')?} [mode='all'] - Which type to return
     * @returns {() => SlashCommandEnumValue[]}
     */
    characters: (mode = 'all') => () => {
        return [
            ...['all', 'character'].includes(mode) ? characters.map(char => new SlashCommandEnumValue(char.name, null, enumTypes.name, enumIcons.character)) : [],
            ...['all', 'group'].includes(mode) ? groups.map(group => new SlashCommandEnumValue(group.name, null, enumTypes.qr, enumIcons.group)) : [],
            ...(name2 === neutralCharacterName) ? [new SlashCommandEnumValue(neutralCharacterName, null, enumTypes.name, '🥸')] : [],
        ];
    },

    /**
     * All group members of the given group, or default the current active one
     *
     * @param {string?} groupId - The id of the group - pass in `undefined` to use the current active group
     * @returns {() =>SlashCommandEnumValue[]}
     */
    groupMembers: (groupId = undefined) => () => getGroupMembers(groupId).map((character, index) => new SlashCommandEnumValue(String(index), character.name, enumTypes.enum, enumIcons.character)),

    /**
     * All possible personas
     *
     * @returns {SlashCommandEnumValue[]}
     */
    personas: () => Object.values(power_user.personas).map(persona => new SlashCommandEnumValue(persona, null, enumTypes.name, enumIcons.persona)),

    /**
     * All possible tags for a given char/group entity
     *
     * @param {('all' | 'existing' | 'not-existing')?} [mode='all'] - Which types of tags to show
     * @returns {() => SlashCommandEnumValue[]}
     */
    tagsForChar: (mode = 'all') => (/** @type {SlashCommandExecutor} */ executor) => {
        // Try to see if we can find the char during execution to filter down the tags list some more. Otherwise take all tags.
        const charName = executor.namedArgumentList.find(it => it.name == 'name')?.value;
        if (charName instanceof SlashCommandClosure) throw new Error('Argument \'name\' does not support closures');
        const key = searchCharByName(substituteParams(charName), { suppressLogging: true });
        const assigned = key ? getTagsList(key) : [];
        return tags.filter(it => !key || mode === 'all' || mode === 'existing' && assigned.includes(it) || mode === 'not-existing' && !assigned.includes(it))
            .map(tag => new SlashCommandEnumValue(tag.name, null, enumTypes.command, enumIcons.tag));
    },

    /**
     * All messages in the current chat, returning the message id
     *
     * Optionally supports variable names, and/or a placeholder for the last/new message id
     *
     * @param {object} [options={}] - Optional arguments
     * @param {boolean} [options.allowIdAfter=false] - Whether to add an enum option for the new message id after the last message
     * @param {boolean} [options.allowVars=false] - Whether to add enum option for variable names
     * @returns {(executor:SlashCommandExecutor, scope:SlashCommandScope) => SlashCommandEnumValue[]}
     */
    messages: ({ allowIdAfter = false, allowVars = false } = {}) => (_, scope) => {
        return [
            ...chat.map((message, index) => new SlashCommandEnumValue(String(index), `${message.name}: ${message.mes}`, enumTypes.number, message.is_user ? enumIcons.user : message.is_system ? enumIcons.system : enumIcons.assistant)),
            ...allowIdAfter ? [new SlashCommandEnumValue(String(chat.length), '>> After Last Message >>', enumTypes.enum, '➕')] : [],
            ...allowVars ? commonEnumProviders.variables('all')(_, scope) : [],
        ];
    },

    /**
     * All existing worlds / lorebooks
     *
     * @returns {SlashCommandEnumValue[]}
     */
    worlds: () => world_names.map(worldName => new SlashCommandEnumValue(worldName, null, enumTypes.name, enumIcons.world)),

    /**
     * All existing injects for the current chat
     *
     * @returns {SlashCommandEnumValue[]}
     */
    injects: () => {
        if (!chat_metadata.script_injects || !Object.keys(chat_metadata.script_injects).length) return [];
        return Object.entries(chat_metadata.script_injects)
            .map(([id, inject]) => {
                const positionName = (Object.entries(extension_prompt_types)).find(([_, value]) => value === inject.position)?.[0] ?? 'unknown';
                return new SlashCommandEnumValue(id, `${enumIcons.getRoleIcon(inject.role ?? extension_prompt_roles.SYSTEM)}[Inject](${positionName}, depth: ${inject.depth}, scan: ${inject.scan ?? false}) ${inject.value}`,
                    enumTypes.enum, '💉');
            });
    },

    /**
     * Gets somewhat recognizable STscript types.
     *
     * @returns {SlashCommandEnumValue[]}
     */
    types: () => [
        new SlashCommandEnumValue('string', null, enumTypes.type, enumIcons.string),
        new SlashCommandEnumValue('number', null, enumTypes.type, enumIcons.number),
        new SlashCommandEnumValue('boolean', null, enumTypes.type, enumIcons.boolean),
        new SlashCommandEnumValue('array', null, enumTypes.type, enumIcons.array),
        new SlashCommandEnumValue('object', null, enumTypes.type, enumIcons.dictionary),
        new SlashCommandEnumValue('null', null, enumTypes.type, enumIcons.null),
        new SlashCommandEnumValue('undefined', null, enumTypes.type, enumIcons.undefined),
    ],
};
