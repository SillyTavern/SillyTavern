import { characters, saveSettingsDebounced, this_chid } from "../script.js";
import { selected_group } from "./group-chats.js";

export {
    tags,
    tag_map,
    loadTagsSettings,
    printTags,
    isElementTagged,
};

const TAG_COLORS = [
    "#dd0a36", // Red
    "#ff6633", // Orange
    "#5f9ea0", // Teal Green
    "#1e90ff", // Light Blue
    "#990066", // Plum
    "#8c00ff", // Fuchsia
    "#00ffff", // Aqua
    "#0f4ecc", // Teal
    "#2f4b1c", // Green
    "#3366e5", // Dodger Blue
    "#36c3a1", // Mint Green
    "#995511", // Terracotta
    "#ab47bc", // Plum RGBA
    "#805451", // Mulberry
    "#ff8c69", // Salmon
    "#ba55d3", // Magenta
    "#b3ffba", // Mint RGBA
    "#bae7b3", // Sea Green
    "#b5d6fd", // Light Sky Blue
    "#d9ecf1", // Mint Green RGBA
    "#ffe6e6", // Light Pink
    "#dcd0c8", // Linen
    "#bed3f3", // Lavender Blush
    "#ffe9f3", // Sand RGBA
    "#333366", // Violet
    "#993333", // Red Violet
    "#3399ff", // Sky Blue
];

const random_id = () => Math.round(Date.now() * Math.random()).toString();

const DEFAULT_TAGS = [
    { id: random_id(), name: "Plain Text", color: TAG_COLORS[0] },
    { id: random_id(), name: "OpenAI", color: TAG_COLORS[1] },
    { id: random_id(), name: "W++", color: TAG_COLORS[2] },
    { id: random_id(), name: "Boostyle", color: TAG_COLORS[3] },
    { id: random_id(), name: "PList", color: TAG_COLORS[4] },
    { id: random_id(), name: "AliChat", color: TAG_COLORS[5] },
];

let tags = [];
let tag_map = {};

function loadTagsSettings(settings) {
    tags = settings.tags !== undefined ? settings.tags : DEFAULT_TAGS;
    tag_map = settings.tag_map !== undefined ? settings.tag_map : Object.create(null);
}

function getTagsList(key) {
    if (!Array.isArray(tag_map[key])) {
        tag_map[key] = [];
        return [];
    }

    return tag_map[key].map(x => tags.find(y => y.id === x)).filter(x => x);
}

function getTagKey() {
    if (selected_group) {
        return selected_group;
    }

    if (this_chid) {
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
    const result = haystack.filter(x => x.toLowerCase().includes(needle));
    resolve(result.length !== 0 ? result : [request.term]);
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
    addTagToMap(tag.id);
    printTags();
    saveSettingsDebounced();

    // need to return false to keep the input clear
    return false;
}

function createNewTag(tagName) {
    const tag = {
        id: random_id(),
        name: tagName,
        color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
    };
    tags.push(tag);
    return tag;
}

function appendTagToList(listSelector, tag, { removable, editable, selectable }) {
    let tagElement = $('#tag_template .tag').clone();
    tagElement.attr('id', tag.id);
    tagElement.find('.tag_name').text(tag.name);
    tagElement.css({ 'background-color': tag.color });
    const removeButton = tagElement.find(".tag_remove");
    removable ? removeButton.show() : removeButton.hide();

    if (selectable) {
        tagElement.on('click', onTagFilterClick);
    }

    // TODO: handle color change
    $(listSelector).append(tagElement);
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
    const tagsToDisplay = tags.filter(x => characterTagIds.includes(x.id));

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

$(document).on("click", ".character_select", function () {
    clearTagsFilter();
    const chid = Number($(this).attr('chid'));
    const key = characters[chid].avatar;
    const tags = getTagsList(key);

    $("#tagList").empty();

    for (const tag of tags) {
        appendTagToList("#tagList", tag, { removable: true });
    }
});

$(document).ready(() => {
    $("#tagInput")
        .autocomplete({ source: findTag, select: selectTag, minLength: 0, })
        .focus(onTagInputFocus); // <== show tag list on click

    $(document).on("click", ".tag_remove", onTagRemoveClick);

    $("#tagInput").on("input", onTagInput);
});