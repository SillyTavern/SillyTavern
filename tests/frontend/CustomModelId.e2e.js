import { test as base, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

// Keep settings and imported presets local to each browser context. These tests
// exercise the real save/load requests without changing the server's account.
const test = base.extend({
    modelState: async ({ page }, use) => {
        const state = { settings: null, models: [], generations: [], presets: [] };
        await page.route('**/api/settings/get', async route => {
            const response = await route.fetch();
            const data = await response.json();
            if (!state.settings) {
                state.settings = JSON.parse(data.settings);
                state.settings.firstRun = false;
                state.settings.main_api = 'openai';
                state.settings.oai_settings = {
                    ...state.settings.oai_settings,
                    chat_completion_source: 'vertexai',
                    vertexai_model: 'gemini-3.7-flash',
                    mistralai_model: 'mistral-large-latest',
                    custom_model_ids: {},
                    reverse_proxy: '',
                    bind_preset_to_connection: true,
                    azure_base_url: 'https://example.invalid',
                };
            }
            data.settings = JSON.stringify(state.settings);
            data.request_compression = { enabled: false };
            await route.fulfill({ response, json: data });
        });
        await page.route('**/api/settings/save', async route => {
            state.settings = route.request().postDataJSON();
            await route.fulfill({ json: { result: 'ok' } });
        });
        await page.route('**/api/presets/save', async route => {
            const payload = route.request().postDataJSON();
            state.presets.push(payload);
            await route.fulfill({ json: { name: payload.name } });
        });
        await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: state.models } }));
        await page.route('**/api/backends/text-completions/status', route => route.fulfill({ json: { data: [], result: 'Connected' } }));
        await page.route('**/api/backends/chat-completions/generate', async route => {
            state.generations.push(route.request().postDataJSON());
            await route.fulfill({ json: { choices: [{ message: { role: 'assistant', content: 'Model request received.' } }] } });
        });
        await use(state);
    },
});

test.beforeEach(async ({ page, modelState }) => {
    void modelState;
    await testSetup.awaitST({ page });
    await page.evaluate(async () => {
        const { secret_state, SECRET_KEYS } = await import('./scripts/secrets.js');
        // Status responses are intercepted above; no real API credentials or
        // provider requests are needed to exercise reconnect/list refreshes.
        for (const key of Object.values(SECRET_KEYS)) secret_state[key] = true;
    });
    await page.locator('#API-status-top').click();
    await expect(page.locator('#chat_completion_model_id')).toBeVisible();
});

async function applyModel(page, id) {
    await page.locator('#chat_completion_model_id').fill(id);
    await page.locator('#chat_completion_model_apply').click();
    await expect.poll(() => currentModel(page)).toBe(id.trim());
}

async function currentModel(page) {
    return page.evaluate(async () => (await import('./scripts/openai.js')).getChatCompletionModel());
}

async function refreshModels(page) {
    const response = page.waitForResponse('**/api/backends/chat-completions/status');
    await page.locator('#api_button_openai').click();
    await response;
    // The model-list change handlers run after response.json(), so wait for the
    // status completion event rather than checking the pre-refresh setting.
    await expect(page.locator('#api_button_openai')).toBeVisible();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function deferStatusRequests(page) {
    await page.evaluate(() => {
        const originalFetch = window.fetch;
        window.modelStatusRequests = [];
        window.fetch = (url, options) => {
            if (url === '/api/backends/chat-completions/status') {
                // Deliberately ignore options.signal. This covers transports
                // that complete after cancellation and bodies already in flight.
                return new Promise((resolve, reject) => {
                    window.modelStatusRequests.push({ source: JSON.parse(options.body).chat_completion_source, signal: options.signal, resolve, reject });
                });
            }
            return originalFetch(url, options);
        };
    });
}

async function resolveStatus(page, index, models) {
    await page.evaluate(async ({ index, models }) => {
        window.modelStatusRequests[index].resolve(new Response(JSON.stringify({ data: models }), { headers: { 'Content-Type': 'application/json' } }));
        await new Promise(resolve => setTimeout(resolve, 0));
    }, { index, models });
}

async function connectionState(page) {
    return page.evaluate(async () => {
        const { model_list, oai_settings, getChatCompletionModel } = await import('./scripts/openai.js');
        const { online_status } = await import('./script.js');
        return { source: oai_settings.chat_completion_source, model: getChatCompletionModel(), models: model_list.map(model => model.id), status: online_status };
    });
}

test('Vertex sends an unlisted model ID and restores it after saving and reloading', async ({ page, modelState }) => {
    const model = 'gemini-4-argon-unlisted-e2e';
    await applyModel(page, `  ${model}  `);
    await expect(page.locator('#model_vertexai_select')).toHaveValue(model);

    await page.evaluate(async () => {
        const { oai_settings, sendOpenAIRequest } = await import('./scripts/openai.js');
        oai_settings.stream_openai = false;
        await sendOpenAIRequest('quiet', [{ role: 'user', content: 'Check custom model routing.' }]);
        await (await import('./script.js')).saveSettings();
    });
    expect(modelState.generations).toHaveLength(1);
    expect(modelState.generations[0]).toMatchObject({ chat_completion_source: 'vertexai', model });
    expect(modelState.settings.oai_settings.vertexai_model).toBe(model);

    await page.reload();
    await page.waitForFunction(() => document.getElementById('preloader') === null);
    await expect.poll(() => currentModel(page)).toBe(model);
    await expect(page.locator('#model_vertexai_select')).toHaveValue(model);
    await expect(page.locator('#chat_completion_model_id')).toHaveValue(model);
});

test('custom model IDs stay with their source and existing dropdown choices remain usable', async ({ page }) => {
    const vertexModel = 'gemini-4-argon-source-e2e';
    const claudeModel = 'claude-future-source-e2e';
    await applyModel(page, vertexModel);
    await page.locator('#chat_completion_source').selectOption('claude');
    await applyModel(page, claudeModel);
    await page.locator('#chat_completion_source').selectOption('vertexai');
    await expect.poll(() => currentModel(page)).toBe(vertexModel);
    await expect(page.locator('#chat_completion_model_id')).toHaveValue(vertexModel);
    await page.locator('#chat_completion_source').selectOption('claude');
    await expect.poll(() => currentModel(page)).toBe(claudeModel);
    await expect(page.locator('#chat_completion_model_id')).toHaveValue(claudeModel);

    await page.locator('#model_claude_select').selectOption('claude-sonnet-5');
    await expect.poll(() => currentModel(page)).toBe('claude-sonnet-5');
    await expect(page.locator('#chat_completion_model_id')).toHaveValue('claude-sonnet-5');
});

test('an imported connection preset can select an unknown model without prior custom history', async ({ page, modelState }) => {
    const model = 'gemini-4-argon-imported-e2e';
    await page.locator('#openai_preset_import_file').setInputFiles({
        name: 'CustomModelE2E.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ chat_completion_source: 'vertexai', vertexai_model: model })),
    });
    await expect.poll(() => currentModel(page)).toBe(model);
    await expect(page.locator('#model_vertexai_select')).toHaveValue(model);
    await expect(page.locator('#chat_completion_model_id')).toHaveValue(model);
    expect(modelState.presets[0].preset.vertexai_model).toBe(model);

    const exported = await page.evaluate(async () => {
        const { getChatCompletionPreset } = await import('./scripts/openai.js');
        return getChatCompletionPreset();
    });
    expect(exported.vertexai_model).toBe(model);
    expect(exported.custom_model_ids.vertexai).toEqual([model]);
});

test('shared presets preserve explicit legacy IDs without exporting model history', async ({ page }) => {
    await page.locator('#chat_completion_source').selectOption('deepseek');
    await applyModel(page, 'deepseek-custom-previous-e2e');
    await applyModel(page, 'deepseek-chat');
    const exported = await page.evaluate(async () => {
        const { getChatCompletionPreset, oai_settings } = await import('./scripts/openai.js');
        const preset = getChatCompletionPreset();
        // Simulate a recipient with no previous custom-model history.
        oai_settings.custom_model_ids = {};
        oai_settings.deepseek_model = 'deepseek-v4-flash';
        $('#chat_completion_source').val('vertexai').trigger('change');
        await (await import('./script.js')).saveSettings();
        return {
            chat_completion_source: preset.chat_completion_source,
            deepseek_model: preset.deepseek_model,
            custom_model_ids: preset.custom_model_ids,
        };
    });
    expect(exported.custom_model_ids.deepseek).toEqual(['deepseek-chat']);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('preloader') === null);
    await page.locator('#openai_preset_import_file').setInputFiles({
        name: 'ExplicitLegacyModelE2E.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
    });
    await expect.poll(() => currentModel(page)).toBe('deepseek-chat');

    // Presets from before custom IDs were supported retain their migrations.
    await page.evaluate(async () => { (await import('./scripts/openai.js')).oai_settings.custom_model_ids = {}; });
    await page.locator('#openai_preset_import_file').setInputFiles({
        name: 'OldLegacyModelE2E.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ chat_completion_source: 'deepseek', deepseek_model: 'deepseek-chat' })),
    });
    await expect.poll(() => currentModel(page)).toBe('deepseek-v4-flash');
});

test('every enabled Chat Completion source sends the exact manually entered ID', async ({ page, modelState }) => {
    test.setTimeout(90000);
    const sources = await page.locator('#chat_completion_source option').evaluateAll(options => options.map(option => option.value));
    const models = {
        ...Object.fromEntries(sources.map(source => [source, `${source}-unlisted-routing-e2e`])),
        claude: 'claude-unlisted-v123-e2e',
        ai21: 'j2-unlisted-e2e',
    };
    for (const source of sources) {
        const model = models[source];
        await page.locator('#chat_completion_source').selectOption(source);
        await applyModel(page, model);
        await page.evaluate(async () => {
            const { oai_settings, sendOpenAIRequest } = await import('./scripts/openai.js');
            oai_settings.stream_openai = false;
            await sendOpenAIRequest('quiet', [{ role: 'user', content: 'Routing test.' }]);
        });
        expect(modelState.generations.at(-1), source).toMatchObject({ chat_completion_source: source, model });
    }
    expect(modelState.generations).toHaveLength(sources.length);
});

test('a manually entered legacy ID survives settings migration on reload', async ({ page }) => {
    await page.locator('#chat_completion_source').selectOption('deepseek');
    await applyModel(page, 'deepseek-chat');
    await page.evaluate(async () => { await (await import('./script.js')).saveSettings(); });
    await page.reload();
    await page.waitForFunction(() => document.getElementById('preloader') === null);
    await expect.poll(() => currentModel(page)).toBe('deepseek-chat');
    await expect(page.locator('#model_deepseek_select')).toHaveValue('deepseek-chat');
});

test('background model refresh preserves an unfinished edit and Enter applies it', async ({ page, modelState }) => {
    await page.locator('#chat_completion_source').selectOption('mistralai');
    await applyModel(page, 'mistral-custom-before-e2e');
    const input = page.locator('#chat_completion_model_id');
    await input.fill('mistral-custom-draft-e2e');
    modelState.models = [{ id: 'mistral-listed', capabilities: { completion_chat: true } }];
    const response = page.waitForResponse('**/api/backends/chat-completions/status');
    // Trigger reconnect without moving the user's focus away from the draft.
    await page.evaluate(() => $('#api_button_openai').trigger('click'));
    await response;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('mistral-custom-draft-e2e');
    expect(await currentModel(page)).toBe('mistral-custom-before-e2e');
    await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
    expect(await currentModel(page)).toBe('mistral-custom-before-e2e');
    await input.press('Enter');
    await expect.poll(() => currentModel(page)).toBe('mistral-custom-draft-e2e');
});

test('/model exact supports unlisted IDs while the default command keeps fuzzy matching', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const commands = window.SillyTavern.getContext().SlashCommandParser.commands;
        const exact = await commands.model.callback({ quiet: 'true', exact: 'true' }, 'gemini-future-command-e2e');
        const queried = await commands.model.callback({ quiet: 'true' }, '');
        const fuzzy = await commands.model.callback({ quiet: 'true' }, 'gemini-3.7-flas');
        return { exact, queried, fuzzy };
    });
    expect(result).toEqual({ exact: 'gemini-future-command-e2e', queried: 'gemini-future-command-e2e', fuzzy: 'gemini-3.7-flash' });

    await page.locator('#chat_completion_source').selectOption('azure_openai');
    const azure = await page.evaluate(async () => {
        const commands = window.SillyTavern.getContext().SlashCommandParser.commands;
        await commands.model.callback({ quiet: 'true', exact: 'true' }, 'azure-command-e2e');
        return commands.model.callback({ quiet: 'true' }, '');
    });
    expect(azure).toBe('azure-command-e2e');
});

test('connection profiles restore an unknown model ID exactly without existing history', async ({ page }) => {
    const model = 'gemini-3.7-flash-unlisted-profile-e2e';
    const result = await page.evaluate(async model => {
        const { extension_settings } = await import('./scripts/extensions.js');
        const profile = { id: 'custom-model-e2e', name: 'Custom model E2E', mode: 'cc', api: 'vertexai', model };
        extension_settings.connectionManager.profiles.push(profile);
        document.getElementById('connection_profiles').add(new Option(profile.name, profile.id));
        const commands = window.SillyTavern.getContext().SlashCommandParser.commands;
        const profileName = await commands.profile.callback({ timeout: '0' }, profile.name);
        return { profileName, model: await commands.model.callback({ quiet: 'true' }, '') };
    }, model);
    expect(result).toEqual({ profileName: 'Custom model E2E', model });
    await expect.poll(() => currentModel(page)).toBe(model);
    await expect(page.locator('#chat_completion_model_id')).toHaveValue(model);
});

test('text completion exact commands and profiles preserve unknown IDs without changing unsupported backends', async ({ page }) => {
    await page.locator('#main_api').selectOption('textgenerationwebui');
    await page.locator('#textgen_type').selectOption('vllm');
    const result = await page.evaluate(async () => {
        const { extension_settings } = await import('./scripts/extensions.js');
        const { getTextGenModel } = await import('./scripts/textgen-settings.js');
        const commands = window.SillyTavern.getContext().SlashCommandParser.commands;
        const exact = await commands.model.callback({ quiet: 'true', exact: 'true' }, 'org/vllm-unlisted-command');
        const profile = { id: 'text-model-e2e', name: 'Text model E2E', mode: 'tc', api: 'vllm', model: 'org/vllm-unlisted-profile' };
        extension_settings.connectionManager.profiles.push(profile);
        document.getElementById('connection_profiles').add(new Option(profile.name, profile.id));
        await commands.profile.callback({ timeout: '0' }, profile.name);
        return { exact, profileModel: getTextGenModel() };
    });
    expect(result).toEqual({ exact: 'org/vllm-unlisted-command', profileModel: 'org/vllm-unlisted-profile' });

    await page.locator('#textgen_type').selectOption('ollama');
    const unsupported = await page.evaluate(async () => {
        const { textgenerationwebui_settings } = await import('./scripts/textgen-settings.js');
        const before = textgenerationwebui_settings.ollama_model;
        const result = await window.SillyTavern.getContext().SlashCommandParser.commands.model.callback({ quiet: 'true', exact: 'true' }, 'uninstalled-ollama-e2e');
        return { result, before, after: textgenerationwebui_settings.ollama_model };
    });
    expect(unsupported.result).toBe('');
    expect(unsupported.after).toBe(unsupported.before);
});

test('a late catalog from an aborted source cannot overwrite the new connection', async ({ page }) => {
    await deferStatusRequests(page);
    await page.locator('#chat_completion_source').selectOption('openai');
    await page.waitForFunction(() => window.modelStatusRequests.length === 1);
    await page.locator('#chat_completion_source').selectOption('groq');
    await page.waitForFunction(() => window.modelStatusRequests.length === 2);
    expect(await page.evaluate(() => window.modelStatusRequests[0].signal.aborted)).toBe(true);
    await resolveStatus(page, 1, [{ id: 'groq-new-connection' }]);
    const current = await connectionState(page);
    expect(current).toMatchObject({ source: 'groq', models: ['groq-new-connection'], status: 'Valid' });
    await resolveStatus(page, 0, [{ id: 'openai-obsolete-connection' }]);
    expect(await connectionState(page)).toEqual(current);
});

test('a newer same-source connect wins even when the earlier response body arrives last', async ({ page }) => {
    await deferStatusRequests(page);
    await page.locator('#chat_completion_source').selectOption('groq');
    await page.waitForFunction(() => window.modelStatusRequests.length === 1);
    await page.evaluate(() => {
        const pending = window.modelStatusRequests[0];
        pending.resolve({ ok: true, json: () => new Promise(resolve => { pending.resolveBody = resolve; }) });
    });
    await page.waitForFunction(() => typeof window.modelStatusRequests[0].resolveBody === 'function');
    await page.evaluate(() => $('#api_button_openai').trigger('click'));
    await page.waitForFunction(() => window.modelStatusRequests.length === 2);
    expect(await page.evaluate(() => window.modelStatusRequests[0].signal.aborted)).toBe(false);
    await resolveStatus(page, 1, [{ id: 'groq-newest-catalog' }]);
    const current = await connectionState(page);
    await page.evaluate(async () => {
        window.modelStatusRequests[0].resolveBody({ data: [{ id: 'groq-obsolete-catalog' }] });
        await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await connectionState(page)).toEqual(current);
    expect(current.models).toEqual(['groq-newest-catalog']);
});

test('an older failed connect cannot replace a successful same-source status', async ({ page }) => {
    await deferStatusRequests(page);
    await page.locator('#chat_completion_source').selectOption('groq');
    await page.waitForFunction(() => window.modelStatusRequests.length === 1);
    await page.evaluate(() => $('#api_button_openai').trigger('click'));
    await page.waitForFunction(() => window.modelStatusRequests.length === 2);
    await resolveStatus(page, 1, [{ id: 'groq-success' }]);
    const current = await connectionState(page);
    expect(current.status).toBe('Valid');
    await page.evaluate(async () => {
        window.modelStatusRequests[0].reject(new Error('Obsolete failed request'));
        await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await connectionState(page)).toEqual(current);
});

test('model catalogs ignore invalid and duplicate IDs while preserving a manual choice', async ({ page, modelState }) => {
    await page.locator('#chat_completion_source').selectOption('groq');
    await applyModel(page, 'groq-custom-catalog-e2e');
    modelState.models = [null, {}, { id: 123 }, { id: '' }, { id: ' ' }, { id: 'valid-a' }, { id: 'valid-a' }, { id: 'valid-b' }];
    await refreshModels(page);
    expect(await connectionState(page)).toMatchObject({ model: 'groq-custom-catalog-e2e', models: ['valid-a', 'valid-b'], status: 'Valid' });
    expect(await page.locator('#model_groq_select option').evaluateAll(options => options.filter(option => option.value === 'valid-a').length)).toBe(1);
});

test('an ordinary default model still falls back when the provider retires it', async ({ page, modelState }) => {
    modelState.models = [{ id: 'mistral-replacement', capabilities: { completion_chat: true } }];
    await page.locator('#chat_completion_source').selectOption('mistralai');
    await refreshModels(page);
    await expect.poll(() => currentModel(page)).toBe('mistral-replacement');
    expect(await page.evaluate(async () => (await import('./scripts/openai.js')).oai_settings.custom_model_ids.mistralai ?? [])).not.toContain('mistral-large-latest');
});

test('an empty Mistral chat catalog does not erase an ordinary selected model', async ({ page, modelState }) => {
    await page.locator('#chat_completion_source').selectOption('mistralai');
    await refreshModels(page);
    await expect.poll(() => currentModel(page)).toBe('mistral-large-latest');
    modelState.models = [{ id: 'embedding-only', capabilities: { completion_chat: false } }];
    await refreshModels(page);
    await expect.poll(() => currentModel(page)).toBe('mistral-large-latest');
    await expect(page.locator('#model_mistralai_select')).toHaveValue('mistral-large-latest');
});

test('a normal catalog selection still falls back after saving and reloading', async ({ page, modelState }) => {
    modelState.models = [{ id: 'mistral-catalog-original-e2e', capabilities: { completion_chat: true } }];
    await page.locator('#chat_completion_source').selectOption('mistralai');
    await refreshModels(page);
    await expect.poll(() => currentModel(page)).toBe('mistral-catalog-original-e2e');
    await page.evaluate(async () => { await (await import('./script.js')).saveSettings(); });
    await page.reload();
    await page.waitForFunction(() => document.getElementById('preloader') === null);
    await expect.poll(() => currentModel(page)).toBe('mistral-catalog-original-e2e');
    expect(await page.evaluate(async () => (await import('./scripts/openai.js')).oai_settings.custom_model_ids.mistralai ?? [])).not.toContain('mistral-catalog-original-e2e');

    modelState.models = [{ id: 'mistral-catalog-replacement-e2e', capabilities: { completion_chat: true } }];
    await page.evaluate(async () => {
        // Mock credentials are in memory only and must be restored after reload.
        const { secret_state, SECRET_KEYS } = await import('./scripts/secrets.js');
        secret_state[SECRET_KEYS.MISTRALAI] = true;
    });
    await page.locator('#API-status-top').click();
    await refreshModels(page);
    await expect.poll(() => currentModel(page)).toBe('mistral-catalog-replacement-e2e');
});

test('an explicit Claude legacy ID is not replaced by the default model', async ({ page }) => {
    await page.locator('#chat_completion_source').selectOption('claude');
    await applyModel(page, 'claude-2');
    await expect(page.locator('#model_claude_select')).toHaveValue('claude-2');
});

for (const [source, selectId, remoteModel] of [
    ['openai', 'model_openai_select', { id: 'gpt-4o' }],
    ['mistralai', 'model_mistralai_select', { id: 'mistral-small-latest', capabilities: { completion_chat: true } }],
    ['electronhub', 'model_electronhub_select', { id: 'listed-model', name: 'Listed model', endpoints: ['/v1/chat/completions'] }],
    ['aimlapi', 'model_aimlapi_select', { id: 'listed-model', type: 'chat-completion' }],
    ['azure_openai', 'azure_openai_model', { id: 'gpt-4o' }],
]) {
    test(`${source} preserves custom selection across model-list refreshes and an empty response`, async ({ page, modelState }) => {
        const model = `${source}-future-e2e`;
        modelState.models = [remoteModel];
        await page.evaluate(async source => { (await import('./scripts/openai.js')).oai_settings.show_external_models = source === 'openai'; }, source);
        await page.locator('#chat_completion_source').selectOption(source);
        await applyModel(page, model);
        await refreshModels(page);
        await expect.poll(() => currentModel(page)).toBe(model);
        await expect(page.locator(`#${selectId}`)).toHaveValue(model);

        modelState.models = [];
        await refreshModels(page);
        await expect.poll(() => currentModel(page)).toBe(model);
        await expect(page.locator(`#${selectId}`)).toHaveValue(model);
        await expect(page.locator('#chat_completion_model_id')).toHaveValue(model);
    });
}
