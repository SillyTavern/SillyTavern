import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

const fetchMock = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: jest.fn(),
    SECRET_KEYS: {},
    writeSecret: jest.fn(),
    allowKeysExposure: jest.fn(),
    SECRETS_FILE: 'stub-secrets.json',
    migrateFlatSecrets: jest.fn(),
    router: jest.fn(),
}));

const IONET_CHAT_URL = 'https://api.intelligence.io.solutions/api/v1/chat/completions';
const IONET_MODELS_URL = 'https://api.intelligence.io.solutions/api/v1/models';

describe('IO Intelligence (io.net) chat completion source', () => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;
    let readSecret;
    let configDirectory;

    beforeAll(async () => {
        // prompt-converters.js reads config.yaml at module load; give it a minimal one.
        const { setConfigFilePath } = await import('../src/util.js');
        configDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'st-ionet-test-'));
        setConfigFilePath(path.join(configDirectory, 'config.yaml'));
        fs.writeFileSync(path.join(configDirectory, 'config.yaml'), '{}\n');

        const secrets = await import('../src/endpoints/secrets.js');
        readSecret = secrets.readSecret;
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
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        fs.rmSync(configDirectory, { recursive: true, force: true });
    });

    beforeEach(() => {
        fetchMock.mockReset();
        readSecret.mockReset();
        readSecret.mockReturnValue('stub-key');
    });

    test('/status fetches the io.net model list with the stored key', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
                object: 'list',
                data: [
                    { id: 'meta-llama/Llama-3.3-70B-Instruct', object: 'model', owned_by: 'io-intelligence' },
                    { id: 'deepseek-ai/DeepSeek-R1-0528', object: 'model', owned_by: 'io-intelligence' },
                ],
            }),
        });

        const response = await fetch(`${baseUrl}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_completion_source: 'ionet' }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.map(model => model.id)).toEqual([
            'meta-llama/Llama-3.3-70B-Instruct',
            'deepseek-ai/DeepSeek-R1-0528',
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, config] = fetchMock.mock.calls[0];
        expect(String(url)).toBe(IONET_MODELS_URL);
        expect(config.method).toBe('GET');
        expect(config.headers.Authorization).toBe('Bearer stub-key');
    });

    test('/status rejects the request when the io.net key is missing', async () => {
        readSecret.mockReturnValue(undefined);

        const response = await fetch(`${baseUrl}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_completion_source: 'ionet' }),
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: true });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('/status reports an upstream auth failure in the response body', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
        });

        const response = await fetch(`${baseUrl}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_completion_source: 'ionet' }),
        });

        // Shared status-check error shape: HTTP 200 with an error flag and an
        // empty model list, so the client shows "no models" rather than a crash.
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ error: true, data: { data: [] } });
    });

    test('/generate posts a non-streaming chat completion to io.net unchanged', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
                id: 'chatcmpl-stub',
                object: 'chat.completion',
                choices: [{ index: 0, message: { role: 'assistant', content: 'stub-ok' }, finish_reason: 'stop' }],
            }),
        });

        const messages = [{ role: 'user', content: 'Reply with exactly: stub-ok' }];
        const response = await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: 'ionet',
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                messages,
                max_tokens: 64,
            }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.choices[0].message.content).toBe('stub-ok');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, config] = fetchMock.mock.calls[0];
        expect(url).toBe(IONET_CHAT_URL);
        expect(config.method).toBe('post');
        expect(config.headers.Authorization).toBe('Bearer stub-key');
        expect(config.headers['Content-Type']).toBe('application/json');
        const parsed = JSON.parse(config.body);
        expect(parsed.model).toBe('meta-llama/Llama-3.3-70B-Instruct');
        expect(parsed.messages).toEqual(messages);
        expect(parsed.max_tokens).toBe(64);
        expect(parsed.stream).toBeUndefined();
    });

    test('/generate forwards io.net sampler overrides', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
        });

        await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: 'ionet',
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                messages: [{ role: 'user', content: 'hi' }],
                repetition_penalty: 1.15,
                min_p: 0.05,
                logprobs: 3,
            }),
        });

        const parsed = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(parsed.repetition_penalty).toBe(1.15);
        expect(parsed.min_p).toBe(0.05);
        expect(parsed.top_logprobs).toBe(3);
        expect(parsed.logprobs).toBe(true);
    });

    test('/generate omits sampler overrides that were not requested', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
        });

        await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: 'ionet',
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                messages: [{ role: 'user', content: 'hi' }],
                logprobs: 0,
            }),
        });

        const parsed = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(parsed).not.toHaveProperty('repetition_penalty');
        expect(parsed).not.toHaveProperty('min_p');
        expect(parsed).not.toHaveProperty('top_logprobs');
        expect(parsed).not.toHaveProperty('logprobs');
    });

    test('/generate forwards tools and tool_choice', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
        });

        const tools = [{
            type: 'function',
            function: {
                name: 'get_weather',
                description: 'Get the weather',
                parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
            },
        }];
        await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: 'ionet',
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                messages: [{ role: 'user', content: 'weather in Paris?' }],
                tools,
                tool_choice: 'auto',
            }),
        });

        const parsed = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(parsed.tools).toEqual(tools);
        expect(parsed.tool_choice).toBe('auto');
    });

    test('/generate requests json_schema output when provided', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ choices: [{ message: { content: '{"reply":"ok"}' } }] }),
        });

        const schema = {
            type: 'object',
            properties: { reply: { type: 'string' } },
            required: ['reply'],
            additionalProperties: false,
        };
        await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: 'ionet',
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                messages: [{ role: 'user', content: 'reply as json' }],
                json_schema: { name: 'reply', strict: true, value: schema },
            }),
        });

        const parsed = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(parsed.response_format).toEqual({
            type: 'json_schema',
            json_schema: { name: 'reply', strict: true, schema },
        });
    });

    test('/generate streams the io.net response when stream is requested', async () => {
        const sse = 'data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n';
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: Readable.from([Buffer.from(sse)]),
        });

        const response = await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: 'ionet',
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                messages: [{ role: 'user', content: 'hi' }],
                stream: true,
            }),
        });

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}');
        expect(text).toContain('data: [DONE]');

        const parsed = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(parsed.stream).toBe(true);
        expect(String(fetchMock.mock.calls[0][0])).toBe(IONET_CHAT_URL);
    });

    test('/generate surfaces an upstream auth failure on the streamed path', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: async () => '{"error":{"message":"Incorrect API key provided"}}',
        });

        const response = await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: 'ionet',
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                messages: [{ role: 'user', content: 'hi' }],
                stream: true,
            }),
        });

        // forwardFetchResponse maps 401 to 400 to avoid resetting the client Basic auth.
        expect(response.status).toBe(400);
        expect(await response.text()).toContain('Incorrect API key provided');
    });
});
