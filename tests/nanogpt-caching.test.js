import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as util from '../src/util.js';

const fetchMock = jest.fn();
let config;
jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/util.js', () => ({
    ...util,
    getConfigValue: (key, fallback) => config[key] ?? fallback,
}));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: () => 'test-key',
    SECRET_KEYS: { NANOGPT: 'api_key_nanogpt' },
}));
jest.unstable_mockModule('../src/users.js', () => ({ getCookieSecret: jest.fn() }));

const messages = [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'First question' },
    { role: 'assistant', content: 'First answer' },
    { role: 'user', content: 'Second question' },
    { role: 'assistant', content: 'Second answer' },
    { role: 'system', content: 'An in-chat note' },
    { role: 'user', content: 'Third question' },
    { role: 'assistant', content: 'Third answer' },
    { role: 'user', content: 'Fourth question' },
    { role: 'assistant', content: 'Fourth answer' },
    { role: 'user', content: 'Latest question' },
    { role: 'assistant', content: 'Prefill' },
];

function cachedMessageIndices(body) {
    return body.messages.flatMap((message, index) =>
        Array.isArray(message.content) && message.content.some(part => part.cache_control) ? [index] : []);
}

let debugSpy;
beforeAll(() => { debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {}); });
afterAll(() => debugSpy.mockRestore());

describe.each([
    { depth: 4, system: false, ttl: '5m', cached: [3, 6], shortCached: [] },
    { depth: 4, system: true, ttl: '1h', cached: [0, 3, 6], shortCached: [0] },
    { depth: 0, system: false, ttl: '5m', cached: [8, 10], shortCached: [1] },
    { depth: -1, system: true, ttl: '1h', cached: [], shortCached: [] },
    { depth: -1, system: false, ttl: '5m', cached: [], shortCached: [] },
])('NanoGPT caching at depth $depth, system=$system, ttl=$ttl', ({ depth, system, ttl, cached, shortCached }) => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;

    beforeAll(async () => {
        jest.resetModules();
        config = {
            'claude.cachingAtDepth': depth,
            'claude.enableSystemPromptCache': system,
            'claude.extendedTTL': ttl === '1h',
        };
        const { default: express } = await import('express');
        const { router } = await import('../src/endpoints/backends/chat-completions.js');
        const app = express();
        app.use(express.json());
        app.use((request, _response, next) => {
            request.user = { directories: {} };
            next();
        });
        app.use(router);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterAll(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });

    beforeEach(() => {
        fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    });

    async function generate(history, model = 'anthropic/claude-fable-5') {
        const response = await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: 'nanogpt', model, messages: history,
                nanogpt_provider: 'anthropic', nanogpt_payg_override: true,
            }),
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ choices: [] });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('https://nano-gpt.com/api/v1/chat/completions');
        expect(options.headers).toMatchObject({ 'X-Provider': 'anthropic', 'X-Billing-Mode': 'paygo' });
        const body = JSON.parse(options.body);
        expect(body.billing_mode).toBe('paygo');
        expect(body.model).toBe(model);
        return body;
    }

    function expectCacheOptions(body) {
        if (depth >= 0) {
            expect(body.cache_control).toEqual({ enabled: true, ttl, explicitCacheControl: true });
        } else {
            expect(body.cache_control).toEqual(system ? { enabled: true, ttl } : undefined);
        }
        for (const index of cachedMessageIndices(body)) {
            const content = body.messages[index].content;
            expect(content[content.length - 1].cache_control).toEqual({ type: 'ephemeral', ttl });
        }
    }

    test('respects depth without caching the prefill or counting system notes', async () => {
        const body = await generate(messages);
        expect(cachedMessageIndices(body)).toEqual(cached);
        expectCacheOptions(body);
        expect(body.messages.at(-1)).toEqual(messages.at(-1));
    });

    test('keeps the selected cache options for a short history', async () => {
        const body = await generate([messages[0], messages[1], messages.at(-1)]);
        expect(cachedMessageIndices(body)).toEqual(shortCached);
        expectCacheOptions(body);
    });

    test('leaves non-Claude models unchanged', async () => {
        const body = await generate(messages, 'openai/gpt-4.1');
        expect(body.messages).toEqual(messages);
        expect(body.cache_control).toBeUndefined();
    });
});
