import { chat_metadata, characters, substituteParams } from "../../script.js";
import { extension_settings } from "../extensions.js";
import { groups } from "../group-chats.js";
import { searchCharByName, getTagsList, tags } from "../tags.js";
import { SlashCommandEnumValue } from "./SlashCommandEnumValue.js";
import { SlashCommandExecutor } from "./SlashCommandExecutor.js";

/**
 * A collection of common enum providers
 *
 * Can be used on `SlashCommandNamedArgument` and `SlashCommandArgument` and their `enumProvider` property.
 */
export const commonEnumProviders = {
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
            ...isAll || types.includes('global') ? Object.keys(chat_metadata.variables).map(x => new SlashCommandEnumValue(x, null, 'variable', 'L')) : [],
            ...isAll || types.includes('local') ? Object.keys(extension_settings.variables.global).map(x => new SlashCommandEnumValue(x, null, 'variable', 'G')) : [],
            ...isAll || types.includes('scope') ? [].map(x => new SlashCommandEnumValue(x, null, 'variable', 'S')) : [], // TODO: Add scoped variables here, Lenny
        ]
    },

    /**
     * All possible character and group names
     *
     * @returns {SlashCommandEnumValue[]}
     */
    charName: () => [
        ...characters.map(it => new SlashCommandEnumValue(it.name, null, 'qr', 'C')),
        ...groups.map(it => new SlashCommandEnumValue(it.name, null, 'variable', 'G')),
    ],

    /**
     * All possible tags for a given char/group entity
     *
     * @param {'all' | 'existing' | 'not-existing'} mode - Which types of tags to show
     * @returns {() => SlashCommandEnumValue[]}
     */
    tagsForChar: (mode) => (/** @type {SlashCommandExecutor} */ executor) => {
        // Try to see if we can find the char during execution to filter down the tags list some more. Otherwise take all tags.
        const key = searchCharByName(substituteParams(/**@type {string?}*/(executor.namedArgumentList.find(it => it.name == 'name')?.value)), { suppressLogging: true });
        const assigned = key ? getTagsList(key) : [];
        return tags.filter(it => !key || mode === 'all' || mode === 'existing' && assigned.includes(it) || mode === 'not-existing' && !assigned.includes(it))
            .map(it => new SlashCommandEnumValue(it.name, it.title));
    },

    /**
     * All existing worlds / lorebooks
     *
     * @returns {SlashCommandEnumValue[]}
     */
    worlds: () => $('#world_info').children().toArray().map(x => new SlashCommandEnumValue(x.textContent)),
};


/**
 * Get the unicode icon for the given enum value type
 * @param {string} type The type of the enum value
 * @returns {string} the unicode icon
 */
export function getEnumIconByValueType(type) {
    // Remove nullable types definition to match type icon
    type = type.replace(/\?$/, '');

    switch (type) {
        case 'boolean': return '🔲';
        case 'string': return '📝';
        case 'number': return '1️⃣';
        case 'array': return '📦';
        case 'enum': return '📚';
        case 'dictionary': return '📖';
        case 'closure': return '🧩';
        default: return '◊';
    }
}
