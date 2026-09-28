import { DOMPurify } from '../lib.js';
import { isMobile } from './RossAscends-mods.js';
import { amount_gen, eventSource, event_types, getRequestHeaders, max_context, online_status, setGenerationParamsFromPreset } from '../script.js';
import { textgenerationwebui_settings as textgen_settings, textgen_types } from './textgen-settings.js';
import { tokenizers } from './tokenizers.js';
import { renderTemplateAsync } from './templates.js';
import { POPUP_TYPE, callGenericPopup } from './popup.js';
import { t } from './i18n.js';
import { accountStorage } from './util/AccountStorage.js';
import { localizePagination, PAGINATION_TEMPLATE, textValueMatcher } from './utils.js';
import { getOpenRouterServiceTierStates } from './openrouter-tiers.js';

let mancerModels = [];
let togetherModels = [];
let infermaticAIModels = [];
let dreamGenModels = [];
let vllmModels = [];
let aphroditeModels = [];
let featherlessModels = [];
let tabbyModels = [];
let llamacppModels = [];
export let openRouterModels = [];
const openRouterProviderSyncSeq = new Map();

/**
 * Endpoints last reported for the model of each provider selector.
 * Kept around so tier availability can be recomputed when the provider selection or the
 * fallback setting changes, without asking the backend again.
 * @type {Map<string, import('./openrouter-tiers.js').OpenRouterEndpoint[]>}
 */
const openRouterEndpointsForSelector = new Map();

/**
 * List of OpenRouter providers.
 * @type {string[]}
 */
const OPENROUTER_PROVIDERS = [
    // Providers endpoint: https://openrouter.ai/api/v1/providers
    // The list should resemble the sidebar from https://openrouter.ai/models
    // Their docs no longer displays the list, which had "super dead" ones at top, thankfully gone from /v1/providers
    'AI21',
    'AionLabs',
    'Alibaba',
    'AkashML',
    'Amazon Bedrock',
    'Amazon Nova',
    'Ambient',
    'Anthropic',
    'Arcee AI',
    'AtlasCloud',
    'Avian',
    'Azure',
    'Baidu',
    'BaseTen',
    'Black Forest Labs',
    'Cerebras',
    'Chutes',
    'Cirrascale',
    'Clarifai',
    'Cloudflare',
    'Cohere',
    'Crucible',
    'Crusoe',
    'DeepInfra',
    'DeepSeek',
    'DekaLLM',
    'FakeProvider',
    'Featherless',
    'Fireworks',
    'Friendli',
    'GMICloud',
    'Google',
    'Google AI Studio',
    'Groq',
    'Hyperbolic',
    'Inception',
    'Inceptron',
    'InferenceNet',
    'Infermatic',
    'Inflection',
    'Io Net',
    'Ionstream',
    'Liquid',
    'Mancer 2',
    'Mara',
    'Minimax',
    'Mistral',
    'ModelRun',
    'Modular',
    'Moonshot AI',
    'Morph',
    'NCompass',
    'Nebius',
    'Nex AGI',
    'NextBit',
    'Novita',
    'Nvidia',
    'OpenAI',
    'OpenInference',
    'Parasail',
    'Perceptron',
    'Perplexity',
    'Phala',
    'Poolside',
    'Recraft',
    'Reka',
    'Relace',
    'SambaNova',
    'Seed',
    'SiliconFlow',
    'Sourceful',
    'Stealth',
    'StepFun',
    'StreamLake',
    'Switchpoint',
    'Together',
    'Upstage',
    'Venice',
    'WandB',
    'xAI',
    'Xiaomi',
    'Z.AI',
];

/**
 * List of NanoGPT providers.
 * Providers endpoint: https://nano-gpt.com/api/models/providers
 * @type {{id: string, label: string}[]}
 */
const NANOGPT_PROVIDERS = [
    {
        'id': 'akash',
        'label': 'Akash',
    },
    {
        'id': 'alibaba',
        'label': 'Alibaba',
    },
    {
        'id': 'ambient',
        'label': 'Ambient',
    },
    {
        'id': 'arliai',
        'label': 'ArliAI',
    },
    {
        'id': 'atlascloud',
        'label': 'AtlasCloud',
    },
    {
        'id': 'azure',
        'label': 'Azure',
    },
    {
        'id': 'awsbedrock',
        'label': 'Amazon Bedrock',
    },
    {
        'id': 'baidu',
        'label': 'Baidu',
    },
    {
        'id': 'baseten',
        'label': 'BaseTen',
    },
    {
        'id': 'cerebras',
        'label': 'Cerebras',
    },
    {
        'id': 'chutes',
        'label': 'Chutes',
    },
    {
        'id': 'clarifai',
        'label': 'Clarifai',
    },
    {
        'id': 'cloudflare',
        'label': 'Cloudflare',
    },
    {
        'id': 'crusoe',
        'label': 'Crusoe',
    },
    {
        'id': 'dekallm',
        'label': 'DekaLLM',
    },
    {
        'id': 'deepinfra',
        'label': 'DeepInfra',
    },
    {
        'id': 'deepseek',
        'label': 'DeepSeek',
    },
    {
        'id': 'fireworks',
        'label': 'Fireworks',
    },
    {
        'id': 'friendli',
        'label': 'Friendli',
    },
    {
        'id': 'gmicloud',
        'label': 'GMICloud',
    },
    {
        'id': 'lilac',
        'label': 'Lilac',
    },
    {
        'id': 'google',
        'label': 'Google',
    },
    {
        'id': 'groq',
        'label': 'Groq',
    },
    {
        'id': 'hyperbolic',
        'label': 'Hyperbolic',
    },
    {
        'id': 'ionet',
        'label': 'io.net',
    },
    {
        'id': 'inceptron',
        'label': 'Inceptron',
    },
    {
        'id': 'mancer',
        'label': 'Mancer',
    },
    {
        'id': 'mara',
        'label': 'Mara',
    },
    {
        'id': 'meganova',
        'label': 'MegaNova',
    },
    {
        'id': 'minimax',
        'label': 'MiniMax',
    },
    {
        'id': 'modelrun',
        'label': 'ModelRun',
    },
    {
        'id': 'moonshot',
        'label': 'Moonshot',
    },
    {
        'id': 'morph',
        'label': 'Morph',
    },
    {
        'id': 'ncompass',
        'label': 'NCompass',
    },
    {
        'id': 'nebius',
        'label': 'Nebius',
    },
    {
        'id': 'neuralwatt',
        'label': 'NeuralWatt',
    },
    {
        'id': 'tensorix',
        'label': 'Tensorix',
    },
    {
        'id': 'nextbit',
        'label': 'NextBit',
    },
    {
        'id': 'novita',
        'label': 'Novita',
    },
    {
        'id': 'parasail',
        'label': 'Parasail',
    },
    {
        'id': 'phala',
        'label': 'Phala',
    },
    {
        'id': 'redpill',
        'label': 'Redpill',
    },
    {
        'id': 'sambanova',
        'label': 'SambaNova',
    },
    {
        'id': 'sambanova-high-throughput',
        'label': 'SambaNova (High Throughput)',
    },
    {
        'id': 'siliconflow',
        'label': 'SiliconFlow',
    },
    {
        'id': 'streamlake',
        'label': 'StreamLake',
    },
    {
        'id': 'tinfoil',
        'label': 'Tinfoil',
    },
    {
        'id': 'together',
        'label': 'Together',
    },
    {
        'id': 'uomi',
        'label': 'UOMI',
    },
    {
        'id': 'venice',
        'label': 'Venice',
    },
    {
        'id': 'wafer',
        'label': 'Wafer',
    },
    {
        'id': 'wandb',
        'label': 'Weights & Biases',
    },
    {
        'id': 'xiaomi',
        'label': 'Xiaomi',
    },
    {
        'id': 'zai',
        'label': 'Z.AI',
    },
];

const OPENROUTER_PROVIDER_WARNING_SELECTORS = {
    '#openrouter_providers_text': {
        fallbackSelector: '#openrouter_allow_fallbacks_textgenerationwebui',
        warningSelector: '#openrouter_provider_warning_text',
    },
    '#openrouter_providers_chat': {
        fallbackSelector: '#openrouter_allow_fallbacks',
        warningSelector: '#openrouter_provider_warning_chat',
        tiersSelector: '#openrouter_service_tier',
        tierNoteSelector: '#openrouter_service_tier_note',
        tierWarningSelector: '#openrouter_service_tier_warning',
    },
};

/**
 * User-facing names of the known service tiers.
 * @type {Record<string, () => string>}
 */
const OPENROUTER_SERVICE_TIER_LABELS = {
    standard: () => t`Default`,
    flex: () => t`Flex (cheap, slower)`,
    priority: () => t`Priority (fast, expensive)`,
};

/**
 * Short tier names, used where the full label would not fit, e.g. next to a provider.
 *
 * These are OpenRouter's own tier names, so they are deliberately not translated. The full labels
 * keep the tier name as-is too and only localize the description in brackets, and reusing the
 * generic `Priority` translation here would make the same tier read differently in the two places.
 * @type {Record<string, string>}
 */
const OPENROUTER_SERVICE_TIER_SHORT_LABELS = {
    flex: 'Flex',
    priority: 'Priority',
};

/** Tiers worth mentioning next to a provider, in display order. */
const OPENROUTER_ANNOTATED_SERVICE_TIERS = ['flex', 'priority'];

/**
 * Extra class on the tier heading icon while only fallback providers can serve the tier.
 *
 * That case is a caution rather than a failure: the request still gets the tier, just not from a
 * provider the user picked. The stylesheet colors the icon accordingly.
 */
const OPENROUTER_FALLBACK_ONLY_ICON_CLASS = 'fallback_only_warning';

/**
 * @param {string} tier Tier identifier
 * @returns {string} Localized tier name, falling back to the raw identifier
 */
function getOpenRouterServiceTierLabel(tier) {
    return OPENROUTER_SERVICE_TIER_LABELS[tier] ? OPENROUTER_SERVICE_TIER_LABELS[tier]() : tier;
}

/**
 * Builds a dropdown label that spells out how well the selected providers cover the tier, so an
 * offered tier never looks usable when it is not.
 *
 * `Default` is exempt: it only means "do not request a tier", so it stays plain (and enabled) even
 * when no endpoint serves the standard rates, and none of the coverage caveats apply to it either.
 * @param {import('./openrouter-tiers.js').OpenRouterServiceTierState} state Tier state
 * @returns {string} Localized label
 */
function getOpenRouterServiceTierOptionLabel(state) {
    const label = getOpenRouterServiceTierLabel(state.tier);

    if (state.tier === 'standard') {
        return label;
    }

    if (!state.available) {
        return t`${label} — currently unavailable`;
    }
    if (state.onlyFromFallback) {
        return t`${label} — supported by fallback providers only`;
    }
    if (state.partiallySupported) {
        return t`${label} — supported by some selected providers`;
    }

    return label;
}

/**
 * Describes what the selected tier will actually do, which matters most for flex: without an
 * eligible flex endpoint the request is served at standard rates instead.
 * @param {import('./openrouter-tiers.js').OpenRouterServiceTierState} [state] Selected tier state
 * @returns {string} Note text, or an empty string when there is nothing to explain
 */
function getOpenRouterServiceTierNote(state) {
    if (!state || state.tier === 'standard') {
        return '';
    }

    const label = getOpenRouterServiceTierLabel(state.tier);

    if (!state.available) {
        return t`${label} is not available for the current providers and model. Requests are served at standard rates.`;
    }
    if (state.onlyFromFallback) {
        return t`None of the selected providers offers ${label}. Because fallbacks are allowed, another provider may serve the request.`;
    }
    if (state.partiallySupported) {
        return t`${label} is only offered by: ${state.selectedProviders.join(', ')}.`;
    }

    return '';
}

/**
 * Decides how loudly the tier heading warns about the selected tier.
 *
 * Only the two states that change what the request ends up doing get an icon: a tier nothing can
 * serve, and a tier only fallback providers can serve. Partial coverage is the ordinary state of a
 * broad provider selection, so the note alone explains it and the icon keeps meaning "this costs
 * you something" instead of just "there is text below".
 * @param {import('./openrouter-tiers.js').OpenRouterServiceTierState} [state] Selected tier state
 * @returns {'unavailable' | 'fallback' | 'none'} Warning level
 */
function getOpenRouterServiceTierWarningLevel(state) {
    if (!state || state.tier === 'standard') {
        return 'none';
    }
    if (!state.available) {
        return 'unavailable';
    }
    if (state.onlyFromFallback) {
        return 'fallback';
    }

    return 'none';
}

/**
 * Shows what the selected tier will actually do: a note under the dropdown that always explains the
 * state, and an icon next to the heading when the tier is at risk — red when nothing can serve it,
 * yellow when only fallbacks can. Partial coverage keeps the note but gets no icon.
 * @param {string} providersSelector Provider selector the tiers belong to
 * @param {import('./openrouter-tiers.js').OpenRouterServiceTierState} [state] Selected tier state
 */
function updateOpenRouterServiceTierNote(providersSelector, state) {
    const selectors = OPENROUTER_PROVIDER_WARNING_SELECTORS[providersSelector];

    if (!selectors?.tierNoteSelector) {
        return;
    }

    const text = getOpenRouterServiceTierNote(state);
    const warningLevel = getOpenRouterServiceTierWarningLevel(state);

    $(selectors.tierNoteSelector).text(text).toggleClass('displayNone', !text);

    $(selectors.tierWarningSelector)
        .toggleClass('displayNone', warningLevel === 'none')
        .toggleClass(OPENROUTER_FALLBACK_ONLY_ICON_CLASS, warningLevel === 'fallback')
        // The icon has no room for an explanation of its own, so the note doubles as its tooltip.
        .attr('title', warningLevel === 'none' ? null : text);
}

/**
 * Builds the toast for a saved tier the current model cannot serve.
 *
 * Unlike the note under the dropdown this message has to stand on its own: the user may not be
 * looking at the API Connections panel, and may not know that the tier comes from OpenRouter, so
 * it names the setting and where to change it.
 * @param {import('./openrouter-tiers.js').OpenRouterServiceTierState} state Selected tier state
 * @returns {string} Localized warning text
 */
function getOpenRouterUnavailableServiceTierWarning(state) {
    const label = getOpenRouterServiceTierLabel(state.tier);

    return t`The selected OpenRouter service tier, ${label}, is not available for the current providers and model. Requests are served at standard rates. You can change the service tier in the API Connections menu.`;
}

/**
 * Reports a tier that has just stopped being servable, so the request does not quietly fall back to
 * standard rates without the user noticing.
 *
 * Warning on the change, rather than on every evaluation, is what keeps it from repeating while the
 * situation stays the same, and it comes back if the tier works again and later breaks again. The
 * provider list needs this in particular: its dropdown covers the tier control while it is open, so a
 * provider click that drops the tier would otherwise stay invisible until the dropdown is closed.
 *
 * What was known last time is remembered on the dropdown itself, so it is forgotten with the panel
 * and cannot outlive it.
 * @param {JQuery<HTMLSelectElement>} $tiers Tier dropdown
 * @param {import('./openrouter-tiers.js').OpenRouterServiceTierState} [state] Selected tier state
 */
function warnAboutUnavailableServiceTier($tiers, state) {
    if (!state || state.tier === 'standard') {
        return;
    }

    const previous = $tiers.data('serviceTierAvailability');
    // Nothing remembered counts as servable: both a first look and a tier this dropdown has not
    // judged before mean the user has not been told about the situation yet.
    const wasServable = !previous || previous.tier !== state.tier || previous.available;
    const hasStoppedBeingServable = !state.available && wasServable;

    $tiers.data('serviceTierAvailability', { tier: state.tier, available: state.available });

    if (hasStoppedBeingServable) {
        toastr.warning(getOpenRouterUnavailableServiceTierWarning(state));
    }
}

/**
 * Collects the non-default service tiers each provider serves for a model.
 * @param {import('./openrouter-tiers.js').OpenRouterEndpoint[] | null | undefined} endpoints Endpoints
 * @returns {Map<string, string[]>} Provider name to the tiers it serves, in display order
 */
function getOpenRouterProviderTiers(endpoints) {
    /** @type {Map<string, Set<string>>} */
    const tiersByProvider = new Map();

    if (!Array.isArray(endpoints)) {
        return new Map();
    }

    for (const endpoint of endpoints) {
        if (!endpoint?.provider || endpoint.online === false) {
            continue;
        }
        if (!OPENROUTER_ANNOTATED_SERVICE_TIERS.includes(endpoint.tier)) {
            continue;
        }
        if (!tiersByProvider.has(endpoint.provider)) {
            tiersByProvider.set(endpoint.provider, new Set());
        }
        tiersByProvider.get(endpoint.provider).add(endpoint.tier);
    }

    return new Map([...tiersByProvider].map(([provider, tiers]) => [
        provider,
        OPENROUTER_ANNOTATED_SERVICE_TIERS.filter(tier => tiers.has(tier)),
    ]));
}

/**
 * Replaces an option element with an identical one carrying a new label.
 *
 * select2 remembers the data it rendered for an option on the option element itself, so rewriting
 * the text of an existing option never reaches the dropdown or its tags. Recreating the element is
 * the only way to make it read the label again without reaching into select2 internals.
 *
 * The replacement is inserted in place, so the order of the options (selected providers are moved
 * to the end of the list) is preserved, and value, selection and disabled state are copied over
 * explicitly. Cloning must not be used: select2 marks up the elements it has already read, and a
 * clone would inherit that mark and keep rendering the old label.
 *
 * The discarded element leaves its cache entry behind, since select2 only clears those when it is
 * itself destroyed. One entry per relabelled option is not worth reaching into the library to purge.
 * @param {JQuery<HTMLOptionElement>} $option Option to relabel
 * @param {string} label New option label
 */
function setOpenRouterProviderOptionLabel($option, label) {
    if ($option.text() === label) {
        return;
    }

    const isSelected = $option.prop('selected');
    const $replacement = $('<option>', {
        value: String($option.val()),
        text: label,
        disabled: $option.prop('disabled'),
    }).insertBefore($option);

    $replacement.prop('selected', isSelected);
    $option.remove();
}

/**
 * Appends the service tiers a provider serves to its option label, e.g. `Google (Flex, Priority)`.
 * Providers that serve no such tier keep their plain name. Option values are left untouched.
 *
 * Only annotated where a service tier can actually be selected, so the hint is never shown next
 * to a dropdown that cannot act on it.
 * @param {string} providersSelector Provider selector to update
 */
function updateOpenRouterProviderTierLabels(providersSelector) {
    const selectors = OPENROUTER_PROVIDER_WARNING_SELECTORS[providersSelector];

    if (!selectors?.tiersSelector) {
        return;
    }

    const $providers = $(providersSelector);

    if ($providers.length === 0) {
        return;
    }

    const tiersByProvider = getOpenRouterProviderTiers(openRouterEndpointsForSelector.get(providersSelector));

    $providers.find('option').each(function () {
        const provider = String($(this).val());
        const tiers = tiersByProvider.get(provider) ?? [];
        const tierNames = tiers.map(tier => OPENROUTER_SERVICE_TIER_SHORT_LABELS[tier] ?? tier);

        setOpenRouterProviderOptionLabel($(this), tierNames.length > 0 ? t`${provider} (${tierNames.join(', ')})` : provider);
    });
}

/**
 * Rebuilds the service tier dropdown from the endpoints already known for a provider selector.
 *
 * This never writes to the settings. A saved tier stays selected even when the current model
 * cannot serve it, so switching models back and forth cannot silently discard the preference.
 * Only the user changing the dropdown updates the setting.
 * @param {string} providersSelector Provider selector the tiers belong to
 * @param {string} [selectedTier] Tier saved in the settings
 * @returns {import('./openrouter-tiers.js').OpenRouterServiceTierState[] | null} Tier states, if any
 */
export function refreshOpenRouterServiceTierOptions(providersSelector, selectedTier = '') {
    const selectors = OPENROUTER_PROVIDER_WARNING_SELECTORS[providersSelector];
    const tiersSelector = selectors?.tiersSelector;

    if (!tiersSelector) {
        return null;
    }

    const $tiers = $(tiersSelector);
    if ($tiers.length === 0) {
        return null;
    }

    const selectedProviders = $(providersSelector).val();
    const states = getOpenRouterServiceTierStates(openRouterEndpointsForSelector.get(providersSelector), {
        selectedProviders: Array.isArray(selectedProviders) ? selectedProviders.map(String) : [],
        allowFallbacks: !!$(selectors.fallbackSelector).prop('checked'),
        selectedTier,
    });

    $tiers.empty();
    for (const state of states) {
        $tiers.append($('<option>', {
            value: state.tier === 'standard' ? '' : state.tier,
            text: getOpenRouterServiceTierOptionLabel(state),
            // The default option only means "do not request a tier", so it is never disabled.
            disabled: state.tier !== 'standard' && !state.available,
        }));
    }

    // Select the saved tier on the option element itself. jQuery's .val() deliberately ignores
    // disabled options, which is exactly the state a saved-but-unavailable tier is in.
    let hasSelection = false;
    $tiers.find('option').each(function () {
        this.selected = this.value === selectedTier;
        hasSelection = hasSelection || this.selected;
    });
    if (!hasSelection) {
        $tiers.find('option').first().prop('selected', true);
    }

    const selectedState = states.find(state => state.tier === selectedTier);
    updateOpenRouterServiceTierNote(providersSelector, selectedState);
    warnAboutUnavailableServiceTier($tiers, selectedState);

    return states;
}

export function updateOpenRouterProvidersWarning(providersSelector) {
    const $providers = $(providersSelector);

    const warningSelectors = OPENROUTER_PROVIDER_WARNING_SELECTORS[providersSelector];

    if ($providers.length === 0 || !warningSelectors) {
        return;
    }

    const $fallback = $(warningSelectors.fallbackSelector);
    const $warning = $(warningSelectors.warningSelector);

    const allowFallback = !!$fallback.prop('checked');
    const selectedCount = $providers.find('option:selected').length;
    const applicableSelectedCount = $providers.find('option:selected:not(:disabled)').length;
    const showWarning = !allowFallback && selectedCount > 0 && applicableSelectedCount === 0;

    $warning.toggleClass('displayNone', !showWarning);
}

/**
 * Loads the providers and service tiers offered for a model.
 *
 * The loaded endpoints are remembered so tier availability can be refreshed on its own when the
 * provider selection or the fallback setting changes.
 * @param {string} modelId OpenRouter model identifier
 * @param {string} providersSelector Provider selector to update
 * @param {Object} [options] Sync options
 * @param {string} [options.selectedTier] Tier saved in the settings, kept selected after the update
 * @returns {Promise<void>}
 */
export async function syncOpenRouterProvidersForModel(modelId, providersSelector, { selectedTier = '' } = {}) {
    const $providers = $(providersSelector);
    const seq = (openRouterProviderSyncSeq.get(providersSelector) || 0) + 1;
    openRouterProviderSyncSeq.set(providersSelector, seq);

    const refreshWarningState = () => {
        updateOpenRouterProvidersWarning(providersSelector);
    };

    const refreshTierState = () => {
        refreshOpenRouterServiceTierOptions(providersSelector, selectedTier);
    };

    const forgetEndpoints = () => {
        openRouterEndpointsForSelector.delete(providersSelector);
    };

    if (!modelId || !modelId.includes('/')) {
        forgetEndpoints();
        $providers.find('option').prop('disabled', false);
        updateOpenRouterProviderTierLabels(providersSelector);
        $providers.trigger('change.select2');
        refreshTierState();
        refreshWarningState();
        return;
    }

    try {
        const response = await fetch('/api/openrouter/models/providers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ model: modelId }),
        });

        if (openRouterProviderSyncSeq.get(providersSelector) !== seq) return;

        if (!response.ok) {
            forgetEndpoints();
            updateOpenRouterProviderTierLabels(providersSelector);
            $providers.trigger('change.select2');
            refreshTierState();
            refreshWarningState();
            return;
        }

        const data = await response.json();
        if (openRouterProviderSyncSeq.get(providersSelector) !== seq) return;

        // Tolerate the legacy array-only response shape.
        const payload = Array.isArray(data) ? { providers: data, endpoints: [] } : data;
        const providerNames = payload?.providers;
        const endpoints = Array.isArray(payload?.endpoints) ? payload.endpoints : null;

        if (!Array.isArray(providerNames) || providerNames.length === 0) {
            forgetEndpoints();
            $providers.find('option').prop('disabled', false);
            updateOpenRouterProviderTierLabels(providersSelector);
            $providers.trigger('change.select2');
            refreshTierState();
            refreshWarningState();
            return;
        }

        openRouterEndpointsForSelector.set(providersSelector, endpoints);

        $providers.find('option').each(function () {
            const isAvailable = providerNames.includes($(this).val());
            $(this).prop('disabled', !isAvailable);
        });

        updateOpenRouterProviderTierLabels(providersSelector);
        $providers.trigger('change.select2');
        refreshTierState();
        refreshWarningState();
    } catch (error) {
        if (openRouterProviderSyncSeq.get(providersSelector) !== seq) return;
        console.error('Failed to fetch OpenRouter providers for model', error);
        forgetEndpoints();
        updateOpenRouterProviderTierLabels(providersSelector);
        $providers.trigger('change.select2');
        refreshTierState();
        refreshWarningState();
    }
}

export async function syncNanoGptProvidersForModel(modelId, providersSelector) {
    const $providers = $(providersSelector);

    const refreshWarningState = () => {
        updateNanoGptProvidersWarning(providersSelector);
    };

    if (!modelId) {
        $providers.find('option').prop('disabled', false);
        $providers.trigger('change.select2');
        refreshWarningState();
        return;
    }

    try {
        const response = await fetch('/api/nanogpt/models/providers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ model: modelId }),
        });

        if (!response.ok) {
            refreshWarningState();
            return;
        }

        const data = await response.json();
        const providerIds = Array.isArray(data?.providers) ? data.providers : [];

        if (!data?.supportsProviderSelection || providerIds.length === 0) {
            $providers.find('option').each(function () {
                $(this).prop('disabled', Boolean($(this).val()));
            });
            $providers.trigger('change').trigger('change.select2');
            refreshWarningState();
            return;
        }

        $providers.find('option').each(function () {
            const value = $(this).val();
            const isAvailable = !value || providerIds.includes(value);
            $(this).prop('disabled', !isAvailable);
        });

        $providers.trigger('change.select2');
        refreshWarningState();
    } catch (error) {
        console.error('Failed to fetch NanoGPT providers for model', error);
        refreshWarningState();
    }
}

export function updateNanoGptProvidersWarning(providersSelector) {
    const $providers = $(providersSelector);

    if ($providers.length === 0) {
        return;
    }

    const selectedCount = $providers.find('option:selected').length;
    const applicableSelectedCount = $providers.find('option:selected:not(:disabled)').length;
    const showWarning = selectedCount > 0 && applicableSelectedCount === 0;

    $('#nanogpt_provider_warning').toggleClass('displayNone', !showWarning);
}

export async function loadOllamaModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Ollama models data', data);
        return;
    }

    if (!data.find(x => x.id === textgen_settings.ollama_model)) {
        textgen_settings.ollama_model = data[0]?.id || '';
    }

    $('#ollama_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.name;
        option.selected = model.id === textgen_settings.ollama_model;
        $('#ollama_model').append(option);
    }
}

export async function loadTabbyModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Tabby models data', data);
        return;
    }

    tabbyModels = data;
    tabbyModels.sort((a, b) => a.id.localeCompare(b.id));
    tabbyModels.unshift({ id: '' });

    if (!tabbyModels.find(x => x.id === textgen_settings.tabby_model)) {
        textgen_settings.tabby_model = tabbyModels[0]?.id || '';
    }

    $('#tabby_model').empty();
    for (const model of tabbyModels) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.tabby_model;
        $('#tabby_model').append(option);
    }
}

export async function loadLlamaCppModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid llama.cpp models data', data);
        return;
    }

    llamacppModels = data;
    llamacppModels.sort((a, b) => a.id.localeCompare(b.id));
    llamacppModels.unshift({ id: '' });

    if (!llamacppModels.find(x => x.id === textgen_settings.llamacpp_model)) {
        textgen_settings.llamacpp_model = llamacppModels[0]?.id || '';
    }

    $('#llamacpp_model').empty();
    for (const model of llamacppModels) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.llamacpp_model;
        $('#llamacpp_model').append(option);
    }
}

export async function loadTogetherAIModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Together AI models data', data);
        return;
    }

    data.sort((a, b) => a.id.localeCompare(b.id));
    togetherModels = data;

    if (!data.find(x => x.id === textgen_settings.togetherai_model)) {
        textgen_settings.togetherai_model = data[0]?.id || '';
    }

    $('#model_togetherai_select').empty();
    for (const model of data) {
        // Hey buddy, I think you've got the wrong door.
        if (model.type === 'image') {
            continue;
        }

        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.display_name;
        option.selected = model.id === textgen_settings.togetherai_model;
        $('#model_togetherai_select').append(option);
    }
}

export async function loadInfermaticAIModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Infermatic AI models data', data);
        return;
    }

    data.sort((a, b) => a.id.localeCompare(b.id));
    infermaticAIModels = data;

    if (!data.find(x => x.id === textgen_settings.infermaticai_model)) {
        textgen_settings.infermaticai_model = data[0]?.id || '';
    }

    $('#model_infermaticai_select').empty();
    for (const model of data) {
        if (model.display_type === 'image') {
            continue;
        }

        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.infermaticai_model;
        $('#model_infermaticai_select').append(option);
    }
}

export function loadGenericModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Generic models data', data);
        return;
    }

    const models = data
        .filter(model => model && typeof model.id === 'string' && model.id.length > 0)
        .sort((a, b) => a.id.localeCompare(b.id));

    const dataList = $('#generic_model_fill');
    dataList.empty();

    const modelSelect = $('#generic_model_select');
    modelSelect.empty();
    modelSelect.append($('<option>', { value: '' }));

    for (const model of models) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        dataList.append(option);

        const selectOption = document.createElement('option');
        selectOption.value = model.id;
        selectOption.text = model.id;
        selectOption.selected = model.id === textgen_settings.generic_model;
        modelSelect.append(selectOption);
    }

    // Keep free-text entry for IDs that are not in the /v1/models list
    if (textgen_settings.generic_model && !models.find(x => x.id === textgen_settings.generic_model)) {
        modelSelect.append($('<option>', {
            value: textgen_settings.generic_model,
            text: textgen_settings.generic_model,
            selected: true,
        }));
    }
}

export async function loadDreamGenModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid DreamGen models data', data);
        return;
    }

    dreamGenModels = data;

    if (!data.find(x => x.id === textgen_settings.dreamgen_model)) {
        textgen_settings.dreamgen_model = data[0]?.id || '';
    }

    $('#model_dreamgen_select').empty();
    for (const model of data) {
        if (model.display_type === 'image') {
            continue;
        }

        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.dreamgen_model;
        $('#model_dreamgen_select').append(option);
    }
}

export async function loadMancerModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Mancer models data', data);
        return;
    }

    data.sort((a, b) => a.name.localeCompare(b.name));
    mancerModels = data;

    if (!data.find(x => x.id === textgen_settings.mancer_model)) {
        textgen_settings.mancer_model = data[0]?.id || '';
    }

    $('#mancer_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.name;
        option.selected = model.id === textgen_settings.mancer_model;
        $('#mancer_model').append(option);
    }
}

export async function loadOpenRouterModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid OpenRouter models data', data);
        return;
    }

    data.sort((a, b) => a.name.localeCompare(b.name));
    openRouterModels = data;

    if (!data.find(x => x.id === textgen_settings.openrouter_model)) {
        textgen_settings.openrouter_model = data[0]?.id || '';
    }

    $('#openrouter_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.name;
        option.selected = model.id === textgen_settings.openrouter_model;
        $('#openrouter_model').append(option);
    }

    // Calculate the cost of the selected model + update on settings change
    calculateOpenRouterCost();
    syncOpenRouterProvidersForModel(textgen_settings.openrouter_model, '#openrouter_providers_text');
}

export async function loadVllmModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid vLLM models data', data);
        return;
    }

    vllmModels = data;

    if (!data.find(x => x.id === textgen_settings.vllm_model)) {
        textgen_settings.vllm_model = data[0]?.id || '';
    }

    $('#vllm_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.vllm_model;
        $('#vllm_model').append(option);
    }
}

export async function loadAphroditeModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Aphrodite models data', data);
        return;
    }

    aphroditeModels = data;

    if (!data.find(x => x.id === textgen_settings.aphrodite_model)) {
        textgen_settings.aphrodite_model = data[0]?.id || '';
    }

    $('#aphrodite_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.aphrodite_model;
        $('#aphrodite_model').append(option);
    }
}

let featherlessCurrentPage = 1;
export async function loadFeatherlessModels(data) {
    const searchBar = document.getElementById('featherless_model_search_bar');
    const modelCardBlock = document.getElementById('featherless_model_card_block');
    const paginationContainer = $('#featherless_model_pagination_container');
    const sortOrderSelect = document.getElementById('featherless_model_sort_order');
    const classSelect = document.getElementById('featherless_class_selection');
    const categoriesSelect = document.getElementById('featherless_category_selection');
    const storageKey = 'FeatherlessModels_PerPage';

    // Store the original models data for search and filtering
    let originalModels = [];

    if (!Array.isArray(data)) {
        console.error('Invalid Featherless models data', data);
        return;
    }

    originalModels = data;  // Store the original data for search
    featherlessModels = data;

    if (!data.find(x => x.id === textgen_settings.featherless_model)) {
        textgen_settings.featherless_model = data[0]?.id || '';
    }

    // Populate class select options with unique classes
    populateClassSelection(data);

    // Retrieve the stored number of items per page or default to 10
    const perPage = Number(accountStorage.getItem(storageKey)) || 10;

    // Initialize pagination
    applyFiltersAndSort();

    // Function to set up pagination (also used for filtered results)
    function setupPagination(models, perPage, pageNumber = featherlessCurrentPage) {
        paginationContainer.pagination({
            dataSource: models,
            pageSize: perPage,
            pageNumber: pageNumber,
            sizeChangerOptions: [6, 10, 26, 50, 100, 250, 500, 1000],
            pageRange: 1,
            showPageNumbers: true,
            showSizeChanger: false,
            prevText: '<',
            nextText: '>',
            formatNavigator: PAGINATION_TEMPLATE,
            showNavigator: true,
            callback: function (modelsOnPage, pagination) {
                modelCardBlock.innerHTML = '';

                modelsOnPage.forEach(model => {
                    const card = document.createElement('div');
                    card.classList.add('model-card');

                    const modelNameContainer = document.createElement('div');
                    modelNameContainer.classList.add('model-name-container');

                    const modelTitle = document.createElement('div');
                    modelTitle.classList.add('model-title');
                    modelTitle.textContent = model.id.replace(/_/g, '_\u200B');
                    modelNameContainer.appendChild(modelTitle);

                    const detailsContainer = document.createElement('div');
                    detailsContainer.classList.add('details-container');

                    const modelClassDiv = document.createElement('div');
                    modelClassDiv.classList.add('model-class');
                    modelClassDiv.textContent = t`Class` + `: ${model.model_class || 'N/A'}`;

                    const contextLengthDiv = document.createElement('div');
                    contextLengthDiv.classList.add('model-context-length');
                    contextLengthDiv.textContent = t`Context Length` + `: ${model.context_length}`;

                    const dateAddedDiv = document.createElement('div');
                    dateAddedDiv.classList.add('model-date-added');
                    dateAddedDiv.textContent = t`Added On` + `: ${new Date(model.created * 1000).toLocaleDateString()}`;

                    detailsContainer.appendChild(modelClassDiv);
                    detailsContainer.appendChild(contextLengthDiv);
                    detailsContainer.appendChild(dateAddedDiv);

                    card.appendChild(modelNameContainer);
                    card.appendChild(detailsContainer);

                    modelCardBlock.appendChild(card);

                    if (model.id === textgen_settings.featherless_model) {
                        card.classList.add('selected');
                    }

                    card.addEventListener('click', function () {
                        document.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
                        card.classList.add('selected');
                        onFeatherlessModelSelect(model.id);
                    });
                });

                // Update the current page value whenever the page changes
                featherlessCurrentPage = pagination.pageNumber;
                localizePagination(paginationContainer);
            },
            afterSizeSelectorChange: function (e) {
                const newPerPage = e.target.value;
                accountStorage.setItem(storageKey, newPerPage);
                setupPagination(models, Number(newPerPage), featherlessCurrentPage); // Use the stored current page number
            },
        });
    }

    // Unset previously added listeners
    $(searchBar).off('input');
    $(sortOrderSelect).off('change');
    $(classSelect).off('change');
    $(categoriesSelect).off('change');

    // Add event listener for input on the search bar
    searchBar.addEventListener('input', function () {
        applyFiltersAndSort();
    });

    // Add event listener for the sort order select
    sortOrderSelect.addEventListener('change', function () {
        applyFiltersAndSort();
    });

    // Add event listener for the class select
    classSelect.addEventListener('change', function () {
        applyFiltersAndSort();
    });

    categoriesSelect.addEventListener('change', function () {
        applyFiltersAndSort();
    });

    // Function to populate class selection dropdown
    function populateClassSelection(models) {
        const uniqueClasses = [...new Set(models.map(model => model.model_class).filter(Boolean))];  // Get unique class names
        uniqueClasses.sort((a, b) => a.localeCompare(b));
        uniqueClasses.forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            classSelect.appendChild(option);
        });
    }

    // Function to apply sorting and filtering based on user input
    async function applyFiltersAndSort() {
        if (!(searchBar instanceof HTMLInputElement) ||
            !(sortOrderSelect instanceof HTMLSelectElement) ||
            !(classSelect instanceof HTMLSelectElement) ||
            !(categoriesSelect instanceof HTMLSelectElement)) {
            return;
        }
        const searchQuery = searchBar.value.toLowerCase();
        const selectedSortOrder = sortOrderSelect.value;
        const selectedClass = classSelect.value;
        const selectedCategory = categoriesSelect.value;
        let featherlessTop = [];
        let featherlessNew = [];

        if (selectedCategory === 'Top') {
            featherlessTop = await fetchFeatherlessStats();
        }
        const featherlessIds = featherlessTop.map(stat => stat.id);

        if (selectedCategory === 'New') {
            featherlessNew = await fetchFeatherlessNew();
        }
        const featherlessNewIds = featherlessNew.map(stat => stat.id);

        let filteredModels = originalModels.filter(model => {
            const matchesSearch = model.id.toLowerCase().includes(searchQuery);
            const matchesClass = selectedClass ? model.model_class === selectedClass : true;
            const matchesTop = featherlessIds.includes(model.id);
            const matchesNew = featherlessNewIds.includes(model.id);

            if (selectedCategory === 'All') {
                return matchesSearch && matchesClass;
            } else if (selectedCategory === 'Top') {
                return matchesSearch && matchesClass && matchesTop;
            } else if (selectedCategory === 'New') {
                return matchesSearch && matchesClass && matchesNew;
            } else {
                return matchesSearch && matchesClass;
            }
        });

        if (selectedSortOrder === 'asc') {
            filteredModels.sort((a, b) => a.id.localeCompare(b.id));
        } else if (selectedSortOrder === 'desc') {
            filteredModels.sort((a, b) => b.id.localeCompare(a.id));
        } else if (selectedSortOrder === 'date_asc') {
            filteredModels.sort((a, b) => a.created - b.created);
        } else if (selectedSortOrder === 'date_desc') {
            filteredModels.sort((a, b) => b.created - a.created);
        }

        const currentModelIndex = filteredModels.findIndex(x => x.id === textgen_settings.featherless_model);
        featherlessCurrentPage = currentModelIndex >= 0 ? (currentModelIndex / perPage) + 1 : 1;

        setupPagination(filteredModels, Number(accountStorage.getItem(storageKey)) || perPage, featherlessCurrentPage);
    }

    // Required to keep the /model command function
    $('#featherless_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.featherless_model;
        $('#featherless_model').append(option);
    }
}

async function fetchFeatherlessStats() {
    const response = await fetch('https://api.featherless.ai/feather/popular');
    const data = await response.json();
    return data.popular;
}

async function fetchFeatherlessNew() {
    const response = await fetch('https://api.featherless.ai/feather/models?sort=-created_at&perPage=20');
    const data = await response.json();
    return data.items;
}

function onFeatherlessModelSelect(modelId) {
    const model = featherlessModels.find(x => x.id === modelId);
    textgen_settings.featherless_model = modelId;
    $('#featherless_model').val(modelId);
    $('#api_button_textgenerationwebui').trigger('click');
    setGenerationParamsFromPreset({ max_length: model.context_length });
}

let featherlessIsGridView = false;  // Default state set to grid view

// Ensure the correct initial view is applied when the page loads
document.addEventListener('DOMContentLoaded', function () {
    const modelCardBlock = document.getElementById('featherless_model_card_block');
    modelCardBlock.classList.add('list-view');

    const toggleButton = document.getElementById('featherless_model_grid_toggle');
    toggleButton.addEventListener('click', function () {
        // Toggle between grid and list view
        if (featherlessIsGridView) {
            modelCardBlock.classList.remove('grid-view');
            modelCardBlock.classList.add('list-view');
            this.title = 'Toggle to grid view';
        } else {
            modelCardBlock.classList.remove('list-view');
            modelCardBlock.classList.add('grid-view');
            this.title = 'Toggle to list view';
        }

        featherlessIsGridView = !featherlessIsGridView;
    });
});
function onMancerModelSelect() {
    const modelId = String($('#mancer_model').val());
    textgen_settings.mancer_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');

    const limits = mancerModels.find(x => x.id === modelId)?.limits;
    setGenerationParamsFromPreset({ max_length: limits.context });
}

function onTogetherModelSelect() {
    const modelName = String($('#model_togetherai_select').val());
    textgen_settings.togetherai_model = modelName;
    $('#api_button_textgenerationwebui').trigger('click');
    const model = togetherModels.find(x => x.id === modelName);
    setGenerationParamsFromPreset({ max_length: model.context_length });
}

function onInfermaticAIModelSelect() {
    const modelName = String($('#model_infermaticai_select').val());
    textgen_settings.infermaticai_model = modelName;
    $('#api_button_textgenerationwebui').trigger('click');
    const model = infermaticAIModels.find(x => x.id === modelName);
    setGenerationParamsFromPreset({ max_length: model.context_length });
}

function onDreamGenModelSelect() {
    const modelName = String($('#model_dreamgen_select').val());
    textgen_settings.dreamgen_model = modelName;
    $('#api_button_textgenerationwebui').trigger('click');
    // TODO(DreamGen): Consider retuning max_tokens from API and setting it here.
}

function onOllamaModelSelect() {
    const modelId = String($('#ollama_model').val());
    textgen_settings.ollama_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
}

function onTabbyModelSelect() {
    const modelId = String($('#tabby_model').val());
    textgen_settings.tabby_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
}

function onLlamaCppModelSelect() {
    const modelId = String($('#llamacpp_model').val());
    textgen_settings.llamacpp_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
}

function onGenericModelSelect() {
    const modelId = String($('#generic_model_select').val() ?? '');
    textgen_settings.generic_model = modelId;
    $('#generic_model_textgenerationwebui').val(modelId);
    $('#api_button_textgenerationwebui').trigger('click');
}

function onOpenRouterModelSelect() {
    const modelId = String($('#openrouter_model').val());
    textgen_settings.openrouter_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
    const model = openRouterModels.find(x => x.id === modelId);
    syncOpenRouterProvidersForModel(modelId, '#openrouter_providers_text');
    setGenerationParamsFromPreset({ max_length: model.context_length });
}

function onVllmModelSelect() {
    const modelId = String($('#vllm_model').val());
    textgen_settings.vllm_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
}

function onAphroditeModelSelect() {
    const modelId = String($('#aphrodite_model').val());
    textgen_settings.aphrodite_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
}

function getMancerModelTemplate(option) {
    const model = mancerModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    const creditsPerPrompt = (model.limits?.context - model.limits?.completion) * model.pricing?.prompt;
    const creditsPerCompletion = model.limits?.completion * model.pricing?.completion;
    const creditsTotal = Math.round(creditsPerPrompt + creditsPerCompletion).toFixed(0);

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.name)}</strong> | <span>${model.limits?.context} ctx</span> / <span>${model.limits?.completion} res</span> | <small>Credits per request (max): ${creditsTotal}</small></div>
        </div>
    `));
}

function getTogetherModelTemplate(option) {
    const model = togetherModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.id)}</strong> | <span>${model.context_length || '???'} tokens</span></div>
            <div><small>${DOMPurify.sanitize(model.description)}</small></div>
        </div>
    `));
}

function getInfermaticAIModelTemplate(option) {
    const model = infermaticAIModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.id)}</strong></div>
        </div>
    `));
}

function getDreamGenModelTemplate(option) {
    const model = dreamGenModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.id)}</strong></div>
        </div>
    `));
}

function getOpenRouterModelTemplate(option) {
    const model = openRouterModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    let tokens_dollar = Number(1 / (1000 * model.pricing?.prompt));
    let tokens_rounded = (Math.round(tokens_dollar * 1000) / 1000).toFixed(0);

    const price = 0 === Number(model.pricing?.prompt) ? 'Free' : `${tokens_rounded}k t/$ `;

    return $((`
        <div class="flex-container flexFlowColumn" title="${DOMPurify.sanitize(model.id)}">
            <div><strong>${DOMPurify.sanitize(model.name)}</strong> | ${model.context_length} ctx | <small>${price}</small></div>
        </div>
    `));
}

function getVllmModelTemplate(option) {
    const model = vllmModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.id)}</strong></div>
        </div>
    `));
}

function getAphroditeModelTemplate(option) {
    const model = aphroditeModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.id)}</strong></div>
        </div>
    `));
}

async function downloadOllamaModel() {
    try {
        const serverUrl = textgen_settings.server_urls[textgen_types.OLLAMA];

        if (!serverUrl) {
            toastr.info('Please connect to an Ollama server first.');
            return;
        }

        const html = `Enter a model tag, for example <code>llama2:latest</code>.<br>
        See <a target="_blank" href="https://ollama.ai/library">Library</a> for available models.`;
        const name = await callGenericPopup(html, POPUP_TYPE.INPUT, '', { okButton: 'Download' });

        if (!name) {
            return;
        }

        toastr.info('Download may take a while, please wait...', 'Working on it');

        const response = await fetch('/api/backends/text-completions/ollama/download', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                name: name,
                api_server: serverUrl,
            }),
        });

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        // Force refresh the model list
        toastr.success('Download complete. Please select the model from the dropdown.');
        $('#api_button_textgenerationwebui').trigger('click');
    } catch (err) {
        console.error(err);
        toastr.error('Failed to download Ollama model. Please try again.');
    }
}

async function downloadTabbyModel() {
    try {
        const serverUrl = textgen_settings.server_urls[textgen_types.TABBY];

        if (online_status === 'no_connection' || !serverUrl) {
            toastr.info('Please connect to a TabbyAPI server first.');
            return;
        }

        const downloadHtml = $(await renderTemplateAsync('tabbyDownloader'));
        const popupResult = await callGenericPopup(downloadHtml, POPUP_TYPE.CONFIRM, '', { okButton: 'Download', cancelButton: 'Cancel' });

        // User cancelled the download
        if (!popupResult) {
            return;
        }

        const repoId = downloadHtml.find('input[name="hf_repo_id"]').val().toString();
        if (!repoId) {
            toastr.error('A HuggingFace repo ID must be provided. Skipping Download.');
            return;
        }

        if (repoId.split('/').length !== 2) {
            toastr.error('A HuggingFace repo ID must be formatted as Author/Name. Please try again.');
            return;
        }

        const params = {
            repo_id: repoId,
            folder_name: downloadHtml.find('input[name="folder_name"]').val() || undefined,
            revision: downloadHtml.find('input[name="revision"]').val() || undefined,
            token: downloadHtml.find('input[name="hf_token"]').val() || undefined,
        };

        for (const suffix of ['include', 'exclude']) {
            const patterns = downloadHtml.find(`textarea[name="tabby_download_${suffix}"]`).val().toString();
            if (patterns) {
                params[suffix] = patterns.split('\n');
            }
        }

        // Params for the server side of ST
        params.api_server = serverUrl;
        params.api_type = textgen_settings.type;

        toastr.info('Downloading. Check the Tabby console for progress reports.');

        const response = await fetch('/api/backends/text-completions/tabby/download', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(params),
        });

        if (response.status === 403) {
            toastr.error('The provided key has invalid permissions. Please use an admin key for downloading.');
            return;
        } else if (!response.ok) {
            throw new Error(response.statusText);
        }

        toastr.success('Download complete.');
    } catch (err) {
        console.error(err);
        toastr.error('Failed to download HuggingFace model in TabbyAPI. Please try again.');
    }
}

function calculateOpenRouterCost() {
    if (textgen_settings.type !== textgen_types.OPENROUTER) {
        return;
    }

    let cost = 'Unknown';
    const model = openRouterModels.find(x => x.id === textgen_settings.openrouter_model);

    if (model?.pricing) {
        const completionCost = Number(model.pricing.completion);
        const promptCost = Number(model.pricing.prompt);
        const completionTokens = amount_gen;
        const promptTokens = (max_context - completionTokens);
        const totalCost = (completionCost * completionTokens) + (promptCost * promptTokens);
        if (!isNaN(totalCost)) {
            cost = '$' + totalCost.toFixed(3);
        }
    }

    $('#or_prompt_cost').text(cost);

    // Schedule an update when settings change
    eventSource.removeListener(event_types.SETTINGS_UPDATED, calculateOpenRouterCost);
    eventSource.once(event_types.SETTINGS_UPDATED, calculateOpenRouterCost);
}

export function getCurrentOpenRouterModelTokenizer() {
    const modelId = textgen_settings.openrouter_model;
    const model = openRouterModels.find(x => x.id === modelId);
    if (modelId?.includes('jamba')) {
        return tokenizers.JAMBA;
    }
    switch (model?.architecture?.tokenizer) {
        case 'Llama2':
            return tokenizers.LLAMA;
        case 'Llama3':
            return tokenizers.LLAMA3;
        case 'Yi':
            return tokenizers.YI;
        case 'Mistral':
            return tokenizers.MISTRAL;
        case 'Gemini':
            return tokenizers.GEMMA;
        case 'Claude':
            return tokenizers.CLAUDE;
        case 'Cohere':
            return tokenizers.COMMAND_R;
        case 'Qwen':
            return tokenizers.QWEN2;
        default:
            return tokenizers.OPENAI;
    }
}

export function getCurrentDreamGenModelTokenizer() {
    const modelId = textgen_settings.dreamgen_model;
    const model = dreamGenModels.find(x => x.id === modelId);
    if (model.id.startsWith('lucid-v1-medium') || model.id.startsWith('lucid-v1-base')) {
        return tokenizers.MISTRAL;
    } else if (model.id.startsWith('lucid-v1-extra-large') || model.id.startsWith('lucid-v1-max')) {
        return tokenizers.LLAMA3;
    } else {
        return tokenizers.MISTRAL;
    }
}

export function initTextGenModels() {
    $('#mancer_model').on('change', onMancerModelSelect);
    $('#model_togetherai_select').on('change', onTogetherModelSelect);
    $('#model_infermaticai_select').on('change', onInfermaticAIModelSelect);
    $('#model_dreamgen_select').on('change', onDreamGenModelSelect);
    $('#ollama_model').on('change', onOllamaModelSelect);
    $('#openrouter_model').on('change', onOpenRouterModelSelect);
    $('#ollama_download_model').on('click', downloadOllamaModel);
    $('#vllm_model').on('change', onVllmModelSelect);
    $('#aphrodite_model').on('change', onAphroditeModelSelect);
    $('#tabby_download_model').on('click', downloadTabbyModel);
    $('#tabby_model').on('change', onTabbyModelSelect);
    $('#llamacpp_model').on('change', onLlamaCppModelSelect);
    $('#generic_model_select').on('change', onGenericModelSelect);
    $('#featherless_model').on('change', () => onFeatherlessModelSelect(String($('#featherless_model').val())));

    // Labels of these options are rewritten later to show the service tiers a provider offers.
    // setOpenRouterProviderOptionLabel() recreates an option for that, so any attribute added here
    // has to be copied there as well.
    const providersSelect = $('.openrouter_providers');
    for (const provider of OPENROUTER_PROVIDERS) {
        providersSelect.append($('<option>', {
            value: provider,
            text: provider,
        }));
    }

    const nanoGptProvidersSelect = $('#nanogpt_provider');
    for (const provider of NANOGPT_PROVIDERS) {
        nanoGptProvidersSelect.append($('<option>', {
            value: provider.id,
            text: provider.label,
        }));
    }

    if (!isMobile()) {
        $('#mancer_model').select2({
            placeholder: t`Select a model`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getMancerModelTemplate,
        });
        $('#model_togetherai_select').select2({
            placeholder: t`Select a model`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getTogetherModelTemplate,
        });
        $('#ollama_model').select2({
            placeholder: t`Select a model`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
        });
        $('#tabby_model').select2({
            placeholder: t`[Currently loaded]`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            allowClear: true,
        });
        $('#llamacpp_model').select2({
            placeholder: t`[Currently loaded]`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            allowClear: true,
        });
        $('#generic_model_select').select2({
            placeholder: t`Select a model`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            allowClear: true,
        });
        $('#model_infermaticai_select').select2({
            placeholder: t`Select a model`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getInfermaticAIModelTemplate,
        });
        $('#model_dreamgen_select').select2({
            placeholder: t`Select a model`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getDreamGenModelTemplate,
        });
        $('#openrouter_model').select2({
            placeholder: t`Select a model`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getOpenRouterModelTemplate,
            matcher: textValueMatcher,
        });
        $('#vllm_model').select2({
            placeholder: t`Select a model`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getVllmModelTemplate,
        });
        $('#aphrodite_model').select2({
            placeholder: t`Select a model`,
            searchInputPlaceholder: t`Search models...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getAphroditeModelTemplate,
        });
        $('.openrouter_quantizations').select2({
            closeOnSelect: false,
            placeholder: t`Select quantizations. No selection = all quantizations.`,
            searchInputCssClass: 'text_pole',
            searchInputPlaceholder: t`Search quantizations...`,
            width: '100%',
        });
        providersSelect.select2({
            sorter: data => data.sort((a, b) => a.text.localeCompare(b.text)),
            placeholder: t`Select providers. No selection = all providers.`,
            searchInputPlaceholder: t`Search providers...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            closeOnSelect: false,
        });
        providersSelect.on('select2:select', function (/** @type {any} */ evt) {
            const element = evt.params.data.element;
            const $element = $(element);

            $element.detach();
            $(this).append($element);
            $(this).trigger('change');
        });
        nanoGptProvidersSelect.select2({
            sorter: data => data.sort((a, b) => a.text.localeCompare(b.text)),
            placeholder: t`Select providers. No selection = all providers.`,
            searchInputPlaceholder: t`Search providers...`,
            searchInputCssClass: 'text_pole',
            width: '100%',
            allowClear: true,
        });
    }
}
