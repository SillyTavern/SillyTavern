import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const fetchMock = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: jest.fn(),
    SECRET_KEYS: {},
}));

describe('ComfyUI generation', () => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;

    beforeAll(async () => {
        const { default: express } = await import('express');
        const { router } = await import('../src/endpoints/stable-diffusion.js');
        const app = express();
        app.use(express.json());
        app.use(router);
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

    test('skips output nodes without images', async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: async () => ({ prompt_id: 'prompt-1' }) })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    'prompt-1': {
                        status: { status_str: 'success' },
                        outputs: {
                            117: { a_images: [{ filename: 'comparison.png' }] },
                            197: { images: [{ filename: 'result.png', subfolder: '', type: 'temp' }] },
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer });

        const response = await fetch(`${baseUrl}/comfy/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'http://127.0.0.1:8188', prompt: '{}' }),
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ format: 'png', data: 'AQID' });
    });

    test('falls back to gifs when no output node has images', async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: async () => ({ prompt_id: 'prompt-2' }) })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    'prompt-2': {
                        status: { status_str: 'success' },
                        outputs: {
                            10: { text: ['some non-media output'] },
                            42: { gifs: [{ filename: 'animation.webp', subfolder: '', type: 'output' }] },
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => Uint8Array.from([4, 5, 6]).buffer });

        const response = await fetch(`${baseUrl}/comfy/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'http://127.0.0.1:8188', prompt: '{}' }),
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ format: 'webp', data: 'BAUG' });
    });

    test('reports an error when no output has images or gifs', async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: async () => ({ prompt_id: 'prompt-3' }) })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    'prompt-3': {
                        status: { status_str: 'success' },
                        outputs: {
                            10: { text: ['no media at all'] },
                        },
                    },
                }),
            });

        const response = await fetch(`${baseUrl}/comfy/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'http://127.0.0.1:8188', prompt: '{}' }),
        });

        expect(response.status).toBe(500);
        expect(await response.text()).toContain('did not return any recognizable outputs');
    });
});

describe('Stability AI generation', () => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;
    let readSecret;
    const originalBaseUrl = process.env.SILLYTAVERN_STABILITY_BASEURL;

    beforeAll(async () => {
        const { setConfigFilePath } = await import('../src/util.js');
        const { fileURLToPath } = await import('node:url');
        setConfigFilePath(fileURLToPath(new URL('../default/config.yaml', import.meta.url)));
        const { default: express } = await import('express');
        const { router } = await import('../src/endpoints/stable-diffusion.js');
        ({ readSecret } = await import('../src/endpoints/secrets.js'));
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
    });

    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer });
    });

    afterEach(() => {
        if (originalBaseUrl === undefined) {
            delete process.env.SILLYTAVERN_STABILITY_BASEURL;
        } else {
            process.env.SILLYTAVERN_STABILITY_BASEURL = originalBaseUrl;
        }
    });

    test.each([
        ['stable-image-core', 'core', undefined],
        ['stable-image-ultra', 'ultra', undefined],
        ['stable-diffusion-3', 'sd3', undefined],
        ['stable-image-core', 'core', 'https://api.stability.ai/'],
        ['stable-diffusion-3', 'sd3', 'https://images.example.test/proxy/'],
    ])('sends %s to %s with base URL %s', async (model, endpoint, configuredBase) => {
        if (configuredBase === undefined) {
            delete process.env.SILLYTAVERN_STABILITY_BASEURL;
        } else {
            process.env.SILLYTAVERN_STABILITY_BASEURL = configuredBase;
        }
        readSecret.mockReturnValue('test-key');

        const response = await fetch(`${baseUrl}/stability/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, payload: { prompt: 'a lighthouse', output_format: 'png' } }),
        });

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('AQID');
        const expectedBase = (configuredBase || 'https://stability.comfy.org').replace(/\/+$/, '');
        expect(fetchMock).toHaveBeenCalledWith(`${expectedBase}/v2beta/stable-image/generate/${endpoint}`, expect.objectContaining({
            headers: { 'Authorization': 'Bearer test-key', 'Accept': 'image/*' },
        }));
        const form = fetchMock.mock.calls[0][1].body;
        expect(form.get('prompt')).toBe('a lighthouse');
        expect(form.get('output_format')).toBe('png');
        expect(form.get('model')).toBe(model === 'stable-diffusion-3' ? 'sd3.5-large' : null);
    });
});
