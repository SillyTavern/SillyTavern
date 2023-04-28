import { characters, saveSettingsDebounced, this_chid, selected_button } from "../script.js";
import { selected_group } from "./group-chats.js";

export {
    tags,
    tag_map,
    loadTagsSettings,
    printTags,
    isElementTagged,
    getTagsList,
    appendTagToList,
    createTagMapFromList,
    renameTagKey,
};

const random_id = () => Math.round(Date.now() * Math.random()).toString();

const DEFAULT_TAGS = [
    { id: random_id(), name: "Plain Text" },
    { id: random_id(), name: "OpenAI" },
    { id: random_id(), name: "W++" },
    { id: random_id(), name: "Boostyle" },
    { id: random_id(), name: "PList" },
    { id: random_id(), name: "AliChat" },
];

let tags = [];
let tag_map = {};

function loadTagsSettings(settings) {
    tags = settings.tags !== undefined ? settings.tags : DEFAULT_TAGS;
    tag_map = settings.tag_map !== undefined ? settings.tag_map : Object.create(null);
}

function renameTagKey(oldKey, newKey) {
    const value = tag_map[oldKey];
    tag_map[newKey] = value || [];
    delete tag_map[oldKey];
    saveSettingsDebounced();
}

function createTagMapFromList(listElement, key) {
    const tagIds = [...($(listElement).find(".tag").map((_, el) => $(el).attr("id")))];
    tag_map[key] = tagIds;
    saveSettingsDebounced();
}

function getTagsList(key) {
    if (!Array.isArray(tag_map[key])) {
        tag_map[key] = [];
        return [];
    }

    return tag_map[key]
        .map(x => tags.find(y => y.id === x))
        .filter(x => x)
        .sort((a, b) => a.name.localeCompare(b.name));
}

function getInlineListSelector() {
    if (selected_group) {
        return `.group_select[grid="${selected_group}"] .tags`;
    }

    if (this_chid && selected_button !== "create") {
        return `.character_select[chid="${this_chid}"] .tags`;
    }

    return null;
}

function getTagKey() {
    if (selected_group) {
        return selected_group;
    }

    if (this_chid && selected_button !== "create") {
        return characters[this_chid].avatar;
    }

    return null;
}

function addTagToMap(tagId) {
    const key = getTagKey();

    if (!key) {
        return;
    }

    if (!Array.isArray(tag_map[key])) {
        tag_map[key] = [tagId];
    }
    else {
        tag_map[key].push(tagId);
    }
}

function removeTagFromMap(tagId) {
    const key = getTagKey();

    if (!key) {
        return;
    }

    if (!Array.isArray(tag_map[key])) {
        tag_map[key] = [];
    }
    else {
        const indexOf = tag_map[key].indexOf(tagId);
        tag_map[key].splice(indexOf, 1);
    }
}

function findTag(request, resolve) {
    const skipIds = [...($("#tagList").find(".tag").map((_, el) => $(el).attr("id")))];
    const haystack = tags.filter(t => !skipIds.includes(t.id)).map(t => t.name).sort();
    const needle = request.term.toLowerCase();
    const hasExactMatch = haystack.findIndex(x => x.toLowerCase() == needle) !== -1;
    const result = haystack.filter(x => x.toLowerCase().includes(needle));

    if (request.term && !hasExactMatch) {
        result.unshift(request.term);
    }

    resolve(result);
}

function selectTag(event, ui) {
    let tagName = ui.item.value;
    let tag = tags.find(t => t.name === tagName);

    // create new tag if it doesn't exist
    if (!tag) {
        tag = createNewTag(tagName);
    }

    // unfocus and clear the input
    $(this).val("").blur();

    // add tag to the UI and internal map
    appendTagToList("#tagList", tag, { removable: true });
    appendTagToList(getInlineListSelector(), tag, { removable: false });
    addTagToMap(tag.id);
    saveSettingsDebounced();

    // need to return false to keep the input clear
    return false;
}

function createNewTag(tagName) {
    const tag = {
        id: random_id(),
        name: tagName,
    };
    tags.push(tag);
    return tag;
}

function appendTagToList(listElement, tag, { removable, editable, selectable }) {
    if (!listElement) {
        return;
    }

    let tagElement = $('#tag_template .tag').clone();
    tagElement.attr('id', tag.id);
    tagElement.find('.tag_name').text(tag.name);
    const removeButton = tagElement.find(".tag_remove");
    removable ? removeButton.show() : removeButton.hide();

    if (selectable) {
        tagElement.on('click', onTagFilterClick);
    }

    $(listElement).append(tagElement);
}

function onTagFilterClick() {
    const wasSelected = $(this).hasClass('selected');
    clearTagsFilter();

    if (wasSelected) {
        return;
    }

    const tagId = $(this).attr('id');
    $(this).addClass('selected');
    $('#rm_print_characters_block > div').each((_, element) => applyFilterToElement(tagId, element));
}

function applyFilterToElement(tagId, element) {
    const isTagged = isElementTagged(element, tagId);
    $(element).css('display', !isTagged ? 'none' : '');
}

function isElementTagged(element, tagId) {
    const isGroup = $(element).hasClass('group_select');
    const isCharacter = $(element).hasClass('character_select');
    const idAttr = isGroup ? 'grid' : 'chid';
    const elementId = $(element).attr(idAttr);
    const lookupValue = isCharacter ? characters[elementId].avatar : elementId;
    const isTagged = Array.isArray(tag_map[lookupValue]) && tag_map[lookupValue].includes(tagId);
    return isTagged;
}

function clearTagsFilter() {
    $('#rm_tag_filter .tag').removeClass('selected');
    $('#rm_print_characters_block > div').css('display', '');
}

function printTags() {
    $('#rm_tag_filter').empty();
    const characterTagIds = Object.values(tag_map).flat();
    const tagsToDisplay = tags
        .filter(x => characterTagIds.includes(x.id))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const tag of tagsToDisplay) {
        appendTagToList('#rm_tag_filter', tag, { removable: false, editable: false, selectable: true, });
    }
}

function onTagRemoveClick(event) {
    event.stopPropagation();
    const tag = $(this).closest(".tag");
    const tagId = tag.attr("id");
    tag.remove();
    removeTagFromMap(tagId);
    $(`${getInlineListSelector()} .tag[id="${tagId}"]`).remove();
    
    printTags();
    saveSettingsDebounced();
}

function onTagInput(event) {
    let val = $(this).val();
    if (tags.find(t => t.name === val)) return;
    $(this).autocomplete("search", val);
}

function onTagInputFocus() {
    $(this).autocomplete('search', $(this).val());
}

function onCreateCharacterClick() {
    $("#tagList").empty();
}

function onCharacterSelectClick() {
        clearTagsFilter();
        const chid = Number($(this).attr('chid'));
        const key = characters[chid].avatar;
        const tags = getTagsList(key);
    
        $("#tagList").empty();
    
        for (const tag of tags) {
            appendTagToList("#tagList", tag, { removable: true });
        }
}

$(document).ready(() => {
    $("#tagInput")
        .autocomplete({ source: findTag, select: selectTag, minLength: 0, })
        .focus(onTagInputFocus); // <== show tag list on click

    $(document).on("click", "#rm_button_create", onCreateCharacterClick);
    $(document).on("click", ".tag_remove", onTagRemoveClick);
    $(document).on("click", ".character_select", onCharacterSelectClick);

    $("#tagInput").on("input", onTagInput);
});