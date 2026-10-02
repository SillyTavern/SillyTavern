/**
 * @jest-environment jsdom
 */
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import jquery from 'jquery';

const PROVIDERS_SELECTOR = '#openrouter_providers_chat';
const TIERS_SELECTOR = '#openrouter_service_tier';
const NOTE_SELECTOR = '#openrouter_service_tier_note';
const ICON_SELECTOR = '#openrouter_service_tier_warning';
const FALLBACK_ONLY_CLASS = 'fallback_only_warning';

/**
 * Asserts what the heading icon says about the selected tier.
 * @param {'error' | 'fallback' | 'none'} level Expected warning level
 */
function expectTierWarningIcon(level) {
    const $icon = $(ICON_SELECTOR);
    expect($icon.hasClass('displayNone')).toBe(level === 'none');
    expect($icon.hasClass(FALLBACK_ONLY_CLASS)).toBe(level === 'fallback');
}

/**
 * Minimal stand-in for the real i18n tag function: interpolate the English source string.
 * @param {TemplateStringsArray} strings Template strings
 * @param {...any} values Interpolated values
 * @returns {string} Interpolated string
 */
function t(strings, ...values) {
    return strings.reduce((result, string, i) => result + string + (values[i] !== undefined ? String(values[i]) : ''), '');
}

global.$ = jquery;
global.jQuery = jquery;
global.toastr = { warning: jest.fn() };

jest.unstable_mockModule('../public/scripts/i18n.js', () => ({ t }));
jest.unstable_mockModule('../public/lib.js', () => ({ DOMPurify: { sanitize: value => value } }));
jest.unstable_mockModule('../public/scripts/RossAscends-mods.js', () => ({ isMobile: () => false }));
jest.unstable_mockModule('../public/script.js', () => ({
    amount_gen: 150,
    eventSource: { emit: jest.fn(), on: jest.fn(), once: jest.fn(), removeListener: jest.fn() },
    event_types: {},
    getRequestHeaders: () => ({}),
    max_context: 8192,
    online_status: 'no_connection',
    setGenerationParamsFromPreset: jest.fn(),
}));
jest.unstable_mockModule('../public/scripts/textgen-settings.js', () => ({
    textgenerationwebui_settings: {},
    textgen_types: {},
}));
jest.unstable_mockModule('../public/scripts/tokenizers.js', () => ({ tokenizers: {} }));
jest.unstable_mockModule('../public/scripts/templates.js', () => ({ renderTemplateAsync: jest.fn() }));
jest.unstable_mockModule('../public/scripts/popup.js', () => ({ POPUP_TYPE: {}, callGenericPopup: jest.fn() }));
jest.unstable_mockModule('../public/scripts/util/AccountStorage.js', () => ({
    accountStorage: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.unstable_mockModule('../public/scripts/utils.js', () => ({
    localizePagination: jest.fn(),
    PAGINATION_TEMPLATE: '',
    textValueMatcher: jest.fn(),
}));

let syncOpenRouterProvidersForModel;
let refreshOpenRouterServiceTierOptions;

beforeAll(async () => {
    ({ refreshOpenRouterServiceTierOptions, syncOpenRouterProvidersForModel } = await import('../public/scripts/textgen-models.js'));
});

/**
 * @param {string} provider Provider name
 * @param {string} tier Service tier
 */
function endpoint(provider, tier) {
    return { provider, tier, online: true };
}

/**
 * Serves the given endpoints to the provider sync request.
 * @param {{provider: string, tier: string}[]} endpoints Endpoints the model reports
 */
function serveEndpoints(endpoints) {
    global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({
            providers: [...new Set(endpoints.map(item => item.provider))],
            endpoints,
        }),
    }));
}

/**
 * jQuery's .val() ignores disabled options, so read the selected option from the DOM instead.
 * @returns {string | null} Value of the selected tier option
 */
function getSelectedTier() {
    const select = /** @type {HTMLSelectElement} */ (document.getElementById('openrouter_service_tier'));
    const selected = Array.from(select.options).find(option => option.selected);
    return selected ? selected.value : null;
}

beforeEach(() => {
    document.body.innerHTML = `
        <select id="openrouter_providers_chat" multiple>
            <option value="Google">Google</option>
            <option value="Google AI Studio">Google AI Studio</option>
            <option value="OpenAI">OpenAI</option>
            <option value="Anthropic">Anthropic</option>
            <option value="Amazon Bedrock">Amazon Bedrock</option>
            <option value="Azure">Azure</option>
            <option value="Claude Platform on AWS">Claude Platform on AWS</option>
            <option value="Together">Together</option>
        </select>
        <input id="openrouter_allow_fallbacks" type="checkbox" />
        <h4><span>Service Tier</span><i id="openrouter_service_tier_warning" class="fa-solid fa-circle-exclamation displayNone"></i></h4>
        <select id="openrouter_service_tier"></select>
        <small id="openrouter_service_tier_note" class="displayNone"></small>
    `;
    global.toastr.warning.mockClear();
});

describe('OpenRouter service tier dropdown', () => {
    test('keeps a saved flex selection selected when the chosen provider cannot serve it', async () => {
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Together', 'flex')]);
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', false);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });

        const $flex = $(`${TIERS_SELECTOR} option[value="flex"]`);
        expect($flex.length).toBe(1);
        expect($flex.prop('disabled')).toBe(true);
        expect($flex.text()).toContain('currently unavailable');
        expect(getSelectedTier()).toBe('flex');
        expect($(NOTE_SELECTOR).hasClass('displayNone')).toBe(false);
        expect($(NOTE_SELECTOR).text()).toContain('not available for the current providers and model');
    });

    test('warns once when the saved tier cannot be served, without rewriting the settings', async () => {
        serveEndpoints([endpoint('Google', 'standard')]);
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', false);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'priority' });
        expect(global.toastr.warning).toHaveBeenCalledTimes(1);

        // The warning has to stand on its own: it names the setting and where to change it.
        const warning = String(global.toastr.warning.mock.calls[0][0]);
        expect(warning).toContain('OpenRouter service tier');
        expect(warning).toContain('Priority (fast, expensive)');
        expect(warning).toContain('served at standard rates');
        expect(warning).toContain('API Connections menu');
        // The note sits right next to the dropdown, so it only explains the state.
        expect($(NOTE_SELECTOR).text()).not.toContain('API Connections');

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'priority' });
        expect(global.toastr.warning).toHaveBeenCalledTimes(1);
        expect(getSelectedTier()).toBe('priority');
    });

    test('shows a warning icon next to the heading while the selected tier is unavailable', async () => {
        serveEndpoints([endpoint('Google', 'standard')]);
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', false);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });

        // Nothing can serve the tier, which is the hard failure, so the icon is the red one.
        expectTierWarningIcon('error');
        // The icon has no room to explain itself, so it repeats the note as its tooltip.
        const $icon = $(ICON_SELECTOR);
        expect($icon.attr('title')).toBe($(NOTE_SELECTOR).text());
        expect($icon.attr('title')).toContain('not available for the current providers and model');
    });

    test('hides the warning icon when the selected tier is served as chosen', async () => {
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Google', 'flex')]);
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', false);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });

        expectTierWarningIcon('none');
        expect($(ICON_SELECTOR).attr('title')).toBeUndefined();
        expect($(NOTE_SELECTOR).hasClass('displayNone')).toBe(true);
    });

    test('warns when selecting providers makes the tier unavailable', async () => {
        // Nothing is selected, so every provider is eligible and flex is servable.
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Together', 'flex')]);
        $(PROVIDERS_SELECTOR).val([]);
        $('#openrouter_allow_fallbacks').prop('checked', false);
        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });
        expect(global.toastr.warning).not.toHaveBeenCalled();

        // Picking Google alone drops flex. The provider dropdown covers the tier control while it is
        // open, so this toast is the only feedback available at that moment.
        $(PROVIDERS_SELECTOR).val(['Google']);
        refreshOpenRouterServiceTierOptions(PROVIDERS_SELECTOR, 'flex');

        expect($(`${TIERS_SELECTOR} option[value="flex"]`).prop('disabled')).toBe(true);
        expect(global.toastr.warning).toHaveBeenCalledTimes(1);

        // Further provider clicks that leave the tier just as unavailable must not repeat it.
        $(PROVIDERS_SELECTOR).val(['Google', 'Anthropic']);
        refreshOpenRouterServiceTierOptions(PROVIDERS_SELECTOR, 'flex');
        expect(global.toastr.warning).toHaveBeenCalledTimes(1);
    });

    test('warns when turning fallbacks off makes the tier unavailable', async () => {
        // Fallbacks are allowed, so flex is servable even though the selected provider is not.
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Together', 'flex')]);
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', true);
        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });
        expect(global.toastr.warning).not.toHaveBeenCalled();
        // Flex is still servable, so the icon is the caution one rather than a failure.
        expectTierWarningIcon('fallback');

        $('#openrouter_allow_fallbacks').prop('checked', false);
        refreshOpenRouterServiceTierOptions(PROVIDERS_SELECTOR, 'flex');

        expect($(`${TIERS_SELECTOR} option[value="flex"]`).prop('disabled')).toBe(true);
        // The same icon now reports the harder failure, so the caution is replaced, not kept.
        expectTierWarningIcon('error');
        expect(global.toastr.warning).toHaveBeenCalledTimes(1);
    });

    test('warns again once the tier has worked and then breaks again', async () => {
        serveEndpoints([endpoint('Google', 'standard')]);
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', false);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });
        expect(global.toastr.warning).toHaveBeenCalledTimes(1);

        // A model that does serve flex: the dropdown recovers, so nothing is reported.
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Google', 'flex')]);
        await syncOpenRouterProvidersForModel('google/gemini-pro', PROVIDERS_SELECTOR, { selectedTier: 'flex' });
        expect(global.toastr.warning).toHaveBeenCalledTimes(1);

        // A model that does not: this is a new problem, so it is worth saying once more.
        serveEndpoints([endpoint('Google', 'standard')]);
        await syncOpenRouterProvidersForModel('google/gemini-lite', PROVIDERS_SELECTOR, { selectedTier: 'flex' });
        expect(global.toastr.warning).toHaveBeenCalledTimes(2);
    });

    test('restores the same saved selection after switching to a model that offers flex', async () => {
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Together', 'flex')]);
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', false);
        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });

        // Switch to a model whose selected provider does serve flex.
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Google', 'flex')]);
        await syncOpenRouterProvidersForModel('google/gemini-pro', PROVIDERS_SELECTOR, { selectedTier: 'flex' });

        const $flex = $(`${TIERS_SELECTOR} option[value="flex"]`);
        expect($flex.prop('disabled')).toBe(false);
        expect($flex.text()).toBe('Flex (cheap, slower)');
        expect(getSelectedTier()).toBe('flex');
        expect($(NOTE_SELECTOR).hasClass('displayNone')).toBe(true);
    });

    test('never fires a change event while refreshing, so settings are not rewritten', async () => {
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Together', 'flex')]);
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', false);

        const onChange = jest.fn();
        $(TIERS_SELECTOR).on('change', onChange);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });

        expect(onChange).not.toHaveBeenCalled();
    });

    test('marks flex as fallback-only when the selected providers cannot serve it', async () => {
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Together', 'flex')]);
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', true);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: '' });

        const $flex = $(`${TIERS_SELECTOR} option[value="flex"]`);
        expect($flex.prop('disabled')).toBe(false);
        expect($flex.text()).toContain('supported by fallback providers only');
    });

    test('marks a tier only some selected providers serve, and names them in the note', async () => {
        serveEndpoints([
            endpoint('Google', 'standard'),
            endpoint('Google', 'flex'),
            endpoint('Together', 'standard'),
        ]);
        $(PROVIDERS_SELECTOR).val(['Google', 'Together']);
        $('#openrouter_allow_fallbacks').prop('checked', false);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });

        const $flex = $(`${TIERS_SELECTOR} option[value="flex"]`);
        expect($flex.prop('disabled')).toBe(false);
        expect($flex.text()).toContain('supported by some selected providers');
        expect($(NOTE_SELECTOR).text()).toContain('only offered by: Google');
        // Partial coverage is the ordinary case for a broad selection, so the note explains it but
        // the icon stays out of it and keeps meaning "something is wrong".
        expectTierWarningIcon('none');
        expect($(NOTE_SELECTOR).hasClass('displayNone')).toBe(false);
    });

    test('annotates providers with the tiers they serve', async () => {
        serveEndpoints([
            endpoint('Google', 'standard'),
            endpoint('Google', 'flex'),
            endpoint('Google', 'priority'),
            endpoint('Together', 'standard'),
        ]);
        $(PROVIDERS_SELECTOR).val([]);
        $('#openrouter_allow_fallbacks').prop('checked', true);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: '' });

        const $google = $(`${PROVIDERS_SELECTOR} option[value="Google"]`);
        const $together = $(`${PROVIDERS_SELECTOR} option[value="Together"]`);
        expect($google.text()).toBe('Google (Flex, Priority)');
        expect($together.text()).toBe('Together');
        // The option value is what ends up in the request, so it must not change.
        expect($google.val()).toBe('Google');
    });

    test('annotates providers from the endpoint data OpenRouter returns for a model', async () => {
        // openai/gpt-6-astra: OpenAI serves flex and priority (its priority endpoint is tagged
        // `fast`), every other provider only serves the default tier.
        serveEndpoints([
            endpoint('OpenAI', 'flex'),
            endpoint('Azure', 'standard'),
            endpoint('OpenAI', 'standard'),
            endpoint('Amazon Bedrock', 'standard'),
            endpoint('OpenAI', 'priority'),
        ]);
        $(PROVIDERS_SELECTOR).val([]);
        $('#openrouter_allow_fallbacks').prop('checked', true);

        await syncOpenRouterProvidersForModel('openai/gpt-6-astra', PROVIDERS_SELECTOR, { selectedTier: '' });

        expect($(`${PROVIDERS_SELECTOR} option[value="OpenAI"]`).text()).toBe('OpenAI (Flex, Priority)');
        expect($(`${PROVIDERS_SELECTOR} option[value="Azure"]`).text()).toBe('Azure');
        expect($(`${PROVIDERS_SELECTOR} option[value="Amazon Bedrock"]`).text()).toBe('Amazon Bedrock');
    });

    test('recreates the option element in place, since select2 caches rendered options', async () => {
        $(PROVIDERS_SELECTOR).val(['Together']);
        const valuesBefore = Array.from(document.querySelectorAll(`${PROVIDERS_SELECTOR} option`)).map(option => option.value);
        const elementBefore = $(`${PROVIDERS_SELECTOR} option[value="OpenAI"]`)[0];

        serveEndpoints([endpoint('OpenAI', 'standard'), endpoint('OpenAI', 'flex'), endpoint('Together', 'standard')]);
        await syncOpenRouterProvidersForModel('openai/gpt', PROVIDERS_SELECTOR, { selectedTier: '' });

        const elementAfter = $(`${PROVIDERS_SELECTOR} option[value="OpenAI"]`)[0];
        expect(elementAfter).not.toBe(elementBefore);
        expect(elementAfter.text).toBe('OpenAI (Flex)');
        // Option order matters (selected providers are moved to the end), so it has to survive.
        expect(Array.from(document.querySelectorAll(`${PROVIDERS_SELECTOR} option`)).map(option => option.value)).toEqual(valuesBefore);
    });

    test('keeps value, selection and disabled state when a provider label is rewritten', async () => {
        serveEndpoints([endpoint('OpenAI', 'standard'), endpoint('OpenAI', 'flex'), endpoint('Google', 'standard')]);
        $(PROVIDERS_SELECTOR).val(['OpenAI']);

        await syncOpenRouterProvidersForModel('openai/gpt', PROVIDERS_SELECTOR, { selectedTier: '' });

        const $annotated = $(`${PROVIDERS_SELECTOR} option[value="OpenAI"]`);
        expect($annotated.text()).toBe('OpenAI (Flex)');
        expect($annotated.val()).toBe('OpenAI');
        expect($annotated.prop('selected')).toBe(true);
        expect($annotated.prop('disabled')).toBe(false);

        // A model that does not list the provider clears the label and disables the option.
        serveEndpoints([endpoint('Google', 'standard')]);
        await syncOpenRouterProvidersForModel('openai/plain', PROVIDERS_SELECTOR, { selectedTier: '' });

        const $plain = $(`${PROVIDERS_SELECTOR} option[value="OpenAI"]`);
        expect($plain.text()).toBe('OpenAI');
        expect($plain.val()).toBe('OpenAI');
        expect($plain.prop('selected')).toBe(true);
        expect($plain.prop('disabled')).toBe(true);
    });

    test('clears provider annotations when the endpoints are no longer known', async () => {
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Google', 'flex')]);
        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: '' });
        expect($(`${PROVIDERS_SELECTOR} option[value="Google"]`).text()).toBe('Google (Flex)');

        global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: '' });

        expect($(`${PROVIDERS_SELECTOR} option[value="Google"]`).text()).toBe('Google');
    });

    test('leaves the text completion provider list plain, since it has no tier control', async () => {
        document.body.innerHTML = `
            <select id="openrouter_providers_text" multiple>
                <option value="Google">Google</option>
            </select>
            <input id="openrouter_allow_fallbacks_textgenerationwebui" type="checkbox" />
        `;
        serveEndpoints([endpoint('Google', 'standard'), endpoint('Google', 'flex')]);

        await syncOpenRouterProvidersForModel('google/gemini', '#openrouter_providers_text');

        expect($('#openrouter_providers_text option[value="Google"]').text()).toBe('Google');
    });

    test('keeps the default option usable when no endpoint serves the standard tier', async () => {
        serveEndpoints([endpoint('Together', 'flex')]);
        $(PROVIDERS_SELECTOR).val(['Together']);
        $('#openrouter_allow_fallbacks').prop('checked', false);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: '' });

        const $default = $(`${TIERS_SELECTOR} option[value=""]`);
        expect($default.prop('disabled')).toBe(false);
        expect(getSelectedTier()).toBe('');
        // `Default` only means "do not request a tier", so a missing standard endpoint must not
        // make it read as unavailable while it stays selectable.
        expect($default.text()).toBe('Default');
    });

    test('keeps every tier selectable when the model lookup fails', async () => {
        global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
        $(PROVIDERS_SELECTOR).val(['Google']);
        $('#openrouter_allow_fallbacks').prop('checked', false);

        await syncOpenRouterProvidersForModel('google/gemini', PROVIDERS_SELECTOR, { selectedTier: 'flex' });

        expect($(`${TIERS_SELECTOR} option:disabled`).length).toBe(0);
        expect(getSelectedTier()).toBe('flex');
        expect($(NOTE_SELECTOR).hasClass('displayNone')).toBe(true);
        expect(global.toastr.warning).not.toHaveBeenCalled();
    });
});
