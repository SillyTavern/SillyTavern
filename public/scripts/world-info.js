import { saveSettings, callPopup, substituteParams, getTokenCount, getRequestHeaders, chat_metadata, this_chid, characters } from "../script.js";
import { download, debounce, delay, initScrollHeight, resetScrollHeight } from "./utils.js";
import { getContext } from "./extensions.js";
import { metadata_keys } from "./extensions/floating-prompt/index.js";

export {
    world_info,
    world_info_data,
    world_info_budget,
    world_info_depth,
    world_info_recursive,
    world_info_case_sensitive,
    world_info_match_whole_words,
    world_info_character_strategy,
    world_names,
    imported_world_name,
    checkWorldInfo,
    deleteWorldInfo,
    selectImportedWorldInfo,
    setWorldInfoSettings,
    getWorldInfoPrompt,
}

const world_info_insertion_strategy = {
    evenly: 0,
    character_first: 1,
    global_first: 2,
}

let world_info = null;
let world_names;
let world_info_data = null;
let world_info_depth = 2;
let world_info_budget = 128;
let is_world_edit_open = false;
let world_info_recursive = false;
let world_info_case_sensitive = false;
let world_info_match_whole_words = false;
let world_info_character_strategy = world_info_insertion_strategy.evenly;
let imported_world_name = "";
const saveWorldDebounced = debounce(async () => await _save(), 1000);
const saveSettingsDebounced = debounce(() => saveSettings(), 1000);

const world_info_position = {
    before: 0,
    after: 1,
    ANTop: 2,
    ANBottom: 3,

};

async function getWorldInfoPrompt(chat2) {
    let worldInfoString = "", worldInfoBefore = "", worldInfoAfter = "";

    const activatedWorldInfo = await checkWorldInfo(chat2);
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
        // preselect world if saved
        if (item == world_info) {
            $("#world_info").val(i).change();
        }
    });
}

// World Info Editor
async function showWorldEditor() {
    if (!world_info) {
        toastr.warning("Select a world info first!");
        return;
    }

    is_world_edit_open = true;
    $("#world_popup_name").val(world_info);
    $("#world_popup").css("display", "flex");
    world_info_data = await loadWorldInfoData(world_info);
    displayWorldEntries(world_info_data);
}

async function loadWorldInfoData(name) {
    if (!name) {
        return;
    }

    const response = await fetch("/getworldinfo", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name }),
    });

    if (response.ok) {
        const data = await response.json();
        return data;
    }

    return null;
}

async function updateWorldInfoList(importedWorldName) {
    var result = await fetch("/getsettings", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (result.ok) {
        var data = await result.json();
        world_names = data.world_names?.length ? data.world_names : [];
        $("#world_info").find('option[value!="None"]').remove();

        world_names.forEach((item, i) => {
            $("#world_info").append(`<option value='${i}'>${item}</option>`);
        });

        if (importedWorldName) {
            const indexOf = world_names.indexOf(world_info);
            $("#world_info").val(indexOf);

            callPopup("<h3>World imported successfully! Select it now?</h3>", "world_imported");
        }
    }
}

function hideWorldEditor() {
    is_world_edit_open = false;
    $("#world_popup").css("display", "none");
}

function displayWorldEntries(data) {
    $("#world_popup_entries_list").empty();

    if (!data || !("entries" in data)) {
        return;
    }

    for (const entryUid in data.entries) {
        const entry = data.entries[entryUid];
        appendWorldEntry(entry);
    }
}

function appendWorldEntry(entry) {
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
        world_info_data.entries[uid].key = value
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x);
        saveWorldInfo();
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
        world_info_data.entries[uid].keysecondary = value
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x);
        saveWorldInfo();
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
        world_info_data.entries[uid].comment = value;
        saveWorldInfo();
    });
    commentToggle.data("uid", entry.uid);
    commentToggle.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        //console.log(value)
        const commentContainer = $(this)
            .closest(".world_entry")
            .find(".commentContainer");
        world_info_data.entries[uid].addMemo = value;
        saveWorldInfo();
        value ? commentContainer.show() : commentContainer.hide();
    });

    commentInput.val(entry.comment).trigger("input");
    commentToggle.prop("checked", entry.selective).trigger("input");
    commentToggle.siblings(".checkbox_fancy").click(function () {
        $(this).siblings("input").click();
    });

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
        world_info_data.entries[uid].content = value;
        saveWorldInfo();

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
        world_info_data.entries[uid].selective = value;
        saveWorldInfo();

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
    selectiveInput.siblings(".checkbox_fancy").click(function () {
        $(this).siblings("input").click();
    });


    // constant
    const constantInput = template.find('input[name="constant"]');
    constantInput.data("uid", entry.uid);
    constantInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        world_info_data.entries[uid].constant = value;
        saveWorldInfo();
    });
    constantInput.prop("checked", entry.constant).trigger("input");
    constantInput.siblings(".checkbox_fancy").click(function () {
        $(this).siblings("input").click();
    });

    // order
    const orderInput = template.find('input[name="order"]');
    orderInput.data("uid", entry.uid);
    orderInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = Number($(this).val());

        world_info_data.entries[uid].order = !isNaN(value) ? value : 0;
        saveWorldInfo();
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
        world_info_data.entries[uid].position = !isNaN(value) ? value : 0;
        saveWorldInfo();
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
        world_info_data.entries[uid].disable = value;
        saveWorldInfo();
        //console.log(`WI #${entry.uid} disabled? ${world_info_data.entries[uid].disable}`);
    });
    disableInput.prop("checked", entry.disable).trigger("input");
    disableInput.siblings(".checkbox_fancy").click(function () {
        $(this).siblings("input").click();
    });

    const excludeRecursionInput = template.find('input[name="exclude_recursion"]');
    excludeRecursionInput.data("uid", entry.uid);
    excludeRecursionInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        world_info_data.entries[uid].excludeRecursion = value;
        saveWorldInfo();
    });
    excludeRecursionInput.prop("checked", entry.excludeRecursion).trigger("input");
    excludeRecursionInput.siblings(".checkbox_fancy").click(function () {
        $(this).siblings("input").click();
    });

    // delete button
    const deleteButton = template.find("input.delete_entry_button");
    deleteButton.data("uid", entry.uid);
    deleteButton.on("click", function () {
        const uid = $(this).data("uid");
        deleteWorldInfoEntry(uid);
        $(this).closest(".world_entry").remove();
        saveWorldInfo();
    });

    template.appendTo("#world_popup_entries_list");
    template.find('.inline-drawer-content').css('display', 'none'); //entries start collapsed

    return template;
}

async function deleteWorldInfoEntry(uid) {
    if (!world_info_data || !("entries" in world_info_data)) {
        return;
    }

    delete world_info_data.entries[uid];
}

function createWorldInfoEntry() {
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
    const newUid = getFreeWorldEntryUid();

    if (!Number.isInteger(newUid)) {
        console.error("Couldn't assign UID to a new entry");
        return;
    }

    const newEntry = { uid: newUid, ...newEntryTemplate };
    world_info_data.entries[newUid] = newEntry;

    const entryTemplate = appendWorldEntry(newEntry);
    entryTemplate.get(0).scrollIntoView({ behavior: "smooth" });
}

async function _save() {
    const response = await fetch("/editworldinfo", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: world_info, data: world_info_data }),
    });
}

async function saveWorldInfo(immediately) {
    if (!world_info || !world_info_data) {
        return;
    }


    if (immediately) {
        return await _save();
    }

    saveWorldDebounced();
}

async function renameWorldInfo() {
    const oldName = world_info;
    const newName = $("#world_popup_name").val().trim();

    if (oldName === newName || !newName) {
        return;
    }

    world_info = newName;
    await saveWorldInfo(true);
    await deleteWorldInfo(oldName, newName);
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
            $("#world_info").val(selectedIndex).change();
        } else {
            $("#world_info").val("None").change();
        }

        hideWorldEditor();
    }
}

function getFreeWorldEntryUid() {
    if (!world_info_data || !("entries" in world_info_data)) {
        return null;
    }

    const MAX_UID = 1_000_000; // <- should be safe enough :)
    for (let uid = 0; uid < MAX_UID; uid++) {
        if (uid in world_info_data.entries) {
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

async function createNewWorldInfo() {
    const worldInfoTemplate = { entries: {} };
    const worldInfoName = getFreeWorldName();

    if (!worldInfoName) {
        return;
    }

    world_info = worldInfoName;
    world_info_data = { ...worldInfoTemplate };
    await saveWorldInfo(true);
    await updateWorldInfoList();

    const selectedIndex = world_names.indexOf(worldInfoName);
    if (selectedIndex !== -1) {
        $("#world_info").val(selectedIndex).change();
    } else {
        $("#world_info").val("None").change();
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

function getGlobalLore() {
    if (!world_info || !world_info_data) {
        return [];
    }

    const entries = Object.keys(world_info_data.entries).map((x) => world_info_data.entries[x]);
    console.debug(`Global world info has ${entries.length} entries`);
    return entries;
}


async function getSortedEntries() {
    try {
        const globalLore = getGlobalLore();
        const characterLore = await getCharacterLore();

        let entries;
        const sortFn = (a, b) => b.order - a.order;

        switch (world_info_character_strategy) {
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
                console.error(`Unknown insertion strategy: ${world_info_character_strategy}`);
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

async function checkWorldInfo(chat) {
    const context = getContext();
    const messagesToLookBack = world_info_depth * 2;
    let textToScan = transformString(chat.slice(0, messagesToLookBack).join(""));
    let worldInfoBefore = "";
    let worldInfoAfter = "";
    let needsToScan = true;
    let count = 0;
    let allActivatedEntries = new Set();

    const sortedEntries = await getSortedEntries();

    if (sortedEntries.length === 0) {
        return  { worldInfoBefore, worldInfoAfter };
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
        let ANInjectionTokens = 0;
        for (const entry of newEntries) {
            let ANWithWI;

            let originalAN = context.extensionPrompts['2_floating_prompt'].value;
            if (entry.position === world_info_position.after) {
                worldInfoAfter = `${substituteParams(
                    entry.content
                )}\n${worldInfoAfter}`;
            } else if (entry.position === world_info_position.before) {
                worldInfoBefore = `${substituteParams(
                    entry.content
                )}\n${worldInfoBefore}`;

                //WI must hijack AN to inject before the prompt is set.
            } else if (entry.position === world_info_position.ANBottom) {
                ANWithWI = originalAN + "\n" + entry.content;
                ANInjectionTokens = ANInjectionTokens + getTokenCount(ANWithWI) - getTokenCount(originalAN);
                context.setExtensionPrompt('2_floating_prompt', ANWithWI, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth]);
            } else if (entry.position === world_info_position.ANTop) {
                ANWithWI = entry.content + "\n" + originalAN;
                ANInjectionTokens = ANInjectionTokens + getTokenCount(ANWithWI) - getTokenCount(originalAN);
                context.setExtensionPrompt('2_floating_prompt', ANWithWI, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth]);
            }

            if (
                (getTokenCount(worldInfoBefore + worldInfoAfter) + ANInjectionTokens) >= world_info_budget
            ) {
                needsToScan = false;
                break;
            }
        }

        if (needsToScan) {
            textToScan = (transformString(newEntries.map(x => x.content).join('\n')) + textToScan);
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

function selectImportedWorldInfo() {
    if (!imported_world_name) {
        return;
    }

    world_names.forEach((item, i) => {
        if (item === imported_world_name) {
            $("#world_info").val(i).change();
        }
    });
    imported_world_name = "";
}

jQuery(() => {
    $("#world_info").change(async function () {
        const selectedWorld = $("#world_info").find(":selected").val();
        world_info = null;
        world_info_data = null;

        if (selectedWorld !== "None") {
            const worldIndex = Number(selectedWorld);
            world_info = !isNaN(worldIndex) ? world_names[worldIndex] : null;
            world_info_data = await loadWorldInfoData(world_info);
        }

        if (selectedWorld === "None") { hideWorldEditor(); }
        if (is_world_edit_open && selectedWorld !== "None") { showWorldEditor() };
        saveSettingsDebounced();
    });

    //**************************WORLD INFO IMPORT EXPORT*************************//
    $("#world_import_button").click(function () {
        $("#world_import_file").click();
    });

    $("#world_import_file").on("change", function (e) {
        var file = e.target.files[0];

        if (!file) {
            return;
        }

        const ext = file.name.match(/\.(\w+)$/);
        if (!ext || ext[1].toLowerCase() !== "json") {
            return;
        }

        const formData = new FormData($("#form_world_import").get(0));

        jQuery.ajax({
            type: "POST",
            url: "/importworldinfo",
            data: formData,
            beforeSend: () => { },
            cache: false,
            contentType: false,
            processData: false,
            success: function (data) {
                if (data.name) {
                    imported_world_name = data.name;
                    updateWorldInfoList(imported_world_name);
                }
            },
            error: (jqXHR, exception) => { },
        });

        // Will allow to select the same file twice in a row
        $("#form_world_import").trigger("reset");
    });

    $("#world_info_edit_button").click(() => {
        is_world_edit_open ? hideWorldEditor() : showWorldEditor();
    });

    $("#world_popup_export").click(() => {
        if (world_info && world_info_data) {
            const jsonValue = JSON.stringify(world_info_data);
            const fileName = `${world_info}.json`;
            download(jsonValue, fileName, "application/json");
        }
    });

    $("#world_popup_delete").click(() => {
        callPopup("<h3>Delete the World Info?</h3>", "del_world");
    });

    $("#world_popup_new").click(() => {
        createWorldInfoEntry();
    });

    $("#world_cross").click(() => {
        hideWorldEditor();
    });

    $("#world_popup_name_button").click(() => {
        renameWorldInfo();
    });

    $("#world_create_button").on('click', async () => {
        const confirm = await callPopup("<h3>Create a new World Info?</h3>", "confirm");

        if (confirm) {
            await createNewWorldInfo();
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
