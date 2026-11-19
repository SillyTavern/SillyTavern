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
});

test('stopping a pending startup restores access to chat history', async ({ page }) => {
    await page.evaluate(async () => {
        const st = await import('/script.js');
        await st.selectCharacterById(0);
        window.startupTest = { entered: false, settled: false };
        st.eventSource.makeFirst(st.event_types.GENERATION_STARTED, () => {
            window.startupTest.entered = true;
            return new Promise(() => {});
        });
        st.setSendButtonState(true);
        void st.Generate('regenerate').then(() => window.startupTest.settled = true);
    });
    await expect.poll(() => page.evaluate(() => window.startupTest.entered)).toBe(true);
    await page.evaluate(() => document.getElementById('option_select_chat').click());
    await expect(page.locator('#shadow_select_chat_popup')).toBeHidden();
    await page.evaluate(async () => (await import('/script.js')).stopGeneration());
    await expect.poll(() => page.evaluate(() => window.startupTest.settled)).toBe(true);
    await page.evaluate(() => document.getElementById('option_select_chat').click());
    await expect(page.locator('#shadow_select_chat_popup')).toBeVisible();
});

test('stopping a pending startup unlocks generation and ignores its late completion', async ({ page }) => {
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const state = window.startupTest = { entered: 0, settled: 0, nextListener: 0, afterCommands: 0, release: [] };
        st.eventSource.makeFirst(st.event_types.GENERATION_STARTED, () => state.nextListener++);
        st.eventSource.makeFirst(st.event_types.GENERATION_STARTED, () => {
            if (++state.entered <= 2) return new Promise(resolve => state.release.push(resolve));
        });
        st.eventSource.on(st.event_types.GENERATION_AFTER_COMMANDS, () => state.afterCommands++);
        state.start = () => {
            // Match the regenerate menu's send lock before calling the public generation API.
            st.setSendButtonState(true);
            st.deactivateSendButtons();
            return st.Generate('regenerate').then(() => state.settled++);
        };
        void state.start();
    });
    await expect.poll(() => page.evaluate(() => window.startupTest.entered)).toBe(1);
    await page.evaluate(async () => (await import('/script.js')).stopGeneration());
    await expect.poll(() => page.evaluate(() => window.startupTest.settled)).toBe(1);
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
    await expect(page.locator('#mes_stop')).toBeHidden();

    await page.evaluate(() => { void window.startupTest.start(); });
    await expect.poll(() => page.evaluate(() => window.startupTest.entered)).toBe(2);
    await page.evaluate(async () => {
        window.startupTest.release[0]();
        // Drain the old listener's continuation before checking the newer generation.
        await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(true);
    expect(await page.evaluate(() => window.startupTest.nextListener)).toBe(0);
    expect(await page.evaluate(() => window.startupTest.afterCommands)).toBe(0);
    await page.evaluate(async () => (await import('/script.js')).stopGeneration());
    await expect.poll(() => page.evaluate(() => window.startupTest.settled)).toBe(2);
    await page.evaluate(async () => {
        window.startupTest.release[1]();
        await window.startupTest.start();
    });
    expect(await page.evaluate(() => window.startupTest.nextListener)).toBe(1);
    expect(await page.evaluate(() => window.startupTest.afterCommands)).toBe(1);
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
});

for (const cancellation of ['stop', 'external', 'pre-aborted', 'fresh-external']) {
    test(`startup respects ${cancellation} cancellation with an external signal`, async ({ page }) => {
        await page.evaluate(async cancellation => {
            const st = await import('/script.js');
            const controller = new AbortController();
            const state = window.startupTest = { entered: false, settled: false, controller };
            if (cancellation === 'fresh-external') st.stopGeneration();
            else st.setExternalAbortController(controller);
            if (cancellation === 'pre-aborted') controller.abort();
            st.eventSource.makeFirst(st.event_types.GENERATION_STARTED, () => {
                state.entered = true;
                return new Promise(() => {});
            });
            st.setSendButtonState(true);
            void st.Generate('regenerate', { signal: controller.signal }).then(() => state.settled = true);
        }, cancellation);
        await expect.poll(() => page.evaluate(() => window.startupTest.entered)).toBe(cancellation !== 'pre-aborted');
        await page.evaluate(async cancellation => {
            if (cancellation === 'stop') (await import('/script.js')).stopGeneration();
            else window.startupTest.controller.abort();
        }, cancellation);
        await expect.poll(() => page.evaluate(() => window.startupTest.settled)).toBe(true);
        expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
        expect(await page.evaluate(() => window.startupTest.entered)).toBe(cancellation !== 'pre-aborted');
    });
}

test('a pending prompt preview does not replace the foreground startup controller', async ({ page }) => {
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const state = window.startupTest = { foreground: false, preview: false, settled: false };
        st.eventSource.makeFirst(st.event_types.GENERATION_STARTED, (_type, _options, dryRun) => {
            state[dryRun ? 'preview' : 'foreground'] = true;
            return new Promise(() => {});
        });
        st.setSendButtonState(true);
        void st.Generate('regenerate').then(() => state.settled = true);
    });
    await expect.poll(() => page.evaluate(() => window.startupTest.foreground)).toBe(true);
    await page.evaluate(async () => { void (await import('/script.js')).Generate('normal', {}, true); });
    await expect.poll(() => page.evaluate(() => window.startupTest.preview)).toBe(true);
    await page.evaluate(async () => (await import('/script.js')).stopGeneration());
    await expect.poll(() => page.evaluate(() => window.startupTest.settled)).toBe(true);
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
});
