/**
 * Adds a "Custom…" entry to hardcoded Chat Completion model dropdowns.
 *
 * The model ID is still stored in the source's existing `<source>_model` setting.
 * A saved value that is not one of the dropdown's options is shown as its own
 * entry in a "Custom" group, so the dropdown never shows a blank selection.
 * Picking "Custom…" opens a text box; confirming adds the typed ID as an entry
 * and selects it, which then goes through the regular `change` handler.
 */

/** Value of the "Custom…" action option. Never saved to settings. */
export const CUSTOM_MODEL_SENTINEL = '__custom_model__';

const CUSTOM_GROUP_CLASS = 'custom_model_group';
const CUSTOM_OPTION_ATTR = 'data-custom-model';
const EDITOR_CLASS = 'custom_model_editor';
const BASE_HINT = 'Context size, reasoning and image support are taken from this model. Auto guesses from the model ID.';

/**
 * @typedef {object} CustomModelSelect
 * @property {string} source Chat completion source ID
 * @property {string} selector Model select selector
 * @property {string} settingKey Key of the model ID in the chat completion settings
 * @property {string} baseKey Key of the "Settings from" model in the chat completion settings
 * @property {(value: string) => string} [normalize] Normalizes a typed model ID
 */

/** @type {(value: string) => string} */
const stripGoogleModelsPrefix = (value) => value.replace(/^models\//, '');

/** @type {CustomModelSelect[]} */
export const CUSTOM_MODEL_SELECTS = [
    { source: 'openai', selector: '#model_openai_select', settingKey: 'openai_model', baseKey: 'openai_model_base' },
    { source: 'claude', selector: '#model_claude_select', settingKey: 'claude_model', baseKey: 'claude_model_base' },
    { source: 'makersuite', selector: '#model_google_select', settingKey: 'google_model', baseKey: 'google_model_base', normalize: stripGoogleModelsPrefix },
    { source: 'vertexai', selector: '#model_vertexai_select', settingKey: 'vertexai_model', baseKey: 'vertexai_model_base', normalize: stripGoogleModelsPrefix },
    { source: 'ai21', selector: '#model_ai21_select', settingKey: 'ai21_model', baseKey: 'ai21_model_base' },
    { source: 'perplexity', selector: '#model_perplexity_select', settingKey: 'perplexity_model', baseKey: 'perplexity_model_base' },
    { source: 'cohere', selector: '#model_cohere_select', settingKey: 'cohere_model', baseKey: 'cohere_model_base' },
    { source: 'minimax', selector: '#model_minimax_select', settingKey: 'minimax_model', baseKey: 'minimax_model_base' },
    { source: 'zai', selector: '#model_zai_select', settingKey: 'zai_model', baseKey: 'zai_model_base' },
    { source: 'groq', selector: '#model_groq_select', settingKey: 'groq_model', baseKey: 'groq_model_base' },
    { source: 'moonshot', selector: '#model_moonshot_select', settingKey: 'moonshot_model', baseKey: 'moonshot_model_base' },
];

/**
 * Gets the ID of the "Settings from" select for a model select.
 * @param {string} selector Model select selector
 * @returns {string} Base select ID (without #)
 */
export function getBaseSelectId(selector) {
    return `${selector.replace(/^#/, '')}_base`;
}

/**
 * Gets the model whose capabilities (context size, reasoning, image support, request parameters)
 * apply to the current model. For the saved custom model with a "Settings from" model chosen, that's
 * the chosen model; otherwise it's the model itself. The actual request always uses the real model ID.
 * @param {object} settings Chat completion settings
 * @param {string} model Current model ID
 * @returns {string} Model ID to use for capability checks
 */
export function resolveCapabilityModel(settings, model) {
    model = String(model ?? '');
    const entry = CUSTOM_MODEL_SELECTS.find(x => x.source === settings?.chat_completion_source);
    const base = entry ? String(settings[entry.baseKey] ?? '') : '';
    // The base belongs to the saved model only, not to other IDs passed with these settings (e.g. connection profiles)
    if (!model || !base || model !== settings[entry.settingKey] || getListedModelValues(entry.selector).includes(model)) {
        return model;
    }
    return base;
}

/**
 * Checks if an option element is a regular (listed) model option.
 * @param {HTMLOptionElement} option Option element
 * @returns {boolean} True if the option is a listed model
 */
function isListedOption(option) {
    return option.value !== CUSTOM_MODEL_SENTINEL && !option.hasAttribute(CUSTOM_OPTION_ATTR);
}

/**
 * Gets the values of the listed (non-custom) model options of a select.
 * @param {string|HTMLSelectElement} select Select element or selector
 * @returns {string[]} Listed model IDs
 */
export function getListedModelValues(select) {
    const element = $(select).get(0);
    if (!(element instanceof HTMLSelectElement)) {
        return [];
    }
    return Array.from(element.options).filter(isListedOption).map(o => o.value);
}

/**
 * Checks if a select element supports custom models.
 * @param {string|HTMLElement} select Select element or selector
 * @returns {boolean} True if custom models are supported
 */
export function isCustomModelSelect(select) {
    const element = $(select).get(0);
    return !!element && CUSTOM_MODEL_SELECTS.some(x => $(x.selector).is(element));
}

/**
 * Makes sure the "Custom" group and the "Custom…" action option exist at the end of the select.
 * Dynamic lists (Groq, Moonshot) are emptied on connect, so this is safe to call repeatedly.
 * @param {JQuery<HTMLElement>} $select Select element
 * @returns {JQuery<HTMLElement>} The custom group
 */
function ensureCustomStructure($select) {
    let $group = $select.children(`optgroup.${CUSTOM_GROUP_CLASS}`);
    if ($group.length === 0) {
        $group = $('<optgroup>')
            .addClass(CUSTOM_GROUP_CLASS)
            .attr('label', 'Custom')
            .attr('data-i18n', '[label]Custom');
    }

    let $sentinel = $select.children(`option[value="${CUSTOM_MODEL_SENTINEL}"]`);
    if ($sentinel.length === 0) {
        $sentinel = $('<option>')
            .val(CUSTOM_MODEL_SENTINEL)
            .text('Custom…')
            .attr('data-i18n', 'Custom…');
    }

    // Keep both at the very end, the group above the action
    $select.append($group, $sentinel);
    $group.toggle($group.children().length > 0);
    return $group;
}

/**
 * Shows the saved model in the select. If the model isn't a listed option,
 * it is added to the "Custom" group. Custom entries that became listed
 * (e.g. after the API model list loaded) are removed. Does not trigger `change`.
 * Also refreshes the "Settings from" row, which is only shown for custom models.
 * @param {string} selector Select selector
 * @param {string} value Saved model ID
 * @param {string} [baseValue] Saved "Settings from" model. Keeps the current choice if omitted.
 */
export function syncCustomModelSelect(selector, value, baseValue) {
    const $select = $(selector);
    if ($select.length === 0) {
        return;
    }

    const $group = ensureCustomStructure($select);
    const listed = getListedModelValues($select);
    value = String(value ?? '');

    // Drop custom entries that duplicate a listed option
    $group.children('option').each(function () {
        if (listed.includes(this.value)) {
            this.remove();
        }
    });

    if (value && value !== CUSTOM_MODEL_SENTINEL && !listed.includes(value)) {
        const exists = $group.children('option').toArray().some(o => o.value === value);
        if (!exists) {
            $group.append($('<option>').val(value).text(value).attr(CUSTOM_OPTION_ATTR, 'true'));
        }
    }

    $group.toggle($group.children().length > 0);

    if (value) {
        $select.val(value);
    }

    syncBaseSelect(selector, listed, !!value && !listed.includes(value), baseValue);
}

/**
 * Refreshes the "Settings from" select: its options mirror the listed models.
 * @param {string} selector Model select selector
 * @param {string[]} listed Listed model IDs
 * @param {boolean} isCustom Whether the current model is a custom one
 * @param {string} [baseValue] Value to select. Keeps the current choice if omitted.
 */
function syncBaseSelect(selector, listed, isCustom, baseValue) {
    const $base = $(`#${getBaseSelectId(selector)}`);
    if ($base.length === 0) {
        return;
    }

    const current = baseValue ?? String($base.val() ?? '');
    const existing = $base.children('option').map((_, o) => o.value).get().slice(1);
    if (existing.join('\n') !== listed.join('\n')) {
        $base.children('option').slice(1).remove();
        const $source = $(selector);
        for (const id of listed) {
            const text = $source.find('option').filter((_, o) => o.value === id).first().text() || id;
            $base.append($('<option>').val(id).text(text));
        }
    }

    // A "Settings from" model that is no longer listed falls back to Auto
    $base.val(listed.includes(current) ? current : '');
    $base.closest('.custom_model_base').toggleClass('displayNone', !isCustom);
}

/**
 * Syncs every custom-capable select with the given settings.
 * @param {object} settings Chat completion settings
 */
export function syncAllCustomModelSelects(settings) {
    for (const { selector, settingKey, baseKey } of CUSTOM_MODEL_SELECTS) {
        syncCustomModelSelect(selector, settings[settingKey], String(settings[baseKey] ?? ''));
    }
}

/**
 * Creates the inline editor shown below a select when "Custom…" is picked.
 * @param {JQuery<HTMLElement>} $select Select element
 * @returns {JQuery<HTMLElement>} Editor container
 */
function createEditor($select) {
    const selectId = $select.attr('id');
    const $editor = $(`
        <div class="${EDITOR_CLASS} flex-container alignItemsCenter marginTop5 displayNone" data-for="${selectId}">
            <input type="text" class="text_pole flex1 margin0" autocomplete="off" spellcheck="false"
                placeholder="Enter a Model ID" data-i18n="[placeholder]Enter a Model ID">
            <div class="menu_button menu_button_icon fa-solid fa-check margin0" title="Use this model" data-i18n="[title]Use this model"></div>
            <div class="menu_button menu_button_icon fa-solid fa-xmark margin0" title="Cancel" data-i18n="[title]Cancel"></div>
        </div>`);
    const $baseRow = $(`
        <div class="custom_model_base flex-container alignItemsCenter marginTop5 displayNone" data-for="${selectId}">
            <span title="${BASE_HINT}" data-i18n="Settings from;[title]${BASE_HINT}">Settings from</span>
            <select id="${selectId}_base" class="text_pole flex1 margin0" title="${BASE_HINT}" data-i18n="[title]${BASE_HINT}">
                <option value="" data-i18n="Auto (from name)">Auto (from name)</option>
            </select>
        </div>`);
    $select.after($editor, $baseRow);
    return $editor;
}

/** @type {() => object} */
let getSettingsRef = () => null;

/**
 * Selects a model ID in a custom-capable select, adding it as a custom entry if it isn't listed,
 * and triggers `change` so the regular handler saves it. A different custom model starts with
 * "Settings from" on Auto.
 * @param {HTMLElement} select Model select element
 * @param {string} value Model ID
 * @returns {string} The selected model ID, or an empty string if nothing was selected
 */
export function selectCustomModel(select, value) {
    const entry = CUSTOM_MODEL_SELECTS.find(x => $(x.selector).is(select));
    value = String(value ?? '').trim();
    if (!entry || !value || value === CUSTOM_MODEL_SENTINEL) {
        return '';
    }
    if (entry.normalize) {
        value = entry.normalize(value);
    }

    const settings = getSettingsRef();
    const isNewModel = !!settings && settings[entry.settingKey] !== value;
    if (isNewModel) {
        settings[entry.baseKey] = '';
    }
    syncCustomModelSelect(entry.selector, value, isNewModel ? '' : undefined);
    $(entry.selector).val(value).trigger('change');
    return value;
}

/**
 * Adds the "Custom…" option and editor to every supported select.
 * Must be called before the selects' `change` handlers are bound,
 * so that picking "Custom…" never reaches them.
 * @param {() => object} getSettings Returns the current chat completion settings
 * @param {(selector: string) => void} onBaseChange Called after a "Settings from" model was stored
 */
export function initCustomModelSelects(getSettings, onBaseChange) {
    getSettingsRef = getSettings;
    for (const { selector, settingKey, baseKey } of CUSTOM_MODEL_SELECTS) {
        const $select = $(selector);
        if ($select.length === 0) {
            continue;
        }

        ensureCustomStructure($select);
        const $editor = createEditor($select);
        const $input = $editor.find('input');

        const closeEditor = () => {
            $editor.addClass('displayNone');
            $input.val('');
        };

        const commit = () => {
            const value = String($input.val() ?? '');
            closeEditor();
            selectCustomModel($select.get(0), value);
        };

        $(`#${getBaseSelectId(selector)}`).on('change', function () {
            const settings = getSettings();
            if (settings) {
                settings[baseKey] = String($(this).val() ?? '');
            }
            onBaseChange?.(selector);
        });

        $select.on('change', function (event) {
            if ($select.val() !== CUSTOM_MODEL_SENTINEL) {
                closeEditor();
                const value = String($select.val() ?? '');
                const isCustom = !!value && !getListedModelValues($select).includes(value);
                $(`#${getBaseSelectId(selector)}`).closest('.custom_model_base').toggleClass('displayNone', !isCustom);
                return;
            }

            // Don't let the sentinel reach onModelChange; restore the saved model instead
            event.stopImmediatePropagation();
            const current = String(getSettings()?.[settingKey] ?? '');
            syncCustomModelSelect(selector, current);

            const isCustom = !!current && !getListedModelValues($select).includes(current);
            $input.val(isCustom ? current : '');
            $editor.removeClass('displayNone');
            $input.trigger('focus');
        });

        $input.on('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                commit();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeEditor();
            }
        });

        $editor.find('.fa-check').on('click', commit);
        $editor.find('.fa-xmark').on('click', closeEditor);
    }
}
