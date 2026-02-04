/**
 * World Info Editor Index
 * Contains the main editor display functions, filter, and entry list management.
 */

import { FilterHelper } from '../../filters.js';
import { Popup } from '../../popup.js';
import { renderTemplateAsync } from '../../templates.js';
import { t } from '../../i18n.js';
import { accountStorage } from '../../util/AccountStorage.js';
import {
    download,
    initScrollHeight,
    PAGINATION_TEMPLATE,
    navigation_option,
    waitUntilCondition,
    flashHighlight,
    getSortableDelay,
} from '../../utils.js';

import { world_info, world_names, saveSettingsDebounced } from '../state.js';
import { MAX_COMMENT_LENGTH } from '../constants.js';
import { loadWorldInfo, saveWorldInfo, deleteWorldInfo, renameWorldInfo, updateWorldInfoList } from '../persistence/index.js';
import { createWorldInfoEntry } from '../entry/index.js';
import { setWIOriginalDataValue } from '../entry/original-data.js';
import { addMissingWorldInfoFields, getFreeWorldName } from '../utilities.js';
import { sortWorldInfoEntries, verifyWorldInfoSearchSortRule, setWorldInfoFilter } from './sorting.js';
import { updateWorldEntryKeyOptionsCache } from './input-helpers.js';
import { getWorldEntry } from './entry-template.js';

// Mutable function that gets updated by displayWorldEntries with new data
let updateEditor = (navigation, flashOnNav = true) => { console.debug('Triggered WI navigation', navigation, flashOnNav); };

// Do not optimize. updateEditor is a function that is updated by the displayWorldEntries with new data.
export const worldInfoFilter = new FilterHelper(() => updateEditor());

// Set the worldInfoFilter reference in the sorting module
setWorldInfoFilter(worldInfoFilter);

/**
 * Reloads the editor for the specified file.
 * @param {string} file - The name of the world info file to reload
 * @param {boolean} [loadIfNotSelected=false] - Whether to load the file even if it's not currently selected
 */
export function reloadEditor(file, loadIfNotSelected = false) {
    const currentIndex = Number($('#world_editor_select').val());
    const selectedIndex = world_names.indexOf(file);
    if (selectedIndex !== -1 && (loadIfNotSelected || currentIndex === selectedIndex)) {
        $('#world_editor_select').val(selectedIndex).trigger('change');
    }
}

/**
 * Shows a toast message when world info is not set.
 */
function nullWorldInfo() {
    toastr.info('Create or import a new World Info file first.', 'World Info is not set', { timeOut: 10000, preventDuplicates: true });
}

/**
 * Gets a World Info element by name from the dropdown.
 * @param {string} name - The name to search for
 * @returns {JQuery<HTMLElement>} The matching element
 */
export function getWIElement(name) {
    const wiElement = $('#world_info').children().filter(function () {
        return $(this).text().toLowerCase() === name.toLowerCase();
    });

    return wiElement;
}

/**
 * Shows the world editor for a given world info file.
 * @param {string} name - The name of the world info file to display
 */
export async function showWorldEditor(name) {
    if (!name) {
        await hideWorldEditor();
        return;
    }

    const wiData = await loadWorldInfo(name);
    await displayWorldEntries(name, wiData);
}

/**
 * Hides the world editor.
 */
export async function hideWorldEditor() {
    await displayWorldEntries(null, null);
}

/**
 * Clears the entry list and properly cleans up DOM elements.
 * @param {JQuery<HTMLElement>} $list - The list element to clear
 */
function clearEntryList($list) {
    console.time('clearEntryList');

    // List already empty, skipping cleanup
    if (!$list.children().length) {
        console.timeEnd('clearEntryList');
        return;
    }

    // Unsubscribe from toggle events, so that mass open won't create new drawers
    $list.find('.inline-drawer').off('inline-drawer-toggle');

    // Step 1: Clean all <option> elements within <select>
    $list.find('option').each(function () {
        const $option = $(this);
        $option.off();
        $.cleanData([$option[0]]);
        $option.remove();
    });

    // Step 2: Clean all <select> elements
    $list.find('select').each(function () {
        const $select = $(this);
        // Remove Select2-related data and container if present
        if ($select.data('select2')) {
            try {
                $select.select2('destroy');
            } catch (e) {
                console.debug('Select2 destroy failed:', e);
            }
        }
        const $container = $select.parent();
        if ($container.length) {
            $container.find('*').off();
            $.cleanData($container.find('*').get());
            $container.remove();
        }

        $select.off();
        $.cleanData([$select[0]]);
    });

    // Step 3: Clean <div>, <span>, <input>
    $list.find('div, span, input').each(function () {
        const $elem = $(this);
        $elem.off();
        $.cleanData([$elem[0]]);
        $elem.remove();
    });

    const totalElementsOfAnyKindLeftInList = $list.children().length;

    // Final cleanup
    if (totalElementsOfAnyKindLeftInList) {
        console.time('empty');
        $list.empty();
        console.timeEnd('empty');
    }

    console.timeEnd('clearEntryList');
}

/**
 * Displays world info entries in the editor.
 * @param {string} name - The name of the world info file
 * @param {object} data - The world info data object
 * @param {number|string} [navigation=navigation_option.none] - Navigation option or UID to navigate to
 * @param {boolean} [flashOnNav=true] - Whether to flash highlight on navigation
 */
export async function displayWorldEntries(name, data, navigation = navigation_option.none, flashOnNav = true) {
    updateEditor = async (navigation, flashOnNav = true) => await displayWorldEntries(name, data, navigation, flashOnNav);

    const worldEntriesList = $('#world_popup_entries_list');
    clearEntryList(worldEntriesList);
    worldEntriesList.show();

    if (!data || !('entries' in data)) {
        $('#world_popup_new').off('click').on('click', nullWorldInfo);
        $('#world_popup_name_button').off('click').on('click', nullWorldInfo);
        $('#world_popup_export').off('click').on('click', nullWorldInfo);
        $('#world_popup_delete').off('click').on('click', nullWorldInfo);
        $('#world_duplicate').off('click').on('click', nullWorldInfo);
        worldEntriesList.hide();
        $('#world_info_pagination').html('');
        return;
    }

    // Regardless of whether success is displayed or not. Make sure the delete button is available.
    // Do not put this code behind.
    $('#world_popup_delete').off('click').on('click', async () => {
        const confirmation = await Popup.show.confirm(t`Delete the World/Lorebook: "${name}"?`, 'This action is irreversible!');
        if (!confirmation) {
            return;
        }

        if (world_info.charLore) {
            world_info.charLore.forEach((charLore, index) => {
                if (charLore.extraBooks?.includes(name)) {
                    const tempCharLore = charLore.extraBooks.filter((e) => e !== name);
                    if (tempCharLore.length === 0) {
                        world_info.charLore.splice(index, 1);
                    } else {
                        charLore.extraBooks = tempCharLore;
                    }
                }
            });

            saveSettingsDebounced();
        }

        // Selected world_info automatically refreshes
        await deleteWorldInfo(name);
    });

    // Before printing the WI, we check if we should enable/disable search sorting
    verifyWorldInfoSearchSortRule();

    function getDataArray(callback) {
        // Convert the data.entries object into an array
        let entriesArray = Object.keys(data.entries).map(uid => {
            const entry = data.entries[uid];
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                return null;
            }
            entry.displayIndex = entry.displayIndex ?? entry.uid;
            return entry;
        }).filter(entry => entry !== null);

        // Apply the filter and do the chosen sorting
        entriesArray = addMissingWorldInfoFields(entriesArray);
        entriesArray = worldInfoFilter.applyFilters(entriesArray);
        entriesArray = sortWorldInfoEntries(entriesArray);

        // Cache keys
        const keys = entriesArray.flatMap(entry => [...entry.key, ...entry.keysecondary]);
        updateWorldEntryKeyOptionsCache(keys, { reset: true });

        // Run the callback for printing this
        typeof callback === 'function' && callback(entriesArray);
        return entriesArray;
    }

    const storageKey = 'WI_PerPage';
    const perPageDefault = 25;
    let startPage = 1;

    if (navigation === navigation_option.previous) {
        startPage = $('#world_info_pagination').pagination('getCurrentPageNum');
    }

    if (typeof navigation === 'number' && Number(navigation) >= 0) {
        const dataArray = getDataArray();
        const uidIndex = dataArray.findIndex(x => x.uid === navigation);
        const perPage = Number(accountStorage.getItem(storageKey)) || perPageDefault;
        startPage = Math.floor(uidIndex / perPage) + 1;
    }

    $('#world_info_pagination').pagination({
        dataSource: getDataArray,
        pageSize: Number(accountStorage.getItem(storageKey)) || perPageDefault,
        sizeChangerOptions: [10, 25, 50, 100, 500, 1000],
        showSizeChanger: true,
        pageRange: 1,
        pageNumber: startPage,
        position: 'top',
        showPageNumbers: false,
        prevText: '<',
        nextText: '>',
        formatNavigator: PAGINATION_TEMPLATE,
        showNavigator: true,
        callback: async function (/** @type {object[]} */ page) {
            try {
                clearEntryList(worldEntriesList);

                const keywordHeaders = await renderTemplateAsync('worldInfoKeywordHeaders');
                const blocks = [];

                for (const entry of page) {
                    try {
                        const block = await getWorldEntry(name, data, entry, { updateEditor, clearEntryList });
                        if (block) {
                            blocks.push(block);
                        }
                    } catch (error) {
                        console.error(`Error while processing entry ${entry.uid}:`, error);
                    }
                }

                const isCustomOrder = $('#world_info_sort_order').find(':selected').data('rule') === 'custom';
                if (!isCustomOrder) {
                    blocks.forEach(block => {
                        block.find('.drag-handle').remove();
                    });
                }

                worldEntriesList.append(keywordHeaders);
                worldEntriesList.append(blocks);
            } catch (error) {
                console.error('Error while rendering WI entries:', error);
            }
        },
        afterSizeSelectorChange: function (e) {
            accountStorage.setItem(storageKey, e.target.value);
        },
        afterPaging: function () {
            $('#world_popup_entries_list textarea[name="comment"]').each(function () {
                initScrollHeight($(this));
            });
        },
    });

    if (typeof navigation === 'number' && Number(navigation) >= 0) {
        const selector = `#world_popup_entries_list [uid="${navigation}"]`;
        waitUntilCondition(() => document.querySelector(selector) !== null).finally(() => {
            const element = $(selector);

            if (element.length === 0) {
                console.log(`Could not find element for uid ${navigation}`);
                return;
            }

            const elementOffset = element.offset();
            const parentOffset = element.parent().offset();
            const scrollOffset = elementOffset.top - parentOffset.top;
            $('#WorldInfo').scrollTop(scrollOffset);
            if (flashOnNav) flashHighlight(element);
        });
    }

    $('#world_popup_new').off('click').on('click', () => {
        const entry = createWorldInfoEntry(name, data);
        if (entry) updateEditor(entry.uid);
    });

    $('#world_popup_name_button').off('click').on('click', async () => {
        await renameWorldInfo(name, data);
    });

    $('#world_backfill_memos').off('click').on('click', async () => {
        let counter = 0;
        for (const entry of Object.values(data.entries)) {
            if (!entry.comment && Array.isArray(entry.key) && entry.key.length > 0) {
                entry.comment = entry.key.join(', ').slice(0, MAX_COMMENT_LENGTH);
                setWIOriginalDataValue(data, entry.uid, 'comment', entry.comment);
                counter++;
            }
        }

        if (counter > 0) {
            toastr.info(`Backfilled ${counter} titles`);
            await saveWorldInfo(name, data);
            updateEditor(navigation_option.previous);
        }
    });

    $('#world_apply_current_sorting').off('click').on('click', async () => {
        const entryCount = Object.keys(data.entries).length;
        const moreThan100 = entryCount > 100;

        let content = '<span>' + t`Apply your current sorting to the "Order" field. The Order values will go down from the chosen number.` + '</span>';
        if (moreThan100) {
            content += '<div class="m-t-1"><i class="fa-solid fa-triangle-exclamation" style="color: #FFD43B;"></i> ' + t`More than 100 entries in this world. If you don't choose a number higher than that, the lower entries will default to 0.<br />(Usual default: 100)<br />Minimum: ${entryCount}` + '</div>';
        }

        const result = await Popup.show.input(t`Apply Current Sorting`, content, '100', { okButton: t`Apply`, cancelButton: 'Cancel' });
        if (!result) return;

        const start = Number(result);
        if (isNaN(start) || start < 0) {
            toastr.error(t`Invalid number: ${result}`, t`Apply Current Sorting`);
            return;
        }
        if (start < entryCount) {
            toastr.warning(t`A number lower than the entry count has been chosen. All entries below that will default to 0.`, t`Apply Current Sorting`);
        }

        // We need to sort the entries here, as the data source isn't sorted
        const entries = Object.values(data.entries);
        sortWorldInfoEntries(entries);

        let updated = 0, current = start;
        for (const entry of entries) {
            const newOrder = Math.max(current--, 0);
            if (entry.order === newOrder) continue;

            entry.order = newOrder;
            setWIOriginalDataValue(data, entry.order, 'order', entry.order);
            updated++;
        }

        if (updated > 0) {
            toastr.info(`Updated ${updated} Order values`, 'Apply Custom Sorting');
            await saveWorldInfo(name, data, true);
            updateEditor(navigation_option.previous);
        } else {
            toastr.info('All values up to date', 'Apply Custom Sorting');
        }
    });

    $('#world_popup_export').off('click').on('click', () => {
        if (name && data) {
            const jsonValue = JSON.stringify(data);
            const fileName = `${name}.json`;
            download(jsonValue, fileName, 'application/json');
        }
    });

    $('#world_duplicate').off('click').on('click', async () => {
        // Find current name for the world selected
        const selectedIndex = String($('#world_editor_select').find(':selected').val());
        const worldName = world_names[selectedIndex] || null;

        // Use the current name as default input, then ask user for the name
        const tempName = getFreeWorldName(worldName);
        const finalName = await Popup.show.input('Create a new World Info?', 'Enter a name for the new file:', tempName);

        if (finalName) {
            await saveWorldInfo(finalName, data, true);
            await updateWorldInfoList();

            const selectedIndex = world_names.indexOf(finalName);
            if (selectedIndex !== -1) {
                $('#world_editor_select').val(selectedIndex).trigger('change');
            } else {
                await hideWorldEditor();
            }
        }
    });

    // Check if a sortable instance exists
    if (worldEntriesList.sortable('instance') !== undefined) {
        // Destroy the instance
        worldEntriesList.sortable('destroy');
    }

    worldEntriesList.sortable({
        items: '.world_entry',
        delay: getSortableDelay(),
        handle: '.drag-handle',
        stop: async function (_event, _ui) {
            const firstEntryUid = $('#world_popup_entries_list .world_entry').first().data('uid');
            const minDisplayIndex = data?.entries[firstEntryUid]?.displayIndex ?? 0;
            $('#world_popup_entries_list .world_entry').each(function (index) {
                const uid = $(this).data('uid');

                // Update the display index in the data array
                const item = data.entries[uid];

                if (!item) {
                    console.debug(`Could not find entry with uid ${uid}`);
                    return;
                }

                item.displayIndex = minDisplayIndex + index;
                setWIOriginalDataValue(data, uid, 'extensions.display_index', item.displayIndex);
            });

            console.table(Object.keys(data.entries).map(uid => data.entries[uid]).map(x => ({ uid: x.uid, key: x.key.join(','), displayIndex: x.displayIndex })));

            await saveWorldInfo(name, data);
        },
    });

    //$("#world_popup_entries_list").disableSelection();
}

// Re-export from sub-modules for convenience
export { sortWorldInfoEntries, verifyWorldInfoSearchSortRule } from './sorting.js';
export { getWorldEntry } from './entry-template.js';
export {
    updateWorldEntryKeyOptionsCache,
    getWorldEntryKeyOptionsCache,
    setCommentPlaceholder,
    enableKeysInputHelper,
    handleMatchCheckboxHelper,
    updatePosOrdDisplayHelper,
    initCharacterFilterSelect2Helper,
    fillCharacterAndTagOptionsHelper,
    handleCharacterFilterChangeHelper,
    handleProbabilityInputHelper,
    handleProbabilityToggleHelper,
    handleBooleanSelectHelper,
    handleNumberInputHelper,
    handleEntryStateSelectorHelper,
    handleEntryKillSwitchHelper,
} from './input-helpers.js';
