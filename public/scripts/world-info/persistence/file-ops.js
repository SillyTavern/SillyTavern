/**
 * World Info File Operations
 * Contains functions for loading, saving, deleting, and renaming world info files.
 */

import { getRequestHeaders, saveCharacterDebounced, menu_type, eventSource, event_types } from '../../../script.js';
import { debounce, getSanitizedFilename, checkOverwriteExistingData, cancelDebounce, equalsIgnoreCaseAndAccents } from '../../utils.js';
import { debounce_timeout } from '../../constants.js';
import { power_user } from '../../power-user.js';
import { getOrCreatePersonaDescriptor } from '../../personas.js';
import { user_avatar } from '../../personas.js';
import { Popup } from '../../popup.js';
import { t } from '../../i18n.js';
import { worldInfoCache } from './cache.js';
import {
    world_info,
    world_names,
    selected_world_info,
    setWorldNames,
    saveSettingsDebounced,
} from '../state.js';

// Debounced save function
const saveWorldDebounced = debounce(async (name, data) => await _save(name, data), debounce_timeout.relaxed);

/**
 * Internal save function that performs the actual API call.
 * @param {string} name - The name of the world info
 * @param {object} data - The data to save
 */
async function _save(name, data) {
    // Prevent double saving if both immediate and debounced save are called
    cancelDebounce(saveWorldDebounced);

    await fetch('/api/worldinfo/edit', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name, data: data }),
    });
    await eventSource.emit(event_types.WORLDINFO_UPDATED, name, data);
}

/**
 * Loads world info from the backend.
 *
 * This function will return from `worldInfoCache` if it has already been loaded before.
 *
 * @param {string} name - The name of the world to load
 * @return {Promise<Object|null>} A promise that resolves to the loaded world information, or null if the request fails.
 */
export async function loadWorldInfo(name) {
    if (!name) {
        return;
    }

    if (worldInfoCache.has(name)) {
        return worldInfoCache.get(name);
    }

    const response = await fetch('/api/worldinfo/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name }),
        cache: 'no-cache',
    });

    if (response.ok) {
        const data = await response.json();
        worldInfoCache.set(name, data);
        return data;
    }

    return null;
}

/**
 * Saves the world info
 *
 * This will also refresh the `worldInfoCache`.
 * Note, for performance reasons the saved cache will not make a deep clone of the data.
 * It is your responsibility to not modify the saved data object after calling this function, or there will be data inconsistencies.
 * Call `loadWorldInfoData` or query directly from cache if you need the object again.
 *
 * @param {string} name - The name of the world info
 * @param {any} data - The data to be saved
 * @param {boolean} [immediately=false] - Whether to save immediately or use debouncing
 * @return {Promise<void>} A promise that resolves when the world info is saved
 */
export async function saveWorldInfo(name, data, immediately = false) {
    if (!name || !data) {
        return;
    }

    // Update cache immediately, so any future call can pull from this
    worldInfoCache.set(name, data);

    if (immediately) {
        return await _save(name, data);
    }

    saveWorldDebounced(name, data);
}

/**
 * Renames a world info file.
 * @param {string} name - The current name of the world info
 * @param {object} data - The world info data
 */
export async function renameWorldInfo(name, data) {
    const oldName = name;
    const newName = await Popup.show.input('Rename World Info', 'Enter a new name:', oldName);

    if (oldName === newName || !newName) {
        console.debug('World info rename cancelled');
        return;
    }
    if (equalsIgnoreCaseAndAccents(oldName, newName)) {
        toastr.warning(t`Name not accepted, as it is the same as before (ignoring case and accents).`, t`Rename World Info`);
        return;
    }

    const entryPreviouslySelected = selected_world_info.findIndex((e) => e === oldName);

    await saveWorldInfo(newName, data, true);
    await deleteWorldInfo(oldName);

    const existingCharLores = world_info.charLore?.filter((e) => e.extraBooks.includes(oldName));
    if (existingCharLores && existingCharLores.length > 0) {
        existingCharLores.forEach((charLore) => {
            const tempCharLore = charLore.extraBooks.filter((e) => e !== oldName);
            tempCharLore.push(newName);
            charLore.extraBooks = tempCharLore;
        });
        saveSettingsDebounced();
    }

    if (entryPreviouslySelected !== -1) {
        const wiElement = getWIElement(newName);
        wiElement.prop('selected', true);
        $('#world_info').trigger('change');
    }

    const selectedIndex = world_names.indexOf(newName);
    if (selectedIndex !== -1) {
        $('#world_editor_select').val(selectedIndex).trigger('change');
    }
}

/**
 * Gets the world info select element by name.
 * @param {string} name - The name of the world info
 * @returns {JQuery<HTMLElement>} The select element
 */
function getWIElement(name) {
    const wiElement = $('#world_info').children().filter(function () {
        return $(this).text().toLowerCase() === name.toLowerCase();
    });

    return wiElement;
}

/**
 * Deletes a world info with the given name
 *
 * @param {string} worldInfoName - The name of the world info to delete
 * @returns {Promise<boolean>} A promise that resolves to true if the world info was successfully deleted, false otherwise
 */
export async function deleteWorldInfo(worldInfoName) {
    if (!world_names.includes(worldInfoName)) {
        return false;
    }

    const response = await fetch('/api/worldinfo/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: worldInfoName }),
    });

    if (!response.ok) {
        return false;
    }

    if (worldInfoCache.has(worldInfoName)) {
        worldInfoCache.delete(worldInfoName);
    }

    const existingWorldIndex = selected_world_info.findIndex((e) => e === worldInfoName);
    if (existingWorldIndex !== -1) {
        selected_world_info.splice(existingWorldIndex, 1);
        saveSettingsDebounced();
    }

    await updateWorldInfoList();
    $('#world_editor_select').trigger('change');

    if ($('#character_world').val() === worldInfoName) {
        $('#character_world').val('').trigger('change');
        // Import dynamically to avoid circular dependencies
        const { setWorldInfoButtonClass } = await import('../integration.js');
        setWorldInfoButtonClass(undefined, false);
        if (menu_type != 'create') {
            saveCharacterDebounced();
        }
    }

    if (power_user.persona_description_lorebook === worldInfoName) {
        power_user.persona_description_lorebook = '';
        if (power_user.personas[user_avatar]) {
            const object = getOrCreatePersonaDescriptor();
            object.lorebook = '';
        }
        $('#persona_lore_button').toggleClass('world_set', false);
        saveSettingsDebounced();
    }

    return true;
}

/**
 * Updates the world info list from the backend.
 */
export async function updateWorldInfoList() {
    const result = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (result.ok) {
        const data = await result.json();
        const editorSelected = String($('#world_editor_select').find(':selected').text());
        setWorldNames(data.world_names?.length ? data.world_names : []);
        $('#world_info').find('option[value!=""]').remove();
        $('#world_editor_select').find('option[value!=""]').remove();

        world_names.forEach((item, i) => {
            const globalListOption = new Option(item, i.toString());
            globalListOption.selected = selected_world_info.includes(item);
            const editorListOption = new Option(item, i.toString());
            editorListOption.selected = editorSelected === item;
            $('#world_info').append(globalListOption);
            $('#world_editor_select').append(editorListOption);
        });
    }
}

/**
 * Creates a new world info/lorebook with the given name.
 * Checks if a world with the same name already exists, providing a warning or optionally a user confirmation dialog.
 *
 * @param {string} worldName - The name of the new world info
 * @param {Object} options - Optional parameters
 * @param {boolean} [options.interactive=false] - Whether to show a confirmation dialog when overwriting an existing world
 * @returns {Promise<boolean>} - True if the world info was successfully created, false otherwise
 */
export async function createNewWorldInfo(worldName, { interactive = false } = {}) {
    const worldInfoTemplate = { entries: {} };

    if (!worldName) {
        return false;
    }

    const sanitizedWorldName = await getSanitizedFilename(worldName);

    const allowed = await checkOverwriteExistingData('World Info', world_names, sanitizedWorldName, { interactive: interactive, actionName: 'Create', deleteAction: (existingName) => deleteWorldInfo(existingName) });
    if (!allowed) {
        return false;
    }

    await saveWorldInfo(worldName, worldInfoTemplate, true);
    await updateWorldInfoList();

    const selectedIndex = world_names.indexOf(worldName);
    if (selectedIndex !== -1) {
        $('#world_editor_select').val(selectedIndex).trigger('change');
    } else {
        // Import dynamically to avoid circular dependencies
        const { hideWorldEditor } = await import('../editor/index.js');
        await hideWorldEditor();
    }

    return true;
}
