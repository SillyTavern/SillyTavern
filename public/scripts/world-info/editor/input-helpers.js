/**
 * World Info Editor Input Helpers
 * Contains helper functions for handling various input types in the world info editor.
 */

import { getContext } from '../../extensions.js';
import { isMobile } from '../../RossAscends-mods.js';
import { power_user } from '../../power-user.js';
import { t } from '../../i18n.js';
import {
    resetScrollHeight,
    getSelect2OptionId,
    select2ModifyOptions,
    dynamicSelect2DataViaAjax,
    highlightRegex,
    select2ChoiceClickSubscribe,
} from '../../utils.js';
import { world_names } from '../state.js';
import { setWIOriginalDataValue, originalWIDataKeyMap } from '../entry/index.js';
import { saveWorldInfo } from '../persistence/index.js';
import { isValidRegex, splitKeywordsAndRegexes, customTokenizer } from '../utilities.js';

/** @type {import('../../utils.js').Select2Option[]} Cache all keys as selectable dropdown option */
let worldEntryKeyOptionsCache = [];

/**
 * Update the cache and all select options for the keys with new values to display
 * @param {string[]|import('../../utils.js').Select2Option[]} keyOptions - An array of options to update
 * @param {object} options - Optional arguments
 * @param {boolean?} [options.remove=false] - Whether the option was removed, so the count should be reduced - otherwise it'll be increased
 * @param {boolean?} [options.reset=false] - Whether the cache should be reset. Reset will also not trigger update of the controls, as we expect them to be redrawn anyway
 */
export function updateWorldEntryKeyOptionsCache(keyOptions, { remove = false, reset = false } = {}) {
    if (!keyOptions.length) return;
    /** @type {import('../../utils.js').Select2Option[]} */
    const options = keyOptions.map(x => typeof x === 'string' ? { id: getSelect2OptionId(x), text: x } : x);
    if (reset) worldEntryKeyOptionsCache.length = 0;
    options.forEach(option => {
        // Update the cache list
        let cachedEntry = worldEntryKeyOptionsCache.find(x => x.id == option.id);
        if (cachedEntry) {
            cachedEntry.count += !remove ? 1 : -1;
        } else if (!remove) {
            worldEntryKeyOptionsCache.push(option);
            cachedEntry = option;
            cachedEntry.count = 1;
        }
    });

    // Sort by count DESC and then alphabetically
    worldEntryKeyOptionsCache.sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}

/**
 * Get the world entry key options cache.
 * @returns {import('../../utils.js').Select2Option[]} The cache
 */
export function getWorldEntryKeyOptionsCache() {
    return worldEntryKeyOptionsCache;
}

/**
 * Update commentInput's placeholder.
 * @param {string} keys Text to display in commentInput's placeholder.
 * @param {JQuery<HTMLElement>} commentInput The comment input element.
 */
export function setCommentPlaceholder(keys, commentInput) {
    const MAX_COMMENT_LENGTH = 100;
    // Limit placeholder text to avoid performance issues.
    keys = keys.slice(0, MAX_COMMENT_LENGTH);
    commentInput.attr('placeholder', (keys || t`Entry Title/Memo`));
}

/**
 * Enables the input helper for keys in a World Info entry.
 * @param {object} params - Parameters for enabling the keys input helper.
 * @param {JQuery<HTMLElement>} params.template - The template element containing the input.
 * @param {object} params.entry - The entry object containing the keys.
 * @param {string} params.entryPropName - The property name of the entry that holds the keys.
 * @param {string} params.originalDataValueName - The name of the original data value to be set.
 * @param {string} params.name - The name of the world info entry.
 * @param {object} params.data - The data object containing entries.
 */
export function enableKeysInputHelper({ template, entry, entryPropName, originalDataValueName, name, data }) {
    const isFancyInput = !isMobile() && !power_user.wi_key_input_plaintext;
    const input = isFancyInput ? template.find(`select[name="${entryPropName}"]`) : template.find(`textarea[name="${entryPropName}"]`);
    input.data('uid', entry.uid);
    input[0].dataset.macros = ''; // active
    input.on('click', function (event) {
        event.stopPropagation();
    });

    function templateStyling(item, { searchStyle = false } = {}) {
        const content = $('<span>').addClass('item').text(item.text).attr('title', `${item.text}\n\nClick to edit`);
        const isRegex = isValidRegex(item.text);
        if (isRegex) {
            content.html(highlightRegex(item.text));
            content.addClass('regex_item').prepend($('<span>').addClass('regex_icon').text('•*').attr('title', 'Regex'));
        }
        if (searchStyle && item.count) {
            const wrapper = $('<span>').addClass('result_block').append(content);
            wrapper.append($('<span>').addClass('item_count').text(item.count).attr('title', `Used as a key ${item.count} ${item.count != 1 ? 'times' : 'time'} in this lorebook`));
            return wrapper;
        }
        return content;
    }

    if (isFancyInput) {
        select2ModifyOptions(input, entry[entryPropName], { select: true, changeEventArgs: { skipReset: true, noSave: true } });
        input.select2({
            ajax: dynamicSelect2DataViaAjax(() => worldEntryKeyOptionsCache),
            tags: true,
            tokenSeparators: [','],
            // @ts-ignore
            tokenizer: customTokenizer,
            placeholder: input.attr('placeholder'),
            templateResult: item => templateStyling(item, { searchStyle: true }),
            templateSelection: item => templateStyling(item),
        });

        // TypeScript-safe event handler
        /**
         * @param {Event} _event
         * @param {{ skipReset?: boolean, noSave?: boolean }} [arg]
         */
        input.on('change', async function (_event, arg) {
            const uid = $(this).data('uid');
            const keys = ($(this).select2('data')).map(x => x.text);
            const skipReset = arg?.skipReset ?? false;
            const noSave = arg?.noSave ?? false;
            if (!skipReset) await resetScrollHeight(this);
            if (!noSave) {
                data.entries[uid][entryPropName] = keys;
                setWIOriginalDataValue(data, uid, originalDataValueName, data.entries[uid][entryPropName]);
                await saveWorldInfo(name, data);
            }
            $(this).toggleClass('empty', !data.entries[uid][entryPropName].length);
            // Update the commentInput's placeholder for primary keys
            if (entryPropName === 'key') {
                const commentInput = $(_event.currentTarget).closest('.world_entry_form').find('textarea[name="comment"]');
                setCommentPlaceholder(data.entries[uid][entryPropName].join(', '), commentInput);
            }
        });

        input.toggleClass('empty', !entry[entryPropName].length);
        input.on('select2:select', event => updateWorldEntryKeyOptionsCache([event.params.data]));
        input.on('select2:unselect', event => updateWorldEntryKeyOptionsCache([event.params.data], { remove: true }));

        select2ChoiceClickSubscribe(input, target => {
            const key = $(target.closest('.regex-highlight, .item')).text();
            const selected = input.val();
            if (!Array.isArray(selected)) return;
            var index = selected.indexOf(getSelect2OptionId(key));
            if (index > -1) selected.splice(index, 1);
            input.val(selected).trigger('change');
            updateWorldEntryKeyOptionsCache([key], { remove: true });
            input.next('span.select2-container').find('textarea').val(key).trigger('input');
        }, { openDrawer: true });
    } else {
        template.find(`select[name="${entryPropName}"]`).hide();
        input.show();
        /**
        * @param {Event} _event
        * @param {{ skipReset?: boolean, noSave?: boolean }} [arg]
        */
        input.on('change', async function (_event, arg) {
            const uid = $(this).data('uid');
            const value = String($(this).val());
            const skipReset = arg?.skipReset ?? false;
            const noSave = arg?.noSave ?? false;
            if (!skipReset) await resetScrollHeight(this);
            if (!noSave) {
                data.entries[uid][entryPropName] = splitKeywordsAndRegexes(value);
                setWIOriginalDataValue(data, uid, originalDataValueName, data.entries[uid][entryPropName]);
                await saveWorldInfo(name, data);
                $(this).toggleClass('empty', !data.entries[uid][entryPropName].length);
            }
            // Update the commentInput's placeholder for primary keys
            if (entryPropName === 'key') {
                const commentInput = $(_event.currentTarget).closest('.world_entry_form').find('textarea[name="comment"]');
                setCommentPlaceholder(value, commentInput);
            }
        });
        input.val(entry[entryPropName].join(', ')).trigger('input', { skipReset: true });
    }
    return { isFancy: isFancyInput, control: input };
}

/**
 * Helper to handle match checkboxes for WI entries.
 * @param {object} params - Parameters for handling match checkboxes.
 * @param {JQuery<HTMLElement>} params.template - The template element containing the checkbox.
 * @param {object} params.entry - The entry object containing the checkbox state.
 * @param {string} params.fieldName - The name of the checkbox field.
 * @param {object} params.data - The data object containing entries.
 * @param {string} params.name - The name of the world info to save changes to.
 */
export function handleMatchCheckboxHelper({ template, entry, fieldName, data, name }) {
    const key = originalWIDataKeyMap[fieldName];
    const checkBoxElem = template.find(`input[type="checkbox"][name="${fieldName}"]`);
    checkBoxElem.data('uid', entry.uid);
    checkBoxElem.on('input', async function (_, { noSave = false } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid][fieldName] = value;
        setWIOriginalDataValue(data, uid, key, data.entries[uid][fieldName]);
        !noSave && await saveWorldInfo(name, data);
    });
    checkBoxElem.prop('checked', !!entry[fieldName]).trigger('input', { noSave: true });
}

/**
 * Helper to update position/order display.
 * @param {object} params - Parameters for updating position/order display.
 * @param {JQuery<HTMLElement>} params.template - The template element containing the display.
 * @param {object} params.data - The data object containing entries.
 * @param {string} params.uid - The unique identifier of the entry to update.
 */
export function updatePosOrdDisplayHelper({ template, data, uid }) {
    let entry = data.entries[uid];
    let posText = entry.position;
    switch (entry.position) {
        case 0: posText = '↑CD'; break;
        case 1: posText = 'CD↓'; break;
        case 2: posText = '↑AN'; break;
        case 3: posText = 'AN↓'; break;
        case 4: posText = `@D${entry.depth}`; break;
    }
    template.find('.world_entry_form_position_value').text(`(${posText} ${entry.order})`);
}

/**
 * Helper to initialize character filter select2.
 * @param {JQuery<HTMLElement>} characterFilter - The select element for character filter.
 */
export function initCharacterFilterSelect2Helper(characterFilter) {
    if (!isMobile()) {
        $(characterFilter).select2({
            width: '100%',
            placeholder: t`Tie this entry to specific characters or characters with specific tags`,
            allowClear: true,
            closeOnSelect: false,
        });
    }
}

/**
 * Helper to fill character and tag options for character filter.
 * @param {object} params - Parameters for filling options.
 * @param {JQuery<HTMLElement>} params.characterFilter - The select element to fill with options.
 * @param {object} params.entry - The entry object containing character filter data.
 */
export function fillCharacterAndTagOptionsHelper({ characterFilter, entry }) {
    const characters = getContext().characters;
    characters.forEach((character) => {
        const option = document.createElement('option');
        const name = character.avatar.replace(/\.[^/.]+$/, '') ?? character.name;
        option.innerText = name;
        option.selected = entry.characterFilter?.names?.includes(name);
        option.setAttribute('data-type', 'character');
        characterFilter.append(option);
    });
    const tags = getContext().tags;
    tags.forEach((tag) => {
        const option = document.createElement('option');
        option.innerText = `[Tag] ${tag.name}`;
        option.selected = entry.characterFilter?.tags?.includes(tag.id);
        option.value = tag.id;
        option.setAttribute('data-type', 'tag');
        characterFilter.append(option);
    });
}

/**
 * Helper to handle character filter changes.
 * @param {object} params - Parameters for handling character filter changes.
 * @param {JQuery<HTMLElement>} params.characterFilter - The select element for character filter.
 * @param {object} params.data - The data object containing entries.
 * @param {object} params.entry - The entry object to update.
 * @param {string} params.name - The name of the world info to save changes to.
 */
export function handleCharacterFilterChangeHelper({ characterFilter, data, entry, name }) {
    characterFilter.on('mousedown change', async function (e) {
        if (world_names.length === 0) {
            e.preventDefault();
            return;
        }
        const uid = $(this).data('uid');
        const selected = $(this).find(':selected');
        if ((!selected || selected?.length === 0) && !data.entries[uid].characterFilter?.isExclude) {
            delete data.entries[uid].characterFilter;
        } else {
            const names = selected.filter('[data-type="character"]').map((_, e) => e instanceof HTMLOptionElement && e.innerText).toArray();
            const tags = selected.filter('[data-type="tag"]').map((_, e) => e instanceof HTMLOptionElement && e.value).toArray();
            Object.assign(
                data.entries[uid],
                {
                    characterFilter: {
                        isExclude: data.entries[uid].characterFilter?.isExclude ?? false,
                        names: names,
                        tags: tags,
                    },
                },
            );
        }
        setWIOriginalDataValue(data, uid, 'character_filter', data.entries[uid].characterFilter);
        await saveWorldInfo(name, data);
    });
}

/**
 * Helper to handle probability input.
 * @param {object} params - Parameters for handling probability input.
 * @param {JQuery<HTMLElement>} params.probabilityInput - The input element for probability.
 * @param {object} params.data - The data object containing entries.
 * @param {object} params.entry - The entry object to update.
 * @param {string} params.name - The name of the world info to save changes to.
 */
export function handleProbabilityInputHelper({ probabilityInput, data, entry, name }) {
    probabilityInput.data('uid', entry.uid);
    probabilityInput.on('input', async function (_, { noSave = false } = {}) {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].probability = !isNaN(value) ? value : null;
        if (data.entries[uid].probability !== null) {
            data.entries[uid].probability = Math.min(100, Math.max(0, data.entries[uid].probability));
            if (data.entries[uid].probability !== value) {
                $(this).val(data.entries[uid].probability);
            }
        }
        setWIOriginalDataValue(data, uid, 'extensions.probability', data.entries[uid].probability);
        !noSave && await saveWorldInfo(name, data);
    });
    probabilityInput.val(entry.probability).trigger('input', { noSave: true });
    probabilityInput.css('width', 'calc(3em + 15px)');
}

/**
 * Helper to handle probability toggle.
 * @param {object} params - Parameters for handling probability toggle.
 * @param {JQuery<HTMLElement>} params.probabilityToggle - The toggle element for probability.
 * @param {object} params.data - The data object containing entries.
 * @param {object} params.entry - The entry object to update.
 * @param {string} params.name - The name of the world info to save changes to.
 * @param {JQuery<HTMLElement>} params.probabilityInput - The input element for probability.
 */
export function handleProbabilityToggleHelper({ probabilityToggle, data, entry, name, probabilityInput }) {
    probabilityToggle.data('uid', entry.uid);
    probabilityToggle.on('input', async function (_, { noSave = false } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].useProbability = value;
        const probabilityContainer = $(this).closest('.world_entry').find('.probabilityContainer');
        !noSave && await saveWorldInfo(name, data);
        value ? probabilityContainer.show() : probabilityContainer.hide();
        if (value && data.entries[uid].probability === null) {
            data.entries[uid].probability = 100;
        }
        if (!value) {
            data.entries[uid].probability = null;
        }
        probabilityInput.val(data.entries[uid].probability).trigger('input', { noSave });
    });
    probabilityToggle.prop('checked', true).trigger('input', { noSave: true });
    probabilityToggle.parent().hide();
}

/**
 * Helper to handle select2 dropdowns for boolean selects.
 * @param {object} params - Parameters for handling boolean selects.
 * @param {JQuery<HTMLElement>} params.selectElem - The select element for boolean values.
 * @param {object} params.entry - The entry object containing the boolean value.
 * @param {string} params.entryKey - The key in the entry object for the boolean value.
 * @param {object} params.data - The data object containing entries.
 * @param {string} params.name - The name of the world info to save changes to.
 */
export function handleBooleanSelectHelper({ selectElem, entry, entryKey, data, name }) {
    selectElem.data('uid', entry.uid);
    selectElem.on('input', async function (_, { noSave = false } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).val();
        data.entries[uid][entryKey] = value === 'null' ? null : value === 'true';
        setWIOriginalDataValue(data, uid, `extensions.${entryKey.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)}`, data.entries[uid][entryKey]);
        !noSave && await saveWorldInfo(name, data);
    });
    selectElem.val((entry[entryKey] === null || entry[entryKey] === undefined) ? 'null' : entry[entryKey] ? 'true' : 'false').trigger('input', { noSave: true });
}

/**
 * Helper to handle input fields for numbers.
 * @param {object} params - Parameters for handling number inputs.
 * @param {JQuery<HTMLElement>} params.inputElem - The input element for the number.
 * @param {object} params.entry - The entry object containing the number value.
 * @param {string} params.entryKey - The key in the entry object for the number value.
 * @param {object} params.data - The data object containing entries.
 * @param {string} params.name - The name of the world info to save changes to.
 * @param {number} params.min - The minimum value for the number input.
 * @param {number} params.max - The maximum value for the number input.
 * @param {boolean} [params.clamp=false] - Whether to clamp the value within the min and max range.
 */
export function handleNumberInputHelper({ inputElem, entry, entryKey, data, name, min, max, clamp = false }) {
    inputElem.data('uid', entry.uid);
    inputElem.on('input', async function (_, { noSave = false } = {}) {
        const uid = $(this).data('uid');
        let value = Number($(this).val());
        if (clamp) {
            if (value < min) {
                value = min;
                $(this).val(min);
            } else if (value > max) {
                value = max;
                $(this).val(max);
            }
        }
        data.entries[uid][entryKey] = !isNaN(value) ? value : null;
        setWIOriginalDataValue(data, uid, `extensions.${entryKey.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)}`, data.entries[uid][entryKey]);
        !noSave && await saveWorldInfo(name, data);
    });
    inputElem.val(entry[entryKey] ?? (clamp ? min : '')).trigger('input', { noSave: true });
}

/**
 * Helper to handle tri-state selector for constant/normal/vectorized.
 * @param {object} params - Parameters for handling the entry state selector.
 * @param {JQuery<HTMLElement>} params.entryStateSelector - The select element for entry state.
 * @param {object} params.entry - The entry object containing the state.
 * @param {object} params.data - The data object containing entries.
 * @param {string} params.name - The name of the world info to save changes to.
 */
export function handleEntryStateSelectorHelper({ entryStateSelector, entry, data, name }) {
    entryStateSelector.data('uid', entry.uid);
    entryStateSelector.on('click', function (event) {
        event.stopPropagation();
    });
    entryStateSelector.on('input', async function (_, { noSave = false } = {}) {
        const uid = entry.uid;
        const value = $(this).val();
        switch (value) {
            case 'constant':
                data.entries[uid].constant = true;
                data.entries[uid].vectorized = false;
                setWIOriginalDataValue(data, uid, 'constant', true);
                setWIOriginalDataValue(data, uid, 'extensions.vectorized', false);
                break;
            case 'normal':
                data.entries[uid].constant = false;
                data.entries[uid].vectorized = false;
                setWIOriginalDataValue(data, uid, 'constant', false);
                setWIOriginalDataValue(data, uid, 'extensions.vectorized', false);
                break;
            case 'vectorized':
                data.entries[uid].constant = false;
                data.entries[uid].vectorized = true;
                setWIOriginalDataValue(data, uid, 'constant', false);
                setWIOriginalDataValue(data, uid, 'extensions.vectorized', true);
                break;
        }
        !noSave && await saveWorldInfo(name, data);
    });
    const entryState = () => entry.constant === true ? 'constant' : entry.vectorized === true ? 'vectorized' : 'normal';
    entryStateSelector.find(`option[value=${entryState()}]`).prop('selected', true).trigger('input', { noSave: true });
}

/**
 * Helper to handle kill switch toggle.
 * @param {object} params - Parameters for handling the kill switch toggle.
 * @param {JQuery<HTMLElement>} params.entryKillSwitch - The toggle element for the kill switch.
 * @param {object} params.entry - The entry object containing the state.
 * @param {object} params.data - The data object containing entries.
 * @param {string} params.name - The name of the world info to save changes to.
 * @param {JQuery<HTMLElement>} params.template - The template element for the entry.
 */
export function handleEntryKillSwitchHelper({ entryKillSwitch, entry, data, name, template }) {
    entryKillSwitch.data('uid', entry.uid);
    entryKillSwitch.on('click', async function () {
        const uid = entry.uid;
        data.entries[uid].disable = !data.entries[uid].disable;
        const isActive = !data.entries[uid].disable;
        setWIOriginalDataValue(data, uid, 'enabled', isActive);
        template.toggleClass('disabledWIEntry', !isActive);
        entryKillSwitch.toggleClass('fa-toggle-off', !isActive);
        entryKillSwitch.toggleClass('fa-toggle-on', isActive);
        await saveWorldInfo(name, data);
    });
    const isActive = !entry.disable;
    template.toggleClass('disabledWIEntry', !isActive);
    entryKillSwitch.toggleClass('fa-toggle-off', !isActive);
    entryKillSwitch.toggleClass('fa-toggle-on', isActive);
}
