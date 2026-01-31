/**
 * World Info Entry Collection
 * Contains functions for collecting and sorting world info entries from various sources.
 */

import { characters, this_chid, chat_metadata, eventSource, event_types } from '../../../script.js';
import { getCharaFilename, getStringHash } from '../../utils.js';
import { power_user } from '../../power-user.js';
import {
    world_info,
    selected_world_info,
    world_info_character_strategy,
    sortFn,
} from '../state.js';
import { world_info_insertion_strategy, METADATA_KEY } from '../constants.js';
import { loadWorldInfo } from '../persistence/index.js';
import { parseDecorators } from '../utilities.js';
import { parseInclusionGroups } from '../pure-functions.js';

/**
 * Gets character-specific lore entries.
 * @returns {Promise<object[]>} Array of character lore entries
 */
export async function getCharacterLore() {
    const character = characters[this_chid];
    const name = character?.name;
    /** @type {Set<string>} */
    let worldsToSearch = new Set();

    const baseWorldName = character?.data?.extensions?.world;
    if (baseWorldName) {
        worldsToSearch.add(baseWorldName);
    }

    // TODO: Maybe make the utility function not use the window context?
    const fileName = getCharaFilename(this_chid);
    const extraCharLore = world_info.charLore?.find((e) => e.name === fileName);
    if (extraCharLore) {
        worldsToSearch = new Set([...worldsToSearch, ...extraCharLore.extraBooks]);
    }

    if (!worldsToSearch.size) {
        return [];
    }

    let entries = [];
    for (const worldName of worldsToSearch) {
        if (selected_world_info.includes(worldName)) {
            console.debug(`[WI] Character ${name}'s world ${worldName} is already activated in global world info! Skipping...`);
            continue;
        }

        if (chat_metadata[METADATA_KEY] === worldName) {
            console.debug(`[WI] Character ${name}'s world ${worldName} is already activated in chat lore! Skipping...`);
            continue;
        }

        if (power_user.persona_description_lorebook === worldName) {
            console.debug(`[WI] Character ${name}'s world ${worldName} is already activated in persona lore! Skipping...`);
            continue;
        }

        const data = await loadWorldInfo(worldName);
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(({ uid, ...rest }) => ({ uid, world: worldName, ...rest })) : [];
        entries = entries.concat(newEntries);

        if (!newEntries.length) {
            console.debug(`[WI] Character ${name}'s world ${worldName} could not be found or is empty`);
        }
    }

    console.debug(`[WI] Character ${name}'s lore has ${entries.length} world info entries`, [...worldsToSearch]);
    return entries;
}

/**
 * Gets global lore entries.
 * @returns {Promise<object[]>} Array of global lore entries
 */
export async function getGlobalLore() {
    if (!selected_world_info?.length) {
        return [];
    }

    let entries = [];
    for (const worldName of selected_world_info) {
        const data = await loadWorldInfo(worldName);
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(({ uid, ...rest }) => ({ uid, world: worldName, ...rest })) : [];
        entries = entries.concat(newEntries);
    }

    console.debug(`[WI] Global world info has ${entries.length} entries`, selected_world_info);

    return entries;
}

/**
 * Gets chat-specific lore entries.
 * @returns {Promise<object[]>} Array of chat lore entries
 */
export async function getChatLore() {
    const chatWorld = chat_metadata[METADATA_KEY];

    if (!chatWorld) {
        return [];
    }

    if (selected_world_info.includes(chatWorld)) {
        console.debug(`[WI] Chat world ${chatWorld} is already activated in global world info! Skipping...`);
        return [];
    }

    const data = await loadWorldInfo(chatWorld);
    const entries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(({ uid, ...rest }) => ({ uid, world: chatWorld, ...rest })) : [];

    console.debug(`[WI] Chat lore has ${entries.length} entries`, [chatWorld]);

    return entries;
}

/**
 * Gets persona-specific lore entries.
 * @returns {Promise<object[]>} Array of persona lore entries
 */
export async function getPersonaLore() {
    const chatWorld = chat_metadata[METADATA_KEY];
    const personaWorld = power_user.persona_description_lorebook;

    if (!personaWorld) {
        return [];
    }

    if (chatWorld === personaWorld) {
        console.debug(`[WI] Persona world ${personaWorld} is already activated in chat world! Skipping...`);
        return [];
    }

    if (selected_world_info.includes(personaWorld)) {
        console.debug(`[WI] Persona world ${personaWorld} is already activated in global world info! Skipping...`);
        return [];
    }

    const data = await loadWorldInfo(personaWorld);
    const entries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(({ uid, ...rest }) => ({ uid, world: personaWorld, ...rest })) : [];

    console.debug(`[WI] Persona lore has ${entries.length} entries`, [personaWorld]);

    return entries;
}

/**
 * Gets all sorted entries from all lore sources.
 * @returns {Promise<object[]>} Array of all sorted lore entries
 */
export async function getSortedEntries() {
    try {
        const [
            globalLore,
            characterLore,
            chatLore,
            personaLore,
        ] = await Promise.all([
            getGlobalLore(),
            getCharacterLore(),
            getChatLore(),
            getPersonaLore(),
        ]);

        await eventSource.emit(event_types.WORLDINFO_ENTRIES_LOADED, { globalLore, characterLore, chatLore, personaLore });

        let entries;

        switch (Number(world_info_character_strategy)) {
            case world_info_insertion_strategy.evenly:
                entries = [...globalLore, ...characterLore].sort(sortFn);
                break;
            case world_info_insertion_strategy.character_first:
                entries = [...characterLore.sort(sortFn), ...globalLore.sort(sortFn)];
                break;
            case world_info_insertion_strategy.global_first:
                entries = [...globalLore.sort(sortFn), ...characterLore.sort(sortFn)];
                break;
            default:
                console.error('[WI] Unknown WI insertion strategy:', world_info_character_strategy, 'defaulting to evenly');
                entries = [...globalLore, ...characterLore].sort(sortFn);
                break;
        }

        // Chat lore always goes first, then persona lore, then the rest
        entries = [...chatLore.sort(sortFn), ...personaLore.sort(sortFn), ...entries];

        // Calculate hash and parse decorators. Split maps to preserve old hashes.
        // Also pre-parse inclusion groups to avoid repeated regex splitting during scanning.
        entries = entries.map((entry) => {
            const [decorators, content] = parseDecorators(entry.content || '');
            const parsedGroups = parseInclusionGroups(entry.group);
            return { ...entry, decorators, content, parsedGroups };
        }).map((entry) => {
            const hash = getStringHash(JSON.stringify(entry));
            return { ...entry, hash };
        });

        console.debug(`[WI] Found ${entries.length} world lore entries. Sorted by strategy`, Object.entries(world_info_insertion_strategy).find((x) => x[1] === world_info_character_strategy));

        // Need to deep clone the entries to avoid modifying the cached data
        return structuredClone(entries);
    }
    catch (e) {
        console.error(e);
        return [];
    }
}
