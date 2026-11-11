/**
 * Adds a "Custom…" entry to hardcoded Chat Completion model dropdowns.
 *
 * The model ID is still stored in the source's existing `<source>_model` setting.
 * When the saved model is not one of the dropdown's options, "Custom…" is selected
 * and a text field below the dropdown shows the saved ID. Typing an ID there saves it.
 *
 * A custom ID gets the settings (context size, reasoning, media, parameters) of the source's
 * most advanced known model, as a guess for models released later. Requests use the real ID.
 */

import { lodash } from '../lib.js';

/** Value of the "Custom…" option. Never saved to settings. */
export const CUSTOM_MODEL_SENTINEL = '__custom_model__';

/**
 * @typedef {object} CustomModelSelect
 * @property {string} source Chat completion source ID
 * @property {string} selector Model select selector
 * @property {string} settingKey Key of the model ID in the chat completion settings
 * @property {string} [guess] Most advanced known model, whose settings custom IDs use
 * @property {boolean} [stripModelsPrefix] Removes a leading "models/" from typed IDs
 */

/** @type {CustomModelSelect[]} */
export const CUSTOM_MODEL_SELECTS = [
    { source: 'openai', selector: '#model_openai_select', settingKey: 'openai_model', guess: 'gpt-6-astra' },
    { source: 'claude', selector: '#model_claude_select', settingKey: 'claude_model', guess: 'claude-fable-5-1' },
    { source: 'makersuite', selector: '#model_google_select', settingKey: 'google_model', guess: 'gemini-3.8-flash', stripModelsPrefix: true },
    { source: 'vertexai', selector: '#model_vertexai_select', settingKey: 'vertexai_model', guess: 'gemini-3.8-flash', stripModelsPrefix: true },
    { source: 'ai21', selector: '#model_ai21_select', settingKey: 'ai21_model', guess: 'jamba-large' },
    { source: 'perplexity', selector: '#model_perplexity_select', settingKey: 'perplexity_model', guess: 'sonar-pro' },
    { source: 'cohere', selector: '#model_cohere_select', settingKey: 'cohere_model', guess: 'command-a-vision-07-2025' },
    { source: 'minimax', selector: '#model_minimax_select', settingKey: 'minimax_model', guess: 'MiniMax-M2.7' },
    { source: 'zai', selector: '#model_zai_select', settingKey: 'zai_model', guess: 'glm-5.2' },
    { source: 'groq', selector: '#model_groq_select', settingKey: 'groq_model' },
    { source: 'moonshot', selector: '#model_moonshot_select', settingKey: 'moonshot_model', guess: 'kimi-k2.5' },
];

/** @type {() => object} */
let getSettingsRef = () => null;

/**
 * Gets the definition of a model select.
 * @param {string|HTMLElement} select Select element or selector
 * @returns {CustomModelSelect|undefined} Definition, if the select supports custom models
 */
const getEntry = (select) => CUSTOM_MODEL_SELECTS.find(x => $(select).is(x.selector));

/**
 * Checks if a select element supports custom models.
 * @param {string|HTMLElement} select Select element or selector
 * @returns {boolean} True if custom models are supported
 */
export const isCustomModelSelect = (select) => !!getEntry(select);

/**
 * Gets the values of the listed (non-custom) model options of a select.
 * @param {string|HTMLElement} select Select element or selector
 * @returns {string[]} Listed model IDs
 */
export function getListedModelValues(select) {
    return $(select).find('option').map((_, o) => o.value).get().filter(x => x !== CUSTOM_MODEL_SENTINEL);
}

/**
 * Gets the model ID a model select currently stands for. With "Custom…" selected,
 * that's the saved custom model (or nothing if the saved model is a listed one).
 * @param {HTMLElement} select Model select element
 * @param {object} settings Chat completion settings
 * @returns {string} Model ID, or an empty string
 */
export function resolveSelectedModel(select, settings) {
    const value = String($(select).val() ?? '');
    if (value !== CUSTOM_MODEL_SENTINEL) {
        return value;
    }
    const saved = String(settings?.[getEntry(select)?.settingKey] ?? '');
    return getListedModelValues(select).includes(saved) ? '' : saved;
}

/**
 * Gets the model whose settings (context size, reasoning, image support, request parameters) apply
 * to the current model. A saved custom ID uses the source's most advanced known model; anything
 * else is its own model. The actual request always uses the real model ID.
 * @param {object} settings Chat completion settings
 * @param {string} model Current model ID
 * @returns {string} Model ID to use for capability checks
 */
export function resolveCapabilityModel(settings, model) {
    model = String(model ?? '');
    const entry = CUSTOM_MODEL_SELECTS.find(x => x.source === settings?.chat_completion_source);
    // Only the saved model counts, not other IDs passed with these settings (e.g. connection profiles)
    if (!entry?.guess || !model || model !== settings[entry.settingKey]) {
        return model;
    }
    const listed = getListedModelValues(entry.selector);
    return listed.length === 0 || listed.includes(model) ? model : entry.guess;
}

/**
 * Gets the custom model IDs used before with a source (settings `custom_models`: `{ [source]: string[] }`).
 * @param {object} settings Chat completion settings
 * @param {CustomModelSelect} entry Select definition
 * @returns {string[]} Model IDs
 */
const getRememberedModels = (settings, entry) => [].concat(lodash.get(settings, ['custom_models', entry?.source], []));

/**
 * Remembers a custom model ID. Listed models are not remembered.
 * @param {object} settings Chat completion settings
 * @param {CustomModelSelect} entry Select definition
 * @param {string} id Model ID
 */
function rememberCustomModel(settings, entry, id) {
    if (settings && id && !getListedModelValues(entry.selector).includes(id)) {
        lodash.set(settings, ['custom_models', entry.source], lodash.union(getRememberedModels(settings, entry), [id]));
    }
}

/**
 * Checks if a name is a custom model ID that was used before with this select.
 * @param {HTMLElement} select Model select element
 * @param {string} id Model ID
 * @returns {boolean} True if the ID is a remembered custom model
 */
export const isRememberedCustomModel = (select, id) => getRememberedModels(getSettingsRef(), getEntry(select)).includes(id);

/**
 * Shows the saved model in the select. A model that isn't a listed option is shown as "Custom…"
 * with the ID in the text box below. Does not trigger `change`.
 * @param {string} selector Select selector
 * @param {string} value Saved model ID
 */
export function syncCustomModelSelect(selector, value) {
    const $select = $(selector);
    if ($select.length === 0) {
        return;
    }

    // Dynamic lists (Groq, Moonshot) are emptied on connect, which drops the option
    if ($select.children(`option[value="${CUSTOM_MODEL_SENTINEL}"]`).length === 0) {
        $select.append(new Option('Custom…', CUSTOM_MODEL_SENTINEL));
    }

    value = String(value ?? '');
    const isCustom = !!value && !getListedModelValues($select).includes(value);
    if (value) {
        $select.val(isCustom ? CUSTOM_MODEL_SENTINEL : value);
    }

    const $editor = $(`${selector}_custom`);
    $editor.toggleClass('displayNone', $select.val() !== CUSTOM_MODEL_SENTINEL);
    if (isCustom) {
        $editor.find('input').val(value);
    }
}

/**
 * Syncs every custom-capable select with the given settings.
 * @param {object} settings Chat completion settings
 */
export function syncAllCustomModelSelects(settings) {
    for (const entry of CUSTOM_MODEL_SELECTS) {
        const id = String(settings[entry.settingKey] ?? '');
        rememberCustomModel(settings, entry, id);
        syncCustomModelSelect(entry.selector, id);
    }
}

/**
 * Selects a model ID in a custom-capable select and triggers `change` so the regular handler saves it.
 * A listed ID selects its option; anything else is saved as a custom model.
 * @param {HTMLElement} select Model select element
 * @param {string} value Model ID
 * @returns {string} The selected model ID, or an empty string if nothing was selected
 */
export function selectCustomModel(select, value) {
    const entry = getEntry(select);
    value = String(value ?? '').trim();
    if (entry?.stripModelsPrefix) {
        value = value.replace(/^models\//, '');
    }
    if (!entry || !value || value === CUSTOM_MODEL_SENTINEL) {
        return '';
    }

    if (getListedModelValues(select).includes(value)) {
        $(select).val(value).trigger('change');
        return value;
    }

    const settings = getSettingsRef();
    rememberCustomModel(settings, entry, value);
    // The change handler reads the model from the settings while "Custom…" is selected
    lodash.set(settings, entry.settingKey, value);
    syncCustomModelSelect(entry.selector, value);
    $(select).trigger('change');
    return value;
}

/**
 * Adds the "Custom…" option and text box to every supported select.
 * Must be called before the selects' `change` handlers are bound.
 * @param {() => object} getSettings Returns the current chat completion settings
 */
export function initCustomModelSelects(getSettings) {
    getSettingsRef = getSettings;
    for (const { selector, settingKey } of CUSTOM_MODEL_SELECTS) {
        const $select = $(selector);
        if ($select.length === 0) {
            continue;
        }

        const $input = $('<input type="text" class="text_pole flex1 margin0" autocomplete="off" spellcheck="false" placeholder="Enter a Model ID" data-i18n="[placeholder]Enter a Model ID">');
        const $editor = $(`<div id="${$select.attr('id')}_custom" class="flex-container marginTop5 displayNone"></div>`).append($input);
        $select.after($editor);
        syncCustomModelSelect(selector, getSettings()?.[settingKey]);

        // "Custom…" was picked (or restored for a saved custom model): show the text box.
        // The regular handler continues with the saved custom model, or ignores it if there is none.
        $select.on('change', function (event) {
            const isCustom = $select.val() === CUSTOM_MODEL_SENTINEL;
            $editor.toggleClass('displayNone', !isCustom);
            if (isCustom) {
                $input.val(resolveSelectedModel(this, getSettings()));
                !event.isTrigger && $input.trigger('focus');
            }
        });

        $input.on('change', () => selectCustomModel($select.get(0), String($input.val())) || syncCustomModelSelect(selector, getSettings()?.[settingKey]));
        $input.on('keydown', (event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                event.key === 'Enter' ? $input.trigger('change') : syncCustomModelSelect(selector, getSettings()?.[settingKey]);
            }
        });
    }
}
