import {
    characters,
    saveSettingsDebounced,
    this_chid,
    callPopup,
    menu_type,
    getCharacters,
    entitiesFilter,
    printCharactersDebounced,
    buildAvatarList,
    eventSource,
    event_types,
} from '../script.js';
// eslint-disable-next-line no-unused-vars
import { FILTER_TYPES, FILTER_STATES, DEFAULT_FILTER_STATE, isFilterState, FilterHelper } from './filters.js';

import { groupCandidatesFilter, groups, select_group_chats, selected_group } from './group-chats.js';
import { download, onlyUnique, parseJsonFile, uuidv4, getSortableDelay, flashHighlight } from './utils.js';
import { power_user } from './power-user.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';

export {
    TAG_FOLDER_TYPES,
    TAG_FOLDER_DEFAULT_TYPE,
    tags,
    tag_map,
    filterByTagState,
    isBogusFolder,
    isBogusFolderOpen,
    chooseBogusFolder,
    getTagBlock,
    loadTagsSettings,
    printTagFilters,
    getTagsList,
    printTagList,
    appendTagToList,
    createTagMapFromList,
    renameTagKey,
    importTags,
    sortTags,
    compareTagsForSort,
    removeTagFromMap,
};

const CHARACTER_FILTER_SELECTOR = '#rm_characters_block .rm_tag_filter';
const GROUP_FILTER_SELECTOR = '#rm_group_chats_block .rm_tag_filter';
const TAG_TEMPLATE = $('#tag_template .tag');
const FOLDER_TEMPLATE = $('#bogus_folder_template .bogus_folder_select');
const VIEW_TAG_TEMPLATE = $('#tag_view_template .tag_view_item');

function getFilterHelper(listSelector) {
    return $(listSelector).is(GROUP_FILTER_SELECTOR) ? groupCandidatesFilter : entitiesFilter;
}

export const tag_filter_types = {
    character: 0,
    group_member: 1,
};

/**
 * @type {{ FAV: Tag, GROUP: Tag, FOLDER: Tag, VIEW: Tag, HINT: Tag, UNFILTER: Tag }}
 * A collection of global actional tags for the filter panel
 * */
const ACTIONABLE_TAGS = {
    FAV: { id: '1', sort_order: 1, name: 'Show only favorites', color: 'rgba(255, 255, 0, 0.5)', action: filterByFav, icon: 'fa-solid fa-star', class: 'filterByFavorites' },
    GROUP: { id: '0', sort_order: 2, name: 'Show only groups', color: 'rgba(100, 100, 100, 0.5)', action: filterByGroups, icon: 'fa-solid fa-users', class: 'filterByGroups' },
    FOLDER: { id: '4', sort_order: 3, name: 'Show only folders', color: 'rgba(120, 120, 120, 0.5)', action: filterByFolder, icon: 'fa-solid fa-folder-plus', class: 'filterByFolder' },
    VIEW: { id: '2', sort_order: 4, name: 'Manage tags', color: 'rgba(150, 100, 100, 0.5)', action: onViewTagsListClick, icon: 'fa-solid fa-gear', class: 'manageTags' },
    HINT: { id: '3', sort_order: 5, name: 'Show Tag List', color: 'rgba(150, 100, 100, 0.5)', action: onTagListHintClick, icon: 'fa-solid fa-tags', class: 'showTagList' },
    UNFILTER: { id: '5', sort_order: 6, name: 'Clear all filters', action: onClearAllFiltersClick, icon: 'fa-solid fa-filter-circle-xmark', class: 'clearAllFilters' },
};

/** @type {{[key: string]: Tag}} An optional list of actionables that can be utilized by extensions */
const InListActionable = {
};

/** @type {Tag[]} A list of default tags */
const DEFAULT_TAGS = [
    { id: uuidv4(), name: 'Plain Text', create_date: Date.now() },
    { id: uuidv4(), name: 'OpenAI', create_date: Date.now() },
    { id: uuidv4(), name: 'W++', create_date: Date.now() },
    { id: uuidv4(), name: 'Boostyle', create_date: Date.now() },
    { id: uuidv4(), name: 'PList', create_date: Date.now() },
    { id: uuidv4(), name: 'AliChat', create_date: Date.now() },
];

/**
 * @typedef FolderType Bogus folder type
 * @property {string} icon - The icon as a string representation / character
 * @property {string} class - The class to apply to the folder type element
 * @property {string} [fa_icon] - Optional font-awesome icon class representing the folder type element
 * @property {string} [tooltip] - Optional tooltip for the folder type element
 * @property {string} [color] - Optional color for the folder type element
 * @property {string} [size] - A string representation of the size that the folder type element should be
 */

/**
 * @type {{ OPEN: FolderType, CLOSED: FolderType, NONE: FolderType, [key: string]: FolderType }}
 * The list of all possible tag folder types
 */
const TAG_FOLDER_TYPES = {
    OPEN: { icon: '✔', class: 'folder_open', fa_icon: 'fa-folder-open', tooltip: 'Open Folder (Show all characters even if not selected)', color: 'green', size: '1' },
    CLOSED: { icon: '👁', class: 'folder_closed', fa_icon: 'fa-eye-slash', tooltip: 'Closed Folder (Hide all characters unless selected)', color: 'lightgoldenrodyellow', size: '0.7' },
    NONE: { icon: '✕', class: 'no_folder', tooltip: 'No Folder', color: 'red', size: '1' },
};
const TAG_FOLDER_DEFAULT_TYPE = 'NONE';

/**
 * @typedef {object} Tag - Object representing a tag
 * @property {string} id - The id of the tag (As a kind of has string. This is used whenever the tag is referenced or linked, as the name might change)
 * @property {string} name - The name of the tag
 * @property {string} [folder_type] - The bogus folder type of this tag (based on `TAG_FOLDER_TYPES`)
 * @property {string} [filter_state] - The saved state of the filter chosen of this tag (based on `FILTER_STATES`)
 * @property {number} [sort_order] - A custom integer representing the sort order if tags are sorted
 * @property {string} [color] - The background color of the tag
 * @property {string} [color2] - The foreground color of the tag
 * @property {number} [create_date] - A number representing the date when this tag was created
 *
 * @property {function} [action] - An optional function that gets executed when this tag is an actionable tag and is clicked on.
 * @property {string} [class] - An optional css class added to the control representing this tag when printed. Used for custom tags in the filters.
 * @property {string} [icon] - An optional css class of an icon representing this tag when printed. This will replace the tag name with the icon. Used for custom tags in the filters.
 * @property {string} [title] - An optional title for the tooltip of this tag. If there is no tooltip specified, and "icon" is chosen, the tooltip will be the "name" property.
 */

/**
 * An list of all tags that are available
 * @type {Tag[]}
 */
let tags = [];

/**
 * A map representing the key of an entity (character avatar, group id, etc) with a corresponding array of tags this entity has assigned. The array might not exist if no tags were assigned yet.
 * @type {{[identifier: string]: string[]?}}
 */
let tag_map = {};

/**
 * A cache of all cut-off tag lists that got expanded until the last reload. They will be printed expanded again.
 * It contains the key of the entity.
 * @type {string[]} ids
 */
let expanded_tags_cache = [];

/**
 * Applies the basic filter for the current state of the tags and their selection on an entity list.
 * @param {Array<Object>} entities List of entities for display, consisting of tags, characters and groups.
 * @param {Object} param1 Optional parameters, explained below.
 * @param {Boolean} [param1.globalDisplayFilters] When enabled, applies the final filter for the global list. Icludes filtering out entities in closed/hidden folders and empty folders.
 * @param {Object} [param1.subForEntity] When given an entity, the list of entities gets filtered specifically for that one as a "sub list", filtering out other tags, elements not tagged for this and hidden elements.
 * @param {Boolean} [param1.filterHidden] Optional switch with which filtering out hidden items (from closed folders) can be disabled.
 * @returns The filtered list of entities
 */
function filterByTagState(entities, { globalDisplayFilters = false, subForEntity = undefined, filterHidden = true } = {}) {
    const filterData = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));

    entities = entities.filter(entity => {
        if (entity.type === 'tag') {
            // Remove folders that are already filtered on
            if (filterData.selected.includes(entity.id) || filterData.excluded.includes(entity.id)) {
                return false;
            }
        }

        return true;
    });

    if (globalDisplayFilters) {
        // Prepare some data for caching and performance
        const closedFolders = entities.filter(x => x.type === 'tag' && TAG_FOLDER_TYPES[x.item.folder_type] === TAG_FOLDER_TYPES.CLOSED);

        entities = entities.filter(entity => {
            // Hide entities that are in a closed folder, unless that one is opened
            if (filterHidden && entity.type !== 'tag' && closedFolders.some(f => entitiesFilter.isElementTagged(entity, f.id) && !filterData.selected.includes(f.id))) {
                return false;
            }

            // Hide folders that have 0 visible sub entities after the first filtering round
            if (entity.type === 'tag') {
                return entity.entities.length > 0;
            }

            return true;
        });
    }

    if (subForEntity !== undefined && subForEntity.type === 'tag') {
        entities = filterTagSubEntities(subForEntity.item, entities, { filterHidden: filterHidden });
    }

    return entities;
}

/**
 * Filter a a list of entities based on a given tag, returning all entities that represent "sub entities"
 *
 * @param {Tag} tag - The to filter the entities for
 * @param {object[]} entities - The list of possible entities (tag, group, folder) that should get filtered
 * @param {object} param2 - optional parameteres
 * @param {boolean} [param2.filterHidden] - Whether hidden entities should be filtered out too
 * @returns {object[]} The filtered list of entities that apply to the given tag
 */
function filterTagSubEntities(tag, entities, { filterHidden = true } = {}) {
    const filterData = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));

    const closedFolders = entities.filter(x => x.type === 'tag' && TAG_FOLDER_TYPES[x.item.folder_type] === TAG_FOLDER_TYPES.CLOSED);

    entities = entities.filter(sub => {
        // Filter out all tags and and all who isn't tagged for this item
        if (sub.type === 'tag' || !entitiesFilter.isElementTagged(sub, tag.id)) {
            return false;
        }

        // Hide entities that are in a closed folder, unless the closed folder is opened or we display a closed folder
        if (filterHidden && sub.type !== 'tag' && TAG_FOLDER_TYPES[tag.folder_type] !== TAG_FOLDER_TYPES.CLOSED && closedFolders.some(f => entitiesFilter.isElementTagged(sub, f.id) && !filterData.selected.includes(f.id))) {
            return false;
        }

        return true;
    });

    return entities;
}

/**
 * Indicates whether a given tag is defined as a folder. Meaning it's neither undefined nor 'NONE'.
 *
 * @param {Tag} tag - The tag to check
 * @returns {boolean} Whether it's a tag folder
 */
function isBogusFolder(tag) {
    return tag?.folder_type !== undefined && tag.folder_type !== TAG_FOLDER_DEFAULT_TYPE;
}

/**
 * Indicates whether a user is currently in a bogus folder.
 *
 * @returns {boolean} If currently viewing a folder
 */
function isBogusFolderOpen() {
    const anyIsFolder = entitiesFilter.getFilterData(FILTER_TYPES.TAG)?.selected
        .map(tagId => tags.find(x => x.id === tagId))
        .some(isBogusFolder);

    return !!anyIsFolder;
}

/**
 * Function to be called when a specific tag/folder is chosen to "drill down".
 *
 * @param {*} source The jQuery element clicked when choosing the folder
 * @param {string} tagId The tag id that is behind the chosen folder
 * @param {boolean} remove Whether the given tag should be removed (otherwise it is added/chosen)
 */
function chooseBogusFolder(source, tagId, remove = false) {
    // If we are here via the 'back' action, we implicitly take the last filtered folder as one to remove
    const isBack = tagId === 'back';
    if (isBack) {
        const drilldown = $(source).closest('#rm_characters_block').find('.rm_tag_bogus_drilldown');
        const lastTag = drilldown.find('.tag:last').last();
        tagId = lastTag.attr('id');
        remove = true;
    }

    // Instead of manually updating the filter conditions, we just "click" on the filter tag
    // We search inside which filter block we are located in and use that one
    const FILTER_SELECTOR = ($(source).closest('#rm_characters_block') ?? $(source).closest('#rm_group_chats_block')).find('.rm_tag_filter');
    const tagElement = $(FILTER_SELECTOR).find(`.tag[id=${tagId}]`);

    toggleTagThreeState(tagElement, { stateOverride: !remove ? FILTER_STATES.SELECTED : DEFAULT_FILTER_STATE, simulateClick: true });
}

/**
 * Builds the tag block for the specified item.
 *
 * @param {Tag} tag The tag item
 * @param {*} entities The list ob sub items for this tag
 * @param {*} hidden A count of how many sub items are hidden
 * @returns The html for the tag block
 */
function getTagBlock(tag, entities, hidden = 0) {
    let count = entities.length;

    const tagFolder = TAG_FOLDER_TYPES[tag.folder_type];

    const template = FOLDER_TEMPLATE.clone();
    template.addClass(tagFolder.class);
    template.attr({ 'tagid': tag.id, 'id': `BogusFolder${tag.id}` });
    template.find('.avatar').css({ 'background-color': tag.color, 'color': tag.color2 }).attr('title', `[Folder] ${tag.name}`);
    template.find('.ch_name').text(tag.name).attr('title', `[Folder] ${tag.name}`);
    template.find('.bogus_folder_hidden_counter').text(hidden > 0 ? `${hidden} hidden` : '');
    template.find('.bogus_folder_counter').text(`${count} ${count != 1 ? 'characters' : 'character'}`);
    template.find('.bogus_folder_icon').addClass(tagFolder.fa_icon);

    // Fill inline character images
    buildAvatarList(template.find('.bogus_folder_avatars_block'), entities);

    return template;
}

/**
 * Applies the favorite filter to the character list.
 * @param {FilterHelper} filterHelper Instance of FilterHelper class.
 */
function filterByFav(filterHelper) {
    const state = toggleTagThreeState($(this));
    ACTIONABLE_TAGS.FAV.filter_state = state;
    filterHelper.setFilterData(FILTER_TYPES.FAV, state);
}

/**
 * Applies the "is group" filter to the character list.
 * @param {FilterHelper} filterHelper Instance of FilterHelper class.
 */
function filterByGroups(filterHelper) {
    const state = toggleTagThreeState($(this));
    ACTIONABLE_TAGS.GROUP.filter_state = state;
    filterHelper.setFilterData(FILTER_TYPES.GROUP, state);
}

/**
 * Applies the "only folder" filter to the character list.
 * @param {FilterHelper} filterHelper Instance of FilterHelper class.
 */
function filterByFolder(filterHelper) {
    if (!power_user.bogus_folders) {
        $('#bogus_folders').prop('checked', true).trigger('input');
        onViewTagsListClick();
        flashHighlight($('#dialogue_popup .tag_as_folder, #dialogue_popup .tag_folder_indicator'));
        return;
    }

    const state = toggleTagThreeState($(this));
    ACTIONABLE_TAGS.FOLDER.filter_state = state;
    filterHelper.setFilterData(FILTER_TYPES.FOLDER, state);
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
    const tagIds = [...($(listElement).find('.tag').map((_, el) => $(el).attr('id')))];
    tag_map[key] = tagIds;
    saveSettingsDebounced();
}

/**
 * Gets a list of all tags for a given entity key.
 * If you have an entity, you can get it's key easily via `getTagKeyForEntity(entity)`.
 *
 * @param {string} key - The key for which to get tags via the tag map
 * @param {boolean} [sort=true] - Whether the tag list should be sorted
 * @returns {Tag[]} A list of tags
 */
function getTagsList(key, sort = true) {
    if (!Array.isArray(tag_map[key])) {
        tag_map[key] = [];
        return [];
    }

    const list = tag_map[key]
        .map(x => tags.find(y => y.id === x))
        .filter(x => x);
    if (sort) list.sort(compareTagsForSort);
    return list;
}

function getInlineListSelector() {
    if (selected_group && menu_type === 'group_edit') {
        return `.group_select[grid="${selected_group}"] .tags`;
    }

    if (this_chid && menu_type === 'character_edit') {
        return `.character_select[chid="${this_chid}"] .tags`;
    }

    return null;
}

/**
 * Gets the current tag key based on the currently selected character or group
 */
function getTagKey() {
    if (selected_group && menu_type === 'group_edit') {
        return selected_group;
    }

    if (this_chid !== undefined && menu_type === 'character_edit') {
        return characters[this_chid].avatar;
    }

    return null;
}

/**
 * Gets the tag key for any provided entity/id/key. If a valid tag key is provided, it just returns this.
 * Robust method to find a valid tag key for any entity.
 *
 * @param {object|number|string} entityOrKey An entity with id property (character, group, tag), or directly an id or tag key.
 * @returns {string|undefined} The tag key that can be found.
 */
export function getTagKeyForEntity(entityOrKey) {
    let x = entityOrKey;

    // If it's an object and has an 'id' property, we take this for further processing
    if (typeof x === 'object' && x !== null && 'id' in x) {
        x = x.id;
    }

    // Next lets check if its a valid character or character id, so we can swith it to its tag
    const character = characters.indexOf(x) >= 0 ? x : characters[x];
    if (character) {
        x = character.avatar;
    }

    // Uninitialized character tag map
    if (character && !(x in tag_map)) {
        tag_map[x] = [];
        return x;
    }

    // We should hopefully have a key now. Let's check
    if (x in tag_map) {
        return x;
    }

    // If none of the above, we cannot find a valid tag key
    return undefined;
}

/**
 * Checks for a tag key based on an entity for a given element.
 * It checks the given element and upwards parents for a set character id (chid) or group id (grid), and if there is any, returns its unique entity key.
 *
 * @param {JQuery<HTMLElement>|string} element - The element to search the entity id on
 * @returns {string|undefined} The tag key that can be found.
 */
export function getTagKeyForEntityElement(element) {
    if (typeof element === 'string') {
        element = $(element);
    }
    // Start with the given element and traverse up the DOM tree
    while (element.length && element.parent().length) {
        const grid = element.attr('grid');
        const chid = element.attr('chid');
        if (grid || chid) {
            const id = grid || chid;
            return getTagKeyForEntity(id);
        }

        // Move up to the parent element
        element = element.parent();
    }

    return undefined;
}

/**
 * Adds a tag to a given entity
 * @param {Tag} tag - The tag to add
 * @param {string|string[]} entityId - The entity to add this tag to. Has to be the entity key (e.g. `addTagToEntity`). (Also allows multiple entities to be passed in)
 * @param {object} [options={}] - Optional arguments
 * @param {JQuery<HTMLElement>|string?} [options.tagListSelector=null] - An optional selector if a specific list should be updated with the new tag too (for example because the add was triggered for that function)
 * @param {PrintTagListOptions} [options.tagListOptions] - Optional parameters for printing the tag list. Can be set to be consistent with the expected behavior of tags in the list that was defined before.
 * @returns {boolean} Whether at least one tag was added
 */
export function addTagToEntity(tag, entityId, { tagListSelector = null, tagListOptions = {} } = {}) {
    let result = false;
    // Add tags to the map
    if (Array.isArray(entityId)) {
        entityId.forEach((id) => result = addTagToMap(tag.id, id) || result);
    } else {
        result = addTagToMap(tag.id, entityId);
    }

    // Save and redraw
    printCharactersDebounced();
    saveSettingsDebounced();

    // We should manually add the selected tag to the print tag function, so we cover places where the tag list did not automatically include it
    tagListOptions.addTag = tag;

    // add tag to the UI and internal map - we reprint so sorting and new markup is done correctly
    if (tagListSelector) printTagList(tagListSelector, tagListOptions);
    const inlineSelector = getInlineListSelector();
    if (inlineSelector) {
        printTagList($(inlineSelector), tagListOptions);
    }

    return result;
}

/**
 * Removes a tag from a given entity
 * @param {Tag} tag - The tag to remove
 * @param {string|string[]} entityId - The entity to remove this tag from. Has to be the entity key (e.g. `addTagToEntity`). (Also allows multiple entities to be passed in)
 * @param {object} [options={}] - Optional arguments
 * @param {JQuery<HTMLElement>|string?} [options.tagListSelector=null] - An optional selector if a specific list should be updated with the tag removed too (for example because the add was triggered for that function)
 * @param {JQuery<HTMLElement>?} [options.tagElement=null] - Optionally a direct html element of the tag to be removed, so it can be removed from the UI
 * @returns {boolean} Whether at least one tag was removed
 */
export function removeTagFromEntity(tag, entityId, { tagListSelector = null, tagElement = null } = {}) {
    let result = false;
    // Remove tag from the map
    if (Array.isArray(entityId)) {
        entityId.forEach((id) => result = removeTagFromMap(tag.id, id) || result);
    } else {
        result = removeTagFromMap(tag.id, entityId);
    }

    // Save and redraw
    printCharactersDebounced();
    saveSettingsDebounced();

    // We don't reprint the lists, we can just remove the html elements from them.
    if (tagListSelector) {
        const $selector = (typeof tagListSelector === 'string') ? $(tagListSelector) : tagListSelector;
        $selector.find(`.tag[id="${tag.id}"]`).remove();
    }
    if (tagElement) tagElement.remove();
    $(`${getInlineListSelector()} .tag[id="${tag.id}"]`).remove();

    return result;
}

/**
 * Adds a tag from a given character. If no character is provided, adds it from the currently active one.
 * @param {string} tagId - The id of the tag
 * @param {string} characterId - The id/key of the character or group
 * @returns {boolean} Whether the tag was added or not
 */
function addTagToMap(tagId, characterId = null) {
    const key = characterId !== null && characterId !== undefined ? getTagKeyForEntity(characterId) : getTagKey();

    if (!key) {
        return false;
    }

    if (!Array.isArray(tag_map[key])) {
        tag_map[key] = [tagId];
        return true;
    }
    else {
        if (tag_map[key].includes(tagId))
            return false;

        tag_map[key].push(tagId);
        tag_map[key] = tag_map[key].filter(onlyUnique);
        return true;
    }
}

/**
 * Removes a tag from a given character. If no character is provided, removes it from the currently active one.
 * @param {string} tagId - The id of the tag
 * @param {string} characterId - The id/key of the character or group
 * @returns {boolean} Whether the tag was removed or not
 */
function removeTagFromMap(tagId, characterId = null) {
    const key = characterId !== null && characterId !== undefined ? getTagKeyForEntity(characterId) : getTagKey();

    if (!key) {
        return false;
    }

    if (!Array.isArray(tag_map[key])) {
        tag_map[key] = [];
        return false;
    }
    else {
        const indexOf = tag_map[key].indexOf(tagId);
        tag_map[key].splice(indexOf, 1);
        return indexOf !== -1;
    }
}

function findTag(request, resolve, listSelector) {
    const skipIds = [...($(listSelector).find('.tag').map((_, el) => $(el).attr('id')))];
    const haystack = tags.filter(t => !skipIds.includes(t.id)).map(t => t.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const needle = request.term.toLowerCase();
    const hasExactMatch = haystack.findIndex(x => x.toLowerCase() == needle) !== -1;
    const result = haystack.filter(x => x.toLowerCase().includes(needle));

    if (request.term && !hasExactMatch) {
        result.unshift(request.term);
    }

    resolve(result);
}

/**
 * Select a tag and add it to the list. This function is (mostly) used as an event handler for the tag selector control.
 *
 * @param {*} event - The event that fired on autocomplete select
 * @param {*} ui - An Object with label and value properties for the selected option
 * @param {*} listSelector - The selector of the list to print/add to
 * @param {object} param1 - Optional parameters for this method call
 * @param {PrintTagListOptions} [param1.tagListOptions] - Optional parameters for printing the tag list. Can be set to be consistent with the expected behavior of tags in the list that was defined before.
 * @returns {boolean} <c>false</c>, to keep the input clear
 */
function selectTag(event, ui, listSelector, { tagListOptions = {} } = {}) {
    let tagName = ui.item.value;
    let tag = tags.find(t => t.name === tagName);

    // create new tag if it doesn't exist
    if (!tag) {
        tag = createNewTag(tagName);
    }

    // unfocus and clear the input
    $(event.target).val('').trigger('input');

    // Optional, check for multiple character ids being present.
    const characterData = event.target.closest('#bulk_tags_div')?.dataset.characters;
    const characterIds = characterData ? JSON.parse(characterData).characterIds : null;

    addTagToEntity(tag, characterIds, { tagListSelector: listSelector, tagListOptions: tagListOptions });

    // need to return false to keep the input clear
    return false;
}

/**
 * Get a list of existing tags matching a list of provided new tag names
 *
 * @param {string[]} new_tags - A list of strings representing tag names
 * @returns List of existing tags
 */
function getExistingTags(new_tags) {
    let existing_tags = [];
    for (let tag of new_tags) {
        let foundTag = tags.find(t => t.name.toLowerCase() === tag.toLowerCase());
        if (foundTag) {
            existing_tags.push(foundTag.name);
        }
    }
    return existing_tags;
}

async function importTags(imported_char) {
    let imported_tags = imported_char.tags.filter(t => t !== 'ROOT' && t !== 'TAVERN');
    let existingTags = await getExistingTags(imported_tags);
    //make this case insensitive
    let newTags = imported_tags.filter(t => !existingTags.some(existingTag => existingTag.toLowerCase() === t.toLowerCase()));
    let selected_tags = '';
    const existingTagsString = existingTags.length ? (': ' + existingTags.join(', ')) : '';
    if (newTags.length === 0) {
        await callPopup(`<h3>Importing Tags For ${imported_char.name}</h3><p>${existingTags.length} existing tags have been found${existingTagsString}.</p>`, 'text');
    } else {
        selected_tags = await callPopup(`<h3>Importing Tags For ${imported_char.name}</h3><p>${existingTags.length} existing tags have been found${existingTagsString}.</p><p>The following ${newTags.length} new tags will be imported.</p>`, 'input', newTags.join(', '));
    }
    // @ts-ignore
    selected_tags = existingTags.concat(selected_tags.split(','));
    // @ts-ignore
    selected_tags = selected_tags.map(t => t.trim()).filter(t => t !== '');
    //Anti-troll measure
    if (selected_tags.length > 15) {
        selected_tags = selected_tags.slice(0, 15);
    }
    for (let tagName of selected_tags) {
        let tag = tags.find(t => t.name === tagName);

        if (!tag) {
            tag = createNewTag(tagName);
        }

        if (!tag_map[imported_char.avatar].includes(tag.id)) {
            tag_map[imported_char.avatar].push(tag.id);
            console.debug('added tag to map', tag, imported_char.name);
        }
    }

    saveSettingsDebounced();

    // Await the character list, which will automatically reprint it and all tag filters
    await getCharacters();

    // need to return false to keep the input clear
    return false;
}

/**
 * Creates a new tag with default properties and a randomly generated id
 *
 * @param {string} tagName - name of the tag
 * @returns {Tag}
 */
function createNewTag(tagName) {
    const tag = {
        id: uuidv4(),
        name: tagName,
        folder_type: TAG_FOLDER_DEFAULT_TYPE,
        filter_state: DEFAULT_FILTER_STATE,
        sort_order: tags.length,
        color: '',
        color2: '',
        create_date: Date.now(),
    };
    tags.push(tag);
    console.debug('Created new tag', tag.name, 'with id', tag.id);
    return tag;
}

/**
 * @typedef {object} TagOptions - Options for tag behavior. (Same object will be passed into "appendTagToList")
 * @property {boolean} [removable=false] - Whether tags can be removed.
 * @property {boolean} [selectable=false] - Whether tags can be selected.
 * @property {function} [action=undefined] - Action to perform on tag interaction.
 * @property {boolean} [isGeneralList=false] - If true, indicates that this is the general list of tags.
 * @property {boolean} [skipExistsCheck=false] - If true, the tag gets added even if a tag with the same id already exists.
 */

/**
 * @typedef {object} PrintTagListOptions - Optional parameters for printing the tag list.
 * @property {Tag[]|function(): Tag[]} [tags=undefined] - Optional override of tags that should be printed. Those will not be sorted. If no supplied, tags for the relevant character are printed. Can also be a function that returns the tags.
 * @property {Tag} [addTag=undefined] - Optionally provide a tag that should be manually added to this print. Either to the overriden tag list or the found tags based on the entity/key. Will respect the tag exists check.
 * @property {object|number|string} [forEntityOrKey=undefined] - Optional override for the chosen entity, otherwise the currently selected is chosen. Can be an entity with id property (character, group, tag), or directly an id or tag key.
 * @property {boolean|string} [empty=true] - Whether the list should be initially empty. If a string string is provided, 'always' will always empty the list, otherwise it'll evaluate to a boolean.
 * @property {boolean} [sort=true] - Whether the tags should be sorted via the sort function, or kept as is.
 * @property {function(object): function} [tagActionSelector=undefined] - An optional override for the action property that can be assigned to each tag via tagOptions.
 * If set, the selector is executed on each tag as input argument. This allows a list of tags to be provided and each tag can have it's action based on the tag object itself.
 * @property {TagOptions} [tagOptions={}] - Options for tag behavior. (Same object will be passed into "appendTagToList")
 */

/**
 * Prints the list of tags
 *
 * @param {JQuery<HTMLElement>|string} element - The container element where the tags are to be printed. (Optionally can also be a string selector for the element, which will then be resolved)
 * @param {PrintTagListOptions} [options] - Optional parameters for printing the tag list.
 */
function printTagList(element, { tags = undefined, addTag = undefined, forEntityOrKey = undefined, empty = true, sort = true, tagActionSelector = undefined, tagOptions = {} } = {}) {
    const $element = (typeof element === 'string') ? $(element) : element;
    const key = forEntityOrKey !== undefined ? getTagKeyForEntity(forEntityOrKey) : getTagKey();
    let printableTags = tags ? (typeof tags === 'function' ? tags() : tags) : getTagsList(key, sort);

    if (empty === 'always' || (empty && (printableTags?.length > 0 || key))) {
        $element.empty();
    }

    if (addTag && (tagOptions.skipExistsCheck || !printableTags.some(x => x.id === addTag.id))) {
        printableTags = [...printableTags, addTag];
    }

    // one last sort, because we might have modified the tag list or manually retrieved it from a function
    if (sort) printableTags = printableTags.sort(compareTagsForSort);

    const customAction = typeof tagActionSelector === 'function' ? tagActionSelector : null;

    // Well, lets check if the tag list was expanded. Based on either a css class, or when any expand was clicked yet, then we search whether this element id matches
    const expanded = $element.hasClass('tags-expanded') || (expanded_tags_cache.length && expanded_tags_cache.indexOf(key ?? getTagKeyForEntityElement(element)) >= 0);

    // We prepare some stuff. No matter which list we have, there is a maximum value of tags we are going to display
    // Constants to define tag printing limits
    const DEFAULT_TAGS_LIMIT = 50;
    const tagsDisplayLimit = expanded ? Number.MAX_SAFE_INTEGER : DEFAULT_TAGS_LIMIT;

    // Functions to determine tag properties
    const isFilterActive = (/** @type {Tag} */ tag) => tag.filter_state && !isFilterState(tag.filter_state, FILTER_STATES.UNDEFINED);
    const shouldPrintTag = (/** @type {Tag} */ tag) => isBogusFolder(tag) || isFilterActive(tag);

    // Calculating the number of tags to print
    const mandatoryPrintTagsCount = printableTags.filter(shouldPrintTag).length;
    const availableSlotsForAdditionalTags = Math.max(tagsDisplayLimit - mandatoryPrintTagsCount, 0);

    // Counters for printed and hidden tags
    let additionalTagsPrinted = 0;
    let tagsSkipped = 0;

    for (const tag of printableTags) {
        // If we have a custom action selector, we override that tag options for each tag
        if (customAction) {
            const action = customAction(tag);
            if (action && typeof action !== 'function') {
                console.error('The action parameter must return a function for tag.', tag);
            } else {
                tagOptions.action = action;
            }
        }

        // Check if we should print this tag
        if (shouldPrintTag(tag) || additionalTagsPrinted++ < availableSlotsForAdditionalTags) {
            appendTagToList($element, tag, tagOptions);
        } else {
            tagsSkipped++;
        }
    }

    // After the loop, check if we need to add the placeholder.
    // The placehold if clicked expands the tags and remembers either via class or cache array which was expanded, so it'll stay expanded until the next reload.
    if (tagsSkipped > 0) {
        const id = 'placeholder_' + uuidv4();

        // Add click event
        const showHiddenTags = (_, event) => {
            const elementKey = key ?? getTagKeyForEntityElement($element);
            console.log(`Hidden tags shown for element ${elementKey}`);

            // Mark the current char/group as expanded if we were in any. This will be kept in memory until reload
            $element.addClass('tags-expanded');
            expanded_tags_cache.push(elementKey);

            // Do not bubble further, we are just expanding
            event.stopPropagation();
            printTagList($element, { tags: tags, addTag: addTag, forEntityOrKey: forEntityOrKey, empty: empty, tagActionSelector: tagActionSelector, tagOptions: tagOptions });
        };

        // Print the placeholder object with its styling and action to show the remaining tags
        /** @type {Tag} */
        const placeholderTag = { id: id, name: '...', title: `${tagsSkipped} tags not displayed.\n\nClick to expand remaining tags.`, color: 'transparent', action: showHiddenTags, class: 'placeholder-expander' };
        // It should never be marked as a removable tag, because it's just an expander action
        /** @type {TagOptions} */
        const placeholderTagOptions = { ...tagOptions, removable: false };
        appendTagToList($element, placeholderTag, placeholderTagOptions);
    }
}

/**
 * Appends a tag to the list element
 *
 * @param {JQuery<HTMLElement>} listElement - List element
 * @param {Tag} tag - Tag object to append
 * @param {TagOptions} [options={}] - Options for tag behavior
 * @returns {void}
 */
function appendTagToList(listElement, tag, { removable = false, selectable = false, action = undefined, isGeneralList = false, skipExistsCheck = false } = {}) {
    if (!listElement) {
        return;
    }
    if (!skipExistsCheck && $(listElement).find(`.tag[id="${tag.id}"]`).length > 0) {
        return;
    }

    let tagElement = TAG_TEMPLATE.clone();
    tagElement.attr('id', tag.id);

    //tagElement.css('color', 'var(--SmartThemeBodyColor)');
    tagElement.css('background-color', tag.color);
    tagElement.css('color', tag.color2);

    tagElement.find('.tag_name').text(tag.name);
    const removeButton = tagElement.find('.tag_remove');
    removable ? removeButton.show() : removeButton.hide();

    if (tag.class) {
        tagElement.addClass(tag.class);
    }
    if (tag.title) {
        tagElement.attr('title', tag.title);
    }
    if (tag.icon) {
        tagElement.find('.tag_name').text('').attr('title', `${tag.name} ${tag.title || ''}`.trim()).addClass(tag.icon);
        tagElement.addClass('actionable');
    }

    // We could have multiple ways of actions passed in. The manual arguments have precendence in front of a specified tag action
    const clickableAction = action ?? tag.action;

    // If this is a tag for a general list and its either selectable or actionable, lets mark its current state
    if ((selectable || clickableAction) && isGeneralList) {
        toggleTagThreeState(tagElement, { stateOverride: tag.filter_state ?? DEFAULT_FILTER_STATE });
    }

    if (selectable) {
        tagElement.on('click', () => onTagFilterClick.bind(tagElement)(listElement));
    }

    if (clickableAction) {
        const filter = getFilterHelper($(listElement));
        tagElement.on('click', (e) => clickableAction.bind(tagElement)(filter, e));
        tagElement.addClass('clickable-action');
    }

    $(listElement).append(tagElement);
}

function onTagFilterClick(listElement) {
    const tagId = $(this).attr('id');
    const existingTag = tags.find((tag) => tag.id === tagId);

    let state = toggleTagThreeState($(this));

    if (existingTag) {
        existingTag.filter_state = state;
        saveSettingsDebounced();
    }

    // We don't print anything manually, updating the filter will automatically trigger a redraw of all relevant stuff
    runTagFilters(listElement);
}

/**
 * Toggle the filter state of a given tag element
 *
 * @param {JQuery<HTMLElement>} element - The jquery element representing the tag for which the state should be toggled
 * @param {object} param1 - Optional parameters
 * @param {import('./filters.js').FilterState|string} [param1.stateOverride] - Optional state override to which the state should be toggled to. If not set, the state will move to the next one in the chain.
 * @param {boolean} [param1.simulateClick] - Optionally specify that the state should not just be set on the html element, but actually achieved via triggering the "click" on it, which follows up with the general click handlers and reprinting
 * @returns {string} The string representing the new state
 */
function toggleTagThreeState(element, { stateOverride = undefined, simulateClick = false } = {}) {
    const states = Object.keys(FILTER_STATES);

    // Make it clear we're getting indexes and handling the 'not found' case in one place
    function getStateIndex(key, fallback) {
        const index = states.indexOf(key);
        return index !== -1 ? index : states.indexOf(fallback);
    }

    const overrideKey = typeof stateOverride == 'string' && states.includes(stateOverride) ? stateOverride : Object.keys(FILTER_STATES).find(key => FILTER_STATES[key] === stateOverride);

    const currentStateIndex = getStateIndex(element.attr('data-toggle-state'), DEFAULT_FILTER_STATE);
    const targetStateIndex = overrideKey !== undefined ? getStateIndex(overrideKey, DEFAULT_FILTER_STATE) : (currentStateIndex + 1) % states.length;

    if (simulateClick) {
        // Calculate how many clicks are needed to go from the current state to the target state
        let clickCount = 0;
        if (targetStateIndex >= currentStateIndex) {
            clickCount = targetStateIndex - currentStateIndex;
        } else {
            clickCount = (states.length - currentStateIndex) + targetStateIndex;
        }

        for (let i = 0; i < clickCount; i++) {
            $(element).trigger('click');
        }

        console.debug('manually click-toggle three-way filter from', states[currentStateIndex], 'to', states[targetStateIndex], 'on', element);
    } else {
        element.attr('data-toggle-state', states[targetStateIndex]);

        // Update css class and remove all others
        states.forEach(state => {
            element.toggleClass(FILTER_STATES[state].class, state === states[targetStateIndex]);
        });

        if (states[currentStateIndex] !== states[targetStateIndex]) {
            console.debug('toggle three-way filter from', states[currentStateIndex], 'to', states[targetStateIndex], 'on', element);
        }
    }


    return states[targetStateIndex];
}

function runTagFilters(listElement) {
    const tagIds = [...($(listElement).find('.tag.selected:not(.actionable)').map((_, el) => $(el).attr('id')))];
    const excludedTagIds = [...($(listElement).find('.tag.excluded:not(.actionable)').map((_, el) => $(el).attr('id')))];
    const filterHelper = getFilterHelper($(listElement));
    filterHelper.setFilterData(FILTER_TYPES.TAG, { excluded: excludedTagIds, selected: tagIds });
}

function printTagFilters(type = tag_filter_types.character) {
    const FILTER_SELECTOR = type === tag_filter_types.character ? CHARACTER_FILTER_SELECTOR : GROUP_FILTER_SELECTOR;
    $(FILTER_SELECTOR).empty();

    // Print all action tags. (Rework 'Folder' button to some kind of onboarding if no folders are enabled yet)
    const actionTags = Object.values(ACTIONABLE_TAGS);
    actionTags.find(x => x == ACTIONABLE_TAGS.FOLDER).name = power_user.bogus_folders ? 'Show only folders' : 'Enable \'Tags as Folder\'\n\nAllows characters to be grouped in folders by their assigned tags.\nTags have to be explicitly chosen as folder to show up.\n\nClick here to start';
    printTagList($(FILTER_SELECTOR), { empty: false, sort: false, tags: actionTags, tagActionSelector: tag => tag.action, tagOptions: { isGeneralList: true } });

    const inListActionTags = Object.values(InListActionable);
    printTagList($(FILTER_SELECTOR), { empty: false, sort: false, tags: inListActionTags, tagActionSelector: tag => tag.action, tagOptions: { isGeneralList: true } });

    const characterTagIds = Object.values(tag_map).flat();
    const tagsToDisplay = tags.filter(x => characterTagIds.includes(x.id)).sort(compareTagsForSort);
    printTagList($(FILTER_SELECTOR), { empty: false, tags: tagsToDisplay, tagOptions: { selectable: true, isGeneralList: true } });

    // Print bogus folder navigation
    const bogusDrilldown = $(FILTER_SELECTOR).siblings('.rm_tag_bogus_drilldown');
    bogusDrilldown.empty();
    if (power_user.bogus_folders && bogusDrilldown.length > 0) {
        const filterData = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));
        const navigatedTags = filterData.selected.map(x => tags.find(t => t.id == x)).filter(x => isBogusFolder(x));

        printTagList(bogusDrilldown, { tags: navigatedTags, tagOptions: { removable: true } });
    }

    runTagFilters(FILTER_SELECTOR);

    if (power_user.show_tag_filters) {
        $('.rm_tag_controls .showTagList').addClass('selected');
        $('.rm_tag_controls').find('.tag:not(.actionable)').show();
    }

    updateTagFilterIndicator();
}

function updateTagFilterIndicator() {
    if ($('.rm_tag_controls').find('.tag:not(.actionable)').is('.selected, .excluded')) {
        $('.rm_tag_controls .showTagList').addClass('indicator');
    } else {
        $('.rm_tag_controls .showTagList').removeClass('indicator');
    }
}

function onTagRemoveClick(event) {
    event.stopPropagation();
    const tagElement = $(this).closest('.tag');
    const tagId = tagElement.attr('id');

    // Check if we are inside the drilldown. If so, we call remove on the bogus folder
    if ($(this).closest('.rm_tag_bogus_drilldown').length > 0) {
        console.debug('Bogus drilldown remove', tagId);
        chooseBogusFolder($(this), tagId, true);
        return;
    }

    const tag = tags.find(t => t.id === tagId);

    // Optional, check for multiple character ids being present.
    const characterData = event.target.closest('#bulk_tags_div')?.dataset.characters;
    const characterIds = characterData ? JSON.parse(characterData).characterIds : null;

    removeTagFromEntity(tag, characterIds, { tagElement: tagElement });
}

// @ts-ignore
function onTagInput(event) {
    let val = $(this).val();
    if (tags.find(t => t.name === val)) return;
    // @ts-ignore
    $(this).autocomplete('search', val);
}

function onTagInputFocus() {
    // @ts-ignore
    $(this).autocomplete('search', $(this).val());
}

function onCharacterCreateClick() {
    $('#tagList').empty();
}

function onGroupCreateClick() {
    // Nothing to do here at the moment. Tags in group interface get automatically redrawn.
}

export function applyTagsOnCharacterSelect() {
    //clearTagsFilter();
    const chid = Number(this_chid);
    printTagList($('#tagList'), { forEntityOrKey: chid, tagOptions: { removable: true } });
}

function applyTagsOnGroupSelect() {
    //clearTagsFilter();
    // Nothing to do here at the moment. Tags in group interface get automatically redrawn.
}

/**
 * Create a tag input by enabling the autocomplete feature of a given input element. Tags will be added to the given list.
 *
 * @param {string} inputSelector - the selector for the tag input control
 * @param {string} listSelector - the selector for the list of the tags modified by the input control
 * @param {PrintTagListOptions} [tagListOptions] - Optional parameters for printing the tag list. Can be set to be consistent with the expected behavior of tags in the list that was defined before.
 */
export function createTagInput(inputSelector, listSelector, tagListOptions = {}) {
    $(inputSelector)
        // @ts-ignore
        .autocomplete({
            source: (i, o) => findTag(i, o, listSelector),
            select: (e, u) => selectTag(e, u, listSelector, { tagListOptions: tagListOptions }),
            minLength: 0,
        })
        .focus(onTagInputFocus); // <== show tag list on click
}

function onViewTagsListClick() {
    const popup = $('#dialogue_popup');
    popup.addClass('large_dialogue_popup');
    const html = $(document.createElement('div'));
    html.attr('id', 'tag_view_list');
    html.append(`
    <div class="title_restorable alignItemsBaseline">
        <h3>Tag Management</h3>
        <div class="flex-container alignItemsBaseline">
            <div class="menu_button menu_button_icon tag_view_backup" title="Save your tags to a file">
                <i class="fa-solid fa-file-export"></i>
                <span data-i18n="Backup">Backup</span>
            </div>
            <div class="menu_button menu_button_icon tag_view_restore" title="Restore tags from a file">
                <i class="fa-solid fa-file-import"></i>
                <span data-i18n="Restore">Restore</span>
            </div>
            <div class="menu_button menu_button_icon tag_view_create" title="Create a new tag">
                <i class="fa-solid fa-plus"></i>
                <span data-i18n="Create">Create</span>
            </div>
            <input type="file" id="tag_view_restore_input" hidden accept=".json">
        </div>
    </div>
    <div class="justifyLeft m-b-1">
        <small>
            Drag handle to reorder. Click name to rename. Click color to change display.<br>
            ${(power_user.bogus_folders ? 'Click on the folder icon to use this tag as a folder.<br>' : '')}
            <label class="checkbox flex-container alignitemscenter flexNoGap m-t-1" for="auto_sort_tags">
                <input type="checkbox" id="auto_sort_tags" name="auto_sort_tags" ${power_user.auto_sort_tags ? ' checked' : ''} />
                <span data-i18n="Use alphabetical sorting">
                    Use alphabetical sorting
                    <div class="fa-solid fa-circle-info opacity50p" data-i18n="[title]If enabled, tags will automatically be sorted alphabetically on creation or rename.\nIf disabled, new tags will be appended at the end.\n\nIf a tag is manually reordered by dragging, automatic sorting will be disabled."
                        title="If enabled, tags will automatically be sorted alphabetically on creation or rename.\nIf disabled, new tags will be appended at the end.\n\nIf a tag is manually reordered by dragging, automatic sorting will be disabled.">
                    </div>
                </span>
            </label>
        </small>
    </div>`);

    const tagContainer = $('<div class="tag_view_list_tags ui-sortable"></div>');
    html.append(tagContainer);

    callPopup(html, 'text', null, { allowVerticalScrolling: true });

    printViewTagList();
    makeTagListDraggable(tagContainer);

    $('#dialogue_popup  .tag-color').on('change', (evt) => onTagColorize(evt));
    $('#dialogue_popup  .tag-color2').on('change', (evt) => onTagColorize2(evt));
}

/**
 * Print the list of tags in the tag management view
 * @param {Event} event Event that triggered the color change
 * @param {boolean} toggle State of the toggle
 */
function toggleAutoSortTags(event, toggle) {
    if (toggle === power_user.auto_sort_tags) return;

    // Ask user to confirm if enabling and it was manually sorted before
    if (toggle && isManuallySorted() && !confirm('Are you sure you want to automatically sort alphabetically?')) {
        if (event.target instanceof HTMLInputElement) {
            event.target.checked = false;
        }
        return;
    }

    power_user.auto_sort_tags = toggle;

    printCharactersDebounced();
    saveSettingsDebounced();
}

/** This function goes over all existing tags and checks whether they were reorderd in the past. @returns {boolean} */
function isManuallySorted() {
    return tags.some((tag, index) => tag.sort_order !== index);
}

function makeTagListDraggable(tagContainer) {
    const onTagsSort = () => {
        tagContainer.find('.tag_view_item').each(function (i, tagElement) {
            const id = $(tagElement).attr('id');
            const tag = tags.find(x => x.id === id);

            // Fix the defined colors, because if there is no color set, they seem to get automatically set to black
            // based on the color picker after drag&drop, even if there was no color chosen. We just set them back.
            const color = $(tagElement).find('.tagColorPickerHolder .tag-color').attr('color');
            const color2 = $(tagElement).find('.tagColorPicker2Holder .tag-color2').attr('color');
            if (color === '' || color === undefined) {
                tag.color = '';
                fixColor('background-color', tag.color);
            }
            if (color2 === '' || color2 === undefined) {
                tag.color2 = '';
                fixColor('color', tag.color2);
            }

            // Update the sort order
            tag.sort_order = i;

            function fixColor(property, color) {
                $(tagElement).find('.tag_view_name').css(property, color);
                $(`.tag[id="${id}"]`).css(property, color);
                $(`.bogus_folder_select[tagid="${id}"] .avatar`).css(property, color);
            }
        });

        // If tags were dragged manually, we have to disable auto sorting
        if (power_user.auto_sort_tags) {
            power_user.auto_sort_tags = false;
            $('#dialogue_popup input[name="auto_sort_tags"]').prop('checked', false);
            toastr.info('Automatic sorting of tags deactivated.');
        }

        // If the order of tags in display has changed, we need to redraw some UI elements. Do it debounced so it doesn't block and you can drag multiple tags.
        printCharactersDebounced();
        saveSettingsDebounced();
    };

    // @ts-ignore
    $(tagContainer).sortable({
        delay: getSortableDelay(),
        stop: () => onTagsSort(),
        handle: '.drag-handle',
    });
}

/**
 * Sorts the given tags, returning a shallow copy of it
 *
 * @param {Tag[]} tags - The tags
 * @returns {Tag[]} The sorted tags
 */
function sortTags(tags) {
    return tags.slice().sort(compareTagsForSort);
}

/**
 * Compares two given tags and returns the compare result
 *
 * @param {Tag} a - First tag
 * @param {Tag} b - Second tag
 * @returns {number} The compare result
 */
function compareTagsForSort(a, b) {
    const defaultSort = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (power_user.auto_sort_tags) {
        return defaultSort;
    }

    if (a.sort_order !== undefined && b.sort_order !== undefined) {
        return a.sort_order - b.sort_order;
    } else if (a.sort_order !== undefined) {
        return -1;
    } else if (b.sort_order !== undefined) {
        return 1;
    } else {
        return defaultSort;
    }
}

async function onTagRestoreFileSelect(e) {
    const file = e.target.files[0];

    if (!file) {
        console.log('Tag restore: No file selected.');
        return;
    }

    const data = await parseJsonFile(file);

    if (!data) {
        toastr.warning('Empty file data', 'Tag restore');
        console.log('Tag restore: File data empty.');
        return;
    }

    if (!data.tags || !data.tag_map || !Array.isArray(data.tags) || typeof data.tag_map !== 'object') {
        toastr.warning('Invalid file format', 'Tag restore');
        console.log('Tag restore: Invalid file format.');
        return;
    }

    const warnings = [];

    // Import tags
    for (const tag of data.tags) {
        if (!tag.id || !tag.name) {
            warnings.push(`Tag object is invalid: ${JSON.stringify(tag)}.`);
            continue;
        }

        if (tags.find(x => x.id === tag.id)) {
            warnings.push(`Tag with id ${tag.id} already exists.`);
            continue;
        }

        tags.push(tag);
    }

    // Import tag_map
    for (const key of Object.keys(data.tag_map)) {
        const tagIds = data.tag_map[key];

        if (!Array.isArray(tagIds)) {
            warnings.push(`Tag map for key ${key} is invalid: ${JSON.stringify(tagIds)}.`);
            continue;
        }

        // Verify that the key points to a valid character or group.
        const characterExists = characters.some(x => String(x.avatar) === String(key));
        const groupExists = groups.some(x => String(x.id) === String(key));

        if (!characterExists && !groupExists) {
            warnings.push(`Tag map key ${key} does not exist.`);
            continue;
        }

        // Get existing tag ids for this key or empty array.
        const existingTagIds = tag_map[key] || [];
        // Merge existing and new tag ids. Remove duplicates.
        tag_map[key] = existingTagIds.concat(tagIds).filter(onlyUnique);
        // Verify that all tags exist. Remove tags that don't exist.
        tag_map[key] = tag_map[key].filter(x => tags.some(y => String(y.id) === String(x)));
    }

    if (warnings.length) {
        toastr.success('Tags restored with warnings. Check console for details.');
        console.warn(`TAG RESTORE REPORT\n====================\n${warnings.join('\n')}`);
    } else {
        toastr.success('Tags restored successfully.');
    }

    $('#tag_view_restore_input').val('');
    printCharactersDebounced();
    saveSettingsDebounced();

    onViewTagsListClick();
}

function onBackupRestoreClick() {
    $('#tag_view_restore_input')
        .off('change')
        .on('change', onTagRestoreFileSelect)
        .trigger('click');
}

function onTagsBackupClick() {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `tags_${timestamp}.json`;
    const data = {
        tags: tags,
        tag_map: tag_map,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    download(blob, filename, 'application/json');
}

function onTagCreateClick() {
    const tag = createNewTag('New Tag');
    printViewTagList();

    const tagElement = ($('#dialogue_popup .tag_view_list_tags')).find(`.tag_view_item[id="${tag.id}"]`);
    flashHighlight(tagElement);

    printCharactersDebounced();
    saveSettingsDebounced();
}

function appendViewTagToList(list, tag, everything) {
    const count = everything.filter(x => x == tag.id).length;
    const template = VIEW_TAG_TEMPLATE.clone();
    template.attr('id', tag.id);
    template.find('.tag_view_counter_value').text(count);
    template.find('.tag_view_name').text(tag.name);
    template.find('.tag_view_name').addClass('tag');

    template.find('.tag_view_name').css('background-color', tag.color);
    template.find('.tag_view_name').css('color', tag.color2);

    const tagAsFolderId = tag.id + '-tag-folder';
    const colorPickerId = tag.id + '-tag-color';
    const colorPicker2Id = tag.id + '-tag-color2';

    if (!power_user.bogus_folders) {
        template.find('.tag_as_folder').hide();
    }

    const primaryColorPicker = $('<toolcool-color-picker></toolcool-color-picker>')
        .addClass('tag-color')
        .attr({ id: colorPickerId, color: tag.color });

    const secondaryColorPicker = $('<toolcool-color-picker></toolcool-color-picker>')
        .addClass('tag-color2')
        .attr({ id: colorPicker2Id, color: tag.color2 });

    template.find('.tagColorPickerHolder').append(primaryColorPicker);
    template.find('.tagColorPicker2Holder').append(secondaryColorPicker);

    template.find('.tag_as_folder').attr('id', tagAsFolderId);

    list.append(template);

    updateDrawTagFolder(template, tag);

    // @ts-ignore
    $(colorPickerId).color = tag.color;
    // @ts-ignore
    $(colorPicker2Id).color = tag.color2;
}

function onTagAsFolderClick() {
    const element = $(this).closest('.tag_view_item');
    const id = element.attr('id');
    const tag = tags.find(x => x.id === id);

    // Cycle through folder types
    const types = Object.keys(TAG_FOLDER_TYPES);
    const currentTypeIndex = types.indexOf(tag.folder_type);
    tag.folder_type = types[(currentTypeIndex + 1) % types.length];

    updateDrawTagFolder(element, tag);

    // If folder display has changed, we have to redraw the character list, otherwise this folders state would not change
    printCharactersDebounced();
    saveSettingsDebounced();

}

function updateDrawTagFolder(element, tag) {
    const tagFolder = TAG_FOLDER_TYPES[tag.folder_type] || TAG_FOLDER_TYPES[TAG_FOLDER_DEFAULT_TYPE];
    const folderElement = element.find('.tag_as_folder');

    // Update css class and remove all others
    Object.keys(TAG_FOLDER_TYPES).forEach(x => {
        folderElement.toggleClass(TAG_FOLDER_TYPES[x].class, TAG_FOLDER_TYPES[x] === tagFolder);
    });

    // Draw/update css attributes for this class
    folderElement.attr('title', tagFolder.tooltip);
    const indicator = folderElement.find('.tag_folder_indicator');
    indicator.text(tagFolder.icon);
    indicator.css('color', tagFolder.color);
    indicator.css('font-size', `calc(var(--mainFontSize) * ${tagFolder.size})`);
}

function onTagDeleteClick() {
    if (!confirm('Are you sure?')) {
        return;
    }

    const id = $(this).closest('.tag_view_item').attr('id');
    for (const key of Object.keys(tag_map)) {
        tag_map[key] = tag_map[key].filter(x => x !== id);
    }
    const index = tags.findIndex(x => x.id === id);
    tags.splice(index, 1);
    $(`.tag[id="${id}"]`).remove();
    $(`.tag_view_item[id="${id}"]`).remove();

    printCharactersDebounced();
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
    $(`.bogus_folder_select[tagid="${id}"] .avatar`).css('background-color', newColor);
    const tag = tags.find(x => x.id === id);
    tag.color = newColor;
    console.debug(tag);
    saveSettingsDebounced();
}

function onTagColorize2(evt) {
    console.debug(evt);
    const id = $(evt.target).closest('.tag_view_item').attr('id');
    const newColor = evt.detail.rgba;
    $(evt.target).parent().parent().find('.tag_view_name').css('color', newColor);
    $(`.tag[id="${id}"]`).css('color', newColor);
    $(`.bogus_folder_select[tagid="${id}"] .avatar`).css('color', newColor);
    const tag = tags.find(x => x.id === id);
    tag.color2 = newColor;
    console.debug(tag);
    saveSettingsDebounced();
}

function onTagListHintClick() {
    $(this).toggleClass('selected');
    $(this).siblings('.tag:not(.actionable)').toggle(100);
    $(this).siblings('.innerActionable').toggleClass('hidden');

    power_user.show_tag_filters = $(this).hasClass('selected');
    saveSettingsDebounced();

    console.debug('show_tag_filters', power_user.show_tag_filters);
}

function onClearAllFiltersClick() {
    console.debug('clear all filters clicked');

    // We have to manually go through the elements and unfilter by clicking...
    // Thankfully nearly all filter controls are three-state-toggles
    const filterTags = $('.rm_tag_controls .rm_tag_filter').find('.tag');
    for (const tag of filterTags) {
        const toggleState = $(tag).attr('data-toggle-state');
        if (toggleState !== undefined && !isFilterState(toggleState ?? FILTER_STATES.UNDEFINED, FILTER_STATES.UNDEFINED)) {
            toggleTagThreeState($(tag), { stateOverride: FILTER_STATES.UNDEFINED, simulateClick: true });
        }
    }

    // Reset search too
    $('#character_search_bar').val('').trigger('input');
}

/**
 * Copy tags from one character to another.
 * @param {{oldAvatar: string, newAvatar: string}} data Event data
 */
function copyTags(data) {
    const prevTagMap = tag_map[data.oldAvatar] || [];
    const newTagMap = tag_map[data.newAvatar] || [];
    tag_map[data.newAvatar] = Array.from(new Set([...prevTagMap, ...newTagMap]));
}

function printViewTagList(empty = true) {
    const tagContainer = $('#dialogue_popup .tag_view_list_tags');

    if (empty) tagContainer.empty();
    const everything = Object.values(tag_map).flat();
    const sortedTags = sortTags(tags);
    for (const tag of sortedTags) {
        appendViewTagToList(tagContainer, tag, everything);
    }
}

function registerTagsSlashCommands() {
    /**
     * Gets the key for char/group for a slash command. If none can be found, a toastr will be shown and null returned.
     * @param {string?} [charName] The optionally provided char name
     * @returns {string?} - The char/group key, or null if none found
     */
    function paraGetCharKey(charName) {
        const entity = charName
            ? (characters.find(x => x.name === charName) || groups.find(x => x.name == charName))
            : (selected_group ? groups.find(x => x.id == selected_group) : characters[this_chid]);
        const key = getTagKeyForEntity(entity);
        if (!key) {
            toastr.warning(`Character ${charName} not found.`);
            return null;
        }
        return key;
    }
    /**
     * Gets a tag by its name. Optionally can create the tag if it does not exist.
     * @param {string} tagName - The name of the tag
     * @param {object} options - Optional arguments
     * @param {boolean} [options.allowCreate=false] - Whether a new tag should be created if no tag with the name exists
     * @returns {Tag?} The tag, or null if not found
     */
    function paraGetTag(tagName, { allowCreate = false } = {}) {
        if (!tagName) {
            toastr.warning('Tag name must be provided.');
            return null;
        }
        let tag = tags.find(t => t.name === tagName);
        if (allowCreate && !tag) {
            tag = createNewTag(tagName);
        }
        if (!tag) {
            toastr.warning(`Tag ${tagName} not found.`);
            return null;
        }
        return tag;
    }

    function updateTagsList() {
        switch (menu_type) {
            case 'characters':
                printTagFilters(tag_filter_types.character);
                printTagFilters(tag_filter_types.group_member);
                break;
            case 'character_edit':
                applyTagsOnCharacterSelect();
                break;
            case 'group_edit':
                select_group_chats(selected_group, true);
                break;
        }
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tag-add',
        returns: 'true/false - Whether the tag was added or was assigned already',
        /** @param {{name: string}} namedArgs @param {string} tagName @returns {string} */
        callback: ({ name }, tagName) => {
            const key = paraGetCharKey(name);
            if (!key) return 'false';
            const tag = paraGetTag(tagName, { allowCreate: true });
            if (!tag) return 'false';
            const result = addTagToEntity(tag, key);
            updateTagsList();
            return String(result);
        },
        namedArgumentList: [
            new SlashCommandNamedArgument('name', 'Character name', [ARGUMENT_TYPE.STRING], false, false, '{{char}}'),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument('tag name', [ARGUMENT_TYPE.STRING], true),
        ],
        helpString: `
        <div>
            Adds a tag to the character. If no character is provided, it adds it to the current character (<code>{{char}}</code>).
            If the tag doesn't exist, it is created.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/tag-add name="Chloe" scenario</code></pre>
                    will add the tag "scenario" to the character named Chloe.
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tag-remove',
        returns: 'true/false - Whether the tag was removed or wasn\'t assigned already',
        /** @param {{name: string}} namedArgs @param {string} tagName @returns {string} */
        callback: ({ name }, tagName) => {
            const key = paraGetCharKey(name);
            if (!key) return 'false';
            const tag = paraGetTag(tagName);
            if (!tag) return 'false';
            const result = removeTagFromEntity(tag, key);
            updateTagsList();
            return String(result);
        },
        namedArgumentList: [
            new SlashCommandNamedArgument('name', 'Character name', [ARGUMENT_TYPE.STRING], false, false, '{{char}}'),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument('tag name', [ARGUMENT_TYPE.STRING], true),
        ],
        helpString: `
        <div>
            Removes a tag from the character. If no character is provided, it removes it from the current character (<code>{{char}}</code>).
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/tag-remove name="Chloe" scenario</code></pre>
                    will remove the tag "scenario" from the character named Chloe.
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tag-exists',
        returns: 'true/false - Whether the given tag name is assigned to the character',
        /** @param {{name: string}} namedArgs @param {string} tagName @returns {string} */
        callback: ({ name }, tagName) => {
            const key = paraGetCharKey(name);
            if (!key) return 'false';
            const tag = paraGetTag(tagName);
            if (!tag) return 'false';
            return String(tag_map[key].includes(tag.id));
        },
        namedArgumentList: [
            new SlashCommandNamedArgument('name', 'Character name', [ARGUMENT_TYPE.STRING], false, false, '{{char}}'),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument('tag name', [ARGUMENT_TYPE.STRING], true),
        ],
        helpString: `
        <div>
            Checks whether the given tag is assigned to the character. If no character is provided, it checks the current character (<code>{{char}}</code>).
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/tag-exists name="Chloe" scenario</code></pre>
                    will return true if the character named Chloe has the tag "scenario".
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tag-list',
        returns: 'Comma-separated list of all assigned tags',
        /** @param {{name: string}} namedArgs @returns {string} */
        callback: ({ name }) => {
            const key = paraGetCharKey(name);
            if (!key) return '';
            const tags = getTagsList(key);
            return tags.map(x => x.name).join(', ');
        },
        namedArgumentList: [
            new SlashCommandNamedArgument('name', 'Character name', [ARGUMENT_TYPE.STRING], false, false, '{{char}}'),
        ],
        helpString: `
        <div>
            Lists all assigned tags of the character. If no character is provided, it uses the current character (<code>{{char}}</code>).
            <br />
            Note that there is no special handling for tags containing commas, they will be printed as-is.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/tag-list name="Chloe"</code></pre>
                    could return something like <code>OC, scenario, edited, funny</code>
                </li>
            </ul>
        </div>
    `,
    }));
}

export function initTags() {
    createTagInput('#tagInput', '#tagList', { tagOptions: { removable: true } });
    createTagInput('#groupTagInput', '#groupTagList', { tagOptions: { removable: true } });

    $(document).on('click', '#rm_button_create', onCharacterCreateClick);
    $(document).on('click', '#rm_button_group_chats', onGroupCreateClick);
    $(document).on('click', '.tag_remove', onTagRemoveClick);
    $(document).on('input', '.tag_input', onTagInput);
    $(document).on('click', '.tags_view', onViewTagsListClick);
    $(document).on('click', '.tag_delete', onTagDeleteClick);
    $(document).on('click', '.tag_as_folder', onTagAsFolderClick);
    $(document).on('input', '.tag_view_name', onTagRenameInput);
    $(document).on('click', '.tag_view_create', onTagCreateClick);
    $(document).on('click', '.tag_view_backup', onTagsBackupClick);
    $(document).on('click', '.tag_view_restore', onBackupRestoreClick);
    eventSource.on(event_types.CHARACTER_DUPLICATED, copyTags);
    eventSource.makeFirst(event_types.CHAT_CHANGED, () => selected_group ? applyTagsOnGroupSelect() : applyTagsOnCharacterSelect());

    $(document).on('input', '#dialogue_popup input[name="auto_sort_tags"]', (evt) => {
        const toggle = $(evt.target).is(':checked');
        toggleAutoSortTags(evt.originalEvent, toggle);
        printViewTagList();
    });
    $(document).on('focusout', '#dialogue_popup .tag_view_name', (evt) => {
        // Remember the order, so we can flash highlight if it changed after reprinting
        const tagId = $(evt.target).parent('.tag_view_item').attr('id');
        const oldOrder = $('#dialogue_popup .tag_view_item').map((_, el) => el.id).get();

        printViewTagList();

        const newOrder = $('#dialogue_popup .tag_view_item').map((_, el) => el.id).get();
        const orderChanged = !oldOrder.every((id, index) => id === newOrder[index]);
        if (orderChanged) {
            flashHighlight($(`#dialogue_popup .tag_view_item[id="${tagId}"]`));
        }
    });

    // Initialize auto sort setting based on whether it was sorted before
    if (power_user.auto_sort_tags === undefined || power_user.auto_sort_tags === null) {
        power_user.auto_sort_tags = !isManuallySorted();
        if (power_user.auto_sort_tags) {
            printCharactersDebounced();
        }
    }

    registerTagsSlashCommands();
}
