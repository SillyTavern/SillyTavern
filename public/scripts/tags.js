import {
    characters,
    saveSettingsDebounced,
    this_chid,
    callPopup,
    menu_type,
    updateVisibleDivs,
} from "../script.js";

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
const TAG_LOGIC_AND = true; // switch to false to use OR logic for combining tags
const CHARACTER_SELECTOR = '#rm_print_characters_block > div';

const ACTIONABLE_TAGS = {

    FAV: { id: 1, name: 'Show only favorites', color: 'rgba(255, 255, 0, 0.5)', action: applyFavFilter, icon: 'fa-solid fa-star' },
    GROUP: { id: 0, name: 'Show only groups', color: 'rgba(100, 100, 100, 0.5)', action: filterByGroups, icon: 'fa-solid fa-users' },
    HINT: { id: 3, name: 'Show Tag List', color: 'rgba(150, 100, 100, 0.5)', action: onTagListHintClick, icon: 'fa-solid fa-tags' },
}

const InListActionable = {
    VIEW: { id: 2, name: 'Manage tags', color: 'rgba(150, 100, 100, 0.5)', action: onViewTagsListClick, icon: 'fa-solid fa-gear' },
}

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

function applyFavFilter() {
    const isSelected = $(this).hasClass('selected');
    const displayFavoritesOnly = !isSelected;

    $(this).toggleClass('selected', displayFavoritesOnly);
    $(CHARACTER_SELECTOR).removeClass('hiddenByFav');

    $(CHARACTER_SELECTOR).each(function () {
        if (displayFavoritesOnly) {
            if ($(this).find(".ch_fav").length !== 0) {
                const shouldBeDisplayed = $(this).find(".ch_fav").val().toLowerCase().includes(true);
                $(this).toggleClass('hiddenByFav', !shouldBeDisplayed);
            }
        }

    });
    updateVisibleDivs('#rm_print_characters_block', true);
}

function filterByGroups() {
    const isSelected = $(this).hasClass('selected');
    const displayGroupsOnly = !isSelected;
    $(this).toggleClass('selected', displayGroupsOnly);
    $(CHARACTER_SELECTOR).removeClass('hiddenByGroup');

    $(CHARACTER_SELECTOR).each((_, element) => {
        $(element).toggleClass('hiddenByGroup', displayGroupsOnly && !$(element).hasClass('group_select'));
    });
    updateVisibleDivs('#rm_print_characters_block', true);
}

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
    if (selected_group && menu_type === "group_edit") {
        return `.group_select[grid="${selected_group}"] .tags`;
    }

    if (this_chid && menu_type === "character_edit") {
        return `.character_select[chid="${this_chid}"] .tags`;
    }

    return null;
}

function getTagKey() {
    if (selected_group && menu_type === "group_edit") {
        return selected_group;
    }

    if (this_chid && menu_type === "character_edit") {
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

function findTag(request, resolve, listSelector) {
    const skipIds = [...($(listSelector).find(".tag").map((_, el) => $(el).attr("id")))];
    const haystack = tags.filter(t => !skipIds.includes(t.id)).map(t => t.name).sort();
    const needle = request.term.toLowerCase();
    const hasExactMatch = haystack.findIndex(x => x.toLowerCase() == needle) !== -1;
    const result = haystack.filter(x => x.toLowerCase().includes(needle));

    if (request.term && !hasExactMatch) {
        result.unshift(request.term);
    }

    resolve(result);
}

function selectTag(event, ui, listSelector) {
    let tagName = ui.item.value;
    let tag = tags.find(t => t.name === tagName);

    // create new tag if it doesn't exist
    if (!tag) {
        tag = createNewTag(tagName);
    }

    // unfocus and clear the input
    $(event.target).val("").trigger('blur');

    // add tag to the UI and internal map
    appendTagToList(listSelector, tag, { removable: true });
    appendTagToList(getInlineListSelector(), tag, { removable: false });
    addTagToMap(tag.id);
    saveSettingsDebounced();
    printTags();

    // need to return false to keep the input clear
    return false;
}

function createNewTag(tagName) {
    const tag = {
        id: random_id(),
        name: tagName,
        color: '',
    };
    tags.push(tag);
    return tag;
}

function appendTagToList(listElement, tag, { removable, selectable, action }) {
    if (!listElement) {
        return;
    }

    let tagElement = $('#tag_template .tag').clone();
    tagElement.attr('id', tag.id);

    tagElement.css('color', 'var(--SmartThemeBodyColor)');
    tagElement.css('background-color', tag.color);

    tagElement.find('.tag_name').text(tag.name);
    const removeButton = tagElement.find(".tag_remove");
    removable ? removeButton.show() : removeButton.hide();

    if (tag.icon) {
        tagElement.find('.tag_name').text('').attr('title', tag.name).addClass(tag.icon);
    }

    if (selectable) {
        tagElement.on('click', () => onTagFilterClick.bind(tagElement)(listElement));
    }

    if (action) {
        tagElement.on('click', () => action.bind(tagElement)());
        tagElement.addClass('actionable');
    }
    if (action && tag.id === 2) {
        tagElement.addClass('innerActionable hidden');
    }

    $(listElement).append(tagElement);
}

function onTagFilterClick(listElement) {
    const wasSelected = $(this).hasClass('selected');
    $(CHARACTER_SELECTOR).removeClass('hiddenByTag');

    $(this).toggleClass('selected', !wasSelected);

    const tagIds = [...($(listElement).find(".tag.selected:not(.actionable)").map((_, el) => $(el).attr("id")))];
    $(CHARACTER_SELECTOR).each((_, element) => applyFilterToElement(tagIds, element));
    updateVisibleDivs('#rm_print_characters_block', true);
}

function applyFilterToElement(tagIds, element) {
    if (tagIds.length === 0) {
        $(element).removeClass('hiddenByTag');
        return;
    }

    const tagFlags = tagIds.map(tagId => isElementTagged(element, tagId));
    const trueFlags = tagFlags.filter(x => x);
    const isTagged = TAG_LOGIC_AND ? tagFlags.length === trueFlags.length : trueFlags.length > 0;

    $(element).toggleClass('hiddenByTag', !isTagged);
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
    $(CHARACTER_SELECTOR).removeClass('hiddenByTag');
}

function printTags() {
    const FILTER_SELECTOR = '#rm_tag_filter';
    const selectedTagIds = [...($(FILTER_SELECTOR).find(".tag.selected").map((_, el) => $(el).attr("id")))];
    $(FILTER_SELECTOR).empty();
    const characterTagIds = Object.values(tag_map).flat();
    const tagsToDisplay = tags
        .filter(x => characterTagIds.includes(x.id))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const tag of Object.values(ACTIONABLE_TAGS)) {
        appendTagToList(FILTER_SELECTOR, tag, { removable: false, selectable: false, action: tag.action });
    }

    $(FILTER_SELECTOR).find('.actionable').last().addClass('margin-right-10px');

    for (const tag of Object.values(InListActionable)) {
        appendTagToList(FILTER_SELECTOR, tag, { removable: false, selectable: false, action: tag.action });
    }
    for (const tag of tagsToDisplay) {
        appendTagToList(FILTER_SELECTOR, tag, { removable: false, selectable: true, });
    }

    for (const tagId of selectedTagIds) {
        $(`${FILTER_SELECTOR} .tag[id="${tagId}"]`).trigger('click');
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

function onCharacterCreateClick() {
    $("#tagList").empty();
}

function onGroupCreateClick() {
    $("#groupTagList").empty();
}

export function applyTagsOnCharacterSelect() {
    //clearTagsFilter();
    const chid = Number($(this).attr('chid'));
    const key = characters[chid].avatar;
    const tags = getTagsList(key);

    $("#tagList").empty();

    for (const tag of tags) {
        appendTagToList("#tagList", tag, { removable: true });
    }
}

function applyTagsOnGroupSelect() {
    //clearTagsFilter();
    const key = $(this).attr('grid');
    const tags = getTagsList(key);

    $("#groupTagList").empty();

    for (const tag of tags) {
        appendTagToList("#groupTagList", tag, { removable: true });
    }
}

function createTagInput(inputSelector, listSelector) {
    $(inputSelector)
        .autocomplete({
            source: (i, o) => findTag(i, o, listSelector),
            select: (e, u) => selectTag(e, u, listSelector),
            minLength: 0,
        })
        .focus(onTagInputFocus); // <== show tag list on click
}

function onViewTagsListClick() {
    $('#dialogue_popup').addClass('large_dialogue_popup');
    const list = document.createElement('div');
    const everything = Object.values(tag_map).flat();
    $(list).append('<h3>Tags</h3><i>Click on the tag name to edit it.</i><br>');
    $(list).append('<i>Click on color box to assign new color.</i><br><br>');

    for (const tag of tags) {
        const count = everything.filter(x => x == tag.id).length;
        const template = $('#tag_view_template .tag_view_item').clone();
        template.attr('id', tag.id);
        template.find('.tag_view_counter_value').text(count);
        template.find('.tag_view_name').text(tag.name);
        template.find('.tag_view_name').addClass('tag');
        template.find('.tag_view_name').css('background-color', tag.color);
        const colorPickerId = tag.id + "-tag-color";
        template.find('.tagColorPickerHolder').html(
            `<toolcool-color-picker id="${colorPickerId}" color="${tag.color}" class="tag-color"></toolcool-color-picker>`
        );

        template.find('.tag-color').attr('id', colorPickerId);
        list.appendChild(template.get(0));

        setTimeout(function () {
            document.querySelector(`.tag-color[id="${colorPickerId}"`).addEventListener('change', (evt) => {
                onTagColorize(evt);
            });
        }, 100);

        $(colorPickerId).color = tag.color;

    }
    callPopup(list.outerHTML, 'text');
}

function onTagDeleteClick() {
    if (!confirm("Are you sure?")) {
        return;
    }

    const id = $(this).closest('.tag_view_item').attr('id');
    for (const key of Object.keys(tag_map)) {
        tag_map[key] = tag_map[key].filter(x => x.id !== id);
    }
    const index = tags.findIndex(x => x.id === id);
    tags.splice(index, 1);
    $(`.tag[id="${id}"]`).remove();
    $(`.tag_view_item[id="${id}"]`).remove();
    saveSettingsDebounced();
}

function onTagRenameInput() {
    const id = $(this).closest('.tag_view_item').attr('id');
    const newName = $(this).text();
    const tag = tags.find(x => x.id === id);
    tag.name = newName;
    $(`.tag[id="${id}"] .tag_name`).text(newName);
    saveSettingsDebounced();
}

function onTagColorize(evt) {
    console.debug(evt);
    const id = $(evt.target).closest('.tag_view_item').attr('id');
    const newColor = evt.detail.rgba;
    $(evt.target).parent().parent().find('.tag_view_name').css('background-color', newColor);
    $(`.tag[id="${id}"]`).css('background-color', newColor);
    const tag = tags.find(x => x.id === id);
    tag.color = newColor;
    console.debug(tag);
    saveSettingsDebounced();
}

function onTagListHintClick() {
    console.log($(this));
    $(this).toggleClass('selected');
    $(this).siblings(".tag:not(.actionable)").toggle(100);
    $(this).siblings(".innerActionable").toggleClass('hidden');
}

$(document).ready(() => {
    createTagInput('#tagInput', '#tagList');
    createTagInput('#groupTagInput', '#groupTagList');

    $(document).on("click", "#rm_button_create", onCharacterCreateClick);
    $(document).on("click", "#rm_button_group_chats", onGroupCreateClick);
    $(document).on("click", ".character_select", applyTagsOnCharacterSelect);
    $(document).on("click", ".group_select", applyTagsOnGroupSelect);
    $(document).on("click", ".tag_remove", onTagRemoveClick);
    $(document).on("input", ".tag_input", onTagInput);
    $(document).on("click", ".tags_view", onViewTagsListClick);
    $(document).on("click", ".tag_delete", onTagDeleteClick);
    $(document).on("input", ".tag_view_name", onTagRenameInput);
});
