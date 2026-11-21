import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as util from '../src/util.js';

const providerFetch = jest.fn();
const extensionSettings = { caption: {} };
const textgenSettings = { llamacpp_model: '', server_urls: {} };
const nativeFetch = global.fetch;
const image = 'data:image/png;base64,aW1hZ2U=';
const prompt = 'Describe this image.';

jest.unstable_mockModule('node-fetch', () => ({ default: providerFetch }));
jest.unstable_mockModule('../src/util.js', () => ({ ...util, getConfigValue: (_key, fallback) => fallback }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: () => '',
    SECRET_KEYS: {},
}));
jest.unstable_mockModule('../public/script.js', () => ({
    CONNECT_API_MAP: {},
    createModelIcon: jest.fn(),
    getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    substituteParams: value => value,
}));
jest.unstable_mockModule('../public/scripts/extensions.js', () => ({
    extension_settings: extensionSettings,
    openThirdPartyExtensionMenu: jest.fn(),
}));
jest.unstable_mockModule('../public/scripts/i18n.js', () => ({ t: strings => strings[0] }));
jest.unstable_mockModule('../public/scripts/openai.js', () => ({
    oai_settings: {}, proxies: [], ZAI_ENDPOINT: {}, POLLINATIONS_ENDPOINT: {},
}));
jest.unstable_mockModule('../public/scripts/secrets.js', () => ({ SECRET_KEYS: {}, secret_state: {} }));
jest.unstable_mockModule('../public/scripts/textgen-settings.js', () => ({
    textgen_types: { LLAMACPP: 'llamacpp' },
    textgenerationwebui_settings: textgenSettings,
}));
jest.unstable_mockModule('../public/scripts/tokenizers.js', () => ({ getTokenCountAsync: jest.fn() }));
jest.unstable_mockModule('../public/scripts/utils.js', () => ({
    createThumbnail: jest.fn(), isValidUrl: jest.fn(),
}));

describe('llama.cpp multimodal caption model selection', () => {
    /** @type {import('node:http').Server} */
    let server;
    let getMultimodalCaption;

    beforeAll(async () => {
        const { default: express } = await import('express');
        const { router } = await import('../src/endpoints/openai.js');
        ({ getMultimodalCaption } = await import('../public/scripts/extensions/shared.js'));
        const app = express();
        app.use(express.json());
        app.use((request, _response, next) => {
            request.user = { directories: {} };
            next();
        });
        app.use('/api/openai', router);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        jest.spyOn(global, 'fetch').mockImplementation((url, options) => nativeFetch(new URL(url, baseUrl), options));
        jest.spyOn(console, 'debug').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });

    beforeEach(() => {
        extensionSettings.caption = {
            multimodal_api: 'llamacpp',
            multimodal_model: 'llamacpp_current',
            alt_endpoint_enabled: false,
            alt_endpoint_url: 'http://secondary.example:8081/v1',
        };
        textgenSettings.llamacpp_model = 'Melody1437-26B';
        textgenSettings.server_urls = { llamacpp: 'http://primary.example:8080' };
        providerFetch.mockReset().mockImplementation(async (_url, options) => {
            const { model } = JSON.parse(options.body);
            if (!['Melody1437-26B', 'custom-vision-model', ''].includes(model)) {
                return {
                    ok: false,
                    statusText: 'Bad Request',
                    text: async () => JSON.stringify({ error: { message: `model '${model}' not found` } }),
                };
            }
            return { ok: true, json: async () => ({ choices: [{ message: { content: ' A tree. ' } }] }) };
        });
    });

    function expectProviderRequest(model, endpoint) {
        expect(providerFetch).toHaveBeenCalledTimes(1);
        const [url, options] = providerFetch.mock.calls[0];
        expect(url).toBe(`${endpoint}/v1/chat/completions`);
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({
            model,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: image } },
                ],
            }],
        });
    }

    test.each([false, true])('uses the selected model with secondary endpoint=%s', async (secondary) => {
        extensionSettings.caption.alt_endpoint_enabled = secondary;
        await expect(getMultimodalCaption(image, prompt)).resolves.toBe('A tree.');
        expectProviderRequest('Melody1437-26B', secondary ? 'http://secondary.example:8081' : 'http://primary.example:8080');
    });

    test('preserves an explicit caption model instead of using the connection model', async () => {
        extensionSettings.caption.multimodal_model = 'custom-vision-model';
        await expect(getMultimodalCaption(image, prompt)).resolves.toBe('A tree.');
        expectProviderRequest('custom-vision-model', 'http://primary.example:8080');
    });

    test('allows a single-model server without a selected model', async () => {
        textgenSettings.llamacpp_model = '';
        providerFetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'A tree.' } }] }) });
        await expect(getMultimodalCaption(image, prompt)).resolves.toBe('A tree.');
        expectProviderRequest('', 'http://primary.example:8080');
    });
});
