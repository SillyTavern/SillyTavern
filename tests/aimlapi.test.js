import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const fetchMock = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: jest.fn(() => 'test-key'),
    SECRET_KEYS: {},
}));
jest.unstable_mockModule('../src/users.js', () => ({ getCookieSecret: jest.fn() }));

const catalog = {
    data: [
        { id: 'vendor/chat-vision', type: 'openai/chat-completions', capabilities: ['streaming', 'tools', 'vision'] },
        { id: 'vendor/chat-text', type: 'openai/chat-completions', capabilities: ['streaming', 'tools'] },
        { id: 'vendor/chat-vision', type: 'openai/responses/submit', capabilities: ['tools', 'vision'] },
        { id: 'vendor/messages-only', type: 'anthropic/messages', capabilities: ['vision'] },
        { id: 'vendor/image', type: 'openai/image-generations', capabilities: [], info: { name: 'Vendor Image' } },
        { id: 'flux/dev/image-to-image', type: 'openai/image-generations', capabilities: [] },
    ],
};

function jsonResponse(data) {
    return { ok: true, status: 200, json: async () => data };
}

function expectAttributedRequest(call) {
    const [url, options] = call;
    expect(new URL(url.toString()).hostname).toBe('api.aimlapi.com');
    expect(options.headers).toMatchObject({
        'X-AIMLAPI-Source': 'agent/sillytavern',
        'X-AIMLAPI-Partner-ID': expect.any(String),
    });
}

describe('AI/ML API', () => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;

    beforeAll(async () => {
        const { default: express } = await import('express');
        const { setConfigFilePath } = await import('../src/util.js');
        setConfigFilePath(fileURLToPath(new URL('../default/config.yaml', import.meta.url)));
        const { router: chatCompletionsRouter } = await import('../src/endpoints/backends/chat-completions.js');
        const { router: imageRouter } = await import('../src/endpoints/stable-diffusion.js');
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = /** @type {any} */ ({ directories: {} });
            next();
        });
        app.use('/chat-completions', chatCompletionsRouter);
        app.use('/sd', imageRouter);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });

    beforeEach(() => {
        fetchMock.mockReset();
    });

    async function post(path, body = {}) {
        const response = await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        expect(response.status).toBe(200);
        return response.json();
    }

    test('requests model capabilities with attribution headers', async () => {
        fetchMock.mockResolvedValue(jsonResponse(catalog));

        await post('/chat-completions/status', { chat_completion_source: 'aimlapi' });

        const [url] = fetchMock.mock.calls[0];
        expect(new URL(url.toString()).searchParams.get('include')).toBe('capabilities');
        expectAttributedRequest(fetchMock.mock.calls[0]);
    });

    test('sends chat completions to api.aimlapi.com with attribution headers', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));

        await post('/chat-completions/generate', {
            chat_completion_source: 'aimlapi',
            model: 'vendor/chat-vision',
            messages: [{ role: 'user', content: 'hi' }],
            stream: false,
        });

        expect(fetchMock.mock.calls[0][0]).toBe('https://api.aimlapi.com/v1/chat/completions');
        expectAttributedRequest(fetchMock.mock.calls[0]);
    });

    test('lists only chat-completions models with vision for captioning', async () => {
        fetchMock.mockResolvedValue(jsonResponse(catalog));

        const models = await post('/chat-completions/multimodal-models/aimlapi');

        expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('include')).toBe('capabilities');
        expect(models).toEqual(['vendor/chat-vision']);
    });

    test('lists image generation models', async () => {
        fetchMock.mockResolvedValue(jsonResponse(catalog));

        const { data } = await post('/sd/aimlapi/models');

        expect(data).toEqual([{ value: 'vendor/image', text: 'Vendor Image' }]);
    });

    test('sends image generation to api.aimlapi.com with attribution headers', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ data: [{ b64_json: 'aW1n' }] }));

        const result = await post('/sd/aimlapi/generate-image', { model: 'vendor/image', prompt: 'cat' });

        expect(result).toEqual({ format: 'png', data: 'aW1n' });
        expectAttributedRequest(fetchMock.mock.calls[0]);
    });
});
