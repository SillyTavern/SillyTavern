import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';

/** @type {{ url: string, args: any }[]} */
const upstreamCalls = [];

const fetchMock = jest.fn(async (url, args) => {
    upstreamCalls.push({ url: String(url), args });
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ response: 'ok' }),
        text: async () => 'ok',
    };
});

jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));

jest.unstable_mockModule('../src/util.js', () => ({
    // Mirrors the real implementation in src/util.js so URL building stays faithful.
    trimV1: str => String(str ?? '').replace(/\/$/, '').replace(/\/v1$/, ''),
    // No config file in tests: every lookup falls back to its default.
    getConfigValue: (key, defaultValue = null) => defaultValue,
    forwardFetchResponse: jest.fn(),
}));

jest.unstable_mockModule('../src/additional-headers.js', () => ({
    setAdditionalHeaders: jest.fn(),
}));

// Real modules under test: the router, the OLLAMA_KEYS allowlist and the payload construction.
const { router } = await import('../src/endpoints/backends/text-completions.js');
const { TEXTGEN_TYPES, OLLAMA_KEYS } = await import('../src/constants.js');

/** @type {import('node:http').Server} */
let server;
let baseUrl = '';

/** Sends a /generate request through the real router and returns the body it forwarded upstream. */
async function generate(body) {
    upstreamCalls.length = 0;
    const response = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await response.text();
    expect(upstreamCalls).toHaveLength(1);
    return upstreamCalls[0];
}

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(router);
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
});

beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
});

describe('Ollama server-side payload allowlist', () => {
    test('does not forward typical_p upstream when a client posts it directly', async () => {
        // A direct API caller or an extension mutating the body still supplies the key.
        const { args } = await generate({
            api_type: TEXTGEN_TYPES.OLLAMA,
            api_server: 'http://127.0.0.1:11434',
            model: 'test-model',
            prompt: 'hello',
            stream: false,
            typical_p: 0.9,
        });

        expect(args.body).not.toContain('typical_p');
        expect(JSON.parse(args.body).options).not.toHaveProperty('typical_p');
    });

    test('still forwards every other allowed Ollama sampling option', async () => {
        const { args } = await generate({
            api_type: TEXTGEN_TYPES.OLLAMA,
            api_server: 'http://127.0.0.1:11434',
            model: 'test-model',
            prompt: 'hello',
            stream: false,
            top_p: 0.9,
            top_k: 40,
            min_p: 0.05,
            tfs_z: 1,
            temperature: 0.7,
            seed: 42,
            num_ctx: 8192,
        });

        const { options } = JSON.parse(args.body);
        expect(options).toEqual({
            top_p: 0.9,
            top_k: 40,
            min_p: 0.05,
            tfs_z: 1,
            temperature: 0.7,
            seed: 42,
            num_ctx: 8192,
        });
    });

    test('keeps the allowlist limited to the removal of typical_p', async () => {
        expect(OLLAMA_KEYS).not.toContain('typical_p');
        // `typical` was never allowlisted, matching the reviewer note.
        expect(OLLAMA_KEYS).not.toContain('typical');
        expect(OLLAMA_KEYS).toEqual([
            'num_predict',
            'num_ctx',
            'num_batch',
            'stop',
            'temperature',
            'repeat_penalty',
            'presence_penalty',
            'frequency_penalty',
            'top_k',
            'top_p',
            'tfs_z',
            'seed',
            'repeat_last_n',
            'min_p',
        ]);
    });

    test('leaves non-Ollama backends forwarding typical_p untouched', async () => {
        // Dreamgen re-serializes the body without filtering, so it still receives typical_p.
        const { args } = await generate({
            api_type: TEXTGEN_TYPES.DREAMGEN,
            api_server: 'http://127.0.0.1:8000',
            model: 'test-model',
            prompt: 'hello',
            stream: false,
            typical_p: 0.9,
        });

        expect(JSON.parse(args.body).typical_p).toBe(0.9);
    });
});
