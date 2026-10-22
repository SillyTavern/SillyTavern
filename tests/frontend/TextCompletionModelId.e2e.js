import { test as base, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

const supportedBackends = ['vllm', 'aphrodite', 'openrouter', 'mancer', 'togetherai', 'infermaticai', 'dreamgen', 'featherless', 'llamacpp'];

const test = base.extend({
    modelState: async ({ page }, use) => {
        const state = { settings: null, models: [], generations: [] };
        await page.route('**/api/settings/get', async route => {
            const response = await route.fetch();
            const data = await response.json();
            if (!state.settings) {
                state.settings = JSON.parse(data.settings);
                state.settings.firstRun = false;
                state.settings.main_api = 'textgenerationwebui';
                state.settings.textgenerationwebui_settings = {
                    ...state.settings.textgenerationwebui_settings,
                    type: 'vllm',
                    custom_model_ids: {},
                    server_urls: Object.fromEntries(['vllm', 'aphrodite', 'llamacpp', 'generic', 'ooba', 'ollama', 'tabby', 'koboldcpp', 'huggingface']
                        .map(type => [type, 'http://127.0.0.1:1234'])),
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
        await page.route('**/api/backends/text-completions/status', route => route.fulfill({ json: { data: state.models, result: 'Connected' } }));
        await page.route('**/api/backends/text-completions/props', route => route.fulfill({ json: {} }));
        await page.route('**/api/backends/text-completions/llamacpp/props', route => route.fulfill({ json: {} }));
        await page.route('**/api/openrouter/models/providers', route => route.fulfill({ json: [] }));
        await page.route('**/api/backends/text-completions/generate', async route => {
            state.generations.push(route.request().postDataJSON());
            await route.fulfill({ contentType: 'text/event-stream', body: 'data: {"choices":[{"text":"OK"}]}\n\ndata: [DONE]\n\n' });
        });
        await use(state);
    },
});

test.beforeEach(async ({ page, modelState }) => {
    void modelState;
    await testSetup.awaitST({ page });
    await page.locator('#API-status-top').click();
    await expect(page.locator('#text_completion_model_id')).toBeVisible();
});

async function currentModel(page) {
    return page.evaluate(async () => (await import('/scripts/textgen-settings.js')).getTextGenModel());
}

async function applyModel(page, model) {
    await page.locator('#text_completion_model_id').fill(model);
    await page.locator('#text_completion_model_apply').click();
    await expect.poll(() => currentModel(page)).toBe(model.trim());
}

async function deferStatusRequests(page) {
    await page.evaluate(() => {
        const originalFetch = window.fetch;
        window.textModelStatusRequests = [];
        window.fetch = (url, options) => {
            if (url === '/api/backends/text-completions/status') {
                // Ignore cancellation deliberately, including response bodies
                // that have already started arriving before the next connect.
                return new Promise((resolve, reject) => {
                    window.textModelStatusRequests.push({ ...JSON.parse(options.body), signal: options.signal, resolve, reject });
                });
            }
            return originalFetch(url, options);
        };
    });
}

async function connect(page, requestCount) {
    await page.evaluate(() => $('#api_button_textgenerationwebui').trigger('click'));
    await page.waitForFunction(count => window.textModelStatusRequests.length === count, requestCount);
}

async function resolveStatus(page, index, models) {
    await page.evaluate(async ({ index, models }) => {
        window.textModelStatusRequests[index].resolve(new Response(JSON.stringify({ data: models }), { headers: { 'Content-Type': 'application/json' } }));
        await new Promise(resolve => setTimeout(resolve, 0));
    }, { index, models });
}

async function connectionState(page) {
    return page.evaluate(async () => {
        const { textgenerationwebui_settings: settings, getTextGenModel } = await import('/scripts/textgen-settings.js');
        return {
            type: settings.type,
            model: getTextGenModel(),
            options: Array.from(document.querySelectorAll(`#${settings.type}_model option`), option => option.value),
            status: (await import('/script.js')).online_status,
            loading: $('#api_button_textgenerationwebui').hasClass('disabled'),
        };
    });
}

test('all supported text completion backends send an unlisted model ID without guessed limits', async ({ page, modelState }) => {
    test.setTimeout(90000);
    for (const type of supportedBackends) {
        await page.locator('#textgen_type').selectOption(type);
        const beforeContext = await page.evaluate(async () => (await import('/script.js')).max_context);
        const model = `${type}-unlisted-model-e2e`;
        await applyModel(page, `  ${model}  `);
        const result = await page.evaluate(async () => {
            const { getTextGenGenerationData, generateTextGenWithStreaming } = await import('/scripts/textgen-settings.js');
            const data = await getTextGenGenerationData('Custom model routing test.', 16, false, false, null, 'quiet');
            const stream = await generateTextGenWithStreaming(data, new AbortController().signal);
            const chunks = [];
            for await (const chunk of stream()) chunks.push(chunk.text);
            return { chunks, context: (await import('/script.js')).max_context };
        });
        expect(result.chunks, type).toEqual(['OK']);
        expect(result.context, type).toBe(beforeContext);
        expect(modelState.generations.at(-1), type).toMatchObject({ api_type: type, model, stream: true });
    }
    expect(modelState.generations).toHaveLength(supportedBackends.length);
});

test('text model history survives catalog refresh, backend switching and settings reload', async ({ page, modelState }) => {
    const vllmModel = 'private-org/custom-vllm-e2e';
    const aphroditeModel = 'private-org/custom-aphrodite-e2e';
    await applyModel(page, vllmModel);
    await page.locator('#textgen_type').selectOption('aphrodite');
    await applyModel(page, aphroditeModel);
    await page.locator('#textgen_type').selectOption('vllm');
    await expect(page.locator('#text_completion_model_id')).toHaveValue(vllmModel);

    modelState.models = [{ id: 'listed-vllm-e2e' }];
    await page.locator('#api_button_textgenerationwebui').click();
    await expect(page.locator('#vllm_model option[value="listed-vllm-e2e"]')).toHaveCount(1);
    await expect(page.locator('#vllm_model')).toHaveValue(vllmModel);
    modelState.models = [];
    await page.locator('#api_button_textgenerationwebui').click();
    await expect(page.locator('#vllm_model option[value="listed-vllm-e2e"]')).toHaveCount(0);
    await expect(page.locator('#vllm_model')).toHaveValue(vllmModel);

    await page.evaluate(async () => { await (await import('/script.js')).saveSettings(); });
    expect(modelState.settings.textgenerationwebui_settings.custom_model_ids.vllm).toEqual([vllmModel]);
    expect(modelState.settings.textgenerationwebui_settings.custom_model_ids.aphrodite).toEqual([aphroditeModel]);
    const preset = await page.evaluate(async () => (await import('/scripts/preset-manager.js')).getPresetManager('textgenerationwebui').getPresetSettings());
    expect(preset).not.toHaveProperty('custom_model_ids');
    await page.reload();
    await page.waitForFunction(() => document.getElementById('preloader') === null);
    await expect(page.locator('#text_completion_model_id')).toHaveValue(vllmModel);
    await expect(page.locator('#vllm_model')).toHaveValue(vllmModel);
    await page.locator('#API-status-top').click();
    await page.locator('#textgen_type').selectOption('aphrodite');
    await expect(page.locator('#text_completion_model_id')).toHaveValue(aphroditeModel);
});

test('custom catalog choices stay safe as text and standard dropdown selections remain usable', async ({ page, modelState }) => {
    const model = 'private/<img src=x onerror=alert(1)>/"quoted"-model';
    await applyModel(page, model);
    await expect(page.locator('#vllm_model option').filter({ hasText: model })).toHaveText(model);
    expect(await page.locator('#text_completion_model_history img').count()).toBe(0);
    modelState.models = [{ id: 'listed-model-e2e' }];
    await page.locator('#api_button_textgenerationwebui').click();
    await expect(page.locator('#vllm_model option[value="listed-model-e2e"]')).toHaveCount(1);
    await page.locator('#vllm_model').selectOption('listed-model-e2e');
    await expect.poll(() => currentModel(page)).toBe('listed-model-e2e');
    await expect(page.locator('#text_completion_model_id')).toHaveValue('listed-model-e2e');
});

test('the editor preserves drafts during refresh and stays hidden for existing or unsupported controls', async ({ page, modelState }) => {
    await applyModel(page, 'vllm-before-draft-e2e');
    const input = page.locator('#text_completion_model_id');
    await input.fill('vllm-draft-e2e');
    modelState.models = [{ id: 'listed-during-draft-e2e' }];
    await page.evaluate(() => $('#api_button_textgenerationwebui').trigger('click'));
    await expect(page.locator('#vllm_model option[value="listed-during-draft-e2e"]')).toHaveCount(1);
    await expect(input).toHaveValue('vllm-draft-e2e');
    await input.press('Enter');
    await expect.poll(() => currentModel(page)).toBe('vllm-draft-e2e');

    for (const type of ['generic', 'ooba', 'ollama', 'tabby', 'koboldcpp', 'huggingface']) {
        await page.locator('#textgen_type').selectOption(type);
        await expect(page.locator('#text_completion_model_editor')).toBeHidden();
        const applied = await page.evaluate(async () => (await import('/scripts/textgen-models.js')).setCustomTextGenModel('not-supported'));
        expect(applied, type).toBe(false);
    }
    await page.locator('#textgen_type').selectOption('generic');
    await expect(page.locator('#generic_model_textgenerationwebui')).toBeVisible();
    await page.locator('#textgen_type').selectOption('ooba');
    await expect(page.locator('#custom_model_textgenerationwebui')).toBeVisible();
});

test('a late text catalog cannot overwrite a different source even when cancellation is ignored', async ({ page }) => {
    await deferStatusRequests(page);
    await connect(page, 1);
    await page.locator('#textgen_type').selectOption('openrouter');
    await page.waitForFunction(() => window.textModelStatusRequests.length === 2);
    expect(await page.evaluate(() => window.textModelStatusRequests[0].signal.aborted)).toBe(true);
    await resolveStatus(page, 1, [{ id: 'org/router-current', name: 'Router current' }]);
    const current = await connectionState(page);
    expect(current).toMatchObject({ type: 'openrouter', model: 'org/router-current', status: 'org/router-current', loading: false });
    await resolveStatus(page, 0, [{ id: 'old-vllm-a' }, { id: 'old-vllm-b' }]);
    expect(await connectionState(page)).toEqual(current);
});

test('a newer text connect wins over an earlier response body from the same source', async ({ page }) => {
    await deferStatusRequests(page);
    await connect(page, 1);
    await page.evaluate(() => {
        const pending = window.textModelStatusRequests[0];
        pending.resolve({ ok: true, headers: new Headers(), json: () => new Promise(resolve => { pending.resolveBody = resolve; }) });
    });
    await page.waitForFunction(() => typeof window.textModelStatusRequests[0].resolveBody === 'function');
    await connect(page, 2);
    expect(await page.evaluate(() => window.textModelStatusRequests[0].signal.aborted)).toBe(false);
    await resolveStatus(page, 1, [{ id: 'vllm-current' }]);
    const current = await connectionState(page);
    expect(current).toMatchObject({ model: 'vllm-current', status: 'vllm-current', loading: false });
    await page.evaluate(async () => {
        window.textModelStatusRequests[0].resolveBody({ data: [{ id: 'vllm-obsolete' }] });
        await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await connectionState(page)).toEqual(current);
});

test('an obsolete text connection failure cannot replace a newer success', async ({ page }) => {
    await deferStatusRequests(page);
    await connect(page, 1);
    await connect(page, 2);
    await resolveStatus(page, 1, [{ id: 'vllm-success' }]);
    const current = await connectionState(page);
    await page.evaluate(async () => {
        window.textModelStatusRequests[0].reject(new Error('Obsolete failed request'));
        await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await connectionState(page)).toEqual(current);
    expect(current.status).toBe('vllm-success');
});

test('editing the text endpoint invalidates its in-flight catalog before reconnect', async ({ page }) => {
    await deferStatusRequests(page);
    await connect(page, 1);
    await page.locator('#vllm_api_url_text').fill('http://127.0.0.1:4321');
    const current = await connectionState(page);
    expect(current).toMatchObject({ status: 'no_connection', loading: false });
    await resolveStatus(page, 0, [{ id: 'old-endpoint-model' }]);
    expect(await connectionState(page)).toEqual(current);
    await page.locator('#api_button_textgenerationwebui').click();
    await page.waitForFunction(() => window.textModelStatusRequests.length === 2);
    expect(await page.evaluate(() => window.textModelStatusRequests[1].api_server)).toBe('http://127.0.0.1:4321');
    await resolveStatus(page, 1, [{ id: 'new-endpoint-model' }]);
    expect(await connectionState(page)).toMatchObject({ model: 'new-endpoint-model', status: 'new-endpoint-model', loading: false });
});
