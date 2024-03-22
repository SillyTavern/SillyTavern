import {
    characters,
    saveSettingsDebounced,
    this_chid,
    callPopup,
    menu_type,
    getCharacters,
    entitiesFilter,
    printCharacters,
    buildAvatarList,
} from '../script.js';
// eslint-disable-next-line no-unused-vars
import { FILTER_TYPES, FILTER_STATES, isFilterState, FilterHelper } from './filters.js';

import { groupCandidatesFilter, groups, selected_group } from './group-chats.js';
import { download, onlyUnique, parseJsonFile, uuidv4, getSortableDelay, debounce } from './utils.js';
import { power_user } from './power-user.js';

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
};

const CHARACTER_FILTER_SELECTOR = '#rm_characters_block .rm_tag_filter';
const GROUP_FILTER_SELECTOR = '#rm_group_chats_block .rm_tag_filter';

function getFilterHelper(listSelector) {
    return $(listSelector).is(GROUP_FILTER_SELECTOR) ? groupCandidatesFilter : entitiesFilter;
}

const redrawCharsAndFiltersDebounced = debounce(() => {
    printCharacters(false);
    printTagFilters(tag_filter_types.character);
    printTagFilters(tag_filter_types.group_member);
}, 100);

export const tag_filter_types = {
    character: 0,
    group_member: 1,
};

const ACTIONABLE_TAGS = {
    FAV: { id: 1, name: 'Show only favorites', color: 'rgba(255, 255, 0, 0.5)', action: filterByFav, icon: 'fa-solid fa-star', class: 'filterByFavorites' },
    GROUP: { id: 0, name: 'Show only groups', color: 'rgba(100, 100, 100, 0.5)', action: filterByGroups, icon: 'fa-solid fa-users', class: 'filterByGroups' },
    FOLDER: { id: 4, name: 'Always show folders', color: 'rgba(120, 120, 120, 0.5)', action: filterByFolder, icon: 'fa-solid fa-folder-plus', class: 'filterByFolder' },
    VIEW: { id: 2, name: 'Manage tags', color: 'rgba(150, 100, 100, 0.5)', action: onViewTagsListClick, icon: 'fa-solid fa-gear', class: 'manageTags' },
    HINT: { id: 3, name: 'Show Tag List', color: 'rgba(150, 100, 100, 0.5)', action: onTagListHintClick, icon: 'fa-solid fa-tags', class: 'showTagList' },
    UNFILTER: { id: 5, name: 'Clear all filters', action: onClearAllFiltersClick, icon: 'fa-solid fa-filter-circle-xmark', class: 'clearAllFilters' },
};

const InListActionable = {
};

const DEFAULT_TAGS = [
    { id: uuidv4(), name: 'Plain Text', create_date: Date.now() },
    { id: uuidv4(), name: 'OpenAI', create_date: Date.now() },
    { id: uuidv4(), name: 'W++', create_date: Date.now() },
    { id: uuidv4(), name: 'Boostyle', create_date: Date.now() },
    { id: uuidv4(), name: 'PList', create_date: Date.now() },
    { id: uuidv4(), name: 'AliChat', create_date: Date.now() },
];

const TAG_FOLDER_TYPES = {
    OPEN: { icon: '✔', class: 'folder_open', fa_icon: 'fa-folder-open', tooltip: 'Open Folder (Show all characters even if not selected)', color: 'green', size: '1' },
    CLOSED: { icon: '👁', class: 'folder_closed', fa_icon: 'fa-eye-slash', tooltip: 'Closed Folder (Hide all characters unless selected)', color: 'lightgoldenrodyellow', size: '0.7' },
    NONE: { icon: '✕', class: 'no_folder', tooltip: 'No Folder', color: 'red', size: '1' },
};
const TAG_FOLDER_DEFAULT_TYPE = 'NONE';


let tags = [];
let tag_map = {};

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
            const alwaysFolder = isFilterState(entitiesFilter.getFilterData(FILTER_TYPES.FOLDER), FILTER_STATES.SELECTED);
            if (entity.type === 'tag') {
                return alwaysFolder || entity.entities.length > 0;
            }

            return true;
        });
    }

    if (subForEntity !== undefined && subForEntity.type === 'tag') {
        entities = filterTagSubEntities(subForEntity.item, entities, { filterHidden : filterHidden });
    }

    return entities;
}

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
 * @returns {boolean} If it's a tag folder
 */
function isBogusFolder(tag) {
    return tag?.folder_type !== undefined && tag.folder_type !== TAG_FOLDER_DEFAULT_TYPE;
}

/**
 * Indicates whether a user is currently in a bogus folder.
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
    if (remove) {
        // Click twice to skip over the 'excluded' state
        $(FILTER_SELECTOR).find(`.tag[id=${tagId}]`).trigger('click').trigger('click');
    } else {
        $(FILTER_SELECTOR).find(`.tag[id=${tagId}]`).trigger('click');
    }
}

/**
 * Builds the tag block for the specified item.
 * @param {Object} item The tag item
 * @param {*} entities The list ob sub items for this tag
 * @param {*} hidden A count of how many sub items are hidden
 * @returns The html for the tag block
 */
function getTagBlock(item, entities, hidden = 0) {
    let count = entities.length;

    const tagFolder = TAG_FOLDER_TYPES[item.folder_type];

    const template = $('#bogus_folder_template .bogus_folder_select').clone();
    template.addClass(tagFolder.class);
    template.attr({ 'tagid': item.id, 'id': `BogusFolder${item.id}` });
    template.find('.avatar').css({ 'background-color': item.color, 'color': item.color2 }).attr('title', `[Folder] ${item.name}`);
    template.find('.ch_name').text(item.name).attr('title', `[Folder] ${item.name}`);
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
    filterHelper.setFilterData(FILTER_TYPES.FAV, state);
}

/**
 * Applies the "is group" filter to the character list.
 * @param {FilterHelper} filterHelper Instance of FilterHelper class.
 */
function filterByGroups(filterHelper) {
    const state = toggleTagThreeState($(this));
    filterHelper.setFilterData(FILTER_TYPES.GROUP, state);
}

/**
 * Applies the "only folder" filter to the character list.
 * @param {FilterHelper} filterHelper Instance of FilterHelper class.
 */
function filterByFolder(filterHelper) {
    const state = toggleTagThreeState($(this));
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

function getTagsList(key) {
    if (!Array.isArray(tag_map[key])) {
        tag_map[key] = [];
        return [];
    }

    return tag_map[key]
        .map(x => tags.find(y => y.id === x))
        .filter(x => x)
        .sort(compareTagsForSort);
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

function getTagKey() {
    if (selected_group && menu_type === 'group_edit') {
        return selected_group;
    }

    if (this_chid && menu_type === 'character_edit') {
        return characters[this_chid].avatar;
    }

    return null;
}

/**
 * Gets the tag key for any provided entity/id/key. If a valid tag key is provided, it just returns this.
 * Robust method to find a valid tag key for any entity
 * @param {object|number|string} entityOrKey An entity with id property (character, group, tag), or directly an id or tag key.
 * @returns {string} The tag key that can be found.
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

    // We should hopefully have a key now. Let's check
    if (x in tag_map) {
        return x;
    }

    // If none of the above, we cannot find a valid tag key
    return undefined;
}

function addTagToMap(tagId, characterId = null) {
    const key = getTagKey() ?? getTagKeyForEntity(characterId);

    if (!key) {
        return;
    }

    if (!Array.isArray(tag_map[key])) {
        tag_map[key] = [tagId];
    }
    else {
        tag_map[key].push(tagId);
        tag_map[key] = tag_map[key].filter(onlyUnique);
    }
}

function removeTagFromMap(tagId, characterId = null) {
    const key = getTagKey() ?? getTagKeyForEntity(characterId);

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

function selectTag(event, ui, listSelector) {
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

    if (characterIds) {
        characterIds.forEach((characterId) => addTagToMap(tag.id, characterId));
    } else {
        addTagToMap(tag.id);
    }

    saveSettingsDebounced();

    // add tag to the UI and internal map - we reprint so sorting and new markup is done correctly
    printTagList(listSelector, { tagOptions: { removable: true } });
    printTagList($(getInlineListSelector()));

    printTagFilters(tag_filter_types.character);
    printTagFilters(tag_filter_types.group_member);

    // need to return false to keep the input clear
    return false;
}

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
    await getCharacters();
    printTagFilters(tag_filter_types.character);
    printTagFilters(tag_filter_types.group_member);

    // need to return false to keep the input clear
    return false;
}

function createNewTag(tagName) {
    const tag = {
        id: uuidv4(),
        name: tagName,
        folder_type: TAG_FOLDER_DEFAULT_TYPE,
        sort_order: tags.length,
        color: '',
        color2: '',
        create_date: Date.now(),
    };
    tags.push(tag);
    return tag;
}

/**
 * @typedef {object} TagOptions
 * @property {boolean} [removable=false] - Whether tags can be removed.
 * @property {boolean} [selectable=false] - Whether tags can be selected.
 * @property {function} [action=undefined] - Action to perform on tag interaction.
 * @property {boolean} [isGeneralList=false] - If true, indicates that this is the general list of tags.
 * @property {boolean} [skipExistsCheck=false] - If true, the tag gets added even if a tag with the same id already exists.
 */

/**
 * Prints the list of tags.
 * @param {JQuery<HTMLElement>} element - The container element where the tags are to be printed.
 * @param {object} [options] - Optional parameters for printing the tag list.
 * @param {Array<object>} [options.tags] Optional override of tags that should be printed. Those will not be sorted. If no supplied, tags for the relevant character are printed.
 * @param {object|number|string} [options.forEntityOrKey=undefined] - Optional override for the chosen entity, otherwise the currently selected is chosen. Can be an entity with id property (character, group, tag), or directly an id or tag key.
 * @param {boolean} [options.empty=true] - Whether the list should be initially empty.
 * @param {function(object): function} [options.tagActionSelector=undefined] - An optional override for the action property that can be assigned to each tag via tagOptions.
 * If set, the selector is executed on each tag as input argument. This allows a list of tags to be provided and each tag can have it's action based on the tag object itself.
 * @param {TagOptions} [options.tagOptions={}] - Options for tag behavior. (Same object will be passed into "appendTagToList")
 */
function printTagList(element, { tags = undefined, forEntityOrKey = undefined, empty = true, tagActionSelector = undefined, tagOptions = {} } = {}) {
    const key = forEntityOrKey !== undefined ? getTagKeyForEntity(forEntityOrKey) : getTagKey();
    const printableTags = tags ?? getTagsList(key);

    if (empty) {
        $(element).empty();
    }

    for (const tag of printableTags) {
        // If we have a custom action selector, we override that tag options for each tag
        if (tagActionSelector && typeof tagActionSelector === 'function') {
            const action = tagActionSelector(tag);
            if (action && typeof action !== 'function') {
                console.error('The action parameter must return a function for tag.', tag);
            } else {
                tagOptions.action = action;
            }
        }

        appendTagToList(element, tag, tagOptions);
    }
}

/**
 * Appends a tag to the list element.
 * @param {JQuery<HTMLElement>} listElement List element.
 * @param {object} tag Tag object to append.
 * @param {TagOptions} [options={}] - Options for tag behavior.
 * @returns {void}
 */
function appendTagToList(listElement, tag, { removable = false, selectable = false, action = undefined, isGeneralList = false, skipExistsCheck = false } = {}) {
    if (!listElement) {
        return;
    }
    if (!skipExistsCheck && $(listElement).find(`.tag[id="${tag.id}"]`).length > 0) {
        return;
    }

    let tagElement = $('#tag_template .tag').clone();
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

    if (tag.icon) {
        tagElement.find('.tag_name').text('').attr('title', tag.name).addClass(tag.icon);
    }

    if (tag.excluded && isGeneralList) {
        toggleTagThreeState(tagElement, { stateOverride: FILTER_STATES.EXCLUDED });
    }

    if (selectable) {
        tagElement.on('click', () => onTagFilterClick.bind(tagElement)(listElement));
    }

    if (action) {
        const filter = getFilterHelper($(listElement));
        tagElement.on('click', () => action.bind(tagElement)(filter));
        tagElement.addClass('actionable');
    }
    /*if (action && tag.id === 2) {
        tagElement.addClass('innerActionable hidden');
    }*/

    $(listElement).append(tagElement);
}

function onTagFilterClick(listElement) {
    const tagId = $(this).attr('id');
    const existingTag = tags.find((tag) => tag.id === tagId);

    let state = toggleTagThreeState($(this));

    // Manual undefined check required for three-state boolean
    if (existingTag) {
        existingTag.excluded = isFilterState(state, FILTER_STATES.EXCLUDED);

        saveSettingsDebounced();
    }

    // Update bogus folder if applicable
    if (isBogusFolder(existingTag)) {
        // Update bogus drilldown
        if ($(this).hasClass('selected')) {
            appendTagToList($('.rm_tag_controls .rm_tag_bogus_drilldown'), existingTag, { removable: true });
        } else {
            $(listElement).closest('.rm_tag_controls').find(`.rm_tag_bogus_drilldown .tag[id=${tagId}]`).remove();
        }
    }

    runTagFilters(listElement);
    updateTagFilterIndicator();
}

function toggleTagThreeState(element, { stateOverride = undefined, simulateClick = false } = {}) {
    const states = Object.keys(FILTER_STATES);

    const overrideKey = states.includes(stateOverride) ? stateOverride : Object.keys(FILTER_STATES).find(key => FILTER_STATES[key] === stateOverride);

    const currentStateIndex = states.indexOf(element.attr('data-toggle-state')) ?? states.length - 1;
    const targetStateIndex = overrideKey !== undefined ? states.indexOf(overrideKey) : (currentStateIndex + 1) % states.length;

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

        console.debug('toggle three-way filter from', states[currentStateIndex], 'to', states[targetStateIndex], 'on', element);
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
    const filterData = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));
    const FILTER_SELECTOR = type === tag_filter_types.character ? CHARACTER_FILTER_SELECTOR : GROUP_FILTER_SELECTOR;
    $(FILTER_SELECTOR).empty();
    $(FILTER_SELECTOR).siblings('.rm_tag_bogus_drilldown').empty();

    // Print all action tags. (Exclude folder if that setting isn't chosen)
    const actionTags = Object.values(ACTIONABLE_TAGS).filter(tag => power_user.bogus_folders || tag.id != ACTIONABLE_TAGS.FOLDER.id);
    printTagList($(FILTER_SELECTOR), { empty: false, tags: actionTags, tagActionSelector: tag => tag.action, tagOptions: { isGeneralList: true } });

    const inListActionTags = Object.values(InListActionable);
    printTagList($(FILTER_SELECTOR), { empty: false, tags: inListActionTags, tagActionSelector: tag => tag.action, tagOptions: { isGeneralList: true } });

    const characterTagIds = Object.values(tag_map).flat();
    const tagsToDisplay = tags
        .filter(x => characterTagIds.includes(x.id))
        .sort(compareTagsForSort);
    printTagList($(FILTER_SELECTOR), { empty: false, tags: tagsToDisplay, tagOptions: { selectable: true, isGeneralList: true } });

    runTagFilters(FILTER_SELECTOR);

    // Simulate clicks on all "selected" tags when we reprint, otherwise their filter gets lost. "excluded" is persisted.
    for (const tagId of filterData.selected) {
        toggleTagThreeState($(`${FILTER_SELECTOR} .tag[id="${tagId}"]`), { stateOverride: FILTER_STATES.SELECTED, simulateClick: true });
    }

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
    const tag = $(this).closest('.tag');
    const tagId = tag.attr('id');

    // Check if we are inside the drilldown. If so, we call remove on the bogus folder
    if ($(this).closest('.rm_tag_bogus_drilldown').length > 0) {
        console.debug('Bogus drilldown remove', tagId);
        chooseBogusFolder($(this), tagId, true);
        return;
    }

    // Optional, check for multiple character ids being present.
    const characterData = event.target.closest('#bulk_tags_div')?.dataset.characters;
    const characterIds = characterData ? JSON.parse(characterData).characterIds : null;

    tag.remove();

    if (characterIds) {
        characterIds.forEach((characterId) => removeTagFromMap(tagId, characterId));
    } else {
        removeTagFromMap(tagId);
    }

    $(`${getInlineListSelector()} .tag[id="${tagId}"]`).remove();

    printTagFilters(tag_filter_types.character);
    printTagFilters(tag_filter_types.group_member);
    saveSettingsDebounced();
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
    const chid = Number($(this).attr('chid'));
    printTagList($('#tagList'), { forEntityOrKey: chid, tagOptions: { removable: true } });
}

function applyTagsOnGroupSelect() {
    //clearTagsFilter();
    // Nothing to do here at the moment. Tags in group interface get automatically redrawn.
}

export function createTagInput(inputSelector, listSelector) {
    $(inputSelector)
        // @ts-ignore
        .autocomplete({
            source: (i, o) => findTag(i, o, listSelector),
            select: (e, u) => selectTag(e, u, listSelector),
            minLength: 0,
        })
        .focus(onTagInputFocus); // <== show tag list on click
}

function onViewTagsListClick() {
    $('#dialogue_popup').addClass('large_dialogue_popup');
    const list = $(document.createElement('div'));
    list.attr('id', 'tag_view_list');
    const everything = Object.values(tag_map).flat();
    $(list).append(`
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
            Drag the handle to reorder.<br>
            ${(power_user.bogus_folders ? 'Click on the folder icon to use this tag as a folder.<br>' : '')}
            Click on the tag name to edit it.<br>
            Click on color box to assign new color.
        </small>
    </div>`);

    const tagContainer = $('<div class="tag_view_list_tags ui-sortable"></div>');
    list.append(tagContainer);

    const sortedTags = sortTags(tags);

    for (const tag of sortedTags) {
        appendViewTagToList(tagContainer, tag, everything);
    }

    makeTagListDraggable(tagContainer);

    callPopup(list, 'text');
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

        saveSettingsDebounced();

        // If the order of tags in display has changed, we need to redraw some UI elements. Do it debounced so it doesn't block and you can drag multiple tags.
        redrawCharsAndFiltersDebounced();
    };

    // @ts-ignore
    $(tagContainer).sortable({
        delay: getSortableDelay(),
        stop: () => onTagsSort(),
        handle: '.drag-handle',
    });
}

function sortTags(tags) {
    return tags.slice().sort(compareTagsForSort);
}

function compareTagsForSort(a, b) {
    if (a.sort_order !== undefined && b.sort_order !== undefined) {
        return a.sort_order - b.sort_order;
    } else if (a.sort_order !== undefined) {
        return -1;
    } else if (b.sort_order !== undefined) {
        return 1;
    } else {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
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
    saveSettingsDebounced();
    printCharacters(true);
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
    appendViewTagToList($('#tag_view_list .tag_view_list_tags'), tag, []);
    printCharacters(false);
    saveSettingsDebounced();
}

function appendViewTagToList(list, tag, everything) {
    const count = everything.filter(x => x == tag.id).length;
    const template = $('#tag_view_template .tag_view_item').clone();
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

    template.find('.tagColorPickerHolder').html(
        `<toolcool-color-picker id="${colorPickerId}" color="${tag.color}" class="tag-color"></toolcool-color-picker>`,
    );
    template.find('.tagColorPicker2Holder').html(
        `<toolcool-color-picker id="${colorPicker2Id}" color="${tag.color2}" class="tag-color2"></toolcool-color-picker>`,
    );

    template.find('.tag_as_folder').attr('id', tagAsFolderId);
    template.find('.tag-color').attr('id', colorPickerId);
    template.find('.tag-color2').attr('id', colorPicker2Id);

    list.append(template);

    setTimeout(function () {
        document.querySelector(`.tag-color[id="${colorPickerId}"`).addEventListener('change', (evt) => {
            onTagColorize(evt);
        });
    }, 100);

    setTimeout(function () {
        document.querySelector(`.tag-color2[id="${colorPicker2Id}"`).addEventListener('change', (evt) => {
            onTagColorize2(evt);
        });
    }, 100);

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
    printCharacters(true);
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
        tag_map[key] = tag_map[key].filter(x => x.id !== id);
    }
    const index = tags.findIndex(x => x.id === id);
    tags.splice(index, 1);
    $(`.tag[id="${id}"]`).remove();
    $(`.tag_view_item[id="${id}"]`).remove();
    printCharacters(false);
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
    for(const tag of filterTags) {
        const toggleState = $(tag).attr('data-toggle-state');
        if (toggleState !== undefined && !isFilterState(toggleState ?? FILTER_STATES.UNDEFINED, FILTER_STATES.UNDEFINED)) {
            toggleTagThreeState($(tag), { stateOverride: FILTER_STATES.UNDEFINED, simulateClick: true });
        }
    }

    // Reset search too
    $('#character_search_bar').val('').trigger('input');
}

jQuery(() => {
    createTagInput('#tagInput', '#tagList');
    createTagInput('#groupTagInput', '#groupTagList');

    $(document).on('click', '#rm_button_create', onCharacterCreateClick);
    $(document).on('click', '#rm_button_group_chats', onGroupCreateClick);
    $(document).on('click', '.character_select', applyTagsOnCharacterSelect);
    $(document).on('click', '.group_select', applyTagsOnGroupSelect);
    $(document).on('click', '.tag_remove', onTagRemoveClick);
    $(document).on('input', '.tag_input', onTagInput);
    $(document).on('click', '.tags_view', onViewTagsListClick);
    $(document).on('click', '.tag_delete', onTagDeleteClick);
    $(document).on('click', '.tag_as_folder', onTagAsFolderClick);
    $(document).on('input', '.tag_view_name', onTagRenameInput);
    $(document).on('click', '.tag_view_create', onTagCreateClick);
    $(document).on('click', '.tag_view_backup', onTagsBackupClick);
    $(document).on('click', '.tag_view_restore', onBackupRestoreClick);
});

