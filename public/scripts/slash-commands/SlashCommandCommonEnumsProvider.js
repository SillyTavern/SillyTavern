import { chat_metadata, characters, substituteParams, chat, extension_prompt_roles } from "../../script.js";
import { extension_settings } from "../extensions.js";
import { groups } from "../group-chats.js";
import { searchCharByName, getTagsList, tags } from "../tags.js";
import { SlashCommandClosure } from "./SlashCommandClosure.js";
import { SlashCommandEnumValue, enumTypes } from "./SlashCommandEnumValue.js";
import { SlashCommandExecutor } from "./SlashCommandExecutor.js";

/**
 * A collection of regularly used enum icons
 */
export const enumIcons = {
    default: '◊',

    // Variables
    variable: 'V',
    localVariable: 'L',
    globalVariable: 'G',
    scopeVariable: 'S',

    // Common types
    character: '👤',
    group: '🧑‍🤝‍🧑',
    qr: '🤖',
    tag: '🏷️',
    world: '🌐',
    preset: '⚙️',
    file: '📄',

    true: '✔️',
    false: '❌',

    // Value types
    boolean: '🔲',
    string: '📝',
    number: '1️⃣',
    array: '📦',
    enum: '📚',
    dictionary: '📖',
    closure: '🧩',

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
}

/**
 * A collection of common enum providers
 *
 * Can be used on `SlashCommandNamedArgument` and `SlashCommandArgument` and their `enumProvider` property.
 */
export const commonEnumProviders = {
    /**
     * Enum values for booleans. Either using true/false or on/off
     * Optionally supports "toggle".
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
     * @returns {() => SlashCommandEnumValue[]}
     */
    variables: (...type) => () => {
        const types = type.flat();
        const isAll = types.includes('all');
        return [
            ...isAll || types.includes('global') ? Object.keys(extension_settings.variables.global ?? []).map(x => new SlashCommandEnumValue(x, null, enumTypes.macro, enumIcons.globalVariable)) : [],
            ...isAll || types.includes('local') ? Object.keys(chat_metadata.variables ?? []).map(x => new SlashCommandEnumValue(x, null, enumTypes.name, enumIcons.localVariable)) : [],
            ...isAll || types.includes('scope') ? [].map(x => new SlashCommandEnumValue(x, null, enumTypes.variable, enumIcons.scopeVariable)) : [], // TODO: Add scoped variables here, Lenny
        ]
    },

    /**
     * All possible char entities, like characters and groups. Can be filtered down to just one type.
     *
     * @param {('all' | 'character' | 'group')?} [mode='all'] - Which type to return
     * @returns {() => SlashCommandEnumValue[]}
     */
    charName: (mode = 'all') => () => {
        return [
            ...['all', 'character'].includes(mode) ? characters.map(it => new SlashCommandEnumValue(it.name, null, enumTypes.name, enumIcons.character)) : [],
            ...['all', 'group'].includes(mode) ? groups.map(it => new SlashCommandEnumValue(it.name, null, enumTypes.qr, enumIcons.group)) : [],
        ];
    },

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
            .map(it => new SlashCommandEnumValue(it.name, null, enumTypes.command, enumIcons.tag));
    },

    /**
     * All messages in the current chat, returning the message id
     * @returns {SlashCommandEnumValue[]}
     */
    messages: () => chat.map((mes, i) => new SlashCommandEnumValue(String(i), `${mes.name}: ${mes.mes}`, enumTypes.number, mes.is_user ? enumIcons.user : mes.is_system ? enumIcons.system : enumIcons.assistant)),

    /**
     * All existing worlds / lorebooks
     *
     * @returns {SlashCommandEnumValue[]}
     */
    worlds: () => $('#world_info').children().toArray().map(x => new SlashCommandEnumValue(x.textContent, null, enumTypes.name, enumIcons.world)),
};

/**
 * Get the unicode icon for the given enum value type
 *
 * Can also confert nullable data types to their non-nullable counterparts
 *
 * @param {string} type The type of the enum value
 * @returns {string} the unicode icon
 */
export function getEnumIcon(type) {
    // Remove possible nullable types definition to match type icon
    type = type.replace(/\?$/, '');
    return enumIcons[type] ?? enumIcons.default;
}
