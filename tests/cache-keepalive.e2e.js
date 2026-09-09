import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, video: 'off' });

const folder = new URL('../public/scripts/extensions/cache-keepalive/', import.meta.url);
const endpoint = '/api/backends/chat-completions/generate';

async function setup(page, native, { locale = 'en-US', forwardedStream = false, reply = { choices: [{ message: { content: '确认', tool_calls: [{ id: 'never-execute' }] } }] } } = {}) {
    const requests = [];
    await page.route('http://keepalive.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === endpoint) {
            requests.push(route.request().postDataJSON());
            if (forwardedStream) {
                await route.fulfill({ body: Buffer.from(`data: ${JSON.stringify(reply)}\n\ndata: [DONE]\n\n`) });
            } else {
                await route.fulfill({ json: reply });
            }
        } else if (path.endsWith('.js')) {
            await route.fulfill({ contentType: 'text/javascript', body: await readFile(new URL(path.split('/').at(-1), folder), 'utf8') });
        } else {
            await route.fulfill({ contentType: 'text/html', body: '<div id="extensions_settings"></div><textarea id="send_textarea">Unsent draft</textarea><div id="chat">Real chat</div>' });
        }
    });
    await page.goto('http://keepalive.test/');
    await page.clock.install();
    await page.evaluate(async ({ native, locale }) => {
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
            getCurrentLocale: () => locale,
            eventSource: {
                on(event, handler) { listeners.set(event, [...(listeners.get(event) || []), handler]); },
                removeListener(event, handler) { listeners.set(event, (listeners.get(event) || []).filter(value => value !== handler)); },
            },
        };
        window.SillyTavern = { getContext: () => window.context };
        window.transportSignals = [];
        const transportFetch = window.fetch;
        window.fetch = function (input, options) {
            if (options?.signal) window.transportSignals.push(options.signal);
            return transportFetch.apply(this, arguments);
        };
        window.extension = await import(native ? '/scripts/extensions/cache-keepalive/index.js' : '/scripts/extensions/third-party/cache-keepalive/index.js');
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
    }, { native, locale });
    return requests;
}

for (const native of [false, true]) {
    // eslint-disable-next-line playwright/valid-title -- Both branches are literal suite titles.
    test.describe(native ? 'Native request event' : 'Stock plugin fetch observer', () => {
        test('accepts stock server forwarded SSE without an event-stream response header', async ({ page }) => {
            const requests = await setup(page, native, { locale: 'zh-CN', forwardedStream: true, reply: { usage: { cache_read_input_tokens: 33960 } } });
            await page.evaluate(() => window.normalTurn());
            await page.clock.fastForward(240000);
            await expect(page.locator('[data-status]')).toContainText('保活请求成功 (1/6)');
            await expect(page.locator('[data-cache]')).toContainText('33960');
            expect(requests).toHaveLength(2);
            await expect(page.locator('#chat')).toHaveText('Real chat');
        });

        test('shows Chinese state, countdown, captured request and confirmed cache usage', async ({ page }) => {
            await setup(page, native, { locale: 'zh-CN', reply: { usage: { cache_read_input_tokens: 800, cache_creation_input_tokens: 40 } } });
            const panel = page.locator('#cache_keepalive_settings');
            await expect(panel.locator('[data-label="title"]')).toHaveText('自动保持缓存在线');
            await expect(panel.locator('[data-snapshot]')).toContainText('尚未捕获');
            await expect(panel.locator('[data-cache]')).toContainText('尚未检查');
            await page.evaluate(() => window.normalTurn());
            await expect(panel.locator('[data-snapshot]')).toContainText('已捕获');
            await expect(panel.locator('[data-cache]')).toContainText('尚未检查');
            await page.clock.runFor(1000);
            await expect(panel.locator('[data-countdown]')).toHaveText('下次刷新: 03:59');
            await page.clock.fastForward(239000);
            await expect(panel.locator('[data-status]')).toContainText('保活请求成功 (1/6)');
            await expect(panel.locator('[data-cache]')).toContainText('已命中：800 个词元 · 已写入：40 个词元');
            await expect(panel.locator('[data-last-success]')).not.toContainText('暂无');
            expect(await panel.textContent()).not.toMatch(/Enable|Resume|Waiting|Unknown|Version/);
        });

        test('shows missing usage as unknown and stays in English', async ({ page }) => {
            await setup(page, native);
            await page.evaluate(() => window.normalTurn());
            await page.clock.fastForward(240000);
            await expect(page.locator('[data-cache]')).toContainText('Unknown — provider returned no cache usage');
            expect(await page.locator('#cache_keepalive_settings').textContent()).not.toMatch(/[\u4e00-\u9fff]/);
            await page.locator('[data-enabled]').uncheck();
            await expect(page.locator('[data-countdown]')).toHaveText('Next refresh: Disabled');
            await expect(page.locator('[data-snapshot]')).toContainText('Not captured');
        });

        test('provides a visible update action with an explicit result', async ({ page }) => {
            await setup(page, native, { locale: 'zh-CN' });
            await page.addStyleTag({ content: '.inline-drawer-content { display: none; }' });
            const updates = [];
            await page.route('**/api/extensions/discover', route => route.fulfill({ json: [{ name: 'third-party/cache-keepalive', type: 'local' }] }));
            await page.route('**/api/extensions/update', route => {
                updates.push(route.request().postDataJSON());
                return route.fulfill({ json: { isUpToDate: false } });
            });
            await expect(page.locator('[data-update]')).toHaveText('检查并更新');
            await expect(page.locator('[data-update]')).toBeVisible();
            await expect(page.locator('[data-countdown]')).toBeVisible();
            await page.locator('[data-update]').click();
            await expect(page.locator('[data-update-status]')).toContainText(native ? '这是内置版' : '更新已安装');
            expect(updates).toEqual(native ? [] : [{ extensionName: 'cache-keepalive', global: false }]);
        });

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
            await page.clock.fastForward(28000);
            expect(requests).toHaveLength(1);
            await page.clock.runFor(1000);
            await expect(page.locator('[data-status]')).toContainText('(1/6)');
            await page.locator('[data-enabled]').uncheck();
            await page.clock.fastForward(240000);
            expect(requests).toHaveLength(2);
            await expect(page.locator('[data-status]')).toContainText('Disabled');
        });

        test('counts the normal generation time toward the four-minute deadline', async ({ page }) => {
            const requests = await setup(page, native);
            await page.evaluate(async native => {
                await window.emit('GENERATION_STARTED', 'normal', {}, false);
                const body = JSON.stringify(window.realRequest);
                if (native) await window.emit('CHAT_COMPLETION_REQUEST_READY', { type: 'normal', body });
                await fetch('/api/backends/chat-completions/generate', { method: 'POST', body });
            }, native);
            await page.clock.fastForward(120000);
            expect(requests).toHaveLength(1);
            await page.evaluate(async () => {
                window.context.chat.push({ mes: 'Two-minute reply' });
                await window.emit('GENERATION_ENDED');
                await window.emit('MESSAGE_RECEIVED');
            });
            await page.clock.runFor(1000);
            await page.clock.fastForward(118000);
            expect(requests).toHaveLength(1);
            await page.clock.runFor(1000);
            await expect(page.locator('[data-status]')).toContainText('(1/6)');
            expect(requests).toHaveLength(2);
        });

        test('ignores chat-save timestamps and auxiliary quiet requests during normal generation', async ({ page }) => {
            const requests = await setup(page, native);
            await page.evaluate(async native => {
                window.context.characters[0].date_last_chat = 100;
                await window.emit('GENERATION_STARTED', 'normal', {}, false);
                const body = JSON.stringify({ ...window.realRequest, type: 'normal' });
                if (native) await window.emit('CHAT_COMPLETION_REQUEST_READY', { type: 'normal', body });
                await fetch('/api/backends/chat-completions/generate', { method: 'POST', body });
                const auxiliary = JSON.stringify({ ...window.realRequest, type: 'quiet', messages: [{ role: 'user', content: 'Auxiliary request' }] });
                if (native) await window.emit('CHAT_COMPLETION_REQUEST_READY', { type: 'quiet', body: auxiliary });
                await fetch('/api/backends/chat-completions/generate', { method: 'POST', body: auxiliary });
                window.context.characters[0].date_last_chat = 200;
            }, native);
            await page.clock.fastForward(240000);
            await expect(page.locator('[data-status]')).toContainText('(1/6)');
            expect(requests).toHaveLength(3);
            expect(requests[2].messages.slice(0, -1)).toEqual(requests[0].messages);
            expect(requests[2].type).toBe('normal');
        });

        test('keeps the original request after an automatic prompt preview rebuild', async ({ page }) => {
            const requests = await setup(page, native);
            await page.evaluate(() => window.normalTurn());
            await page.clock.runFor(1000);
            await page.evaluate(async () => {
                await window.emit('GENERATION_STARTED', 'normal', {}, true);
                window.context.extensionPrompts.DEPTH_PROMPT = { value: 'Derived preview after the reply', depth: 4 };
                window.context.chatMetadata.runtime_preview = { updated: Date.now() };
                window.context.chat[0].extra = { token_count: 900 };
                window.context.chat.at(-1).extra = { runtime_output_state: 'Post-processing finished' };
            });
            await page.clock.fastForward(239000);
            await expect(page.locator('[data-status]')).toContainText('(1/6)');
            expect(requests).toHaveLength(2);
            expect(requests[1].messages.slice(0, -1)).toEqual(requests[0].messages);
            await page.evaluate(() => { window.context.chatMetadata.note_prompt = 'User edited the author note'; });
            await page.clock.fastForward(240000);
            expect(requests).toHaveLength(2);
            await expect(page.locator('[data-status]')).toContainText('Context changed');
        });

        test('refreshes while the foreground request is pending and its output grows', async ({ page }) => {
            const requests = await setup(page, native);
            let foreground;
            await page.route('**/api/backends/chat-completions/generate', route => {
                const body = route.request().postDataJSON();
                if (body.messages.at(-1).content === 'Latest question') {
                    requests.push(body);
                    foreground = route;
                    return;
                }
                return route.fallback();
            });
            await page.evaluate(async native => {
                await window.emit('GENERATION_STARTED', 'normal', {}, false);
                const body = JSON.stringify(window.realRequest);
                if (native) await window.emit('CHAT_COMPLETION_REQUEST_READY', { type: 'normal', body });
                window.foregroundController = new AbortController();
                window.foregroundDone = false;
                window.normalPending = fetch('/api/backends/chat-completions/generate', { method: 'POST', body, signal: window.foregroundController.signal })
                    .then(response => response.json()).then(() => { window.foregroundDone = true; });
            }, native);
            await expect.poll(() => requests.length).toBe(1);
            await page.evaluate(() => { window.context.chat.push({ mes: 'Partial output' }); });
            await page.clock.fastForward(240000);
            await expect(page.locator('[data-status]')).toContainText('(1/6)');
            await page.evaluate(() => { window.context.chat.at(-1).mes += ' and more output'; });
            await page.clock.fastForward(240000);
            await expect(page.locator('[data-status]')).toContainText('(2/6)');
            expect(requests).toHaveLength(3);
            expect(requests[1].messages.slice(0, -1)).toEqual(requests[0].messages);
            expect(await page.evaluate(() => window.foregroundDone)).toBe(false);
            expect(await page.evaluate(() => window.foregroundController.signal.aborted)).toBe(false);
            await foreground.fulfill({ json: { choices: [{ message: { content: 'Finished' } }] } });
            await page.evaluate(async () => {
                await window.normalPending;
                await window.emit('GENERATION_ENDED');
                await window.emit('MESSAGE_RECEIVED');
            });
            await page.clock.runFor(1000);
            expect(requests).toHaveLength(3);
            await page.clock.fastForward(239000);
            await expect(page.locator('[data-status]')).toContainText('(3/6)');
        });

        test('cancels only background refresh on chat switch, without overlapping refreshes', async ({ page }) => {
            const requests = await setup(page, native);
            const held = [];
            await page.route('**/api/backends/chat-completions/generate', route => {
                requests.push(route.request().postDataJSON());
                held.push(route);
            });
            await page.evaluate(async native => {
                await window.emit('GENERATION_STARTED', 'normal', {}, false);
                const body = JSON.stringify(window.realRequest);
                if (native) await window.emit('CHAT_COMPLETION_REQUEST_READY', { type: 'normal', body });
                window.foregroundController = new AbortController();
                window.normalPending = fetch('/api/backends/chat-completions/generate', { method: 'POST', body, signal: window.foregroundController.signal });
            }, native);
            await expect.poll(() => held.length).toBe(1);
            await page.clock.fastForward(240000);
            await expect.poll(() => held.length).toBe(2);
            await page.clock.runFor(10000);
            expect(held).toHaveLength(2);
            await page.evaluate(async () => { window.context.chatId = 'another-chat'; await window.emit('CHAT_CHANGED'); });
            expect(await page.evaluate(() => window.transportSignals.at(-1).aborted)).toBe(true);
            expect(await page.evaluate(() => window.foregroundController.signal.aborted)).toBe(false);
            await page.clock.fastForward(240000);
            expect(held).toHaveLength(2);
            await held[0].fulfill({ json: { choices: [] } });
            await page.evaluate(() => window.normalPending.then(() => undefined));
        });

        test('keeps swipe and continuation output out of the comparison prefix', async ({ page }) => {
            const requests = await setup(page, native);
            for (const type of ['swipe', 'continue']) {
                await page.evaluate(async ({ native, type }) => {
                    window.context.chat = [{ mes: 'Earlier message' }, { mes: 'Original assistant answer' }];
                    await window.emit('GENERATION_STARTED', type, {}, false);
                    const body = JSON.stringify(window.realRequest);
                    if (native) await window.emit('CHAT_COMPLETION_REQUEST_READY', { type, body });
                    await fetch('/api/backends/chat-completions/generate', { method: 'POST', body });
                    window.context.chat.at(-1).mes = 'Growing replacement or continuation';
                }, { native, type });
                await page.clock.fastForward(240000);
                await expect(page.locator('[data-status]')).toContainText('(1/6)');
            }
            expect(requests).toHaveLength(4);
            expect(requests[3].messages.slice(0, -1)).toEqual(requests[2].messages);
        });

        test('invalidates an earlier-message edit during generation', async ({ page }) => {
            const requests = await setup(page, native);
            await page.evaluate(async native => {
                await window.emit('GENERATION_STARTED', 'normal', {}, false);
                const body = JSON.stringify(window.realRequest);
                if (native) await window.emit('CHAT_COMPLETION_REQUEST_READY', { type: 'normal', body });
                await fetch('/api/backends/chat-completions/generate', { method: 'POST', body });
                window.context.chat[0].mes = 'Edited while streaming';
                await window.emit('MESSAGE_EDITED');
            }, native);
            await page.clock.fastForward(240000);
            expect(requests).toHaveLength(1);
            await expect(page.locator('[data-status]')).toContainText('Context changed');
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
