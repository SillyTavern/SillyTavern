import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, video: 'off' });

const folder = new URL('../public/scripts/extensions/cache-keepalive/', import.meta.url);
const endpoint = '/api/backends/chat-completions/generate';

async function setup(page, native) {
    const requests = [];
    await page.route('http://keepalive.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === endpoint) {
            requests.push(route.request().postDataJSON());
            await route.fulfill({ json: { choices: [{ message: { content: '确认', tool_calls: [{ id: 'never-execute' }] } }] } });
        } else if (path.endsWith('.js')) {
            await route.fulfill({ contentType: 'text/javascript', body: await readFile(new URL(path.slice(1), folder), 'utf8') });
        } else {
            await route.fulfill({ contentType: 'text/html', body: '<div id="extensions_settings"></div><textarea id="send_textarea">Unsent draft</textarea><div id="chat">Real chat</div>' });
        }
    });
    await page.goto('http://keepalive.test/');
    await page.clock.install();
    await page.evaluate(async native => {
        const listeners = new Map();
        const keys = ['GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'MESSAGE_RECEIVED',
            'CHAT_CHANGED', 'MESSAGE_EDITED', 'WORLDINFO_UPDATED', 'CHATCOMPLETION_MODEL_CHANGED'];
        if (native) keys.push('CHAT_COMPLETION_REQUEST_READY');
        const eventTypes = Object.fromEntries(keys.map(key => [key, key]));
        window.emit = async (event, ...args) => {
            for (const listener of listeners.get(event) || []) await listener(...args);
        };
        window.context = {
            chatId: 'chat-a', characterId: 0, groupId: null,
            characters: [{ name: 'Alice' }], groups: [],
            chat: [{ mes: 'Earlier message' }, { mes: 'Latest question' }],
            chatMetadata: {}, extensionPrompts: {}, mainApi: 'openai', onlineStatus: 'connected',
            chatCompletionSettings: { model: 'test-model' }, powerUserSettings: {},
            extensionSettings: { cache_keepalive: { enabled: true, interval: 4 } },
            saveSettingsDebounced() {}, getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'test' }),
            eventTypes,
            eventSource: {
                on(event, handler) { listeners.set(event, [...(listeners.get(event) || []), handler]); },
                removeListener(event, handler) { listeners.set(event, (listeners.get(event) || []).filter(value => value !== handler)); },
            },
        };
        window.SillyTavern = { getContext: () => window.context };
        window.extension = await import('/index.js');
        window.extension.init();
        window.realRequest = {
            model: 'test-model', stream: true, n: 1, max_tokens: 8192, reasoning_effort: 'high',
            tools: [{ type: 'function', function: { name: 'never-execute', parameters: {} } }],
            tool_choice: 'auto', messages: [{ role: 'system', content: 'Full character instructions' }, { role: 'user', content: 'Latest question' }],
        };
        window.normalTurn = async (streaming = true) => {
            await window.emit('GENERATION_STARTED', 'normal', {}, false);
            const body = JSON.stringify(window.realRequest);
            if (native) await window.emit('CHAT_COMPLETION_REQUEST_READY', { type: 'normal', body });
            await fetch('/api/backends/chat-completions/generate', { method: 'POST', body });
            window.context.chat.push({ mes: 'Normal model reply' });
            if (!streaming) await window.emit('MESSAGE_RECEIVED');
            await window.emit('GENERATION_ENDED');
            if (streaming) await window.emit('MESSAGE_RECEIVED');
            window.context.extensionPrompts = {};
        };
    }, native);
    return requests;
}

for (const native of [false, true]) {
    // eslint-disable-next-line playwright/valid-title -- Both branches are literal suite titles.
    test.describe(native ? 'Native request event' : 'Stock plugin fetch observer', () => {
        test('refreshes the same prefix six times, leaves chat and draft untouched, and resumes', async ({ page }) => {
            const requests = await setup(page, native);
            await page.evaluate(() => window.normalTurn());
            await page.clock.runFor(1000);
            const originalChat = await page.evaluate(() => JSON.stringify(window.context.chat));
            // Real ST extensions recreate empty depth prompts after generation.
            await page.evaluate(() => { window.context.extensionPrompts.DEPTH_PROMPT = { value: '', depth: 4 }; });
            for (let i = 1; i <= 6; i++) {
                await page.clock.fastForward(240000);
                await expect(page.locator('[data-status]')).toContainText(`(${i}/6)`);
            }
            await expect(page.locator('[data-status]')).toContainText('Paused');
            await page.clock.fastForward(1000000);
            expect(requests).toHaveLength(7);
            for (const refresh of requests.slice(1)) {
                expect(refresh.messages.slice(0, -1)).toEqual(requests[0].messages);
                expect(refresh.tools).toEqual(requests[0].tools);
                expect(refresh.reasoning_effort).toBe(requests[0].reasoning_effort);
                expect(refresh.max_tokens).toBe(requests[0].max_tokens);
            }
            expect(await page.evaluate(() => JSON.stringify(window.context.chat))).toBe(originalChat);
            await expect(page.locator('#send_textarea')).toHaveValue('Unsent draft');
            await expect(page.locator('#chat')).toHaveText('Real chat');
            await page.locator('[data-resume]').click();
            await page.clock.fastForward(240000);
            await expect(page.locator('[data-status]')).toContainText('(1/6)');
            expect(requests).toHaveLength(8);
        });

        test('supports non-streaming completion, custom intervals, and disable', async ({ page }) => {
            const requests = await setup(page, native);
            await page.locator('[data-interval]').fill('0.5');
            await page.locator('[data-interval]').dispatchEvent('change');
            await page.evaluate(() => window.normalTurn(false));
            await page.clock.runFor(1000);
            await page.clock.fastForward(29000);
            expect(requests).toHaveLength(1);
            await page.clock.runFor(1000);
            await expect(page.locator('[data-status]')).toContainText('(1/6)');
            await page.locator('[data-enabled]').uncheck();
            await page.clock.fastForward(240000);
            expect(requests).toHaveLength(2);
            await expect(page.locator('[data-status]')).toContainText('Disabled');
        });

        test('detects changes to an earlier message and never refreshes an inactive chat', async ({ page }) => {
            const requests = await setup(page, native);
            await page.evaluate(() => window.normalTurn());
            await page.clock.runFor(1000);
            await page.evaluate(() => { window.context.chat[0].mes = 'Edited old message'; });
            await page.clock.fastForward(240000);
            expect(requests).toHaveLength(1);
            await expect(page.locator('[data-status]')).toContainText('Context changed');
            await page.evaluate(() => window.normalTurn());
            await page.clock.runFor(1000);
            await page.evaluate(async () => { window.context.chatId = 'chat-b'; await window.emit('CHAT_CHANGED'); });
            await page.clock.fastForward(240000);
            expect(requests).toHaveLength(2);
        });

        test('excludes quiet generations and cleans up the observer on disposal', async ({ page }) => {
            const requests = await setup(page, native);
            await page.evaluate(async native => {
                await window.emit('GENERATION_STARTED', 'quiet', {}, false);
                const body = JSON.stringify(window.realRequest);
                if (native) await window.emit('CHAT_COMPLETION_REQUEST_READY', { type: 'quiet', body });
                await fetch('/api/backends/chat-completions/generate', { method: 'POST', body });
                await window.emit('GENERATION_ENDED');
            }, native);
            await page.clock.fastForward(1000000);
            expect(requests).toHaveLength(1);
            await page.evaluate(() => window.normalTurn());
            await page.clock.runFor(1000);
            await page.evaluate(() => window.extension.dispose());
            await page.clock.fastForward(240000);
            expect(requests).toHaveLength(2);
            await expect(page.locator('#cache_keepalive_settings')).toHaveCount(0);
        });
    });
}
