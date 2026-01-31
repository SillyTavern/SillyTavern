/**
 * World Info Integration
 * Contains functions for integrating world info with characters, chats, and the UI.
 */

import { characters, chat_metadata, saveMetadata, getCurrentChatId, eventSource, event_types, menu_type, create_save, createOrEditCharacter, getRequestHeaders } from '../../script.js';
import { isTrueBoolean, getCharaFilename, getFileBuffer, extractDataFromPng, parseJsonFile, getSanitizedFilename, checkOverwriteExistingData, normalizeArray } from '../utils.js';
import { callGenericPopup, Popup, POPUP_TYPE } from '../popup.js';
import { power_user } from '../power-user.js';
import { accountStorage } from '../util/AccountStorage.js';
import { renderTemplateAsync } from '../templates.js';
import { t } from '../i18n.js';

import { world_info, world_names, selected_world_info, setSelectedWorldInfo, saveSettingsDebounced } from './state.js';
import { METADATA_KEY } from './constants.js';
import { loadWorldInfo, saveWorldInfo, deleteWorldInfo, updateWorldInfoList } from './persistence/index.js';
import { getFreeWorldEntryUid } from './utilities.js';
import { deleteWIOriginalDataValue } from './entry/original-data.js';
import { convertCharacterBook, convertNovelLorebook, convertAgnaiMemoryBook, convertRisuLorebook } from './converters.js';
import { reloadEditor } from './editor/index.js';

/**
 * Gets a World Info element by name from the dropdown.
 * @param {string} name - The name to search for
 * @returns {JQuery<HTMLElement>} The matching element
 */
function getWIElement(name) {
    const wiElement = $('#world_info').children().filter(function () {
        return $(this).text().toLowerCase() === name.toLowerCase();
    });

    return wiElement;
}

/**
 * Sets the world info button class based on character's world info status.
 * @param {number} chid - Character ID
 * @param {boolean} [forceValue] - Optional forced value
 */
export function setWorldInfoButtonClass(chid, forceValue = undefined) {
    if (forceValue !== undefined) {
        $('#set_character_world, #world_button').toggleClass('world_set', forceValue);
        return;
    }

    if (chid === undefined) {
        return;
    }

    const world = characters[chid]?.data?.extensions?.world;
    const worldSet = Boolean(world && world_names.includes(world));
    $('#set_character_world, #world_button').toggleClass('world_set', worldSet);
}

/**
 * Checks if a character has embedded world info and prompts to import if needed.
 * @param {number} chid - Character ID
 * @returns {boolean} True if character has embedded world info
 */
export function checkEmbeddedWorld(chid) {
    $('#import_character_info').hide();

    if (chid === undefined) {
        return false;
    }

    if (characters[chid]?.data?.character_book) {
        $('#import_character_info').data('chid', chid).show();

        // Only show the alert once per character
        const checkKey = `AlertWI_${characters[chid].avatar}`;
        const worldName = characters[chid]?.data?.extensions?.world;
        if (!accountStorage.getItem(checkKey) && (!worldName || !world_names.includes(worldName))) {
            accountStorage.setItem(checkKey, 'true');

            if (power_user.world_import_dialog) {
                const html = `<h3>This character has an embedded World/Lorebook.</h3>
                <h3>Would you like to import it now?</h3>
                <div class="m-b-1">If you want to import it later, select "Import Card Lore" in the "More..." dropdown menu on the character panel.</div>`;
                const checkResult = (result) => {
                    if (result) {
                        importEmbeddedWorldInfo(true);
                    }
                };
                callGenericPopup(html, POPUP_TYPE.CONFIRM, '', { okButton: 'Yes' }).then(checkResult);
            }
            else {
                toastr.info(
                    'To import and use it, select "Import Card Lore" in the "More..." dropdown menu on the character panel.',
                    `${characters[chid].name} has an embedded World/Lorebook`,
                    { timeOut: 5000, extendedTimeOut: 10000 },
                );
            }
        }
        return true;
    }

    return false;
}

/**
 * Imports embedded world info from a character.
 * @param {boolean} [skipPopup=false] - Skip confirmation popup
 */
export async function importEmbeddedWorldInfo(skipPopup = false) {
    const chid = $('#import_character_info').data('chid');

    if (chid === undefined || chid === -1) {
        return;
    }

    const hasEmbed = checkEmbeddedWorld(chid);

    if (!hasEmbed) {
        return;
    }

    const bookName = characters[chid]?.data?.character_book?.name || `${characters[chid]?.name}'s Lorebook`;

    if (!skipPopup) {
        const confirmation = await Popup.show.confirm(t`Are you sure you want to import '${bookName}'?`, world_names.includes(bookName) ? t`It will overwrite the World/Lorebook with the same name.` : '');
        if (!confirmation) {
            return;
        }
    }

    const convertedBook = convertCharacterBook(characters[chid].data.character_book);

    await saveWorldInfo(bookName, convertedBook, true);
    await updateWorldInfoList();
    $('#character_world').val(bookName).trigger('change');

    toastr.success(t`The world '${bookName}' has been imported and linked to the character successfully.`, t`World/Lorebook imported`);

    const newIndex = world_names.indexOf(bookName);
    if (newIndex >= 0) {
        //show&draw the WI panel before..
        $('#WIDrawerIcon').trigger('click');
        //..auto-opening the new imported WI
        $('#world_editor_select').val(newIndex).trigger('change');
    }

    setWorldInfoButtonClass(chid, true);
}

/**
 * Handles world info change from UI or slash command.
 * @param {object|string} args - Arguments or '__notSlashCommand__'
 * @param {string} text - World names to change
 * @returns {string} Empty string
 */
export function onWorldInfoChange(args, text) {
    if (args !== '__notSlashCommand__') { // if it's a slash command
        const silent = isTrueBoolean(args.silent);
        if (text.trim() !== '') { // and args are provided
            const slashInputSplitText = text.trim().toLowerCase().split(',');

            slashInputSplitText.forEach((worldName) => {
                const wiElement = getWIElement(worldName);
                if (wiElement.length > 0) {
                    const name = wiElement.text();
                    switch (args.state) {
                        case 'off': {
                            if (selected_world_info.includes(name)) {
                                selected_world_info.splice(selected_world_info.indexOf(name), 1);
                                wiElement.prop('selected', false);
                                if (!silent) toastr.success(t`Deactivated world: ${name}`);
                            } else {
                                if (!silent) toastr.error(t`World was not active: ${name}`);
                            }
                            break;
                        }
                        case 'toggle': {
                            if (selected_world_info.includes(name)) {
                                selected_world_info.splice(selected_world_info.indexOf(name), 1);
                                wiElement.prop('selected', false);
                                if (!silent) toastr.success(t`Deactivated world: ${name}`);
                            } else {
                                selected_world_info.push(name);
                                wiElement.prop('selected', true);
                                if (!silent) toastr.success(t`Activated world: ${name}`);
                            }
                            break;
                        }
                        case 'on':
                        default: {
                            selected_world_info.push(name);
                            wiElement.prop('selected', true);
                            if (!silent) toastr.success(t`Activated world: ${name}`);
                        }
                    }
                } else {
                    if (!silent) toastr.error(t`No world found named: ${worldName}`);
                }
            });
            $('#world_info').trigger('change');
        } else { // if no args, unset all worlds
            if (!silent) toastr.success(t`Deactivated all worlds`);
            setSelectedWorldInfo([]);
            $('#world_info').val(null).trigger('change');
        }
    } else { //if it's a pointer selection
        const tempWorldInfo = [];
        const val = $('#world_info').val();
        const selectedWorlds = (Array.isArray(val) ? val : [val]).map((e) => Number(e)).filter((e) => !isNaN(e));
        if (selectedWorlds.length > 0) {
            selectedWorlds.forEach((worldIndex) => {
                const existingWorldName = world_names[worldIndex];
                if (existingWorldName) {
                    tempWorldInfo.push(existingWorldName);
                } else {
                    const wiElement = getWIElement(existingWorldName);
                    wiElement.prop('selected', false);
                    toastr.error(t`The world with ${existingWorldName} is invalid or corrupted.`);
                }
            });
        }
        setSelectedWorldInfo(tempWorldInfo);
    }

    saveSettingsDebounced();
    eventSource.emit(event_types.WORLDINFO_SETTINGS_UPDATED);
    return '';
}

/**
 * Imports world info from a file.
 * @param {File} file File to import
 */
export async function importWorldInfo(file) {
    if (!file) {
        return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        let jsonData;

        if (file.name.endsWith('.png')) {
            const buffer = new Uint8Array(await getFileBuffer(file));
            jsonData = extractDataFromPng(buffer, 'naidata');
        } else {
            // File should be a JSON file
            jsonData = await parseJsonFile(file);
        }

        if (jsonData === undefined || jsonData === null) {
            toastr.error(t`File is not valid: ${file.name}`);
            return;
        }

        // Convert Novel Lorebook
        if (jsonData.lorebookVersion !== undefined) {
            console.log('Converting Novel Lorebook');
            formData.append('convertedData', JSON.stringify(convertNovelLorebook(jsonData)));
        }

        // Convert Agnai Memory Book
        if (jsonData.kind === 'memory') {
            console.log('Converting Agnai Memory Book');
            formData.append('convertedData', JSON.stringify(convertAgnaiMemoryBook(jsonData)));
        }

        // Convert Risu Lorebook
        if (jsonData.type === 'risu') {
            console.log('Converting Risu Lorebook');
            formData.append('convertedData', JSON.stringify(convertRisuLorebook(jsonData)));
        }
    } catch (error) {
        toastr.error(`Error parsing file: ${error}`);
        return;
    }

    const worldName = file.name.substr(0, file.name.lastIndexOf('.'));
    const sanitizedWorldName = await getSanitizedFilename(worldName);
    const allowed = await checkOverwriteExistingData('World Info', world_names, sanitizedWorldName, { interactive: true, actionName: 'Import', deleteAction: (existingName) => deleteWorldInfo(existingName) });
    if (!allowed) {
        return false;
    }

    try {
        const result = await fetch('/api/worldinfo/import', {
            method: 'POST',
            headers: getRequestHeaders({ omitContentType: true }),
            body: formData,
            cache: 'no-cache',
        });

        if (!result.ok) {
            throw new Error(`Failed to import world info: ${result.statusText}`);
        }

        const data = await result.json();

        if (data.name) {
            await updateWorldInfoList();

            const newIndex = world_names.indexOf(data.name);
            if (newIndex >= 0) {
                $('#world_editor_select').val(newIndex).trigger('change');
            }

            toastr.success(t`World Info "${data.name}" imported successfully!`);
        }
    } catch (error) {
        console.error('Error importing world info:', error);
        toastr.error(t`Failed to import World Info`);
    }
}

/**
 * Forces the world info editor to open on a specific world.
 * @param {string} worldName The name of the world to open
 */
export function openWorldInfoEditor(worldName) {
    console.log(`Opening lorebook for ${worldName}`);
    if (!$('#WorldInfo').is(':visible')) {
        $('#WIDrawerIcon').trigger('click');
    }
    const index = world_names.indexOf(worldName);
    $('#world_editor_select').val(index).trigger('change');
}

/**
 * Assigns a lorebook to the current chat.
 * @param {JQuery.ClickEvent<Document, undefined, any, any>} event Pointer event
 * @returns {Promise<void>}
 */
export async function assignLorebookToChat(event) {
    const selectedName = chat_metadata[METADATA_KEY];

    if (selectedName && event.altKey) {
        openWorldInfoEditor(selectedName);
        return;
    }

    const template = $(await renderTemplateAsync('chatLorebook'));

    const worldSelect = template.find('select');
    const chatName = template.find('.chat_name');
    chatName.text(getCurrentChatId());

    for (const worldName of world_names) {
        const option = document.createElement('option');
        option.value = worldName;
        option.innerText = worldName;
        option.selected = selectedName === worldName;
        worldSelect.append(option);
    }

    worldSelect.on('change', function () {
        const worldName = $(this).val();

        if (worldName) {
            chat_metadata[METADATA_KEY] = worldName;
            $('.chat_lorebook_button').addClass('world_set');
        } else {
            delete chat_metadata[METADATA_KEY];
            $('.chat_lorebook_button').removeClass('world_set');
        }

        saveMetadata();
    });

    await callGenericPopup(template, POPUP_TYPE.TEXT);
}

/**
 * Moves a World Info entry from a source lorebook to a target lorebook.
 *
 * @param {string} sourceName - The name of the source lorebook file.
 * @param {string} targetName - The name of the target lorebook file.
 * @param {string|number} uid - The UID of the entry to move from the source lorebook.
 * @param {Object} options - Additional options for the move operation.
 * @param {boolean} [options.deleteOriginal=true] - Whether to delete the original entry from the source lorebook after moving it.
 * @returns {Promise<boolean>} True if the move was successful, false otherwise.
 */
export async function moveWorldInfoEntry(sourceName, targetName, uid, { deleteOriginal = true } = {}) {
    if (sourceName === targetName) {
        return false;
    }

    if (!world_names.includes(sourceName)) {
        toastr.error(t`Source lorebook '${sourceName}' not found.`);
        console.error(`[WI Move] Source lorebook '${sourceName}' does not exist.`);
        return false;
    }

    if (!world_names.includes(targetName)) {
        toastr.error(t`Target lorebook '${targetName}' not found.`);
        console.error(`[WI Move] Target lorebook '${targetName}' does not exist.`);
        return false;
    }

    const entryUidString = String(uid);

    try {
        const sourceData = await loadWorldInfo(sourceName);
        const targetData = await loadWorldInfo(targetName);

        if (!sourceData || !sourceData.entries) {
            toastr.error(t`Failed to load data for source lorebook '${sourceName}'.`);
            console.error(`[WI Move] Could not load source data for '${sourceName}'.`);
            return false;
        }
        if (!targetData || !targetData.entries) {
            toastr.error(t`Failed to load data for target lorebook '${targetName}'.`);
            console.error(`[WI Move] Could not load target data for '${targetName}'.`);
            return false;
        }

        if (!sourceData.entries[entryUidString]) {
            toastr.error(t`Entry not found in source lorebook '${sourceName}'.`);
            console.error(`[WI Move] Entry UID ${entryUidString} not found in '${sourceName}'.`);
            return false;
        }

        const entryToMove = structuredClone(sourceData.entries[entryUidString]);

        const newUid = getFreeWorldEntryUid(targetData);
        if (newUid === null) {
            console.error(`[WI Move] Failed to get a free UID in '${targetName}'.`);
            return false;
        }

        entryToMove.uid = newUid;
        // Place the entry at the end of the target lorebook
        const maxDisplayIndex = Object.values(targetData.entries).reduce((max, entry) => Math.max(max, entry.displayIndex ?? -1), -1);
        entryToMove.displayIndex = maxDisplayIndex + 1;

        targetData.entries[newUid] = entryToMove;

        if (deleteOriginal) {
            delete sourceData.entries[entryUidString];
            // Remove from originalData if it exists
            deleteWIOriginalDataValue(sourceData, entryUidString);
            // TODO: setWIOriginalDataValue
            console.debug(`[WI Move] Removed entry UID ${entryUidString} from source '${sourceName}'.`);
        }

        await saveWorldInfo(targetName, targetData, true);
        console.debug(`[WI Move] Saved target lorebook '${targetName}'.`);
        await saveWorldInfo(sourceName, sourceData, true);
        console.debug(`[WI Move] Saved source lorebook '${sourceName}'.`);

        console.log(`[WI Move] ${entryToMove.comment} ${deleteOriginal ? 'moved' : 'copied'} successfully to '${targetName}'.`);

        // Check if the currently viewed book in the editor is the source or target and reload it
        const currentEditorBookIndex = Number($('#world_editor_select').val());
        if (!isNaN(currentEditorBookIndex)) {
            const currentEditorBookName = world_names[currentEditorBookIndex];
            if (currentEditorBookName === sourceName || currentEditorBookName === targetName) {
                reloadEditor(currentEditorBookName);
            }
        }

        toastr.success(deleteOriginal
            ? t`Entry moved successfully from '${sourceName}' to '${targetName}'.`
            : t`Entry copied successfully to '${targetName}'.`);

        return true;
    } catch (error) {
        toastr.error(t`An unexpected error occurred while moving the entry: ${error.message}`);
        console.error('[WI Move] Unexpected error:', error);
        return false;
    }
}


/**
 * Updates the primary world info linked to a character.
 * Can also unset it to null.
 * @param {string} name - The name of the world info to link to the character.
 */
export async function charUpdatePrimaryWorld(name) {
    const previousValue = $('#character_world').val();
    $('#character_world').val(name);

    console.debug('Character world selected:', name);

    if (menu_type == 'create') {
        create_save.world = name;
        return;
    }

    if (previousValue && !name) {
        try {
            // Dirty hack to remove embedded lorebook from character JSON data.
            const data = JSON.parse(String($('#character_json_data').val()));

            if (data?.data?.character_book) {
                data.data.character_book = undefined;
            }

            $('#character_json_data').val(JSON.stringify(data));
            toastr.info(t`Embedded lorebook will be removed from this character.`);
        } catch {
            console.error('Failed to parse character JSON data.');
        }
    }

    await createOrEditCharacter();

    setWorldInfoButtonClass(undefined, !!name);
}

/**
 * Adds one or more auxiliary world books to a character.
 * @param {string} characterKey - The key of the character to add auxiliary world books to
 * @param {string|string[]} nameOrNames - The name or names of the auxiliary world books to add
 */
export async function charUpdateAddAuxWorld(characterKey, nameOrNames) {
    const fileName = getCharaFilename(null, { manualAvatarKey: characterKey });
    const toAdd = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
    updateAuxBooks(fileName, curr => [...curr, ...toAdd]);
}

/**
 * Replaces the entire list of auxiliary world books for a character.
 * @param {string} fileName - The filename of the character to update
 * @param {string[]} books - The new list of auxiliary world books to replace the existing list with
 */
export function charSetAuxWorlds(fileName, books) {
    updateAuxBooks(fileName, _ => Array.isArray(books) ? books : []);
}

function updateAuxBooks(fileName, computeNext) {
    if (!fileName) return;

    if (menu_type === 'create') {
        const current = create_save.extra_books ?? [];
        create_save.extra_books = normalizeArray(computeNext(current));
        return; // no debounced save in create flow
    }

    const charLore = world_info.charLore ?? [];
    const idx = charLore.findIndex(e => e.name === fileName);
    const current = idx !== -1 ? (charLore[idx].extraBooks ?? []) : [];
    const next = normalizeArray(computeNext(current));

    if (next.length === 0) {
        if (idx !== -1) charLore.splice(idx, 1);
    } else if (idx === -1) {
        charLore.push({ name: fileName, extraBooks: next });
    } else {
        charLore[idx] = { ...charLore[idx], extraBooks: next };
    }

    Object.assign(world_info, { charLore });
    saveSettingsDebounced();
}
