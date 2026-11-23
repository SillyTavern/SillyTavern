import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.beforeEach(async ({ page }) => {
    await testSetup.awaitST({ page });
    const welcome = page.locator('dialog[open]').filter({ hasText: 'Welcome to SillyTavern!' });
    await expect.poll(async () => {
        if (await welcome.isVisible()) await welcome.locator('.popup-button-ok').click();
        return page.evaluate(async () => {
            const st = await import('/script.js');
            return st.eventSource.autoFireLastArgs.has(st.event_types.APP_READY);
        });
    }, { timeout: 15000 }).toBe(true);
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const { cancelDebounce } = await import('/scripts/utils.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        cancelDebounce(st.saveSettingsDebounced);
        await st.saveSettings();
        const state = window.settingsTest = { requests: [], events: [], errors: [], saves: [] };
        const fetch = window.fetch;
        window.fetch = (url, options) => {
            if (url !== '/api/settings/save') return fetch(url, options);
            return new Promise((resolve, reject) => state.requests.push({
                body: JSON.parse(options.body), resolve, reject,
            }));
        };
        window.toastr.error = (...args) => state.errors.push(args);
        st.eventSource.on(st.event_types.SETTINGS_UPDATED, () => state.events.push(st.settings.extension_settings.saveTest.value));
        state.save = value => {
            extension_settings.saveTest = { value };
            const save = st.saveSettings();
            state.saves.push(save);
            return save;
        };
    });
});

test('saves snapshots in order without retaining mutable nested settings', async ({ page }) => {
    await page.evaluate(() => { void window.settingsTest.save(1); });
    await expect.poll(() => page.evaluate(() => window.settingsTest.requests.length)).toBe(1);
    await page.evaluate(async () => {
        void window.settingsTest.save(2);
        const { extension_settings } = await import('/scripts/extensions.js');
        extension_settings.saveTest.value = 3;
    });
    expect(await page.evaluate(() => window.settingsTest.requests.length)).toBe(1);
    await page.evaluate(async () => {
        window.settingsTest.requests[0].resolve({ ok: true });
        await window.settingsTest.saves[0];
    });
    await expect.poll(() => page.evaluate(() => window.settingsTest.requests.length)).toBe(2);
    await page.evaluate(async () => {
        window.settingsTest.requests[1].resolve({ ok: true });
        await Promise.all(window.settingsTest.saves);
    });
    expect(await page.evaluate(() => window.settingsTest.requests.map(x => x.body.extension_settings.saveTest.value))).toEqual([1, 2]);
    expect(await page.evaluate(() => window.settingsTest.events)).toEqual([1, 2]);
    expect(await page.evaluate(async () => (await import('/script.js')).settings.extension_settings.saveTest.value)).toBe(2);
});

for (const failure of ['HTTP error', 'network rejection']) {
    test(`recovers after ${failure} without reporting a saved event`, async ({ page }) => {
        await page.evaluate(() => { void window.settingsTest.save(1); void window.settingsTest.save(2); });
        await expect.poll(() => page.evaluate(() => window.settingsTest.requests.length)).toBe(1);
        await page.evaluate(async failure => {
            const state = window.settingsTest;
            if (failure === 'HTTP error') state.requests[0].resolve({ ok: false, statusText: 'Internal Server Error' });
            else state.requests[0].reject(new TypeError('Failed to fetch'));
            await state.saves[0];
        }, failure);
        expect(await page.evaluate(() => window.settingsTest.events)).toEqual([]);
        expect(await page.evaluate(() => window.settingsTest.errors.length)).toBe(1);
        await expect.poll(() => page.evaluate(() => window.settingsTest.requests.length)).toBe(2);
        await page.evaluate(async () => {
            window.settingsTest.requests[1].resolve({ ok: true });
            await Promise.all(window.settingsTest.saves);
        });
        expect(await page.evaluate(() => window.settingsTest.events)).toEqual([2]);
    });
}

test('a settings-updated listener can await another save', async ({ page }) => {
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const listener = async () => {
            st.eventSource.removeListener(st.event_types.SETTINGS_UPDATED, listener);
            await window.settingsTest.save(2);
            window.settingsTest.listenerFinished = true;
        };
        st.eventSource.on(st.event_types.SETTINGS_UPDATED, listener);
        void window.settingsTest.save(1);
    });
    await expect.poll(() => page.evaluate(() => window.settingsTest.requests.length)).toBe(1);
    await page.evaluate(() => window.settingsTest.requests[0].resolve({ ok: true }));
    await expect.poll(() => page.evaluate(() => window.settingsTest.requests.length)).toBe(2);
    await page.evaluate(async () => {
        window.settingsTest.requests[1].resolve({ ok: true });
        await window.settingsTest.saves[0];
    });
    expect(await page.evaluate(() => window.settingsTest.listenerFinished)).toBe(true);
    expect(await page.evaluate(() => window.settingsTest.events)).toEqual([1, 2]);
});

test('prompt manager waits for its own save and settles after a failure', async ({ page }) => {
    await page.evaluate(async () => {
        void window.settingsTest.save(1);
        const { promptManager } = await import('/scripts/openai.js');
        window.settingsTest.promptSave = promptManager.saveServiceSettings().then(() => {
            window.settingsTest.promptFinished = true;
        });
    });
    await expect.poll(() => page.evaluate(() => window.settingsTest.requests.length)).toBe(1);
    await page.evaluate(async () => {
        window.settingsTest.requests[0].resolve({ ok: true });
        await window.settingsTest.saves[0];
    });
    expect(await page.evaluate(() => !!window.settingsTest.promptFinished)).toBe(false);
    await expect.poll(() => page.evaluate(() => window.settingsTest.requests.length)).toBe(2);
    await page.evaluate(async () => {
        window.settingsTest.requests[1].resolve({ ok: false, statusText: 'Internal Server Error' });
        await window.settingsTest.promptSave;
    });
    expect(await page.evaluate(() => window.settingsTest.promptFinished)).toBe(true);
    expect(await page.evaluate(() => window.settingsTest.events)).toEqual([1]);
    expect(await page.evaluate(() => window.settingsTest.errors.length)).toBe(1);
});
