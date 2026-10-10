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

for (const type of ['normal', 'quiet', 'preview']) {
    test(`preserves successful ${type} generation`, async ({ page }) => {
        const result = await page.evaluate(async type => {
            const st = await import('/script.js');
            const events = [];
            for (const event of [st.event_types.GENERATION_STARTED, st.event_types.GENERATION_AFTER_COMMANDS]) {
                st.eventSource.on(event, () => events.push(event));
            }
            const value = await st.Generate(type === 'preview' ? 'normal' : type, { quiet_prompt: 'Fixture prompt.' }, type === 'preview');
            return { value: String(value), events, locked: st.is_send_press, lastMessage: st.chat.at(-1)?.mes };
        }, type);
        expect(result.events).toEqual(['generation_started', 'GENERATION_AFTER_COMMANDS']);
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
