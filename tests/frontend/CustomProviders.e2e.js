import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

// This suite installs a fixture and writes synthetic vault entries: explicitly opt into a disposable data root.
const dataRoot = process.env.ST_TEST_DATA_ROOT;
// eslint-disable-next-line playwright/no-skipped-test -- Refuse fixture/key writes unless the runner explicitly selects disposable data.
test.skip(!dataRoot, 'Set ST_TEST_DATA_ROOT to the disposable server data directory.');
const owner = 'third-party/custom-provider-extension';
let upstream;
let root;
const received = [];

test.beforeAll(async () => {
    if (!dataRoot) return;
    const destination = path.join(dataRoot, 'default-user/extensions/custom-provider-extension');
    fs.mkdirSync(destination, { recursive: true });
    fs.cpSync(new URL('../fixtures/custom-provider-extension', import.meta.url), destination, { recursive: true });
    upstream = http.createServer(async (req, res) => {
        if (req.url.endsWith('/models')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: [{ id: 'discovered-model' }, { id: 'second-model' }] }));
            return;
        }
        let text = '';
        for await (const chunk of req) text += chunk;
        const body = JSON.parse(text);
        // Retain only nonsecret markers and booleans, never a credential-bearing request dump.
        received.push({ path: req.url, marker: req.headers['x-marker'], bodyMarker: body.marker, model: body.model, correctKey: req.headers.authorization === `Bearer synthetic-${req.url.includes('/a/') ? 'a' : 'b'}`, localMetadata: 'custom_auth' in body || 'secret_id' in body });
        if (body.stream) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.end(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'Synthetic stream' } }] })}\n\ndata: [DONE]\n\n`);
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'Synthetic completion' } }] }));
    });
    upstream.listen(0, '127.0.0.1');
    await new Promise(resolve => upstream.once('listening', resolve));
    root = `http://127.0.0.1:${upstream.address().port}`;
});
test.afterAll(async () => { if (upstream) await new Promise(resolve => upstream.close(resolve)); });

async function openCustom(page) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.SillyTavern && document.getElementById('preloader') === null);
    await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('Welcome to SillyTavern!') || SillyTavern.getContext().eventSource.autoFireLastArgs.has('app_ready'));
    const welcome = page.getByRole('dialog').filter({ hasText: 'Welcome to SillyTavern!' });
    if (await welcome.count()) await welcome.locator('.popup-button-ok').click();
    await page.evaluate(async () => {
        const { eventSource, eventTypes } = SillyTavern.getContext();
        await new Promise(resolve => eventSource.once(eventTypes.APP_READY, resolve));
    });
    await page.evaluate(async endpoint => {
        const fixture = await import('/scripts/extensions/third-party/custom-provider-extension/index.js');
        fixture.configure(`${endpoint}/a/v1`, `${endpoint}/b/v1`);
        const context = SillyTavern.getContext();
        await context.executeSlashCommandsWithOptions('/api custom');
        $('#rm_api_block').removeClass('closedDrawer').addClass('openDrawer').show();
    }, root);
    await expect(page.locator('#custom_provider_select')).toBeVisible();
}

async function syntheticKey(page, provider, key) {
    const id = await page.evaluate(async ({ key, provider }) => {
        const { writeSecret } = await import('/scripts/secrets.js');
        return await writeSecret(key, `synthetic-${provider}`, `Synthetic ${provider}`, { activate: false });
    }, { key, provider });
    await page.selectOption('#custom_credential_select', JSON.stringify([key, id]));
    await page.locator('dialog[open] .popup-button-ok').click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    return id;
}

test('Custom setup and Profile journey through the installed extension', async ({ page }) => {
    // This serial account journey shares one browser; cold application startup is the expensive boundary.
    test.setTimeout(240_000);
    await test.step('installed extension exposes safe labels, neutral defaults, and remembered Manual', async () => {
        await openCustom(page);
        await page.evaluate(async () => {
            const { oai_settings } = await import('/scripts/openai.js');
            delete oai_settings.custom_provider_state;
            const context = SillyTavern.getContext();
            context.extensionSettings.connectionManager.profiles = [];
            context.extensionSettings.connectionManager.selectedProfile = null;
            await context.eventSource.emit(context.eventTypes.CONNECTION_PROFILE_DELETED, null);
            $('#custom_api_url_text').val('http://localhost:1234/v1').trigger('input');
            $('#custom_model_id').val('manual-model').trigger('input');
            oai_settings.custom_include_headers = 'X-Manual: preserved';
        });
        await page.selectOption('#custom_provider_select', `${owner}:a`);
        await expect(page.locator('#custom_api_url_text')).toHaveValue(`${root}/a/v1`);
        await expect(page.locator('#custom_model_id')).toHaveValue('');
        await expect(page.locator('#custom_provider_select option').filter({ hasText: '<b>Provider A</b>' })).toHaveCount(1);
        await expect(page.locator('#custom_provider_info b')).toHaveCount(0);
        await page.locator('#api_button_openai').click();
        await expect(page.locator('#custom_provider_error')).toContainText('Choose a stored key');
        await page.locator('#custom_model_id').fill('deliberate-model');
        await page.selectOption('#custom_provider_select', `${owner}:b`);
        await page.selectOption('#custom_provider_select', `${owner}:a`);
        await expect(page.locator('#custom_model_id')).toHaveValue('deliberate-model');
        await page.selectOption('#custom_provider_select', '');
        await expect(page.locator('#custom_model_id')).toHaveValue('manual-model');
        expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.custom_include_headers)).toBe('X-Manual: preserved');
        await page.evaluate(async () => { await (await import('/script.js')).saveSettings(); });
    });

    await test.step('masked core picker, discovery, edits, reload and missing helper retain the generic connection', async () => {
        await openCustom(page);
        await page.selectOption('#custom_provider_select', `${owner}:a`);
        await syntheticKey(page, 'a', 'api_key_openai');
        await page.locator('#custom_model_id').fill('explicit-model');
        await page.locator('#api_button_openai').click();
        await expect(page.locator('#model_custom_select option[value="discovered-model"]')).toHaveCount(1);
        await expect(page.locator('#custom_model_id')).toHaveValue('explicit-model');
        await page.locator('#api_key_custom').fill('pending-unsaved-synthetic');
        await page.selectOption('#custom_provider_select', `${owner}:b`);
        await expect(page.locator('#api_key_custom')).toHaveValue('');
        await page.selectOption('#custom_provider_select', `${owner}:a`);
        await page.evaluate(async () => { await (await import('/script.js')).saveSettings(); });
        await openCustom(page);
        await expect(page.locator('#custom_model_id')).toHaveValue('explicit-model');
        await page.evaluate(async owner => { await (await import('/scripts/extensions.js')).disableExtension(owner, false); }, owner);
        await expect(page.locator('#custom_provider_info')).toContainText('extension unavailable');
        expect(await page.evaluate(async () => (await import('/scripts/custom-providers.js')).getCustomAuth((await import('/scripts/openai.js')).oai_settings).credential.key)).toBe('api_key_openai');
        await page.evaluate(async owner => { await (await import('/scripts/extensions.js')).enableExtension(owner, false); }, owner);
    });

    await test.step('Manual without helpers retains discovery, pending key and online status on ordinary edits', async () => {
        await page.selectOption('#custom_provider_select', '');
        await page.evaluate(async owner => { await (await import('/scripts/extensions.js')).disableExtension(owner, false); }, owner);
        await page.evaluate(async () => {
            // Exercise legacy Manual, with no opted-in state or registered helper.
            delete (await import('/scripts/openai.js')).oai_settings.custom_provider_state;
            await (await import('/scripts/secrets.js')).writeSecret('api_key_custom', 'synthetic-a', 'Synthetic Manual');
        });
        await page.locator('#custom_api_url_text').fill(`${root}/a/v1`);
        await page.locator('#api_button_openai').click();
        await expect(page.locator('#model_custom_select option[value="second-model"]')).toHaveCount(1);
        const online = await page.evaluate(async () => (await import('/script.js')).online_status);
        expect(online).not.toBe('no_connection');
        await page.locator('#api_key_custom').fill('pending-unsaved-synthetic');
        await page.selectOption('#model_custom_select', 'discovered-model');
        await page.selectOption('#model_custom_select', 'second-model');
        await expect(page.locator('#custom_model_id')).toHaveValue('second-model');
        await page.locator('#customize_additional_parameters').click();
        await page.locator('#custom_include_body').fill('marker: manual-edit');
        await page.locator('dialog[open] .popup-button-ok').click();
        await expect(page.locator('#api_key_custom')).toHaveValue('pending-unsaved-synthetic');
        await expect(page.locator('#model_custom_select option[value="discovered-model"]')).toHaveCount(1);
        expect(await page.evaluate(async () => (await import('/script.js')).online_status)).toBe(online);
        await page.evaluate(async ({ owner, root }) => {
            await (await import('/scripts/extensions.js')).enableExtension(owner, false);
            (await import('/scripts/extensions/third-party/custom-provider-extension/index.js')).configure(`${root}/a/v1`, `${root}/b/v1`);
        }, { owner, root });
    });

    await test.step('endpoint edits and descriptor policy resets immediately reconcile credentials', async () => {
        await page.selectOption('#custom_provider_select', `${owner}:a`);
        await syntheticKey(page, 'a', 'api_key_custom');
        await page.locator('#custom_api_url_text').fill(`${root}/changed/v1`);
        expect(await page.evaluate(async () => (await import('/scripts/openai.js')).captureCurrentCustomConnection().credential.mode)).toBe('unbound');
        await expect(page.locator('#custom_credential_select')).toHaveValue('');
        async function reset(auth) {
            await page.evaluate(async ({ root, auth }) => {
                (await import('/scripts/extensions/third-party/custom-provider-extension/index.js')).configure(`${root}/a/v1`, `${root}/b/v1`, auth);
            }, { root, auth });
            await page.locator('#custom_provider_reset').click();
            await page.locator('dialog[open] .popup-button-ok').click();
            await expect(page.locator('dialog[open]')).toHaveCount(0);
        }
        await reset({ mode: 'bearer', required: true });
        await syntheticKey(page, 'a', 'api_key_custom');
        await reset({ mode: 'none' });
        await expect(page.locator('#api_key_custom')).toBeDisabled();
        expect(await page.evaluate(async () => (await import('/scripts/openai.js')).captureCurrentCustomConnection().credential.mode)).toBe('none');
        let writes = 0;
        const countWrite = request => { writes += Number(request.url().endsWith('/api/secrets/write')); };
        page.on('request', countWrite);
        await page.evaluate(() => { $('#api_key_custom').val('synthetic-injected'); });
        await page.locator('#api_button_openai').click();
        await expect(page.locator('#custom_provider_error')).toContainText('does not accept');
        expect(writes).toBe(0);
        page.off('request', countWrite);
        await reset({ mode: 'bearer', required: false });
        expect(await page.evaluate(async () => (await import('/scripts/openai.js')).captureCurrentCustomConnection().credential.mode)).toBe('none');
        await reset({ mode: 'bearer', required: true });
        expect(await page.evaluate(async () => (await import('/scripts/openai.js')).captureCurrentCustomConnection().credential.mode)).toBe('unbound');
    });

    await test.step('two full profiles request concurrently without changing the active form', async () => {
        await openCustom(page);
        const profiles = [];
        for (const provider of ['a', 'b']) {
            await page.selectOption('#custom_provider_select', `${owner}:${provider}`);
            await syntheticKey(page, provider, 'api_key_custom');
            await page.locator('#custom_model_id').fill(`model-${provider}`);
            const profile = await page.evaluate(async provider => {
                const { oai_settings, captureCurrentCustomConnection } = await import('/scripts/openai.js');
                oai_settings.custom_include_headers = `X-Marker: ${provider}`;
                oai_settings.custom_include_body = `marker: ${provider}`;
                const value = { id: `synthetic-${provider}`, name: `Synthetic ${provider}`, api: 'custom', mode: 'cc', 'custom-connection': captureCurrentCustomConnection() };
                const context = SillyTavern.getContext();
                context.extensionSettings.connectionManager.profiles.push(value);
                $('#connection_profiles').append(new Option(value.name, value.id));
                // Existing profile command is the public UI-selection journey; background requests use neither.
                await context.executeSlashCommandsWithOptions(`/profile "Synthetic ${provider}" timeout=0`);
                return value;
            }, provider);
            profiles.push(profile);
        }
        await page.selectOption('#custom_provider_select', '');
        const before = await page.locator('#custom_api_url_text').inputValue();
        const result = await page.evaluate(async () => {
            const context = SillyTavern.getContext();
            const responses = await Promise.all(['a', 'b'].map(provider => context.ConnectionManagerRequestService.sendRequest(`synthetic-${provider}`, 'Synthetic prompt', 8, { includePreset: false })));
            return responses.map(response => response.content);
        });
        expect(result).toEqual(['Synthetic completion', 'Synthetic completion']);
        await expect(page.locator('#custom_api_url_text')).toHaveValue(before);
        expect(received.slice(-2)).toEqual(expect.arrayContaining([
            { path: '/a/v1/chat/completions', marker: 'a', bodyMarker: 'a', model: 'model-a', correctKey: true, localMetadata: false },
            { path: '/b/v1/chat/completions', marker: 'b', bodyMarker: 'b', model: 'model-b', correctKey: true, localMetadata: false },
        ]));
        expect(profiles[0]['custom-connection'].settings.custom_model).toBe('model-a');
        const streamed = await page.evaluate(async () => {
            const stream = await SillyTavern.getContext().ConnectionManagerRequestService.sendRequest('synthetic-a', 'Synthetic prompt', 8, { includePreset: false, stream: true });
            let result = '';
            for await (const chunk of stream()) result = chunk.text;
            return result;
        });
        expect(streamed).toBe('Synthetic stream');
        await page.evaluate(async () => { await (await import('/script.js')).saveSettings(); });
    });

    await test.step('Profile commits reconnect once, emit only final state and preserve excluded or failed native connections', async () => {
        let checks = 0;
        const countStatus = request => { checks += Number(request.url().endsWith('/api/backends/chat-completions/status')); };
        page.on('request', countStatus);
        await page.evaluate(async () => {
            const context = SillyTavern.getContext();
            window.customEvents = [];
            context.eventSource.on(context.eventTypes.CUSTOM_CONNECTION_CHANGED, value => window.customEvents.push(value));
            $('#main_api').val('kobold').trigger('change');
            (await import('/script.js')).setOnlineStatus('Synthetic native ready');
        });
        await page.selectOption('#connection_profiles', 'synthetic-a');
        await expect.poll(async () => page.evaluate(async () => (await import('/script.js')).online_status)).toBe('Valid');
        expect(checks).toBe(1);
        expect(await page.evaluate(() => window.customEvents.map(({ oldProviderId, newProviderId }) => ({ oldProviderId, newProviderId })))).toEqual([{ oldProviderId: null, newProviderId: `${owner}:a` }]);
        // Exercise the active connection's main-chat transport immediately after Profile commit.
        const response = await page.evaluate(async () => {
            const openai = await import('/scripts/openai.js');
            const result = await openai.sendOpenAIRequest('quiet', [{ role: 'user', content: 'Synthetic main chat' }], new AbortController().signal);
            return openai.getStreamingReply(result, {});
        });
        expect(response).toBe('Synthetic completion');
        await page.selectOption('#connection_profiles', 'synthetic-b');
        await expect(page.locator('#custom_provider_select')).toHaveValue(`${owner}:b`);
        await expect.poll(async () => page.evaluate(async () => (await import('/script.js')).online_status)).toBe('Valid');
        expect(checks).toBe(2);
        expect(await page.evaluate(() => window.customEvents.map(({ oldProviderId, newProviderId }) => ({ oldProviderId, newProviderId })))).toEqual([
            { oldProviderId: null, newProviderId: `${owner}:a` },
            { oldProviderId: `${owner}:a`, newProviderId: `${owner}:b` },
        ]);
        const preserved = await page.evaluate(async () => {
            const context = SillyTavern.getContext();
            const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
            const { oai_settings } = await import('/scripts/openai.js');
            const script = await import('/script.js');
            $('#main_api').val('kobold').trigger('change');
            script.setOnlineStatus('Synthetic native ready');
            window.customEvents.length = 0;
            const profile = { id: 'native-excluded', name: 'Native excluded', api: 'custom', mode: 'cc', 'custom-connection': { version: 1, excluded: true } };
            context.extensionSettings.connectionManager.profiles.push(profile);
            const before = JSON.stringify(oai_settings);
            await SlashCommandParser.commands.profile.callback({ await: 'true', timeout: '0' }, profile.name);
            const excluded = { main: script.main_api, online: script.online_status, unchanged: before === JSON.stringify(oai_settings), events: window.customEvents.length };
            const fail = { ...profile, id: 'native-fail', name: 'Native failed', 'custom-connection': context.extensionSettings.connectionManager.profiles.find(value => value.id === 'synthetic-a')['custom-connection'], preset: 'ignored' };
            context.extensionSettings.connectionManager.profiles.push(fail);
            const callback = SlashCommandParser.commands.preset.callback;
            SlashCommandParser.commands.preset.callback = async () => { throw new Error('Synthetic staged failure'); };
            let failed = false;
            try { await SlashCommandParser.commands.profile.callback({ await: 'true', timeout: '0' }, fail.name); }
            catch { failed = true; }
            finally { SlashCommandParser.commands.preset.callback = callback; }
            return { excluded, failed, main: script.main_api, online: script.online_status, unchanged: before === JSON.stringify(oai_settings), events: window.customEvents.length };
        });
        expect(preserved.excluded).toEqual({ main: 'kobold', online: 'Synthetic native ready', unchanged: true, events: 0 });
        expect(preserved.failed).toBe(true);
        expect(preserved.main).toBe('kobold');
        expect(preserved.online).toBe('Synthetic native ready');
        expect(preserved.unchanged).toBe(true);
        expect(preserved.events).toBe(0);
        expect(checks).toBe(2);
        page.off('request', countStatus);
        await page.evaluate(async () => {
            const context = SillyTavern.getContext();
            await context.executeSlashCommandsWithOptions('/profile "Synthetic a" timeout=0');
        });
    });

    await test.step('profile failure resolves its promise, keeps selection, and rejects missing API/version', async () => {
        await openCustom(page);
        const result = await page.evaluate(async () => {
            const context = SillyTavern.getContext();
            context.extensionSettings.connectionManager.profiles.push({ id: 'synthetic-bad', name: 'Synthetic bad', api: 'custom', mode: 'cc', 'custom-connection': { version: 9 } });
            const selected = context.extensionSettings.connectionManager.selectedProfile;
            let failed = false;
            const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
            try { await SlashCommandParser.commands.profile.callback({ await: 'true', timeout: '0' }, 'Synthetic bad'); } catch { failed = true; }
            const { captureCurrentCustomConnection } = await import('/scripts/openai.js');
            const snapshot = captureCurrentCustomConnection();
            const before = JSON.stringify(snapshot);
            snapshot.credential = { mode: 'reference', key: 'api_key_custom', id: 'missing-synthetic-key', endpoint: snapshot.settings.custom_url };
            context.extensionSettings.connectionManager.profiles.push({ id: 'synthetic-missing', name: 'Synthetic missing key', api: 'custom', mode: 'cc', 'custom-connection': snapshot });
            let missingFailed = false;
            try { await SlashCommandParser.commands.profile.callback({ await: 'true', timeout: '0' }, 'Synthetic missing key'); } catch { missingFailed = true; }
            return { failed, missingFailed, restored: before === JSON.stringify(captureCurrentCustomConnection()), unchanged: selected === context.extensionSettings.connectionManager.selectedProfile, unknownSupported: context.ConnectionManagerRequestService.isProfileSupported({ api: 'unknown' }) };
        });
        expect(result.failed).toBe(true);
        expect(result.missingFailed).toBe(true);
        expect(result.restored).toBe(true);
        expect(result.unchanged).toBe(true);
        expect(result.unknownSupported).toBe(false);
    });

    async function createProfile(page, name, excluded = false) {
        await page.locator('#create_connection_profile').click();
        const dialog = page.locator('dialog[open]');
        await expect(dialog.locator('input[name="exclude"][value="Custom connection"]')).toHaveCount(1);
        await expect(dialog.locator('input[name="exclude"][value="API"]')).toHaveCount(0);
        // eslint-disable-next-line playwright/no-conditional-in-test -- Parameterized control input, not conditional assertions.
        if (excluded) await dialog.locator('input[value="Custom connection"]').uncheck();
        await dialog.locator('.popup-input').fill(name);
        await dialog.locator('.popup-button-ok').click();
        await expect(page.locator('#connection_profiles option:checked')).toHaveText(name);
        return await page.evaluate(name => SillyTavern.getContext().extensionSettings.connectionManager.profiles.find(profile => profile.name === name), name);
    }

    await test.step('real Profile create/update/reload preserves empty values and atomic exclusions', async () => {
        await openCustom(page);
        await page.selectOption('#custom_provider_select', `${owner}:a`);
        await syntheticKey(page, 'a', 'api_key_openai');
        await page.locator('#custom_model_id').fill('same-provider-one');
        const first = await createProfile(page, 'UI first');
        await page.locator('#custom_model_id').fill('same-provider-two');
        const second = await createProfile(page, 'UI second');
        expect(first['custom-connection'].provider.id).toBe(second['custom-connection'].provider.id);
        await page.locator('#custom_model_id').fill('');
        await page.locator('#update_connection_profile').click();
        await expect.poll(async () => page.evaluate(() => SillyTavern.getContext().extensionSettings.connectionManager.profiles.find(profile => profile.name === 'UI second')['custom-connection'].settings.custom_model)).toBe('');
        await page.selectOption('#connection_profiles', first.id);
        await expect(page.locator('#custom_model_id')).toHaveValue('same-provider-one');
        await page.selectOption('#connection_profiles', second.id);
        await expect(page.locator('#custom_model_id')).toHaveValue('');
        await page.locator('#custom_model_id').fill('changed');
        await page.locator('#reload_connection_profile').click();
        await expect(page.locator('#custom_model_id')).toHaveValue('');
        const excluded = await createProfile(page, 'UI excluded', true);
        expect(excluded['custom-connection']).toEqual({ version: 1, excluded: true });
        await page.selectOption('#custom_provider_select', `${owner}:b`);
        await page.locator('#custom_model_id').fill('kept-current');
        await page.selectOption('#connection_profiles', first.id);
        await expect(page.locator('#custom_model_id')).toHaveValue('same-provider-one');
        await page.locator('#custom_model_id').fill('kept-current');
        await page.selectOption('#connection_profiles', excluded.id);
        await expect(page.locator('#custom_model_id')).toHaveValue('kept-current');
        const rejected = await page.evaluate(async id => {
            try { await SillyTavern.getContext().ConnectionManagerRequestService.sendRequest(id, 'Synthetic prompt', 8, { includePreset: false }); return false; }
            catch (error) { return error.message.includes('complete custom_connection override'); }
        }, excluded.id);
        expect(rejected).toBe(true);
        await page.screenshot({ path: 'artifacts/browser/custom-profile-controls-desktop.png' });
        await page.evaluate(async () => { await (await import('/script.js')).saveSettings(); });
    });

    await test.step('preset binding and rapid Profile selection leave one coherent final tuple', async () => {
        await openCustom(page);
        await page.evaluate(() => {
            const context = SillyTavern.getContext();
            window.customEvents = [];
            context.eventSource.on(context.eventTypes.CUSTOM_CONNECTION_CHANGED, value => window.customEvents.push(value));
        });
        await page.selectOption('#custom_provider_select', `${owner}:a`);
        await syntheticKey(page, 'a', 'api_key_custom');
        const saved = await page.evaluate(async () => {
            const { getPresetManager } = await import('/scripts/preset-manager.js');
            const { oai_settings } = await import('/scripts/openai.js');
            const preset = { ...structuredClone(oai_settings), custom_url: 'https://preset.invalid/v1', custom_model: 'preset-model', custom_include_headers: '', custom_include_body: '', custom_exclude_body: '', custom_prompt_post_processing: '' };
            delete preset.custom_provider_state;
            oai_settings.bind_preset_to_connection = false;
            await getPresetManager('openai').savePreset('Synthetic connection preset', preset);
            return 'Synthetic connection preset';
        });
        await page.evaluate(async preset => {
            const { oai_settings } = await import('/scripts/openai.js');
            oai_settings.bind_preset_to_connection = false;
            await SillyTavern.getContext().executeSlashCommandsWithOptions(`/preset "${preset}"`);
        }, saved);
        await expect(page.locator('#custom_provider_select')).toHaveValue(`${owner}:a`);
        await expect(page.locator('#custom_api_url_text')).toHaveValue(`${root}/a/v1`);
        const included = await createProfile(page, 'UI bound included');
        const excluded = await createProfile(page, 'UI bound excluded', true);
        await page.evaluate(preset => {
            const state = SillyTavern.getContext().extensionSettings.connectionManager;
            for (const name of ['UI bound included', 'UI bound excluded']) state.profiles.find(profile => profile.name === name).preset = preset;
        }, saved);
        await page.evaluate(async () => { (await import('/scripts/openai.js')).oai_settings.bind_preset_to_connection = true; });
        await page.selectOption('#connection_profiles', included.id);
        await expect(page.locator('#custom_api_url_text')).toHaveValue(`${root}/a/v1`);
        await expect.poll(async () => page.evaluate(() => SillyTavern.getContext().extensionSettings.connectionManager.selectedProfile)).toBe(included.id);
        await expect.poll(async () => page.evaluate(async () => (await import('/script.js')).online_status)).toBe('Valid');
        await page.locator('#api_key_custom').fill('pending-excluded-synthetic');
        await page.evaluate(() => { window.customEvents.length = 0; });
        await page.selectOption('#connection_profiles', excluded.id);
        await expect.poll(async () => page.evaluate(() => SillyTavern.getContext().extensionSettings.connectionManager.selectedProfile)).toBe(excluded.id);
        await expect(page.locator('#custom_api_url_text')).toHaveValue(`${root}/a/v1`);
        await expect(page.locator('#api_key_custom')).toHaveValue('pending-excluded-synthetic');
        await expect(page.locator('#model_custom_select option[value="second-model"]')).toHaveCount(1);
        expect(await page.evaluate(async () => (await import('/script.js')).online_status)).toBe('Valid');
        expect(await page.evaluate(() => window.customEvents)).toEqual([]);
        await page.evaluate(() => { window.customEvents.length = 0; });
        await page.evaluate(async preset => {
            const manager = (await import('/scripts/preset-manager.js')).getPresetManager('openai');
            await manager.selectPreset(manager.findPreset(preset));
            await (await import('/scripts/openai.js')).getPresetApplicationPromise();
        }, saved);
        await expect(page.locator('#custom_provider_select')).toHaveValue('');
        await expect(page.locator('#custom_api_url_text')).toHaveValue('https://preset.invalid/v1');
        expect(await page.evaluate(() => window.customEvents)).toEqual([{ oldProviderId: `${owner}:a`, newProviderId: null, reason: 'preset' }]);
        expect(await page.evaluate(async () => (await import('/scripts/openai.js')).oai_settings.custom_provider_state.active.credential.mode)).toBe('unbound');
        const loaded = await page.evaluate(async () => {
            const context = SillyTavern.getContext();
            const names = [];
            const listener = name => names.push(name);
            context.eventSource.on(context.eventTypes.CONNECTION_PROFILE_LOADED, listener);
            try {
                await Promise.all([context.executeSlashCommandsWithOptions('/profile "UI first"'), context.executeSlashCommandsWithOptions('/profile "UI second"')]);
                return { names, name: context.extensionSettings.connectionManager.profiles.find(profile => profile.id === context.extensionSettings.connectionManager.selectedProfile).name };
            } finally { context.eventSource.removeListener(context.eventTypes.CONNECTION_PROFILE_LOADED, listener); }
        });
        expect(loaded.name).toBe('UI second');
        expect(loaded.names).not.toContain('UI first');
    });

    await test.step('a late status result cannot populate the next provider', async () => {
        await openCustom(page);
        await page.selectOption('#custom_provider_select', `${owner}:a`);
        await syntheticKey(page, 'a', 'api_key_custom');
        let finish;
        let intercepted;
        const started = new Promise(resolve => { intercepted = resolve; });
        await page.route('**/api/backends/chat-completions/status', async route => {
            intercepted();
            await new Promise(resolve => { finish = resolve; });
            await route.fulfill({ json: { data: [{ id: 'late-model' }] } }).catch(() => {});
        });
        await page.locator('#api_button_openai').click();
        await started;
        await page.selectOption('#custom_provider_select', `${owner}:b`);
        const model = await page.locator('#custom_model_id').inputValue();
        finish();
        await expect(page.locator('#model_custom_select option[value="late-model"]')).toHaveCount(0);
        await expect(page.locator('#custom_model_id')).toHaveValue(model);
    });
    await page.screenshot({ path: 'artifacts/browser/custom-provider-controls-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/browser/custom-provider-controls-mobile.png' });
});
