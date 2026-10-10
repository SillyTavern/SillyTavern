import http from 'node:http';
import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

let server, apiUrl;
let requests = 0;
test.beforeAll(async () => {
    server = http.createServer(async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        requests++;
        if (body.stream) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.write('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: 'Fixture reply.' } }] }) + '\n\n');
            if (body.model !== 'fixture-hold') res.end('data: [DONE]\n\n');
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ choices: [{ message: { content: 'Fixture reply.' } }] }));
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    apiUrl = `http://127.0.0.1:${server.address().port}/v1`;
});
test.afterAll(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
});
test.beforeEach(async ({ page }) => {
    requests = 0;
    await testSetup.awaitST({ page });
    const welcome = page.locator('dialog[open]').filter({ hasText: 'Welcome to SillyTavern!' });
    await expect.poll(async () => {
        if (await welcome.isVisible()) await welcome.locator('.popup-button-ok').click();
        return page.evaluate(async () => {
            const st = await import('/script.js');
            return st.eventSource.autoFireLastArgs.has(st.event_types.APP_READY);
        });
    }, { timeout: 15000 }).toBe(true);
    await page.evaluate(async apiUrl => {
        const st = await import('/script.js');
        const { oai_settings } = await import('/scripts/openai.js');
        const { power_user } = await import('/scripts/power-user.js');
        st.changeMainAPI('openai');
        Object.assign(oai_settings, { chat_completion_source: 'custom', custom_url: apiUrl, custom_model: 'fixture', stream_openai: true });
        power_user.tokenizer = 0;
        power_user.auto_continue.enabled = false;
        power_user.auto_swipe = false;
        st.setOnlineStatus('fixture');
        await st.newAssistantChat({ temporary: true });
    }, apiUrl);
});

for (const type of ['normal', 'quiet', 'preview', 'regenerate', 'swipe', 'continue']) {
    test(`preserves successful ${type} generation`, async ({ page }) => {
        const result = await page.evaluate(async type => {
            const st = await import('/script.js');
            const { createWorldInfoEntry } = await import('/scripts/world-info.js');
            const trigger = type === 'preview' ? 'normal' : type;
            const events = [];
            for (const event of [st.event_types.GENERATION_STARTED, st.event_types.GENERATION_AFTER_COMMANDS]) {
                st.eventSource.on(event, (type, options, dryRun) => events.push([event, type, options.quiet_prompt, dryRun]));
            }
            st.eventSource.on(st.event_types.WORLDINFO_ENTRIES_LOADED, ({ globalLore }) => {
                const data = { entries: {} };
                const entry = createWorldInfoEntry('fixture', data);
                Object.assign(entry, { world: 'fixture', constant: true, content: 'Matching trigger lore.', triggers: [trigger] });
                globalLore.push(entry, { ...entry, uid: 1, content: 'Wrong trigger lore.', triggers: ['impersonate'] });
            });
            let prompt;
            st.eventSource.on(st.event_types.GENERATE_AFTER_DATA, data => prompt = JSON.stringify(data.prompt));
            const value = await st.Generate(trigger, { quiet_prompt: 'Fixture prompt.' }, type === 'preview');
            return { value: String(value), events, prompt, locked: st.is_send_press, lastMessage: st.chat.at(-1)?.mes };
        }, type);
        expect(result.events).toEqual(['generation_started', 'GENERATION_AFTER_COMMANDS'].map(event => [event, type === 'preview' ? 'normal' : type, 'Fixture prompt.', type === 'preview']));
        expect(result.prompt).toContain('Matching trigger lore.');
        expect(result.prompt).not.toContain('Wrong trigger lore.');
        expect(result.locked).toBe(false);
        expect(requests).toBe(type === 'preview' ? 0 : 1);
        expect(type === 'preview' || result.value.includes('Fixture reply.')).toBe(true);
        expect(type !== 'normal' || result.lastMessage.includes('Fixture reply.')).toBe(true);
    });
}

test('preserves stopping an active stream after startup completes', async ({ page }) => {
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const { oai_settings } = await import('/scripts/openai.js');
        oai_settings.custom_model = 'fixture-hold';
        window.streamTest = { settled: false, token: '' };
        st.eventSource.on(st.event_types.STREAM_TOKEN_RECEIVED, token => window.streamTest.token = token);
        void st.Generate('normal').finally(() => window.streamTest.settled = true);
    });
    await expect.poll(() => page.evaluate(() => window.streamTest.token)).toBe('Fixture reply.');
    await page.evaluate(async () => (await import('/script.js')).stopGeneration());
    await expect.poll(() => page.evaluate(() => window.streamTest.settled)).toBe(true);
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
    expect(requests).toBe(1);
});

for (const type of ['regenerate', 'quiet']) {
    test(`stops a pending ${type} before-generation hook without late history changes`, async ({ page }) => {
        const before = await page.evaluate(async type => {
            const st = await import('/script.js');
            const state = window.preparationTest = { entered: 0, settled: 0, next: 0, release: [] };
            st.eventSource.makeFirst(st.event_types.GENERATION_AFTER_COMMANDS, () => state.next++);
            st.eventSource.makeFirst(st.event_types.GENERATION_AFTER_COMMANDS, () => {
                state.entered++;
                return new Promise(resolve => state.release.push(resolve));
            });
            state.start = () => {
                st.setSendButtonState(true);
                st.deactivateSendButtons();
                return st.Generate(type).then(() => state.settled++);
            };
            void state.start();
            return JSON.stringify(st.chat);
        }, type);
        await expect.poll(() => page.evaluate(() => window.preparationTest.entered)).toBe(1);
        await page.evaluate(async () => (await import('/script.js')).stopGeneration());
        await expect.poll(() => page.evaluate(() => window.preparationTest.settled)).toBe(1);
        expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
        await page.evaluate(() => { void window.preparationTest.start(); });
        await expect.poll(() => page.evaluate(() => window.preparationTest.entered)).toBe(2);
        const after = await page.evaluate(async () => {
            window.preparationTest.release[0]();
            await new Promise(resolve => setTimeout(resolve, 0));
            const st = await import('/script.js');
            return { chat: JSON.stringify(st.chat), locked: st.is_send_press, next: window.preparationTest.next };
        });
        expect(after).toEqual({ chat: before, locked: true, next: 0 });
        await page.evaluate(async () => (await import('/script.js')).stopGeneration());
        await expect.poll(() => page.evaluate(() => window.preparationTest.settled)).toBe(2);
        await page.evaluate(() => window.preparationTest.release[1]());
        expect(requests).toBe(0);
    });
}

test('stops waiting for a delayed ping before replacing an assistant message', async ({ page }) => {
    let releasePing;
    let pingEntered = false;
    const ping = new Promise(resolve => releasePing = resolve);
    await page.route('**/api/ping', async route => {
        pingEntered = true;
        await ping;
        await route.fulfill({ status: 200, body: '{}' });
    });
    const before = await page.evaluate(async () => {
        const st = await import('/script.js');
        window.preparationTest = { settled: false };
        st.setSendButtonState(true);
        void st.Generate('regenerate').then(() => window.preparationTest.settled = true);
        return JSON.stringify(st.chat);
    });
    await expect.poll(() => pingEntered).toBe(true);
    await page.evaluate(async () => (await import('/script.js')).stopGeneration());
    try {
        await expect.poll(() => page.evaluate(() => window.preparationTest.settled)).toBe(true);
    } finally {
        releasePing();
    }
    expect(await page.evaluate(async () => JSON.stringify((await import('/script.js')).chat))).toBe(before);
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
    expect(requests).toBe(0);
});

for (const phase of ['interceptor', 'world-info', 'prompt-data', 'prompt-anchors']) {
    test(`does not resume generation after a cancelled ${phase} finishes`, async ({ page }) => {
        await page.evaluate(async phase => {
            const st = await import('/script.js');
            const state = window.preparationTest = { entered: false, completed: false, settled: false, later: 0, args: null, error: null };
            const pending = async () => {
                state.entered = true;
                await new Promise(resolve => state.release = resolve);
                state.completed = true;
            };
            if (phase === 'interceptor') {
                window.SD_ProcessTriggers = (...args) => {
                    state.args = [args.length, Array.isArray(args[0]), typeof args[1], typeof args[2], args[3]];
                    return pending();
                };
                window.vectors_rearrangeChat = () => state.later++;
            } else if (phase === 'world-info') {
                st.eventSource.makeFirst(st.event_types.WORLDINFO_ENTRIES_LOADED, pending);
                st.eventSource.on(st.event_types.GENERATE_AFTER_COMBINE_PROMPTS, () => state.later++);
            } else if (phase === 'prompt-data') {
                st.eventSource.on(st.event_types.GENERATE_AFTER_DATA, pending);
            } else {
                st.eventSource.on(st.event_types.GENERATE_AFTER_DATA, () => {
                    st.setExtensionPrompt('fixture', 'Fixture anchor.', 0, 0, false, 0, pending);
                });
            }
            void st.Generate('normal').catch(error => state.error = String(error)).finally(() => state.settled = true);
        }, phase);
        await expect.poll(() => page.evaluate(() => window.preparationTest.entered)).toBe(true);
        await page.evaluate(async () => (await import('/script.js')).stopGeneration());
        // Stateful callbacks retain the lock until they finish their own work.
        expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(true);
        expect(await page.evaluate(() => window.preparationTest.settled)).toBe(false);
        await page.evaluate(() => window.preparationTest.release());
        await expect.poll(() => page.evaluate(() => window.preparationTest.settled)).toBe(true);
        expect(await page.evaluate(() => ({ completed: window.preparationTest.completed, later: window.preparationTest.later }))).toEqual({ completed: true, later: 0 });
        expect(await page.evaluate(() => window.preparationTest.error)).toBeNull();
        expect(await page.evaluate(() => window.preparationTest.args)).toEqual(phase === 'interceptor' ? [4, true, 'number', 'function', 'normal'] : null);
        expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
        expect(requests).toBe(0);
    });
}

test('finishes an in-flight slash command without starting generation after stop', async ({ page }) => {
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
        const { SlashCommand } = await import('/scripts/slash-commands/SlashCommand.js');
        const state = window.preparationTest = { entered: false, completed: false, settled: false, afterCommands: 0 };
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'fixture-wait', callback: async () => {
            state.entered = true;
            await new Promise(resolve => state.release = resolve);
            state.completed = true;
            return '';
        } }));
        st.eventSource.on(st.event_types.GENERATION_AFTER_COMMANDS, () => state.afterCommands++);
        document.querySelector('#send_textarea').value = '/fixture-wait';
        st.setSendButtonState(true);
        void st.Generate('normal').then(() => state.settled = true);
    });
    await expect.poll(() => page.evaluate(() => window.preparationTest.entered)).toBe(true);
    await page.evaluate(async () => (await import('/script.js')).stopGeneration());
    expect(await page.evaluate(() => window.preparationTest.settled)).toBe(false);
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(true);
    await page.evaluate(() => window.preparationTest.release());
    await expect.poll(() => page.evaluate(() => window.preparationTest.settled)).toBe(true);
    expect(await page.evaluate(() => ({ completed: window.preparationTest.completed, afterCommands: window.preparationTest.afterCommands }))).toEqual({ completed: true, afterCommands: 0 });
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
    expect(requests).toBe(0);
});

for (const outcome of ['complete', 'stop', 'external']) {
    test(`preserves group recursion with ${outcome}`, async ({ page }) => {
        await page.evaluate(async outcome => {
            const st = await import('/script.js');
            const gc = await import('/scripts/group-chats.js');
            const id = 'generation-fixture';
            gc.groups.push({ id, name: id, chat_id: id, chats: [id], members: [st.characters[0].avatar], disabled_members: [], activation_strategy: 1 });
            await gc.openGroupById(id);
            const controller = new AbortController();
            const state = window.preparationTest = { entered: false, settled: false, phases: [], controller };
            for (const event of [st.event_types.GENERATION_STARTED, st.event_types.GENERATION_AFTER_COMMANDS]) {
                st.eventSource.makeFirst(event, () => {
                    state.phases.push([event, gc.is_group_generating]);
                    const pendingEvent = outcome === 'external' ? st.event_types.GENERATION_STARTED : st.event_types.GENERATION_AFTER_COMMANDS;
                    if (outcome !== 'complete' && gc.is_group_generating && event === pendingEvent) {
                        state.entered = true;
                        return new Promise(resolve => state.release = resolve);
                    }
                });
            }
            void st.Generate('normal', { signal: controller.signal }).then(() => state.settled = true);
        }, outcome);
        await expect.poll(() => page.evaluate(() => window.preparationTest.entered)).toBe(outcome !== 'complete');
        await page.evaluate(async outcome => {
            if (outcome === 'external') window.preparationTest.controller.abort();
            if (outcome === 'stop') (await import('/script.js')).stopGeneration();
        }, outcome);
        await expect.poll(() => page.evaluate(() => window.preparationTest.settled)).toBe(true);
        const result = await page.evaluate(async () => {
            const st = await import('/script.js');
            const gc = await import('/scripts/group-chats.js');
            window.preparationTest.release?.();
            return { locked: st.is_send_press, group: gc.is_group_generating, phases: window.preparationTest.phases };
        });
        expect(result.locked).toBe(false);
        expect(result.group).toBe(false);
        const expectedPhases = [['generation_started', false], ['GENERATION_AFTER_COMMANDS', false], ['generation_started', true], ['GENERATION_AFTER_COMMANDS', true]];
        expect(result.phases).toEqual(expectedPhases.slice(0, outcome === 'external' ? 3 : 4));
        expect(requests).toBe(outcome === 'complete' ? 1 : 0);
    });
}

test('cancelling quiet preparation preserves a concurrent active stream', async ({ page }) => {
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const { oai_settings } = await import('/scripts/openai.js');
        oai_settings.custom_model = 'fixture-hold';
        const state = window.preparationTest = { token: '', quiet: false, entered: false, foreground: false };
        st.eventSource.on(st.event_types.STREAM_TOKEN_RECEIVED, token => state.token = token);
        st.eventSource.makeFirst(st.event_types.GENERATION_AFTER_COMMANDS, type => {
            if (type === 'quiet') {
                state.entered = true;
                return new Promise(() => {});
            }
        });
        void st.Generate('normal').finally(() => state.foreground = true);
    });
    await expect.poll(() => page.evaluate(() => window.preparationTest.token)).toBe('Fixture reply.');
    await page.evaluate(async () => {
        const controller = window.preparationTest.controller = new AbortController();
        void (await import('/script.js')).Generate('quiet', { signal: controller.signal }).then(() => window.preparationTest.quiet = true);
    });
    await expect.poll(() => page.evaluate(() => window.preparationTest.entered)).toBe(true);
    await page.evaluate(() => window.preparationTest.controller.abort());
    await expect.poll(() => page.evaluate(() => window.preparationTest.quiet)).toBe(true);
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(true);
    expect(await page.evaluate(() => window.preparationTest.foreground)).toBe(false);
    await page.evaluate(async () => (await import('/script.js')).stopGeneration());
    await expect.poll(() => page.evaluate(() => window.preparationTest.foreground)).toBe(true);
    expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
    expect(requests).toBe(1);
});

for (const cancellation of ['stop', 'external', 'preview-signal', 'aborted-preview-signal']) {
    test(`preview preparation preserves foreground cancellation with ${cancellation}`, async ({ page }) => {
        await page.evaluate(async () => {
            const st = await import('/script.js');
            const controller = new AbortController();
            const state = window.preparationTest = { controller, foreground: false, preview: false, entered: false, previewEntered: false };
            state.foregroundHook = (_type, _options, dryRun) => {
                if (!dryRun) {
                    state.entered = true;
                    return new Promise(resolve => state.releaseForeground = resolve);
                }
            };
            state.previewHook = (_type, _options, dryRun) => {
                if (dryRun) {
                    state.previewEntered = true;
                    return new Promise(resolve => state.releasePreview = resolve);
                }
            };
            st.eventSource.makeFirst(st.event_types.GENERATION_STARTED, state.foregroundHook);
            st.eventSource.makeFirst(st.event_types.GENERATION_AFTER_COMMANDS, state.previewHook);
            st.setExternalAbortController(controller);
            st.setSendButtonState(true);
            void st.Generate('regenerate', { signal: controller.signal }).then(() => state.foreground = true);
        });
        await expect.poll(() => page.evaluate(() => window.preparationTest.entered)).toBe(true);
        await page.evaluate(async cancellation => {
            const st = await import('/script.js');
            const previewController = new AbortController();
            if (cancellation === 'aborted-preview-signal') previewController.abort();
            const options = cancellation.includes('preview-signal') ? { signal: previewController.signal } : {};
            void st.Generate('normal', options, true).then(() => window.preparationTest.preview = true);
        }, cancellation);
        await expect.poll(() => page.evaluate(() => window.preparationTest.previewEntered)).toBe(true);
        await page.evaluate(async cancellation => {
            if (cancellation === 'external') window.preparationTest.controller.abort();
            else (await import('/script.js')).stopGeneration();
        }, cancellation);
        await expect.poll(() => page.evaluate(() => window.preparationTest.foreground)).toBe(true);
        expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
        expect(await page.evaluate(() => window.preparationTest.preview)).toBe(false);
        await page.evaluate(() => {
            window.preparationTest.releaseForeground();
            window.preparationTest.releasePreview();
        });
        await expect.poll(() => page.evaluate(() => window.preparationTest.preview)).toBe(true);
        expect(requests).toBe(0);
        const next = await page.evaluate(async () => {
            const st = await import('/script.js');
            st.eventSource.removeListener(st.event_types.GENERATION_STARTED, window.preparationTest.foregroundHook);
            st.eventSource.removeListener(st.event_types.GENERATION_AFTER_COMMANDS, window.preparationTest.previewHook);
            return String(await st.Generate('regenerate'));
        });
        expect(next).toContain('Fixture reply.');
        expect(await page.evaluate(async () => (await import('/script.js')).is_send_press)).toBe(false);
        expect(requests).toBe(1);
    });
}
