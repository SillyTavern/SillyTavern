import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const fetchMock = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/transformers.js', () => ({ getPipeline: jest.fn() }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: jest.fn(),
    SECRET_KEYS: {},
}));

describe('Pollinations TTS model aliases', () => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;

    beforeAll(async () => {
        const { default: express } = await import('express');
        const { router: speechRouter } = await import('../src/endpoints/speech.js');
        const app = express();
        app.use(express.json());
        app.use('/speech', speechRouter);
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

    test.each([undefined, 'openai-audio', 'openai/gpt-audio-mini'])('looks up voices for %s', async (model) => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => [{ name: 'openai/gpt-audio-mini', aliases: ['openai-audio'], voices: ['alloy', 'nova'] }],
        });

        const response = await fetch(`${baseUrl}/speech/pollinations/voices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model }),
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(['alloy', 'nova']);
    });

    test('still accepts catalogs without aliases', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => [{ name: 'openai-audio', voices: ['alloy'] }],
        });

        const response = await fetch(`${baseUrl}/speech/pollinations/voices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(['alloy']);
    });
});
