import { fuzzySearchCharacters, fuzzySearchGroups, fuzzySearchPersonas, fuzzySearchTags, fuzzySearchWorldInfo, power_user } from './power-user.js';
import { tag_map } from './tags.js';

/**
 * The filter types
 * @type {{ SEARCH: string, TAG: string, FOLDER: string, FAV: string, GROUP: string, WORLD_INFO_SEARCH: string, PERSONA_SEARCH: string, [key: string]: string }}
 */
export const FILTER_TYPES = {
    SEARCH: 'search',
    TAG: 'tag',
    FOLDER: 'folder',
    FAV: 'fav',
    GROUP: 'group',
    WORLD_INFO_SEARCH: 'world_info_search',
    PERSONA_SEARCH: 'persona_search',
};

/**
 * @typedef FilterState One of the filter states
 * @property {string} key - The key of the state
 * @property {string} class - The css class for this state
 */

/**
 * The filter states
 * @type {{ SELECTED: FilterState, EXCLUDED: FilterState, UNDEFINED: FilterState, [key: string]: FilterState }}
 */
export const FILTER_STATES = {
    SELECTED: { key: 'SELECTED', class: 'selected' },
    EXCLUDED: { key: 'EXCLUDED', class: 'excluded' },
    UNDEFINED: { key: 'UNDEFINED', class: 'undefined' },
};
/** @type {string} the default filter state of `FILTER_STATES` */
export const DEFAULT_FILTER_STATE = FILTER_STATES.UNDEFINED.key;

/**
 * Robust check if one state equals the other. It does not care whether it's the state key or the state value object.
 * @param {FilterState|string} a First state
 * @param {FilterState|string} b Second state
 * @returns {boolean}
 */
export function isFilterState(a, b) {
    const states = Object.keys(FILTER_STATES);

    const aKey = typeof a == 'string' && states.includes(a) ? a : states.find(key => FILTER_STATES[key] === a);
    const bKey = typeof b == 'string' && states.includes(b) ? b : states.find(key => FILTER_STATES[key] === b);

    return aKey === bKey;
}

/**
 * Helper class for filtering data.
 * @example
 * const filterHelper = new FilterHelper(() => console.log('data changed'));
 * filterHelper.setFilterData(FILTER_TYPES.SEARCH, 'test');
 * data = filterHelper.applyFilters(data);
 */
export class FilterHelper {
    /**
     * Creates a new FilterHelper
     * @param {Function} onDataChanged Callback to trigger when the filter data changes
     */
    constructor(onDataChanged) {
        this.onDataChanged = onDataChanged;
    }

    /**
     * The filter functions.
     * @type {Object.<string, Function>}
     */
    filterFunctions = {
        [FILTER_TYPES.SEARCH]: this.searchFilter.bind(this),
        [FILTER_TYPES.FAV]: this.favFilter.bind(this),
        [FILTER_TYPES.GROUP]: this.groupFilter.bind(this),
        [FILTER_TYPES.FOLDER]: this.folderFilter.bind(this),
        [FILTER_TYPES.TAG]: this.tagFilter.bind(this),
        [FILTER_TYPES.WORLD_INFO_SEARCH]: this.wiSearchFilter.bind(this),
        [FILTER_TYPES.PERSONA_SEARCH]: this.personaSearchFilter.bind(this),
    };

    /**
     * The filter data.
     * @type {Object.<string, any>}
     */
    filterData = {
        [FILTER_TYPES.SEARCH]: '',
        [FILTER_TYPES.FAV]: false,
        [FILTER_TYPES.GROUP]: false,
        [FILTER_TYPES.FOLDER]: false,
        [FILTER_TYPES.TAG]: { excluded: [], selected: [] },
        [FILTER_TYPES.WORLD_INFO_SEARCH]: '',
        [FILTER_TYPES.PERSONA_SEARCH]: '',
    };

    /**
     * Applies a fuzzy search filter to the World Info data.
     * @param {any[]} data The data to filter. Must have a uid property.
     * @returns {any[]} The filtered data.
     */
    wiSearchFilter(data) {
        const term = this.filterData[FILTER_TYPES.WORLD_INFO_SEARCH];

        if (!term) {
            return data;
        }

        const fuzzySearchResults = fuzzySearchWorldInfo(data, term);
        return data.filter(entity => fuzzySearchResults.includes(entity.uid));
    }

    /**
     * Applies a search filter to Persona data.
     * @param {string[]} data The data to filter.
     * @returns {string[]} The filtered data.
     */
    personaSearchFilter(data) {
        const term = this.filterData[FILTER_TYPES.PERSONA_SEARCH];

        if (!term) {
            return data;
        }

        const fuzzySearchResults = fuzzySearchPersonas(data, term);
        return data.filter(entity => fuzzySearchResults.includes(entity));
    }

    /**
     * Checks if the given entity is tagged with the given tag ID.
     * @param {object} entity Searchable entity
     * @param {string} tagId Tag ID to check
     * @returns {boolean} Whether the entity is tagged with the given tag ID
     */
    isElementTagged(entity, tagId) {
        const isCharacter = entity.type === 'character';
        const lookupValue = isCharacter ? entity.item.avatar : String(entity.id);
        const isTagged = Array.isArray(tag_map[lookupValue]) && tag_map[lookupValue].includes(tagId);

        return isTagged;
    }

    /**
     * Applies a tag filter to the data.
     * @param {any[]} data The data to filter.
     * @returns {any[]} The filtered data.
     */
    tagFilter(data) {
        const TAG_LOGIC_AND = true; // switch to false to use OR logic for combining tags
        const { selected, excluded } = this.filterData[FILTER_TYPES.TAG];

        if (!selected.length && !excluded.length) {
            return data;
        }

        const getIsTagged = (entity) => {
            const isTag = entity.type === 'tag';
            const tagFlags = selected.map(tagId => this.isElementTagged(entity, tagId));
            const trueFlags = tagFlags.filter(x => x);
            const isTagged = TAG_LOGIC_AND ? tagFlags.length === trueFlags.length : trueFlags.length > 0;

            const excludedTagFlags = excluded.map(tagId => this.isElementTagged(entity, tagId));
            const isExcluded = excludedTagFlags.includes(true);

            if (isTag) {
                return true;
            } else if (isExcluded) {
                return false;
            } else if (selected.length > 0 && !isTagged) {
                return false;
            } else {
                return true;
            }
        };

        return data.filter(entity => getIsTagged(entity));
    }

    /**
     * Applies a favorite filter to the data.
     * @param {any[]} data The data to filter.
     * @returns {any[]} The filtered data.
     */
    favFilter(data) {
        const state = this.filterData[FILTER_TYPES.FAV];
        const isFav = entity => entity.item.fav || entity.item.fav == 'true';

        return this.filterDataByState(data, state, isFav, { includeFolders: true });
    }

    /**
     * Applies a group type filter to the data.
     * @param {any[]} data The data to filter.
     * @returns {any[]} The filtered data.
     */
    groupFilter(data) {
        const state = this.filterData[FILTER_TYPES.GROUP];
        const isGroup = entity => entity.type === 'group';

        return this.filterDataByState(data, state, isGroup, { includeFolders: true });
    }

    /**
     * Applies a "folder" filter to the data.
     * @param {any[]} data The data to filter.
     * @returns {any[]} The filtered data.
     */
    folderFilter(data) {
        const state = this.filterData[FILTER_TYPES.FOLDER];
        // Slightly different than the other filters, as a positive folder filter means it doesn't filter anything (folders get "not hidden" at another place),
        // while a negative state should then filter out all folders.
        const isFolder = entity => isFilterState(state, FILTER_STATES.SELECTED) ? true : entity.type === 'tag';

        return this.filterDataByState(data, state, isFolder);
    }

    filterDataByState(data, state, filterFunc, { includeFolders = false } = {}) {
        if (isFilterState(state, FILTER_STATES.SELECTED)) {
            return data.filter(entity => filterFunc(entity) || (includeFolders && entity.type == 'tag'));
        }
        if (isFilterState(state, FILTER_STATES.EXCLUDED)) {
            return data.filter(entity => !filterFunc(entity) || (includeFolders && entity.type == 'tag'));
        }

        return data;
    }

    /**
     * Applies a search filter to the data. Uses fuzzy search if enabled.
     * @param {any[]} data The data to filter.
     * @returns {any[]} The filtered data.
     */
    searchFilter(data) {
        if (!this.filterData[FILTER_TYPES.SEARCH]) {
            return data;
        }

        const searchValue = this.filterData[FILTER_TYPES.SEARCH].trim().toLowerCase();
        const fuzzySearchCharactersResults = power_user.fuzzy_search ? fuzzySearchCharacters(searchValue) : [];
        const fuzzySearchGroupsResults = power_user.fuzzy_search ? fuzzySearchGroups(searchValue) : [];
        const fuzzySearchTagsResult = power_user.fuzzy_search ? fuzzySearchTags(searchValue) : [];

        function getIsValidSearch(entity) {
            const isGroup = entity.type === 'group';
            const isCharacter = entity.type === 'character';
            const isTag = entity.type === 'tag';

            if (power_user.fuzzy_search) {
                if (isCharacter) {
                    return fuzzySearchCharactersResults.includes(parseInt(entity.id));
                } else if (isGroup) {
                    return fuzzySearchGroupsResults.includes(String(entity.id));
                } else if (isTag) {
                    return fuzzySearchTagsResult.includes(String(entity.id));
                } else {
                    return false;
                }
            }
            else {
                return entity.item?.name?.toLowerCase()?.includes(searchValue) || false;
            }
        }

        return data.filter(entity => getIsValidSearch(entity));
    }

    /**
     * Sets the filter data for the given filter type.
     * @param {string} filterType The filter type to set data for.
     * @param {any} data The data to set.
     * @param {boolean} suppressDataChanged Whether to suppress the data changed callback.
     */
    setFilterData(filterType, data, suppressDataChanged = false) {
        const oldData = this.filterData[filterType];
        this.filterData[filterType] = data;

        // only trigger a data change if the data actually changed
        if (JSON.stringify(oldData) !== JSON.stringify(data) && !suppressDataChanged) {
            this.onDataChanged();
        }
    }

    /**
     * Gets the filter data for the given filter type.
     * @param {string} filterType The filter type to get data for.
     */
    getFilterData(filterType) {
        return this.filterData[filterType];
    }

    /**
     * Applies all filters to the given data.
     * @param {any[]} data The data to filter.
     * @returns {any[]} The filtered data.
     */
    applyFilters(data) {
        return Object.values(this.filterFunctions)
            .reduce((data, fn) => fn(data), data);
    }
}
