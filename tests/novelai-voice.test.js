import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { Readable } from 'node:stream';
import { setConfigFilePath } from '../src/util.js';

setConfigFilePath(new URL('../default/config.yaml', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'));

const upstream = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: upstream }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    SECRET_KEYS: { NOVEL: 'api_key_novel' },
    readSecret: () => 'synthetic-token',
}));

const { default: express } = await import('express');
const { router } = await import('../src/endpoints/novelai.js');

describe('NovelAI TTS', () => {
    let server;
    let baseUrl;

    beforeAll(async () => {
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = { directories: {} };
            next();
        });
        app.use('/api/novelai', router);
        await new Promise(resolve => {
            server = app.listen(0, '127.0.0.1', resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterAll(async () => {
        await new Promise(resolve => server.close(resolve));
    });

    test('requests speech from text.novelai.net, where TTS moved from api.novelai.net', async () => {
        const audio = new Uint8Array([1, 2, 3]);
        upstream.mockResolvedValue({
            ok: true,
            body: Readable.from([audio]),
        });

        const response = await fetch(`${baseUrl}/api/novelai/generate-voice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Hi & bye?', voice: 'Ligeia Seed' }),
        });

        expect(response.status).toBe(200);
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(audio);

        const [url, options] = upstream.mock.calls[0];
        const requested = new URL(url);
        expect(requested.origin).toBe('https://text.novelai.net');
        expect(requested.pathname).toBe('/ai/generate-voice');
        expect(requested.searchParams.get('text')).toBe('Hi & bye?');
        expect(requested.searchParams.get('seed')).toBe('Ligeia Seed');
        expect(requested.searchParams.get('version')).toBe('v2');
        expect(options.headers.Authorization).toBe('Bearer synthetic-token');
    });
});
