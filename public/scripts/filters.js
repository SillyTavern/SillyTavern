import { fuzzySearchCharacters, fuzzySearchGroups, power_user } from "./power-user.js";
import { tag_map } from "./tags.js";

export const FILTER_TYPES = {
    SEARCH: 'search',
    TAG: 'tag',
    FAV: 'fav',
    GROUP: 'group',
};

export class FilterHelper {
    constructor(onDataChanged) {
        this.onDataChanged = onDataChanged;
    }

    filterFunctions = {
        [FILTER_TYPES.SEARCH]: this.searchFilter.bind(this),
        [FILTER_TYPES.GROUP]: this.groupFilter.bind(this),
        [FILTER_TYPES.FAV]: this.favFilter.bind(this),
        [FILTER_TYPES.TAG]: this.tagFilter.bind(this),
    }

    filterData = {
        [FILTER_TYPES.SEARCH]: '',
        [FILTER_TYPES.GROUP]: false,
        [FILTER_TYPES.FAV]: false,
        [FILTER_TYPES.TAG]: { excluded: [], selected: [] },
    }

    tagFilter(data) {
        const TAG_LOGIC_AND = true; // switch to false to use OR logic for combining tags
        const { selected, excluded } = this.filterData[FILTER_TYPES.TAG];

        if (!selected.length && !excluded.length) {
            return data;
        }

        function isElementTagged(entity, tagId) {
            const isCharacter = entity.type === 'character';
            const lookupValue = isCharacter ? entity.item.avatar : String(entity.id);
            const isTagged = Array.isArray(tag_map[lookupValue]) && tag_map[lookupValue].includes(tagId);
            return isTagged;
        }

        function getIsTagged(entity) {
            const tagFlags = selected.map(tagId => isElementTagged(entity, tagId));
            const trueFlags = tagFlags.filter(x => x);
            const isTagged = TAG_LOGIC_AND ? tagFlags.length === trueFlags.length : trueFlags.length > 0;

            const excludedTagFlags = excluded.map(tagId => isElementTagged(entity, tagId));
            const isExcluded = excludedTagFlags.includes(true);

            if (isExcluded) {
                return false;
            } else if (selected.length > 0 && !isTagged) {
                return false;
            } else {
                return true;
            }
        }

        return data.filter(entity => getIsTagged(entity));
    }

    favFilter(data) {
        if (!this.filterData[FILTER_TYPES.FAV]) {
            return data;
        }

        return data.filter(entity => entity.item.fav || entity.item.fav == "true");
    }

    groupFilter(data) {
        if (!this.filterData[FILTER_TYPES.GROUP]) {
            return data;
        }

        return data.filter(entity => entity.type === 'group');
    }

    searchFilter(data) {
        if (!this.filterData[FILTER_TYPES.SEARCH]) {
            return data;
        }

        const searchValue = this.filterData[FILTER_TYPES.SEARCH].trim().toLowerCase();
        const fuzzySearchCharactersResults = power_user.fuzzy_search ? fuzzySearchCharacters(searchValue) : [];
        const fuzzySearchGroupsResults = power_user.fuzzy_search ? fuzzySearchGroups(searchValue) : [];

        function getIsValidSearch(entity) {
            const isGroup = entity.type === 'group';
            const isCharacter = entity.type === 'character';

            if (power_user.fuzzy_search) {
                if (isCharacter) {
                    return fuzzySearchCharactersResults.includes(parseInt(entity.id));
                } else if (isGroup) {
                    return fuzzySearchGroupsResults.includes(String(entity.id));
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

    setFilterData(filterType, data) {
        const oldData = this.filterData[filterType];
        this.filterData[filterType] = data;

        // only trigger a data change if the data actually changed
        if (JSON.stringify(oldData) !== JSON.stringify(data)) {
            this.onDataChanged();
        }
    }

    getFilterData(filterType) {
        return this.filterData[filterType];
    }

    applyFilters(data) {
        return Object.values(this.filterFunctions)
            .reduce((data, fn) => fn(data), data);
    }
}
