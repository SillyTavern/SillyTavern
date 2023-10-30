import { saveSettings, callPopup, substituteParams, getRequestHeaders, chat_metadata, this_chid, characters, saveCharacterDebounced, menu_type, eventSource, event_types, getExtensionPrompt, MAX_INJECTION_DEPTH, extension_prompt_types, getExtensionPromptByName, saveMetadata, getCurrentChatId } from "../script.js";
import { download, debounce, initScrollHeight, resetScrollHeight, parseJsonFile, extractDataFromPng, getFileBuffer, getCharaFilename, getSortableDelay, escapeRegex, PAGINATION_TEMPLATE, navigation_option, waitUntilCondition } from "./utils.js";
import { extension_settings, getContext } from "./extensions.js";
import { NOTE_MODULE_NAME, metadata_keys, shouldWIAddPrompt } from "./authors-note.js";
import { registerSlashCommand } from "./slash-commands.js";
import { getDeviceInfo } from "./RossAscends-mods.js";
import { FILTER_TYPES, FilterHelper } from "./filters.js";
import { getTokenCount } from "./tokenizers.js";
import { power_user } from "./power-user.js";

export {
    world_info,
    world_info_budget,
    world_info_depth,
    world_info_recursive,
    world_info_overflow_alert,
    world_info_case_sensitive,
    world_info_match_whole_words,
    world_info_character_strategy,
    world_info_budget_cap,
    world_names,
    checkWorldInfo,
    deleteWorldInfo,
    setWorldInfoSettings,
    getWorldInfoPrompt,
}

const world_info_insertion_strategy = {
    evenly: 0,
    character_first: 1,
    global_first: 2,
};

let world_info = {};
let selected_world_info = [];
let world_names;
let world_info_depth = 2;
let world_info_budget = 25;
let world_info_recursive = false;
let world_info_overflow_alert = false;
let world_info_case_sensitive = false;
let world_info_match_whole_words = false;
let world_info_character_strategy = world_info_insertion_strategy.character_first;
let world_info_budget_cap = 0;
const saveWorldDebounced = debounce(async (name, data) => await _save(name, data), 1000);
const saveSettingsDebounced = debounce(() => {
    Object.assign(world_info, { globalSelect: selected_world_info })
    saveSettings()
}, 1000);
const sortFn = (a, b) => b.order - a.order;
let updateEditor = (navigation) => { navigation; };

// Do not optimize. updateEditor is a function that is updated by the displayWorldEntries with new data.
const worldInfoFilter = new FilterHelper(() => updateEditor());
const SORT_ORDER_KEY = 'world_info_sort_order';
const METADATA_KEY = 'world_info';

const InputWidthReference = $("#WIInputWidthReference");

const DEFAULT_DEPTH = 4;

export function getWorldInfoSettings() {
    return {
        world_info,
        world_info_depth,
        world_info_budget,
        world_info_recursive,
        world_info_overflow_alert,
        world_info_case_sensitive,
        world_info_match_whole_words,
        world_info_character_strategy,
        world_info_budget_cap,
    }
}

const world_info_position = {
    before: 0,
    after: 1,
    ANTop: 2,
    ANBottom: 3,
    atDepth: 4,
};

const worldInfoCache = {};

async function getWorldInfoPrompt(chat2, maxContext) {
    let worldInfoString = "", worldInfoBefore = "", worldInfoAfter = "";

    const activatedWorldInfo = await checkWorldInfo(chat2, maxContext);
    worldInfoBefore = activatedWorldInfo.worldInfoBefore;
    worldInfoAfter = activatedWorldInfo.worldInfoAfter;
    worldInfoString = worldInfoBefore + worldInfoAfter;

    return {
        worldInfoString,
        worldInfoBefore,
        worldInfoAfter,
        worldInfoDepth: activatedWorldInfo.WIDepthEntries
    };
}

function setWorldInfoSettings(settings, data) {
    if (settings.world_info_depth !== undefined)
        world_info_depth = Number(settings.world_info_depth);
    if (settings.world_info_budget !== undefined)
        world_info_budget = Number(settings.world_info_budget);
    if (settings.world_info_recursive !== undefined)
        world_info_recursive = Boolean(settings.world_info_recursive);
    if (settings.world_info_overflow_alert !== undefined)
        world_info_overflow_alert = Boolean(settings.world_info_overflow_alert);
    if (settings.world_info_case_sensitive !== undefined)
        world_info_case_sensitive = Boolean(settings.world_info_case_sensitive);
    if (settings.world_info_match_whole_words !== undefined)
        world_info_match_whole_words = Boolean(settings.world_info_match_whole_words);
    if (settings.world_info_character_strategy !== undefined)
        world_info_character_strategy = Number(settings.world_info_character_strategy);
    if (settings.world_info_budget_cap !== undefined)
        world_info_budget_cap = Number(settings.world_info_budget_cap);

    // Migrate old settings
    if (world_info_budget > 100) {
        world_info_budget = 25;
    }

    // Reset selected world from old string and delete old keys
    // TODO: Remove next release
    const existingWorldInfo = settings.world_info;
    if (typeof existingWorldInfo === "string") {
        delete settings.world_info;
        selected_world_info = [existingWorldInfo];
    } else if (Array.isArray(existingWorldInfo)) {
        delete settings.world_info;
        selected_world_info = existingWorldInfo;
    }

    world_info = settings.world_info ?? {}

    $("#world_info_depth_counter").val(world_info_depth);
    $("#world_info_depth").val(world_info_depth);

    $("#world_info_budget_counter").val(world_info_budget);
    $("#world_info_budget").val(world_info_budget);

    $("#world_info_recursive").prop('checked', world_info_recursive);
    $("#world_info_overflow_alert").prop('checked', world_info_overflow_alert);
    $("#world_info_case_sensitive").prop('checked', world_info_case_sensitive);
    $("#world_info_match_whole_words").prop('checked', world_info_match_whole_words);

    $(`#world_info_character_strategy option[value='${world_info_character_strategy}']`).prop('selected', true);
    $("#world_info_character_strategy").val(world_info_character_strategy);

    $("#world_info_budget_cap").val(world_info_budget_cap);
    $("#world_info_budget_cap_counter").val(world_info_budget_cap);

    world_names = data.world_names?.length ? data.world_names : [];

    // Add to existing selected WI if it exists
    selected_world_info = selected_world_info.concat(settings.world_info?.globalSelect?.filter((e) => world_names.includes(e)) ?? []);

    if (world_names.length > 0) {
        $("#world_info").empty();
    }

    world_names.forEach((item, i) => {
        $("#world_info").append(`<option value='${i}'${selected_world_info.includes(item) ? ' selected' : ''}>${item}</option>`);
        $("#world_editor_select").append(`<option value='${i}'>${item}</option>`);
    });

    $('#world_info_sort_order').val(localStorage.getItem(SORT_ORDER_KEY) || '0');
    $("#world_editor_select").trigger("change");

    eventSource.on(event_types.CHAT_CHANGED, () => {
        const hasWorldInfo = !!chat_metadata[METADATA_KEY] && world_names.includes(chat_metadata[METADATA_KEY]);
        $('.chat_lorebook_button').toggleClass('world_set', hasWorldInfo);
    });
}

// World Info Editor
async function showWorldEditor(name) {
    if (!name) {
        hideWorldEditor();
        return;
    }

    const wiData = await loadWorldInfoData(name);
    displayWorldEntries(name, wiData);
}

async function loadWorldInfoData(name) {
    if (!name) {
        return;
    }

    if (worldInfoCache[name]) {
        return worldInfoCache[name];
    }

    const response = await fetch("/getworldinfo", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name }),
        cache: 'no-cache',
    });

    if (response.ok) {
        const data = await response.json();
        worldInfoCache[name] = data;
        return data;
    }

    return null;
}

async function updateWorldInfoList() {
    var result = await fetch("/getsettings", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (result.ok) {
        var data = await result.json();
        world_names = data.world_names?.length ? data.world_names : [];
        $("#world_info").find('option[value!=""]').remove();
        $("#world_editor_select").find('option[value!=""]').remove();

        world_names.forEach((item, i) => {
            $("#world_info").append(`<option value='${i}'${selected_world_info.includes(item) ? ' selected' : ''}>${item}</option>`);
            $("#world_editor_select").append(`<option value='${i}'>${item}</option>`);
        });
    }
}

function hideWorldEditor() {
    displayWorldEntries(null, null);
}

function getWIElement(name) {
    const wiElement = $("#world_info").children().filter(function () {
        return $(this).text().toLowerCase() === name.toLowerCase()
    });

    return wiElement;
}

/**
 * @param {any[]} data WI entries
 * @returns {any[]} Sorted data
 */
function sortEntries(data) {
    const option = $('#world_info_sort_order').find(":selected");
    const sortField = option.data('field');
    const sortOrder = option.data('order');
    const sortRule = option.data('rule');
    const orderSign = sortOrder === 'asc' ? 1 : -1;

    if (sortRule === 'priority') {
        // First constant, then normal, then disabled. Then sort by order
        data.sort((a, b) => {
            const aValue = a.constant ? 0 : a.disable ? 2 : 1;
            const bValue = b.constant ? 0 : b.disable ? 2 : 1;

            return (aValue - bValue || b.order - a.order);
        });
    } else {
        const primarySort = (a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];

            // Sort strings
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                if (sortRule === 'length') {
                    // Sort by string length
                    return orderSign * (aValue.length - bValue.length);
                } else {
                    // Sort by A-Z ordinal
                    return orderSign * aValue.localeCompare(bValue);
                }
            }

            // Sort numbers
            return orderSign * (Number(aValue) - Number(bValue));
        };
        const secondarySort = (a, b) => a.order - b.order;
        const tertiarySort = (a, b) => a.uid - b.uid;

        data.sort((a, b) => {
            const primary = primarySort(a, b);

            if (primary !== 0) {
                return primary;
            }

            const secondary = secondarySort(a, b);

            if (secondary !== 0) {
                return secondary;
            }

            return tertiarySort(a, b);
        });
    }

    return data;
}

function nullWorldInfo() {
    toastr.info("Create or import a new World Info file first.", "World Info is not set", { timeOut: 10000, preventDuplicates: true });
}

function displayWorldEntries(name, data, navigation = navigation_option.none) {
    updateEditor = (navigation) => displayWorldEntries(name, data, navigation);

    $("#world_popup_entries_list").empty().show();

    if (!data || !("entries" in data)) {
        $("#world_popup_new").off('click').on('click', nullWorldInfo);
        $("#world_popup_name_button").off('click').on('click', nullWorldInfo);
        $("#world_popup_export").off('click').on('click', nullWorldInfo);
        $("#world_popup_delete").off('click').on('click', nullWorldInfo);
        $("#world_popup_entries_list").hide();
        $('#world_info_pagination').html('');
        return;
    }

    function getDataArray(callback) {
        // Convert the data.entries object into an array
        let entriesArray = Object.keys(data.entries).map(uid => {
            const entry = data.entries[uid];
            entry.displayIndex = entry.displayIndex ?? entry.uid;
            return entry;
        });

        // Sort the entries array by displayIndex and uid
        entriesArray.sort((a, b) => a.displayIndex - b.displayIndex || a.uid - b.uid);
        entriesArray = sortEntries(entriesArray);
        entriesArray = worldInfoFilter.applyFilters(entriesArray);
        typeof callback === 'function' && callback(entriesArray);
        return entriesArray;
    }

    let startPage = 1;

    if (navigation === navigation_option.previous) {
        startPage = $("#world_info_pagination").pagination('getCurrentPageNum');
    }

    const storageKey = 'WI_PerPage';
    const perPageDefault = 25;
    $("#world_info_pagination").pagination({
        dataSource: getDataArray,
        pageSize: Number(localStorage.getItem(storageKey)) || perPageDefault,
        sizeChangerOptions: [10, 25, 50, 100],
        showSizeChanger: true,
        pageRange: 1,
        pageNumber: startPage,
        position: 'top',
        showPageNumbers: false,
        prevText: '<',
        nextText: '>',
        formatNavigator: PAGINATION_TEMPLATE,
        showNavigator: true,
        callback: function (page) {
            $("#world_popup_entries_list").empty();
            const keywordHeaders = `
            <div id="WIEntryHeaderTitlesPC" class="flex-container wide100p spaceBetween justifyCenter textAlignCenter" style="padding:0 2.5em;">
            <small class="flex1">
            Title/Memo
        </small>
                <small style="width:${InputWidthReference.width() + 5 + 'px'}">
                    Status
                </small>
                <small style="width:${InputWidthReference.width() + 20 + 'px'}">
                    Position
                </small>
                <small style="width:${InputWidthReference.width() + 15 + 'px'}">
                    Depth
                </small>
                <small style="width:${InputWidthReference.width() + 15 + 'px'}">
                    Order
                </small>
                <small style="width:${InputWidthReference.width() + 15 + 'px'}">
                    Trigger %
                </small>

            </div>`
            const blocks = page.map(entry => getWorldEntry(name, data, entry));
            $("#world_popup_entries_list").append(keywordHeaders);
            $("#world_popup_entries_list").append(blocks);
        },
        afterSizeSelectorChange: function (e) {
            localStorage.setItem(storageKey, e.target.value);
        }
    });

    if (typeof navigation === 'number' && Number(navigation) >= 0) {
        const selector = `#world_popup_entries_list [uid="${navigation}"]`;
        const data = getDataArray();
        const uidIndex = data.findIndex(x => x.uid === navigation);
        const perPage = Number(localStorage.getItem(storageKey)) || perPageDefault;
        const page = Math.floor(uidIndex / perPage) + 1;
        $("#world_info_pagination").pagination('go', page);
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
            element.addClass('flash animated');
            setTimeout(() => element.removeClass('flash animated'), 2000);
        });
    }

    $("#world_popup_new").off('click').on('click', () => {
        createWorldInfoEntry(name, data);
    });

    $("#world_popup_name_button").off('click').on('click', async () => {
        await renameWorldInfo(name, data);
    });

    $("#world_backfill_memos").off('click').on('click', async () => {
        let counter = 0;
        for (const entry of Object.values(data.entries)) {
            if (!entry.comment && Array.isArray(entry.key) && entry.key.length > 0) {
                entry.comment = entry.key[0];
                setOriginalDataValue(data, entry.uid, "comment", entry.comment);
                counter++;
            }
        }

        if (counter > 0) {
            toastr.info(`Backfilled ${counter} titles`);
            await saveWorldInfo(name, data, true);
            updateEditor(navigation_option.previous);
        }
    });

    $("#world_popup_export").off('click').on('click', () => {
        if (name && data) {
            const jsonValue = JSON.stringify(data);
            const fileName = `${name}.json`;
            download(jsonValue, fileName, "application/json");
        }
    });

    $("#world_popup_delete").off('click').on('click', async () => {
        const confirmation = await callPopup(`<h3>Delete the World/Lorebook: "${name}"?</h3>This action is irreversible!`, "confirm");

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

    // Check if a sortable instance exists
    if ($('#world_popup_entries_list').sortable('instance') !== undefined) {
        // Destroy the instance
        $('#world_popup_entries_list').sortable('destroy');
    }

    $("#world_popup_entries_list").sortable({
        delay: getSortableDelay(),
        handle: ".drag-handle",
        stop: async function (event, ui) {
            $('#world_popup_entries_list .world_entry').each(function (index) {
                const uid = $(this).data('uid');

                // Update the display index in the data array
                const item = data.entries[uid];

                if (!item) {
                    console.debug(`Could not find entry with uid ${uid}`);
                    return;
                }

                item.displayIndex = index;
                setOriginalDataValue(data, uid, 'extensions.display_index', index);
            });

            console.table(Object.keys(data.entries).map(uid => data.entries[uid]).map(x => ({ uid: x.uid, key: x.key.join(','), displayIndex: x.displayIndex })));

            await saveWorldInfo(name, data, true);
        }
    });
    //$("#world_popup_entries_list").disableSelection();
}

function setOriginalDataValue(data, uid, key, value) {
    if (data.originalData && Array.isArray(data.originalData.entries)) {
        let originalEntry = data.originalData.entries.find(x => x.uid === uid);

        if (!originalEntry) {
            return;
        }

        const keyParts = key.split('.');
        let currentObject = originalEntry;

        for (let i = 0; i < keyParts.length - 1; i++) {
            const part = keyParts[i];

            if (!currentObject.hasOwnProperty(part)) {
                currentObject[part] = {};
            }

            currentObject = currentObject[part];
        }

        currentObject[keyParts[keyParts.length - 1]] = value;
    }
}

function deleteOriginalDataValue(data, uid) {
    if (data.originalData && Array.isArray(data.originalData.entries)) {
        const originalIndex = data.originalData.entries.findIndex(x => x.uid === uid);

        if (originalIndex >= 0) {
            data.originalData.entries.splice(originalIndex, 1);
        }
    }
}

function getWorldEntry(name, data, entry) {
    const template = $("#entry_edit_template .world_entry").clone();
    template.data("uid", entry.uid);
    template.attr("uid", entry.uid);

    // key
    const keyInput = template.find('textarea[name="key"]');
    keyInput.data("uid", entry.uid);
    keyInput.on("click", function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });

    keyInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = String($(this).val());
        resetScrollHeight(this);
        data.entries[uid].key = value
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x);

        setOriginalDataValue(data, uid, "keys", data.entries[uid].key);
        saveWorldInfo(name, data);
    });
    keyInput.val(entry.key.join(",")).trigger("input");
    //initScrollHeight(keyInput);

    // logic AND/NOT
    const selectiveLogicDropdown = template.find('select[name="entryLogicType"]');
    selectiveLogicDropdown.data("uid", entry.uid);

    selectiveLogicDropdown.on("click", function (event) {
        event.stopPropagation();
    })

    selectiveLogicDropdown.on("input", function () {
        const uid = $(this).data("uid");
        const value = Number($(this).val());
        console.debug(`logic for ${entry.uid} set to ${value}`)
        data.entries[uid].selectiveLogic = !isNaN(value) ? value : 0;
        setOriginalDataValue(data, uid, "selectiveLogic", data.entries[uid].selectiveLogic);
        saveWorldInfo(name, data);
    });

    template
        .find(`select[name="entryLogicType"] option[value=${entry.selectiveLogic}]`)
        .prop("selected", true)
        .trigger("input");

    // Character filter
    const characterFilterLabel = template.find(`label[for="characterFilter"] > small`);
    characterFilterLabel.text(!!(entry.characterFilter?.isExclude) ? "Exclude Character(s)" : "Filter to Character(s)");

    // exclude characters checkbox
    const characterExclusionInput = template.find(`input[name="character_exclusion"]`);
    characterExclusionInput.data("uid", entry.uid);
    characterExclusionInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        characterFilterLabel.text(value ? "Exclude Character(s)" : "Filter to Character(s)");
        if (data.entries[uid].characterFilter) {
            if (!value && data.entries[uid].characterFilter.names.length === 0) {
                delete data.entries[uid].characterFilter;
            } else {
                data.entries[uid].characterFilter.isExclude = value
            }
        } else if (value) {
            Object.assign(
                data.entries[uid],
                {
                    characterFilter: {
                        isExclude: true,
                        names: []
                    }
                }
            );
        }

        setOriginalDataValue(data, uid, "character_filter", data.entries[uid].characterFilter);
        saveWorldInfo(name, data);
    });
    characterExclusionInput.prop("checked", entry.characterFilter?.isExclude ?? false).trigger("input");

    const characterFilter = template.find(`select[name="characterFilter"]`);
    characterFilter.data("uid", entry.uid)
    const deviceInfo = getDeviceInfo();
    if (deviceInfo && deviceInfo.device.type === 'desktop') {
        $(characterFilter).select2({
            width: '100%',
            placeholder: 'All characters will pull from this entry.',
            allowClear: true,
            closeOnSelect: false,
        });
    }
    const characters = getContext().characters;
    characters.forEach((character) => {
        const option = document.createElement('option');
        const name = character.avatar.replace(/\.[^/.]+$/, "") ?? character.name
        option.innerText = name
        option.selected = entry.characterFilter?.names.includes(name)
        characterFilter.append(option)
    });

    characterFilter.on('mousedown change', async function (e) {
        // If there's no world names, don't do anything
        if (world_names.length === 0) {
            e.preventDefault();
            return;
        }

        const uid = $(this).data("uid");
        const value = $(this).val();
        if ((!value || value?.length === 0) && !data.entries[uid].characterFilter?.isExclude) {
            delete data.entries[uid].characterFilter;
        } else {
            Object.assign(
                data.entries[uid],
                {
                    characterFilter: {
                        isExclude: data.entries[uid].characterFilter?.isExclude ?? false,
                        names: value
                    }
                }
            );
        }
        setOriginalDataValue(data, uid, "character_filter", data.entries[uid].characterFilter);
        saveWorldInfo(name, data);
    });

    // keysecondary
    const keySecondaryInput = template.find('textarea[name="keysecondary"]');
    keySecondaryInput.data("uid", entry.uid);
    keySecondaryInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = String($(this).val());
        resetScrollHeight(this);
        data.entries[uid].keysecondary = value
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x);

        setOriginalDataValue(data, uid, "secondary_keys", data.entries[uid].keysecondary);
        saveWorldInfo(name, data);
    });

    keySecondaryInput.val(entry.keysecondary.join(",")).trigger("input");
    initScrollHeight(keySecondaryInput);

    // comment
    const commentInput = template.find('textarea[name="comment"]');
    const commentToggle = template.find('input[name="addMemo"]');
    commentInput.data("uid", entry.uid);
    commentInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).val();
        resetScrollHeight(this);
        data.entries[uid].comment = value;

        setOriginalDataValue(data, uid, "comment", data.entries[uid].comment);
        saveWorldInfo(name, data);
    });
    commentToggle.data("uid", entry.uid);
    commentToggle.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        //console.log(value)
        const commentContainer = $(this)
            .closest(".world_entry")
            .find(".commentContainer");
        data.entries[uid].addMemo = value;
        saveWorldInfo(name, data);
        value ? commentContainer.show() : commentContainer.hide();
    });

    commentInput.val(entry.comment).trigger("input");
    initScrollHeight(commentInput);
    commentToggle.prop("checked", true /* entry.addMemo */).trigger("input");
    commentToggle.parent().hide()

    // content
    const counter = template.find(".world_entry_form_token_counter");
    const countTokensDebounced = debounce(function (counter, value) {
        const numberOfTokens = getTokenCount(value);
        $(counter).text(numberOfTokens);
    }, 1000);

    const contentInput = template.find('textarea[name="content"]');
    contentInput.data("uid", entry.uid);
    contentInput.on("input", function (_, { skipCount } = {}) {
        const uid = $(this).data("uid");
        const value = $(this).val();
        data.entries[uid].content = value;

        setOriginalDataValue(data, uid, "content", data.entries[uid].content);
        saveWorldInfo(name, data);

        if (skipCount) {
            return;
        }

        // count tokens
        countTokensDebounced(counter, value);
    });
    contentInput.val(entry.content).trigger("input", { skipCount: true });
    //initScrollHeight(contentInput);

    template.find('.inline-drawer-toggle').on('click', function () {
        if (counter.data('first-run')) {
            counter.data('first-run', false);
            countTokensDebounced(counter, contentInput.val());
        }
    });

    // selective
    const selectiveInput = template.find('input[name="selective"]');
    selectiveInput.data("uid", entry.uid);
    selectiveInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        data.entries[uid].selective = value;

        setOriginalDataValue(data, uid, "selective", data.entries[uid].selective);
        saveWorldInfo(name, data);

        const keysecondary = $(this)
            .closest(".world_entry")
            .find(".keysecondary");

        const keysecondarytextpole = $(this)
            .closest(".world_entry")
            .find(".keysecondarytextpole");

        const keyprimarytextpole = $(this)
            .closest(".world_entry")
            .find(".keyprimarytextpole");

        const keyprimaryHeight = keyprimarytextpole.outerHeight();
        keysecondarytextpole.css('height', keyprimaryHeight + 'px');

        value ? keysecondary.show() : keysecondary.hide();

    });
    //forced on, ignored if empty
    selectiveInput.prop("checked", true /* entry.selective */).trigger("input");
    selectiveInput.parent().hide();


    // constant
    /*
    const constantInput = template.find('input[name="constant"]');
    constantInput.data("uid", entry.uid);
    constantInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        data.entries[uid].constant = value;
        setOriginalDataValue(data, uid, "constant", data.entries[uid].constant);
        saveWorldInfo(name, data);
    });
    constantInput.prop("checked", entry.constant).trigger("input");
    */

    // order
    const orderInput = template.find('input[name="order"]');
    orderInput.data("uid", entry.uid);
    orderInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = Number($(this).val());

        data.entries[uid].order = !isNaN(value) ? value : 0;
        updatePosOrdDisplay(uid)
        setOriginalDataValue(data, uid, "insertion_order", data.entries[uid].order);
        saveWorldInfo(name, data);
    });
    orderInput.val(entry.order).trigger("input");
    orderInput.width(InputWidthReference.width() + 15 + 'px')

    // probability
    if (entry.probability === undefined) {
        entry.probability = null;
    }

    // depth
    const depthInput = template.find('input[name="depth"]');
    depthInput.data("uid", entry.uid);

    depthInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = Number($(this).val());

        data.entries[uid].depth = !isNaN(value) ? value : 0;
        updatePosOrdDisplay(uid)
        setOriginalDataValue(data, uid, "extensions.depth", data.entries[uid].depth);
        saveWorldInfo(name, data);
    });
    depthInput.val(entry.depth ?? DEFAULT_DEPTH).trigger("input");
    depthInput.width(InputWidthReference.width() + 15 + 'px');

    // Hide by default unless depth is specified
    if (entry.position === world_info_position.atDepth) {
        //depthInput.parent().hide();
    }

    const probabilityInput = template.find('input[name="probability"]');
    probabilityInput.data("uid", entry.uid);
    probabilityInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = parseInt($(this).val());

        data.entries[uid].probability = !isNaN(value) ? value : null;

        // Clamp probability to 0-100
        if (data.entries[uid].probability !== null) {
            data.entries[uid].probability = Math.min(100, Math.max(0, data.entries[uid].probability));

            if (data.entries[uid].probability !== value) {
                $(this).val(data.entries[uid].probability);
            }
        }

        setOriginalDataValue(data, uid, "extensions.probability", data.entries[uid].probability);
        saveWorldInfo(name, data);
    });
    probabilityInput.val(entry.probability).trigger("input");
    probabilityInput.width(InputWidthReference.width() + 15 + 'px')

    // probability toggle
    if (entry.useProbability === undefined) {
        entry.useProbability = false;
    }

    const probabilityToggle = template.find('input[name="useProbability"]');
    probabilityToggle.data("uid", entry.uid);
    probabilityToggle.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        data.entries[uid].useProbability = value;
        const probabilityContainer = $(this)
            .closest(".world_entry")
            .find(".probabilityContainer");
        saveWorldInfo(name, data);
        value ? probabilityContainer.show() : probabilityContainer.hide();

        if (value && data.entries[uid].probability === null) {
            data.entries[uid].probability = 100;
        }

        if (!value) {
            data.entries[uid].probability = null;
        }

        probabilityInput.val(data.entries[uid].probability).trigger("input");
    });
    //forced on, 100% by default
    probabilityToggle.prop("checked", true /* entry.useProbability */).trigger("input");
    probabilityToggle.parent().hide();

    // position
    if (entry.position === undefined) {
        entry.position = 0;
    }

    const positionInput = template.find('select[name="position"]');
    initScrollHeight(positionInput);
    positionInput.data("uid", entry.uid);
    positionInput.on("click", function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });
    positionInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = Number($(this).val());
        data.entries[uid].position = !isNaN(value) ? value : 0;
        if (value === world_info_position.atDepth) {
            depthInput.prop('disabled', false);
            depthInput.css('visibility', 'visible')
            //depthInput.parent().show();
        } else {
            depthInput.prop('disabled', true);
            depthInput.css('visibility', 'hidden')
            //depthInput.parent().hide();
        }
        updatePosOrdDisplay(uid)
        // Spec v2 only supports before_char and after_char
        setOriginalDataValue(data, uid, "position", data.entries[uid].position == 0 ? 'before_char' : 'after_char');
        // Write the original value as extensions field
        setOriginalDataValue(data, uid, "extensions.position", data.entries[uid].position);
        saveWorldInfo(name, data);
    });

    template
        .find(`select[name="position"] option[value=${entry.position}]`)
        .prop("selected", true)
        .trigger("input");

    //add UID above content box (less important doesn't need to be always visible)
    template.find(".world_entry_form_uid_value").text(`(UID: ${entry.uid})`);

    // disable
    /*
    const disableInput = template.find('input[name="disable"]');
    disableInput.data("uid", entry.uid);
    disableInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        data.entries[uid].disable = value;
        setOriginalDataValue(data, uid, "enabled", !data.entries[uid].disable);
        saveWorldInfo(name, data);
    });
    disableInput.prop("checked", entry.disable).trigger("input");
    */

    //new tri-state selector for constant/normal/disabled
    const entryStateSelector = template.find('select[name="entryStateSelector"]');
    entryStateSelector.data("uid", entry.uid);
    console.log(entry.uid)
    entryStateSelector.on("click", function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });
    entryStateSelector.on("input", function () {
        const uid = entry.uid;
        const value = $(this).val();
        switch (value) {
            case "constant":
                data.entries[uid].constant = true;
                data.entries[uid].disable = false;
                setOriginalDataValue(data, uid, "enabled", true);
                setOriginalDataValue(data, uid, "constant", true);
                template.removeClass('disabledWIEntry');
                console.debug("set to constant")
                break
            case "normal":
                data.entries[uid].constant = false;
                data.entries[uid].disable = false;
                setOriginalDataValue(data, uid, "enabled", true);
                setOriginalDataValue(data, uid, "constant", false);
                template.removeClass('disabledWIEntry');
                console.debug("set to normal")
                break
            case "disabled":
                data.entries[uid].constant = false;
                data.entries[uid].disable = true;
                setOriginalDataValue(data, uid, "enabled", false);
                setOriginalDataValue(data, uid, "constant", false);
                template.addClass('disabledWIEntry');
                console.debug("set to disabled")
                break
        }
        saveWorldInfo(name, data);

    })

    const entryState = function () {

        console.log(`constant: ${entry.constant},  disabled: ${entry.disable}`)
        if (entry.constant === true) {
            console.debug('found constant')
            return "constant"
        } else if (entry.disable === true) {
            console.debug('found disabled')
            return "disabled"
        } else {
            console.debug('found normal')
            return "normal"
        }

    }
    template
        .find(`select[name="entryStateSelector"] option[value=${entryState()}]`)
        .prop("selected", true)
        .trigger("input");

    saveWorldInfo(name, data);

    // exclude recursion
    const excludeRecursionInput = template.find('input[name="exclude_recursion"]');
    excludeRecursionInput.data("uid", entry.uid);
    excludeRecursionInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        data.entries[uid].excludeRecursion = value;
        setOriginalDataValue(data, uid, "extensions.exclude_recursion", data.entries[uid].excludeRecursion);
        saveWorldInfo(name, data);
    });
    excludeRecursionInput.prop("checked", entry.excludeRecursion).trigger("input");

    // delete button
    const deleteButton = template.find(".delete_entry_button");
    deleteButton.data("uid", entry.uid);
    deleteButton.on("click", function () {
        const uid = $(this).data("uid");
        deleteWorldInfoEntry(data, uid);
        deleteOriginalDataValue(data, uid);
        saveWorldInfo(name, data);
        updateEditor(navigation_option.previous);
    });

    template.find('.inline-drawer-content').css('display', 'none'); //entries start collapsed

    function updatePosOrdDisplay(uid) {
        // display position/order info left of keyword box
        let entry = data.entries[uid]
        let posText = entry.position
        switch (entry.position) {
            case 0:
                posText = '↑CD';
                break
            case 1:
                posText = 'CD↓';
                break
            case 2:
                posText = '↑AN';
                break
            case 3:
                posText = 'AN↓';
                break
            case 4:
                posText = `@D${entry.depth}`;
                break
        }
        template.find(".world_entry_form_position_value").text(`(${posText} ${entry.order})`);
    }

    return template;
}

async function deleteWorldInfoEntry(data, uid) {
    if (!data || !("entries" in data)) {
        return;
    }

    if (!confirm(`Delete the entry with UID: ${uid}? This action is irreversible!`)) {
        throw new Error("User cancelled deletion");
    }

    delete data.entries[uid];
}

function createWorldInfoEntry(name, data) {
    const newEntryTemplate = {
        key: [],
        keysecondary: [],
        comment: "",
        content: "",
        constant: false,
        selective: true,
        selectiveLogic: 0,
        addMemo: false,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false,
        probability: 100,
        useProbability: true,
    };
    const newUid = getFreeWorldEntryUid(data);

    if (!Number.isInteger(newUid)) {
        console.error("Couldn't assign UID to a new entry");
        return;
    }

    const newEntry = { uid: newUid, ...newEntryTemplate };
    data.entries[newUid] = newEntry;

    updateEditor(newUid);
}

async function _save(name, data) {
    const response = await fetch("/editworldinfo", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name, data: data }),
    });
}

async function saveWorldInfo(name, data, immediately) {
    if (!name || !data) {
        return;
    }

    delete worldInfoCache[name];

    if (immediately) {
        return await _save(name, data);
    }

    saveWorldDebounced(name, data);
}

async function renameWorldInfo(name, data) {
    const oldName = name;
    const newName = await callPopup("<h3>Rename World Info</h3>Enter a new name:", 'input', oldName);

    if (oldName === newName || !newName) {
        console.debug("World info rename cancelled");
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
        wiElement.prop("selected", true);
        $("#world_info").trigger('change');
    }

    const selectedIndex = world_names.indexOf(newName);
    if (selectedIndex !== -1) {
        $('#world_editor_select').val(selectedIndex).trigger('change');
    }
}

async function deleteWorldInfo(worldInfoName) {
    if (!world_names.includes(worldInfoName)) {
        return;
    }

    const response = await fetch("/deleteworldinfo", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: worldInfoName }),
    });

    if (response.ok) {
        const existingWorldIndex = selected_world_info.findIndex((e) => e === worldInfoName);
        if (existingWorldIndex !== -1) {
            selected_world_info.splice(existingWorldIndex, 1);
            saveSettingsDebounced();
        }

        await updateWorldInfoList();
        $('#world_editor_select').trigger('change');

        if ($('#character_world').val() === worldInfoName) {
            $('#character_world').val('').trigger('change');
            setWorldInfoButtonClass(undefined, false);
            if (menu_type != 'create') {
                saveCharacterDebounced();
            }
        }
    }
}

function getFreeWorldEntryUid(data) {
    if (!data || !("entries" in data)) {
        return null;
    }

    const MAX_UID = 1_000_000; // <- should be safe enough :)
    for (let uid = 0; uid < MAX_UID; uid++) {
        if (uid in data.entries) {
            continue;
        }
        return uid;
    }

    return null;
}

function getFreeWorldName() {
    const MAX_FREE_NAME = 100_000;
    for (let index = 1; index < MAX_FREE_NAME; index++) {
        const newName = `New World (${index})`;
        if (world_names.includes(newName)) {
            continue;
        }
        return newName;
    }

    return undefined;
}

async function createNewWorldInfo(worldInfoName) {
    const worldInfoTemplate = { entries: {} };

    if (!worldInfoName) {
        return;
    }

    await saveWorldInfo(worldInfoName, worldInfoTemplate, true);
    await updateWorldInfoList();

    const selectedIndex = world_names.indexOf(worldInfoName);
    if (selectedIndex !== -1) {
        $('#world_editor_select').val(selectedIndex).trigger('change');
    } else {
        hideWorldEditor();
    }
}

// Gets a string that respects the case sensitivity setting
function transformString(str) {
    return world_info_case_sensitive ? str : str.toLowerCase();
}

async function getCharacterLore() {
    const character = characters[this_chid];
    const name = character?.name;
    let worldsToSearch = new Set();

    const baseWorldName = character?.data?.extensions?.world;
    if (baseWorldName) {
        worldsToSearch.add(baseWorldName);
    } else {
        console.debug(`Character ${name}'s base world could not be found or is empty! Skipping...`)
        return [];
    }

    // TODO: Maybe make the utility function not use the window context?
    const fileName = getCharaFilename(this_chid);
    const extraCharLore = world_info.charLore?.find((e) => e.name === fileName);
    if (extraCharLore) {
        worldsToSearch = new Set([...worldsToSearch, ...extraCharLore.extraBooks]);
    }

    let entries = [];
    for (const worldName of worldsToSearch) {
        if (selected_world_info.includes(worldName)) {
            console.debug(`Character ${name}'s world ${worldName} is already activated in global world info! Skipping...`);
            continue;
        }

        if (chat_metadata[METADATA_KEY] === worldName) {
            console.debug(`Character ${name}'s world ${worldName} is already activated in chat lore! Skipping...`);
            continue;
        }

        const data = await loadWorldInfoData(worldName);
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]) : [];
        entries = entries.concat(newEntries);
    }

    console.debug(`Character ${characters[this_chid]?.name} lore (${baseWorldName}) has ${entries.length} world info entries`);
    return entries;
}

async function getGlobalLore() {
    if (!selected_world_info) {
        return [];
    }

    let entries = [];
    for (const worldName of selected_world_info) {
        const data = await loadWorldInfoData(worldName);
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]) : [];
        entries = entries.concat(newEntries);
    }

    console.debug(`Global world info has ${entries.length} entries`);

    return entries;
}

async function getChatLore() {
    const chatWorld = chat_metadata[METADATA_KEY];

    if (!chatWorld) {
        return [];
    }

    if (selected_world_info.includes(chatWorld)) {
        console.debug(`Chat world ${chatWorld} is already activated in global world info! Skipping...`);
        return [];
    }

    const data = await loadWorldInfoData(chatWorld);
    const entries = data ? Object.keys(data.entries).map((x) => data.entries[x]) : [];

    console.debug(`Chat lore has ${entries.length} entries`);

    return entries;
}

async function getSortedEntries() {
    try {
        const globalLore = await getGlobalLore();
        const characterLore = await getCharacterLore();
        const chatLore = await getChatLore();

        let entries;

        switch (Number(world_info_character_strategy)) {
            case world_info_insertion_strategy.evenly:
                console.debug('WI using evenly')
                entries = [...globalLore, ...characterLore].sort(sortFn);
                break;
            case world_info_insertion_strategy.character_first:
                console.debug('WI using char first')
                entries = [...characterLore.sort(sortFn), ...globalLore.sort(sortFn)];
                break;
            case world_info_insertion_strategy.global_first:
                console.debug('WI using global first')
                entries = [...globalLore.sort(sortFn), ...characterLore.sort(sortFn)];
                break;
            default:
                console.error("Unknown WI insertion strategy: ", world_info_character_strategy, "defaulting to evenly");
                entries = [...globalLore, ...characterLore].sort(sortFn);
                break;
        }

        // Chat lore always goes first
        entries = [...chatLore.sort(sortFn), ...entries];

        console.debug(`Sorted ${entries.length} world lore entries using strategy ${world_info_character_strategy}`);

        // Need to deep clone the entries to avoid modifying the cached data
        return structuredClone(entries);
    }
    catch (e) {
        console.error(e);
        return [];
    }
}

async function checkWorldInfo(chat, maxContext) {
    const context = getContext();
    const messagesToLookBack = world_info_depth * 2 || 1;

    // Combine the chat
    let textToScan = chat.slice(0, messagesToLookBack).join("");

    // Add the depth or AN if enabled
    // Put this code here since otherwise, the chat reference is modified
    if (extension_settings.note.allowWIScan) {
        for (const key of Object.keys(context.extensionPrompts)) {
            if (key.startsWith('DEPTH_PROMPT')) {
                const depthPrompt = getExtensionPromptByName(key)
                if (depthPrompt) {
                    textToScan = `${depthPrompt}\n${textToScan}`
                }
            }
        }

        const anPrompt = getExtensionPromptByName(NOTE_MODULE_NAME);
        if (anPrompt) {
            textToScan = `${anPrompt}\n${textToScan}`
        }
    }

    // Transform the resulting string
    textToScan = transformString(textToScan);

    let needsToScan = true;
    let count = 0;
    let allActivatedEntries = new Set();
    let failedProbabilityChecks = new Set();
    let allActivatedText = '';

    let budget = Math.round(world_info_budget * maxContext / 100) || 1;

    if (world_info_budget_cap > 0 && budget > world_info_budget_cap) {
        console.debug(`Budget ${budget} exceeds cap ${world_info_budget_cap}, using cap`);
        budget = world_info_budget_cap;
    }

    console.debug(`Context size: ${maxContext}; WI budget: ${budget} (max% = ${world_info_budget}%, cap = ${world_info_budget_cap})`);
    const sortedEntries = await getSortedEntries();

    if (sortedEntries.length === 0) {
        return { worldInfoBefore: '', worldInfoAfter: '' };
    }

    while (needsToScan) {
        // Track how many times the loop has run
        count++;

        let activatedNow = new Set();

        for (let entry of sortedEntries) {
            // Check if this entry applies to the character or if it's excluded
            if (entry.characterFilter && entry.characterFilter?.names.length > 0) {
                const nameIncluded = entry.characterFilter.names.includes(getCharaFilename());
                const filtered = entry.characterFilter.isExclude ? nameIncluded : !nameIncluded

                if (filtered) {
                    continue;
                }
            }

            if (failedProbabilityChecks.has(entry)) {
                continue;
            }

            if (allActivatedEntries.has(entry) || entry.disable == true || (count > 1 && world_info_recursive && entry.excludeRecursion)) {
                continue;
            }

            if (entry.constant) {
                entry.content = substituteParams(entry.content)
                activatedNow.add(entry);
                continue;
            }

            if (Array.isArray(entry.key) && entry.key.length) { //check for keywords existing
                primary: for (let key of entry.key) {
                    const substituted = substituteParams(key);
                    console.debug(`${entry.uid}: ${substituted}`)
                    if (substituted && matchKeys(textToScan, substituted.trim())) {
                        console.debug(`${entry.uid}: got primary match`)
                        //selective logic begins
                        if (
                            entry.selective && //all entries are selective now
                            Array.isArray(entry.keysecondary) && //always true
                            entry.keysecondary.length //ignore empties
                        ) {
                            console.debug(`uid:${entry.uid}: checking logic: ${entry.selectiveLogic}`)
                            secondary: for (let keysecondary of entry.keysecondary) {
                                const secondarySubstituted = substituteParams(keysecondary);
                                console.debug(`uid:${entry.uid}: filtering ${secondarySubstituted}`);

                                // If selectiveLogic isn't found, assume it's AND
                                const selectiveLogic = entry.selectiveLogic ?? 0;

                                //AND operator
                                if (selectiveLogic === 0) {
                                    console.debug('saw AND logic, checking..')
                                    if (secondarySubstituted && matchKeys(textToScan, secondarySubstituted.trim())) {
                                        console.debug(`activating entry ${entry.uid} with AND found`)
                                        activatedNow.add(entry);
                                        break secondary;
                                    }
                                }
                                //NOT operator
                                if (selectiveLogic === 1) {
                                    console.debug(`uid ${entry.uid}: checking NOT logic for ${secondarySubstituted}`)
                                    if (secondarySubstituted && matchKeys(textToScan, secondarySubstituted.trim())) {
                                        console.debug(`uid ${entry.uid}: canceled; filtered out by ${secondarySubstituted}`)
                                        break primary;
                                    } else {
                                        console.debug(`${entry.uid}: activated; passed NOT filter`)
                                        activatedNow.add(entry);
                                        break secondary;
                                    }
                                }
                            }
                            //handle cases where secondary is empty
                        } else {
                            console.debug(`uid ${entry.uid}: activated without filter logic`)
                            activatedNow.add(entry);
                            break primary;
                        }
                    } else { console.debug('no active entries for logic checks yet') }
                }
            }
        }

        needsToScan = world_info_recursive && activatedNow.size > 0;
        const newEntries = [...activatedNow]
            .sort((a, b) => sortedEntries.indexOf(a) - sortedEntries.indexOf(b));
        let newContent = "";
        const textToScanTokens = getTokenCount(allActivatedText);
        const probabilityChecksBefore = failedProbabilityChecks.size;
        console.debug(`-- PROBABILITY CHECKS BEGIN --`)
        for (const entry of newEntries) {
            const rollValue = Math.random() * 100;


            if (entry.useProbability && rollValue > entry.probability) {
                console.debug(`WI entry ${entry.uid} ${entry.key} failed probability check, skipping`);
                failedProbabilityChecks.add(entry);
                continue;
            } else { console.debug(`uid:${entry.uid} passed probability check, inserting to prompt`) }

            newContent += `${substituteParams(entry.content)}\n`;

            if (textToScanTokens + getTokenCount(newContent) >= budget) {
                console.debug(`WI budget reached, stopping`);
                if (world_info_overflow_alert) {
                    console.log("Alerting");
                    toastr.warning(`World info budget reached after ${allActivatedEntries.size} entries.`, 'World Info');
                }
                needsToScan = false;
                break;
            }

            allActivatedEntries.add(entry);
            console.debug('WI entry activated:', entry);
        }

        const probabilityChecksAfter = failedProbabilityChecks.size;

        if ((probabilityChecksAfter - probabilityChecksBefore) === activatedNow.size) {
            console.debug(`WI probability checks failed for all activated entries, stopping`);
            needsToScan = false;
        }

        if (needsToScan) {
            const text = newEntries
                .filter(x => !failedProbabilityChecks.has(x))
                .map(x => x.content).join('\n');
            const currentlyActivatedText = transformString(text);
            textToScan = (currentlyActivatedText + '\n' + textToScan);
            allActivatedText = (currentlyActivatedText + '\n' + allActivatedText);
        }
    }

    // Forward-sorted list of entries for joining
    const WIBeforeEntries = [];
    const WIAfterEntries = [];
    const ANTopEntries = [];
    const ANBottomEntries = [];
    const WIDepthEntries = [];

    // Appends from insertion order 999 to 1. Use unshift for this purpose
    [...allActivatedEntries].sort(sortFn).forEach((entry) => {
        switch (entry.position) {
            case world_info_position.before:
                WIBeforeEntries.unshift(substituteParams(entry.content));
                break;
            case world_info_position.after:
                WIAfterEntries.unshift(substituteParams(entry.content));
                break;
            case world_info_position.ANTop:
                ANTopEntries.unshift(entry.content);
                break;
            case world_info_position.ANBottom:
                ANBottomEntries.unshift(entry.content);
                break;
            case world_info_position.atDepth:
                const existingDepthIndex = WIDepthEntries.findIndex((e) => e.depth === entry.depth ?? DEFAULT_DEPTH);
                if (existingDepthIndex !== -1) {
                    WIDepthEntries[existingDepthIndex].entries.unshift(entry.content);
                } else {
                    WIDepthEntries.push({
                        depth: entry.depth,
                        entries: [entry.content]
                    });
                }
            default:
                break;
        }
    });

    const worldInfoBefore = WIBeforeEntries.length ? WIBeforeEntries.join("\n") : '';
    const worldInfoAfter = WIAfterEntries.length ? WIAfterEntries.join("\n") : '';

    if (shouldWIAddPrompt) {
        const originalAN = context.extensionPrompts[NOTE_MODULE_NAME].value;
        const ANWithWI = `${ANTopEntries.join("\n")}\n${originalAN}\n${ANBottomEntries.join("\n")}`
        context.setExtensionPrompt(NOTE_MODULE_NAME, ANWithWI, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth]);
    }

    return { worldInfoBefore, worldInfoAfter, WIDepthEntries };
}

function matchKeys(haystack, needle) {
    const transformedString = transformString(needle);

    if (world_info_match_whole_words) {
        const keyWords = transformedString.split(/\s+/);

        if (keyWords.length > 1) {
            return haystack.includes(transformedString);
        }
        else {
            const regex = new RegExp(`\\b${escapeRegex(transformedString)}\\b`);
            if (regex.test(haystack)) {
                return true;
            }
        }

    } else {
        return haystack.includes(transformedString);
    }

    return false;
}

function convertAgnaiMemoryBook(inputObj) {
    const outputObj = { entries: {} };

    inputObj.entries.forEach((entry, index) => {
        outputObj.entries[index] = {
            uid: index,
            key: entry.keywords,
            keysecondary: [],
            comment: entry.name,
            content: entry.entry,
            constant: false,
            selective: false,
            order: entry.weight,
            position: 0,
            disable: !entry.enabled,
            addMemo: !!entry.name,
            excludeRecursion: false,
            displayIndex: index,
            probability: null,
            useProbability: false,
        };
    });

    return outputObj;
}

function convertRisuLorebook(inputObj) {
    const outputObj = { entries: {} };

    inputObj.data.forEach((entry, index) => {
        outputObj.entries[index] = {
            uid: index,
            key: entry.key.split(',').map(x => x.trim()),
            keysecondary: entry.secondkey ? entry.secondkey.split(',').map(x => x.trim()) : [],
            comment: entry.comment,
            content: entry.content,
            constant: entry.alwaysActive,
            selective: entry.selective,
            order: entry.insertorder,
            position: world_info_position.before,
            disable: false,
            addMemo: true,
            excludeRecursion: false,
            displayIndex: index,
            probability: entry.activationPercent ?? null,
            useProbability: entry.activationPercent ?? false,
        };
    });

    return outputObj;
}

function convertNovelLorebook(inputObj) {
    const outputObj = {
        entries: {}
    };

    inputObj.entries.forEach((entry, index) => {
        const displayName = entry.displayName;
        const addMemo = displayName !== undefined && displayName.trim() !== '';

        outputObj.entries[index] = {
            uid: index,
            key: entry.keys,
            keysecondary: [],
            comment: displayName || '',
            content: entry.text,
            constant: false,
            selective: false,
            order: entry.contextConfig?.budgetPriority ?? 0,
            position: 0,
            disable: !entry.enabled,
            addMemo: addMemo,
            excludeRecursion: false,
            displayIndex: index,
            probability: null,
            useProbability: false,
        };
    });

    return outputObj;
}

function convertCharacterBook(characterBook) {
    const result = { entries: {}, originalData: characterBook };

    characterBook.entries.forEach((entry, index) => {
        // Not in the spec, but this is needed to find the entry in the original data
        if (entry.id === undefined) {
            entry.id = index;
        }

        result.entries[entry.id] = {
            uid: entry.id,
            key: entry.keys,
            keysecondary: entry.secondary_keys || [],
            comment: entry.comment || "",
            content: entry.content,
            constant: entry.constant || false,
            selective: entry.selective || false,
            order: entry.insertion_order,
            position: entry.extensions?.position ?? (entry.position === "before_char" ? world_info_position.before : world_info_position.after),
            excludeRecursion: entry.extensions?.exclude_recursion ?? false,
            disable: !entry.enabled,
            addMemo: entry.comment ? true : false,
            displayIndex: entry.extensions?.display_index ?? index,
            probability: entry.extensions?.probability ?? null,
            useProbability: entry.extensions?.useProbability ?? false,
            depth: entry.extensions?.depth ?? DEFAULT_DEPTH,
        };
    });

    return result;
}

export function setWorldInfoButtonClass(chid, forceValue = undefined) {
    if (forceValue !== undefined) {
        $('#set_character_world, #world_button').toggleClass('world_set', forceValue);
        return;
    }

    if (!chid) {
        return;
    }

    const world = characters[chid]?.data?.extensions?.world;
    const worldSet = Boolean(world && world_names.includes(world));
    $('#set_character_world, #world_button').toggleClass('world_set', worldSet);
}

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
        if (!localStorage.getItem(checkKey) && (!worldName || !world_names.includes(worldName))) {
            localStorage.setItem(checkKey, 1);

            if (power_user.world_import_dialog) {
                callPopup(`<h3>This character has an embedded World/Lorebook.</h3>
                           <h3>Would you like to import it now?</h3>
                           <div class="m-b-1">If you want to import it later, select "Import Card Lore" in the "More..." dropdown menu on the character panel.</div>`,
                    'confirm',
                    '',
                    { okButton: 'Yes', })
                    .then((result) => {
                        if (result) {
                            importEmbeddedWorldInfo(true);
                        }
                    });
            }
            else {
                toastr.info(
                    'To import and use it, select "Import Card Lore" in the "More..." dropdown menu on the character panel.',
                    `${characters[chid].name} has an embedded World/Lorebook`,
                    { timeOut: 5000, extendedTimeOut: 10000, positionClass: 'toast-top-center' },
                );
            }
        }
        return true;
    }

    return false;
}

export async function importEmbeddedWorldInfo(skipPopup = false) {
    const chid = $('#import_character_info').data('chid');

    if (chid === undefined) {
        return;
    }

    const bookName = characters[chid]?.data?.character_book?.name || `${characters[chid]?.name}'s Lorebook`;
    const confirmationText = (`<h3>Are you sure you want to import "${bookName}"?</h3>`) + (world_names.includes(bookName) ? 'It will overwrite the World/Lorebook with the same name.' : '');

    if (!skipPopup) {
        const confirmation = await callPopup(confirmationText, 'confirm');

        if (!confirmation) {
            return;
        }
    }

    const convertedBook = convertCharacterBook(characters[chid].data.character_book);

    await saveWorldInfo(bookName, convertedBook, true);
    await updateWorldInfoList();
    $('#character_world').val(bookName).trigger('change');

    toastr.success(`The world "${bookName}" has been imported and linked to the character successfully.`, 'World/Lorebook imported');

    const newIndex = world_names.indexOf(bookName);
    if (newIndex >= 0) {
        //show&draw the WI panel before..
        $("#WIDrawerIcon").trigger('click');
        //..auto-opening the new imported WI
        $("#world_editor_select").val(newIndex).trigger('change');
    }

    setWorldInfoButtonClass(chid, true);
}

function onWorldInfoChange(_, text) {
    if (_ !== '__notSlashCommand__') { // if it's a slash command
        if (text !== undefined) { // and args are provided
            const slashInputSplitText = text.trim().toLowerCase().split(",");

            slashInputSplitText.forEach((worldName) => {
                const wiElement = getWIElement(worldName);
                if (wiElement.length > 0) {
                    selected_world_info.push(wiElement.text());
                    wiElement.prop("selected", true);
                    toastr.success(`Activated world: ${wiElement.text()}`);
                } else {
                    toastr.error(`No world found named: ${worldName}`);
                }
            });
            $("#world_info").trigger("change");
        } else { // if no args, unset all worlds
            toastr.success('Deactivated all worlds');
            selected_world_info = [];
            $("#world_info").val("");
        }
    } else { //if it's a pointer selection
        let tempWorldInfo = [];
        let selectedWorlds = $("#world_info").val().map((e) => Number(e)).filter((e) => !isNaN(e));
        if (selectedWorlds.length > 0) {
            selectedWorlds.forEach((worldIndex) => {
                const existingWorldName = world_names[worldIndex];
                if (existingWorldName) {
                    tempWorldInfo.push(existingWorldName);
                } else {
                    const wiElement = getWIElement(existingWorldName);
                    wiElement.prop("selected", false);
                    toastr.error(`The world with ${existingWorldName} is invalid or corrupted.`);
                }
            });
        }
        selected_world_info = tempWorldInfo;
    }

    saveSettingsDebounced();
    eventSource.emit(event_types.WORLDINFO_SETTINGS_UPDATED);
}

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
            toastr.error(`File is not valid: ${file.name}`);
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

    jQuery.ajax({
        type: "POST",
        url: "/importworldinfo",
        data: formData,
        beforeSend: () => { },
        cache: false,
        contentType: false,
        processData: false,
        success: async function (data) {
            if (data.name) {
                await updateWorldInfoList();

                const newIndex = world_names.indexOf(data.name);
                if (newIndex >= 0) {
                    $("#world_editor_select").val(newIndex).trigger('change');
                }

                toastr.info(`World Info "${data.name}" imported successfully!`);
            }
        },
        error: (jqXHR, exception) => { },
    });
}

function assignLorebookToChat() {
    const selectedName = chat_metadata[METADATA_KEY];
    const template = $('#chat_world_template .chat_world').clone();

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

    callPopup(template, 'text');
}

jQuery(() => {

    $(document).ready(function () {
        registerSlashCommand('world', onWorldInfoChange, [], '<span class="monospace">(optional name)</span> – sets active World, or unsets if no args provided', true, true);
    })


    $("#world_info").on('mousedown change', async function (e) {
        // If there's no world names, don't do anything
        if (world_names.length === 0) {
            e.preventDefault();
            return;
        }

        onWorldInfoChange('__notSlashCommand__');
    });

    //**************************WORLD INFO IMPORT EXPORT*************************//
    $("#world_import_button").on('click', function () {
        $("#world_import_file").trigger('click');
    });

    $("#world_import_file").on("change", async function (e) {
        const file = e.target.files[0];

        await importWorldInfo(file);

        // Will allow to select the same file twice in a row
        e.target.value = '';
    });

    $("#world_create_button").on('click', async () => {
        const tempName = getFreeWorldName();
        const finalName = await callPopup("<h3>Create a new World Info?</h3>Enter a name for the new file:", "input", tempName);

        if (finalName) {
            await createNewWorldInfo(finalName);
        }
    });

    $("#world_editor_select").on('change', async () => {
        $("#world_info_search").val('');
        worldInfoFilter.setFilterData(FILTER_TYPES.WORLD_INFO_SEARCH, '', true);
        const selectedIndex = $("#world_editor_select").find(":selected").val();

        if (selectedIndex === "") {
            hideWorldEditor();
        } else {
            const worldName = world_names[selectedIndex];
            showWorldEditor(worldName);
        }
    });

    const saveSettings = () => {
        saveSettingsDebounced()
        eventSource.emit(event_types.WORLDINFO_SETTINGS_UPDATED);
    }

    $(document).on("input", "#world_info_depth", function () {
        world_info_depth = Number($(this).val());
        $("#world_info_depth_counter").val($(this).val());
        saveSettings();
    });

    $(document).on("input", "#world_info_budget", function () {
        world_info_budget = Number($(this).val());
        $("#world_info_budget_counter").val($(this).val());
        saveSettings();
    });

    $(document).on("input", "#world_info_recursive", function () {
        world_info_recursive = !!$(this).prop('checked');
        saveSettings();
    })

    $('#world_info_case_sensitive').on('input', function () {
        world_info_case_sensitive = !!$(this).prop('checked');
        saveSettings();
    })

    $('#world_info_match_whole_words').on('input', function () {
        world_info_match_whole_words = !!$(this).prop('checked');
        saveSettings();
    });

    $('#world_info_character_strategy').on('change', function () {
        world_info_character_strategy = Number($(this).val());
        saveSettings();
    });

    $('#world_info_overflow_alert').on('change', function () {
        world_info_overflow_alert = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#world_info_budget_cap').on('input', function () {
        world_info_budget_cap = Number($(this).val());
        $("#world_info_budget_cap_counter").val(world_info_budget_cap);
        saveSettings();
    });

    $('#world_button').on('click', async function (event) {
        const chid = $('#set_character_world').data('chid');

        if (chid) {
            const worldName = characters[chid]?.data?.extensions?.world;
            const hasEmbed = checkEmbeddedWorld(chid);
            if (worldName && world_names.includes(worldName) && !event.shiftKey) {
                if (!$('#WorldInfo').is(':visible')) {
                    $('#WIDrawerIcon').trigger('click');
                }
                const index = world_names.indexOf(worldName);
                $("#world_editor_select").val(index).trigger('change');
            } else if (hasEmbed && !event.shiftKey) {
                await importEmbeddedWorldInfo();
                saveCharacterDebounced();
            }
            else {
                $('#char-management-dropdown').val($('#set_character_world').val()).trigger('change');
            }
        }
    });

    $('#world_info_search').on('input', function () {
        const term = $(this).val();
        worldInfoFilter.setFilterData(FILTER_TYPES.WORLD_INFO_SEARCH, term);
    });

    $('#world_refresh').on('click', () => {
        updateEditor(navigation_option.previous);
    });

    $('#world_info_sort_order').on('change', function (e) {
        if (e.target instanceof HTMLOptionElement) {
            localStorage.setItem(SORT_ORDER_KEY, e.target.value);
        }

        updateEditor(navigation_option.none);
    })

    $(document).on('click', '.chat_lorebook_button', assignLorebookToChat);

    // Not needed on mobile
    const deviceInfo = getDeviceInfo();
    if (deviceInfo && deviceInfo.device.type === 'desktop') {
        $('#world_info').select2({
            width: '100%',
            placeholder: 'No Worlds active. Click here to select.',
            allowClear: true,
            closeOnSelect: false,
        });
    }
})
