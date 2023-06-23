import { saveSettings, callPopup, substituteParams, getTokenCount, getRequestHeaders, chat_metadata, this_chid, characters } from "../script.js";
import { download, debounce, initScrollHeight, resetScrollHeight, parseJsonFile, extractDataFromPng, getFileBuffer } from "./utils.js";
import { getContext } from "./extensions.js";
import { metadata_keys, shouldWIAddPrompt } from "./extensions/floating-prompt/index.js";
import { registerSlashCommand } from "./slash-commands.js";

export {
    world_info,
    world_info_budget,
    world_info_depth,
    world_info_recursive,
    world_info_case_sensitive,
    world_info_match_whole_words,
    world_info_character_strategy,
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

let world_info = null;
let world_names;
let world_info_depth = 2;
let world_info_budget = 25;
let world_info_recursive = false;
let world_info_case_sensitive = false;
let world_info_match_whole_words = false;
let world_info_character_strategy = world_info_insertion_strategy.evenly;
const saveWorldDebounced = debounce(async (name, data) => await _save(name, data), 1000);
const saveSettingsDebounced = debounce(() => saveSettings(), 1000);

const world_info_position = {
    before: 0,
    after: 1,
    ANTop: 2,
    ANBottom: 3,

};

async function getWorldInfoPrompt(chat2, maxContext) {
    let worldInfoString = "", worldInfoBefore = "", worldInfoAfter = "";

    const activatedWorldInfo = await checkWorldInfo(chat2, maxContext);
    worldInfoBefore = activatedWorldInfo.worldInfoBefore;
    worldInfoAfter = activatedWorldInfo.worldInfoAfter;
    worldInfoString = worldInfoBefore + worldInfoAfter;

    return { worldInfoString, worldInfoBefore, worldInfoAfter };
}

function setWorldInfoSettings(settings, data) {
    if (settings.world_info_depth !== undefined)
        world_info_depth = Number(settings.world_info_depth);
    if (settings.world_info_budget !== undefined)
        world_info_budget = Number(settings.world_info_budget);
    if (settings.world_info_recursive !== undefined)
        world_info_recursive = Boolean(settings.world_info_recursive);
    if (settings.world_info_case_sensitive !== undefined)
        world_info_case_sensitive = Boolean(settings.world_info_case_sensitive);
    if (settings.world_info_match_whole_words !== undefined)
        world_info_match_whole_words = Boolean(settings.world_info_match_whole_words);
    if (settings.world_info_character_strategy !== undefined)
        world_info_character_strategy = Number(settings.world_info_character_strategy);

    // Migrate old settings
    if (world_info_budget > 100) {
        world_info_budget = 25;
    }

    $("#world_info_depth_counter").text(world_info_depth);
    $("#world_info_depth").val(world_info_depth);

    $("#world_info_budget_counter").text(world_info_budget);
    $("#world_info_budget").val(world_info_budget);

    $("#world_info_recursive").prop('checked', world_info_recursive);
    $("#world_info_case_sensitive").prop('checked', world_info_case_sensitive);
    $("#world_info_match_whole_words").prop('checked', world_info_match_whole_words);

    $(`#world_info_character_strategy option[value='${world_info_character_strategy}']`).prop('selected', true);
    $("#world_info_character_strategy").val(world_info_character_strategy);

    world_names = data.world_names?.length ? data.world_names : [];

    if (settings.world_info != undefined) {
        if (world_names.includes(settings.world_info)) {
            world_info = settings.world_info;
        }
    }

    world_names.forEach((item, i) => {
        $("#world_info").append(`<option value='${i}'>${item}</option>`);
        $("#world_editor_select").append(`<option value='${i}'>${item}</option>`);
        // preselect world if saved
        if (item == world_info) {
            $("#world_info").val(i).trigger('change');
        }
    });

    $("#world_editor_select").trigger("change");
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

    const response = await fetch("/getworldinfo", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name }),
        cache: 'no-cache',
    });

    if (response.ok) {
        const data = await response.json();
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
            $("#world_info").append(`<option value='${i}'>${item}</option>`);
            $("#world_editor_select").append(`<option value='${i}'>${item}</option>`);
        });
    }
}

function hideWorldEditor() {
    displayWorldEntries(null, null);
}

function nullWorldInfo() {
    toastr.info("Create or import a new World Info file first.", "World Info is not set", { timeOut: 10000, preventDuplicates: true });
}

function displayWorldEntries(name, data) {
    $("#world_popup_entries_list").empty().show();

    if (!data || !("entries" in data)) {
        $("#world_popup_new").off('click').on('click', nullWorldInfo);
        $("#world_popup_name_button").off('click').on('click', nullWorldInfo);
        $("#world_popup_export").off('click').on('click', nullWorldInfo);
        $("#world_popup_delete").off('click').on('click', nullWorldInfo);
        $("#world_popup_entries_list").hide();
        return;
    }

    // Convert the data.entries object into an array
    const entriesArray = Object.keys(data.entries).map(uid => {
        const entry = data.entries[uid];
        entry.displayIndex = entry.displayIndex ?? entry.uid;
        return entry;
    });

    // Sort the entries array by displayIndex and uid
    entriesArray.sort((a, b) => a.displayIndex - b.displayIndex || a.uid - b.uid);

    // Loop through the sorted array and call appendWorldEntry
    for (const entry of entriesArray) {
        appendWorldEntry(name, data, entry);
    }

    $("#world_popup_new").off('click').on('click', () => {
        createWorldInfoEntry(name, data);
    });

    $("#world_popup_name_button").off('click').on('click', async () => {
        await renameWorldInfo(name, data);
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

        await deleteWorldInfo(name, world_info);
    });

    // Check if a sortable instance exists
    if ($('#world_popup_entries_list').sortable('instance') !== undefined) {
        // Destroy the instance
        $('#world_popup_entries_list').sortable('destroy');
    }

    $("#world_popup_entries_list").sortable({
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
            });

            console.table(Object.keys(data.entries).map(uid => data.entries[uid]).map(x => ({ uid: x.uid, key: x.key.join(','), displayIndex: x.displayIndex })));

            await saveWorldInfo(name, data, true);
        }
    });
    $("#world_popup_entries_list").disableSelection();
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

function appendWorldEntry(name, data, entry) {
    const template = $("#entry_edit_template .world_entry").clone();
    template.data("uid", entry.uid);

    // key
    const keyInput = template.find('textarea[name="key"]');
    keyInput.data("uid", entry.uid);
    keyInput.on("click", function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });

    keyInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).val();
        resetScrollHeight(this);
        data.entries[uid].key = value
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x);

        setOriginalDataValue(data, uid, "keys", data.entries[uid].key);
        saveWorldInfo(name, data);
    });
    keyInput.val(entry.key.join(",")).trigger("input");
    initScrollHeight(keyInput);

    // keysecondary
    const keySecondaryInput = template.find('textarea[name="keysecondary"]');
    keySecondaryInput.data("uid", entry.uid);
    keySecondaryInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).val();
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
    commentToggle.prop("checked", entry.addMemo).trigger("input");

    // content
    const countTokensDebounced = debounce(function (that, value) {
        const numberOfTokens = getTokenCount(value);
        $(that)
            .closest(".world_entry")
            .find(".world_entry_form_token_counter")
            .text(numberOfTokens);
    }, 1000);

    const contentInput = template.find('textarea[name="content"]');
    contentInput.data("uid", entry.uid);
    contentInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).val();
        data.entries[uid].content = value;

        setOriginalDataValue(data, uid, "content", data.entries[uid].content);
        saveWorldInfo(name, data);

        // count tokens
        countTokensDebounced(this, value);
    });
    contentInput.val(entry.content).trigger("input");
    //initScrollHeight(contentInput);

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
    selectiveInput.prop("checked", entry.selective).trigger("input");


    // constant
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

    // order
    const orderInput = template.find('input[name="order"]');
    orderInput.data("uid", entry.uid);
    orderInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = Number($(this).val());

        data.entries[uid].order = !isNaN(value) ? value : 0;
        setOriginalDataValue(data, uid, "insertion_order", data.entries[uid].order);
        saveWorldInfo(name, data);
    });
    orderInput.val(entry.order).trigger("input");

    // position
    if (entry.position === undefined) {
        entry.position = 0;
    }

    const positionInput = template.find('input[name="position"]');
    positionInput.data("uid", entry.uid);
    positionInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = Number($(this).val());
        data.entries[uid].position = !isNaN(value) ? value : 0;
        // Spec v2 only supports before_char and after_char
        setOriginalDataValue(data, uid, "position", data.entries[uid].position == 0 ? 'before_char' : 'after_char');
        // Write the original value as extensions field
        setOriginalDataValue(data, uid, "extensions.position", data.entries[uid].position);
        saveWorldInfo(name, data);
    });
    template
        .find(`input[name="position"][value=${entry.position}]`)
        .prop("checked", true)
        .trigger("input");

    // display uid
    template.find(".world_entry_form_uid_value").text(entry.uid);

    // disable
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
    const deleteButton = template.find("input.delete_entry_button");
    deleteButton.data("uid", entry.uid);
    deleteButton.on("click", function () {
        const uid = $(this).data("uid");
        deleteWorldInfoEntry(data, uid);
        deleteOriginalDataValue(data, uid);
        $(this).closest(".world_entry").remove();
        saveWorldInfo(name, data);
    });

    template.appendTo("#world_popup_entries_list");
    template.find('.inline-drawer-content').css('display', 'none'); //entries start collapsed

    return template;
}

async function deleteWorldInfoEntry(data, uid) {
    if (!data || !("entries" in data)) {
        return;
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
        selective: false,
        addMemo: false,
        order: 100,
        position: 0,
        disable: false,
        excludeRecursion: false
    };
    const newUid = getFreeWorldEntryUid(data);

    if (!Number.isInteger(newUid)) {
        console.error("Couldn't assign UID to a new entry");
        return;
    }

    const newEntry = { uid: newUid, ...newEntryTemplate };
    data.entries[newUid] = newEntry;

    const entryTemplate = appendWorldEntry(name, data, newEntry);
    entryTemplate.get(0).scrollIntoView({ behavior: "smooth" });
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

    let selectNewName = null;
    if (oldName === world_info) {
        console.debug("Renaming current world info");
        world_info = newName;
        selectNewName = newName;
    }
    else {
        console.debug("Renaming non-current world info");
        selectNewName = world_info;
    }

    await saveWorldInfo(newName, data, true);
    await deleteWorldInfo(oldName, selectNewName);

    const selectedIndex = world_names.indexOf(newName);
    if (selectedIndex !== -1) {
        $('#world_editor_select').val(selectedIndex).trigger('change');
    }
}

async function deleteWorldInfo(worldInfoName, selectWorldName) {
    if (!world_names.includes(worldInfoName)) {
        return;
    }

    const response = await fetch("/deleteworldinfo", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: worldInfoName }),
    });

    if (response.ok) {
        await updateWorldInfoList();

        const selectedIndex = world_names.indexOf(selectWorldName);
        if (selectedIndex !== -1) {
            $("#world_info").val(selectedIndex).trigger('change');
        } else {
            $("#world_info").val("").trigger('change');
        }

        $('#world_editor_select').trigger('change');
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

    world_info = worldInfoName;
    await saveWorldInfo(world_info, worldInfoTemplate, true);
    await updateWorldInfoList();

    const selectedIndex = world_names.indexOf(worldInfoName);
    if (selectedIndex !== -1) {
        $("#world_info").val(selectedIndex).trigger('change');
        $('#world_editor_select').val(selectedIndex).trigger('change');
    } else {
        $("#world_info").val("").trigger('change');
        hideWorldEditor();
    }
}

// Gets a string that respects the case sensitivity setting
function transformString(str) {
    return world_info_case_sensitive ? str : str.toLowerCase();
}

async function getCharacterLore() {
    const name = characters[this_chid]?.data?.extensions?.world;

    if (!name) {
        return [];
    }

    if (name === world_info) {
        console.debug(`Character ${characters[this_chid]?.name} world info is the same as global: ${name}. Skipping...`);
        return [];
    }

    if (!world_names.includes(name)) {
        console.log(`Character ${characters[this_chid]?.name} world info does not exist: ${name}`);
        return [];
    }

    const data = await loadWorldInfoData(name);
    const entries = data ? Object.keys(data.entries).map((x) => data.entries[x]) : [];
    console.debug(`Character ${characters[this_chid]?.name} lore (${name}) has ${entries.length} world info entries`);
    return entries;
}

async function getGlobalLore() {
    if (!world_info) {
        return [];
    }

    if (!world_names.includes(world_info)) {
        console.log(`Global ${characters[this_chid]?.name} world info does not exist: ${world_info}`);
        return [];
    }

    const data = await loadWorldInfoData(world_info);
    const entries = data ? Object.keys(data.entries).map((x) => data.entries[x]) : [];
    console.debug(`Global world info has ${entries.length} entries`);

    return entries;
}

async function getSortedEntries() {
    try {
        const globalLore = await getGlobalLore();
        const characterLore = await getCharacterLore();

        let entries;
        const sortFn = (a, b) => b.order - a.order;

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

        console.debug(`Sorted ${entries.length} world lore entries using strategy ${world_info_character_strategy}`);

        return entries;
    }
    catch (e) {
        console.error(e);
        return [];
    }
}

async function checkWorldInfo(chat, maxContext) {
    const context = getContext();
    const messagesToLookBack = world_info_depth * 2 || 1;
    let textToScan = transformString(chat.slice(0, messagesToLookBack).join(""));
    let worldInfoBefore = "";
    let worldInfoAfter = "";
    let needsToScan = true;
    let count = 0;
    let allActivatedEntries = new Set();

    const budget = Math.round(world_info_budget * maxContext / 100) || 1;
    console.debug(`Context size: ${maxContext}; WI budget: ${budget} (${world_info_budget}%)`);
    const sortedEntries = await getSortedEntries();

    if (sortedEntries.length === 0) {
        return { worldInfoBefore, worldInfoAfter };
    }

    while (needsToScan) {
        // Track how many times the loop has run
        count++;

        let activatedNow = new Set();

        for (let entry of sortedEntries) {
            if (allActivatedEntries.has(entry) || entry.disable == true || (count > 1 && world_info_recursive && entry.excludeRecursion)) {
                continue;
            }

            if (entry.constant) {
                activatedNow.add(entry);
                continue;
            }

            if (Array.isArray(entry.key) && entry.key.length) {
                primary: for (let key of entry.key) {
                    const substituted = substituteParams(key);
                    if (substituted && matchKeys(textToScan, substituted.trim())) {
                        if (
                            entry.selective &&
                            Array.isArray(entry.keysecondary) &&
                            entry.keysecondary.length
                        ) {
                            secondary: for (let keysecondary of entry.keysecondary) {
                                const secondarySubstituted = substituteParams(keysecondary);
                                if (secondarySubstituted && matchKeys(textToScan, secondarySubstituted.trim())) {
                                    activatedNow.add(entry);
                                    break secondary;
                                }
                            }
                        } else {
                            activatedNow.add(entry);
                            break primary;
                        }
                    }
                }
            }
        }

        needsToScan = world_info_recursive && activatedNow.size > 0;
        const newEntries = [...activatedNow]
            .sort((a, b) => sortedEntries.indexOf(a) - sortedEntries.indexOf(b));
        if (shouldWIAddPrompt) {
            let ANInjectionTokens = 0;
            let ANTopInjection = [];
            let ANBottomInjection = [];
            for (const entry of newEntries) {
                if (entry.position === world_info_position.after) {
                    worldInfoAfter = `${substituteParams(
                        entry.content
                    )}\n${worldInfoAfter}`;
                } else if (entry.position === world_info_position.before) {
                    worldInfoBefore = `${substituteParams(
                        entry.content
                    )}\n${worldInfoBefore}`;

                } else if (entry.position === world_info_position.ANBottom) {
                    ANBottomInjection.push(entry.content);
                    ANInjectionTokens += getTokenCount(entry.content);
                } else if (entry.position === world_info_position.ANTop) {
                    ANTopInjection.push(entry.content);
                    ANInjectionTokens = getTokenCount(entry.content);
                }

                if (
                    (getTokenCount(worldInfoBefore + worldInfoAfter) + ANInjectionTokens) >= budget
                ) {
                    console.debug(`WI budget reached, stopping`);
                    needsToScan = false;
                    break;
                }
            }
            if (needsToScan) {
                textToScan = (transformString(newEntries.map(x => x.content).join('\n')) + textToScan);
            }

            const originalAN = context.extensionPrompts['2_floating_prompt'].value;
            const ANWithWI = `\n${ANTopInjection.join("\n")} \n${originalAN} \n${ANBottomInjection.reverse().join("\n")}`
            context.setExtensionPrompt('2_floating_prompt', ANWithWI, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth]);
        }
        allActivatedEntries = new Set([...allActivatedEntries, ...activatedNow]);
    }

    return { worldInfoBefore, worldInfoAfter };
}

function matchKeys(haystack, needle) {
    const transformedString = transformString(needle);

    if (world_info_match_whole_words) {
        const keyWords = transformedString.split(/\s+/);

        if (keyWords.length > 1) {
            return haystack.includes(transformedString);
        }
        else {
            const regex = new RegExp(`\\b${transformedString}\\b`);
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

        result.entries[index] = {
            uid: entry.id || index,
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
        };
    });

    return result;
}

export async function importEmbeddedWorldInfo() {
    const chid = $('#import_character_info').data('chid');

    if (chid === undefined) {
        return;
    }

    const bookName = characters[chid]?.data?.character_book?.name || `${characters[chid]?.name}'s Lorebook`;
    const confirmationText = (`<h3>Are you sure you want to import "${bookName}"?</h3>`) + (world_names.includes(bookName) ? 'It will overwrite the World/Lorebook with the same name.' : '');

    const confirmation = await callPopup(confirmationText, 'confirm');

    if (!confirmation) {
        return;
    }

    const convertedBook = convertCharacterBook(characters[chid].data.character_book);

    await saveWorldInfo(bookName, convertedBook, true);
    await updateWorldInfoList();
    $('#character_world').val(bookName).trigger('change');

    toastr.success(`The world "${bookName}" has been imported and linked to the character successfully.`, 'World/Lorebook imported');

    const newIndex = world_names.indexOf(bookName);
    if (newIndex >= 0) {
        $("#world_editor_select").val(newIndex).trigger('change');
    }
}

function onWorldInfoChange(_, text) {
    let selectedWorld;
    if (_ !== '__notSlashCommand__') { //if it's a slash command
        if (text !== undefined) { //and args are provided
            let slashInputWorld = text.toLowerCase();
            $("#world_info").find(`option`).filter(function () {
                return $(this).text().toLowerCase() === slashInputWorld;
            }).prop('selected', true); //matches arg with worldnames and selects; if none found, unsets world
            let setWorldName = $("#world_info").find(":selected").text(); //only for toastr display
            toastr.success(`Active world: ${setWorldName}`);
            selectedWorld = $("#world_info").find(":selected").val();
        } else { //if no args, unset world
            toastr.success('Deselected World')
            $("#world_info").val("");
        }
    } else { //if it's a pointer selection
        selectedWorld = $("#world_info").find(":selected").val();
    }
    world_info = null;
    if (selectedWorld !== "") {
        const worldIndex = Number(selectedWorld);
        world_info = !isNaN(worldIndex) ? world_names[worldIndex] : null;
    }
    saveSettingsDebounced();
}

jQuery(() => {

    $(document).ready(function () {
        registerSlashCommand('world', onWorldInfoChange, [], "– sets active World, or unsets if no args provided", true, true);
    })
    $("#world_info").on('change', async function () { onWorldInfoChange('__notSlashCommand__') });

    //**************************WORLD INFO IMPORT EXPORT*************************//
    $("#world_import_button").on('click', function () {
        $("#world_import_file").trigger('click');
    });

    $("#world_import_file").on("change", async function (e) {
        const file = e.target.files[0];

        if (!file) {
            return;
        }

        const formData = new FormData($("#form_world_import").get(0));

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
                formData.append('convertedData', JSON.stringify(convertNovelLorebook(jsonData)));
            }

            // Convert Agnai Memory Book
            if (jsonData.kind === 'memory') {
                formData.append('convertedData', JSON.stringify(convertAgnaiMemoryBook(jsonData)));
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

        // Will allow to select the same file twice in a row
        $("#form_world_import").trigger("reset");
    });

    $("#world_cross").click(() => {
        hideWorldEditor();
    });

    $("#world_create_button").on('click', async () => {
        const tempName = getFreeWorldName();
        const finalName = await callPopup("<h3>Create a new World Info?</h3>Enter a name for the new file:", "input", tempName);

        if (finalName) {
            await createNewWorldInfo(finalName);
        }
    });

    $("#world_editor_select").on('change', async () => {
        const selectedIndex = $("#world_editor_select").find(":selected").val();

        if (selectedIndex === "") {
            hideWorldEditor();
        } else {
            const worldName = world_names[selectedIndex];
            showWorldEditor(worldName);
        }
    });

    $(document).on("input", "#world_info_depth", function () {
        world_info_depth = Number($(this).val());
        $("#world_info_depth_counter").text($(this).val());
        saveSettingsDebounced();
    });

    $(document).on("input", "#world_info_budget", function () {
        world_info_budget = Number($(this).val());
        $("#world_info_budget_counter").text($(this).val());
        saveSettingsDebounced();
    });

    $(document).on("input", "#world_info_recursive", function () {
        world_info_recursive = !!$(this).prop('checked');
        saveSettingsDebounced();
    })

    $('#world_info_case_sensitive').on('input', function () {
        world_info_case_sensitive = !!$(this).prop('checked');
        saveSettingsDebounced();
    })

    $('#world_info_match_whole_words').on('input', function () {
        world_info_match_whole_words = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#world_info_character_strategy').on('change', function () {
        world_info_character_strategy = $(this).val();
        saveSettingsDebounced();
    })
});
