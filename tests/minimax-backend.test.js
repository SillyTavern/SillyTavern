import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const fetchMock = jest.fn();
const readSecretMock = jest.fn(() => 'test-key');

jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/util.js', () => ({
    color: {
        blue: value => value,
        red: value => value,
        yellow: value => value,
    },
    delay: async () => undefined,
    excludeKeysByYaml: value => value,
    flattenSchema: value => value,
    forwardFetchResponse: jest.fn(),
    getConfigValue: (_key, defaultValue) => defaultValue,
    isValidUrl: value => URL.canParse(value),
    mergeObjectWithYaml: value => value,
    trimTrailingSlash: value => value.replace(/\/+$/, ''),
    tryParse: value => {
        try {
            return JSON.parse(value);
        } catch {
            return undefined;
        }
    },
    uuidv4: () => 'test-uuid',
}));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: readSecretMock,
    SECRET_KEYS: { MINIMAX: 'api_key_minimax' },
}));

/** @type {import('../src/endpoints/backends/chat-completions.js')} */
let mod;

beforeAll(async () => {
    mod = await import('../src/endpoints/backends/chat-completions.js');
});

beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: 'Done' }] }),
    });
});

function createRequest(endpoint, messages = [{ role: 'user', content: 'Hello' }]) {
    return {
        body: {
            chat_completion_source: 'minimax',
            minimax_endpoint: endpoint,
            model: 'MiniMax-M3',
            messages,
            max_tokens: 256,
            stream: false,
            temperature: 1,
            top_p: 0.95,
            include_reasoning: true,
        },
        user: { directories: {} },
        socket: {
            removeAllListeners: jest.fn(),
            on: jest.fn(),
        },
    };
}

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        end: jest.fn(),
    };
}

async function captureRequestUrl(endpoint) {
    await mod.sendMinimaxRequest(createRequest(endpoint), createResponse());
    return fetchMock.mock.calls[0][0];
}

describe('MiniMax chat completion endpoints', () => {
    test('sends global OpenAI-compatible requests to the expected URL', async () => {
        expect(await captureRequestUrl('global')).toBe('https://api.minimax.io/v1/chat/completions');
    });

    test('sends China OpenAI-compatible requests to the expected URL', async () => {
        expect(await captureRequestUrl('cn')).toBe('https://api.minimaxi.com/v1/chat/completions');
    });

    test('requests separated reasoning for MiniMax-M3 OpenAI-compatible responses', async () => {
        await mod.sendMinimaxRequest(createRequest('global'), createResponse());
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.thinking).toEqual({ type: 'adaptive' });
        expect(body.reasoning_split).toBe(true);
    });

    test('sends global Anthropic-compatible requests to the expected URL', async () => {
        expect(await captureRequestUrl('global-anthropic')).toBe('https://api.minimax.io/anthropic/v1/messages');
    });

    test('sends China Anthropic-compatible requests to the expected URL', async () => {
        expect(await captureRequestUrl('cn-anthropic')).toBe('https://api.minimaxi.com/anthropic/v1/messages');
    });

    test('converts Anthropic-compatible messages and preserves the MiniMax API key', async () => {
        const messages = [
            { role: 'system', content: 'Be concise.' },
            { role: 'user', content: [
                { type: 'text', text: 'Describe this video.' },
                { type: 'video_url', video_url: { url: 'data:video/mp4;base64,abc123' } },
            ] },
        ];
        await mod.sendMinimaxRequest(createRequest('global-anthropic', messages), createResponse());
        const options = fetchMock.mock.calls[0][1];
        const body = JSON.parse(options.body);
        expect(options.headers['x-api-key']).toBe('test-key');
        expect(body.system).toEqual([{ type: 'text', text: 'Be concise.' }]);
        expect(body.thinking).toEqual({ type: 'adaptive' });
        expect(body.messages[0].content[1]).toEqual({
            type: 'video',
            source: { type: 'base64', media_type: 'video/mp4', data: 'abc123' },
        });
    });
});
