import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const fetchMock = jest.fn();
const readSecretMock = jest.fn();

jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/transformers.js', () => ({ getPipeline: jest.fn() }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: readSecretMock,
    SECRET_KEYS: { FISH_AUDIO: 'api_key_fish_audio' },
}));

function mockHeaders(map = {}) {
    const lower = Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
    return { get: (name) => lower[name.toLowerCase()] ?? null };
}

describe('Fish Audio speech endpoints', () => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;

    beforeAll(async () => {
        const { default: express } = await import('express');
        const { router: speechRouter } = await import('../src/endpoints/speech.js');
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = { directories: { root: '/tmp/test-user' } };
            next();
        });
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
        readSecretMock.mockReset();
        readSecretMock.mockReturnValue('test-fish-key');
    });

    test('returns 400 without calling Fish Audio when no API key is configured', async () => {
        readSecretMock.mockReturnValue('');

        const response = await fetch(`${baseUrl}/speech/fish-audio/voices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Set a Fish Audio API key first.' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('paginates and filters trained TTS voices from /voices', async () => {
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                headers: mockHeaders({ 'content-type': 'application/json' }),
                json: async () => ({
                    has_more: true,
                    items: [
                        { _id: 'voice-1', type: 'tts', state: 'trained', title: 'Alice' },
                        { _id: 'voice-untrained', type: 'tts', state: 'training', title: 'Pending' },
                        { _id: 'voice-dmca', type: 'tts', state: 'trained', title: 'TakenDown', dmca_taken_down: true },
                        { _id: 'bad/id', type: 'tts', state: 'trained', title: 'Invalid' },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                headers: mockHeaders({ 'content-type': 'application/json' }),
                json: async () => ({
                    has_more: false,
                    items: [
                        { _id: 'voice-2', type: 'tts', state: 'trained', title: 'Bob' },
                        { _id: 'other-type', type: 'asr', state: 'trained', title: 'NotTTS' },
                    ],
                }),
            });

        const response = await fetch(`${baseUrl}/speech/fish-audio/voices`, { method: 'POST' });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            voices: [
                { id: 'voice-1', name: 'Alice' },
                { id: 'voice-2', name: 'Bob' },
            ],
            complete: true,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            'https://api.fish.audio/model?self=true&page_size=100&page_number=1&sort_by=created_at',
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer test-fish-key' }),
            }),
        );
    });

    test('marks voice list incomplete when window_limited is true', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            headers: mockHeaders({ 'content-type': 'application/json' }),
            json: async () => ({
                has_more: false,
                window_limited: true,
                items: [{ _id: 'voice-1', type: 'tts', state: 'trained', title: 'Alice' }],
            }),
        });

        const response = await fetch(`${baseUrl}/speech/fish-audio/voices`, { method: 'POST' });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            voices: [{ id: 'voice-1', name: 'Alice' }],
            complete: false,
        });
    });

    test('streams synthesized MP3 audio with expected upstream headers and payload', async () => {
        const audioBytes = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00]);
        fetchMock.mockResolvedValueOnce({
            ok: true,
            headers: mockHeaders({ 'content-type': 'audio/mpeg' }),
            body: Readable.from([Buffer.alloc(0), audioBytes]),
        });

        const response = await fetch(`${baseUrl}/speech/fish-audio/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: '[laughing] Hello world!',
                reference_id: '7f92f8afb8ec43bf81429cc1c9199cb1',
                model: 's3-pro',
                latency: 'low',
                speed: 1.15,
                temperature: 0.8,
                top_p: 0.9,
            }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('audio/mpeg');
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(Buffer.from(await response.arrayBuffer())).toEqual(audioBytes);
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.fish.audio/v1/tts',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-fish-key',
                    'Content-Type': 'application/json',
                    model: 's3-pro',
                }),
                body: JSON.stringify({
                    text: '[laughing] Hello world!',
                    reference_id: '7f92f8afb8ec43bf81429cc1c9199cb1',
                    format: 'mp3',
                    latency: 'low',
                    temperature: 0.8,
                    top_p: 0.9,
                    prosody: { speed: 1.15 },
                }),
            }),
        );
    });

    test.each([
        ['empty text', { text: '   ', reference_id: 'voice-1' }, 'Text is required.'],
        ['invalid reference_id', { text: 'hi', reference_id: '../bad' }, 'A valid Fish Audio reference ID is required.'],
        ['invalid model', { text: 'hi', reference_id: 'voice-1', model: 'bad\r\nmodel' }, 'A valid Fish Audio model is required.'],
        ['invalid latency', { text: 'hi', reference_id: 'voice-1', latency: 'turbo' }, 'Latency must be normal, balanced, or low.'],
        ['out-of-range speed', { text: 'hi', reference_id: 'voice-1', speed: 3 }, 'Speed must be a number from 0.5 to 2.'],
        ['out-of-range temperature', { text: 'hi', reference_id: 'voice-1', temperature: -0.1 }, 'Temperature must be a number from 0 to 1.'],
        ['out-of-range top_p', { text: 'hi', reference_id: 'voice-1', top_p: 1.5 }, 'Top P must be a number from 0 to 1.'],
    ])('rejects invalid synthesis parameters: %s', async (_label, payload, expectedError) => {
        const response = await fetch(`${baseUrl}/speech/fish-audio/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: expectedError });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('remaps upstream 401 to 400 and sanitizes upstream error responses', async () => {
        const destroy = jest.fn();
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 401,
            headers: mockHeaders(),
            body: { destroy },
        });

        const response = await fetch(`${baseUrl}/speech/fish-audio/voices`, { method: 'POST' });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Fish Audio rejected the API key.' });
        expect(destroy).toHaveBeenCalled();
    });

    test('forwards valid Retry-After on 429 and strips invalid Retry-After values', async () => {
        fetchMock
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: mockHeaders({ 'retry-after': '12' }),
                body: { destroy: jest.fn() },
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: mockHeaders({ 'retry-after': 'not-a-valid-date' }),
                body: { destroy: jest.fn() },
            });

        const validRes = await fetch(`${baseUrl}/speech/fish-audio/voices`, { method: 'POST' });
        expect(validRes.status).toBe(429);
        expect(validRes.headers.get('retry-after')).toBe('12');
        expect(await validRes.json()).toEqual({ error: 'Fish Audio rate limit reached. Try again later.' });

        const invalidRes = await fetch(`${baseUrl}/speech/fish-audio/voices`, { method: 'POST' });
        expect(invalidRes.status).toBe(429);
        expect(invalidRes.headers.get('retry-after')).toBeNull();
    });

    test('rejects non-audio and empty audio responses with 502', async () => {
        const destroy = jest.fn();
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                headers: mockHeaders({ 'content-type': 'application/json' }),
                body: { destroy },
            })
            .mockResolvedValueOnce({
                ok: true,
                headers: mockHeaders({ 'content-type': 'audio/mpeg' }),
                body: Readable.from([]),
            });

        const payload = JSON.stringify({ text: 'Hello', reference_id: 'voice-1' });
        const nonAudio = await fetch(`${baseUrl}/speech/fish-audio/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
        });
        expect(nonAudio.status).toBe(502);
        expect(await nonAudio.json()).toEqual({ error: 'Fish Audio returned a non-audio response.' });
        expect(destroy).toHaveBeenCalled();

        const emptyAudio = await fetch(`${baseUrl}/speech/fish-audio/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
        });
        expect(emptyAudio.status).toBe(502);
        expect(await emptyAudio.json()).toEqual({ error: 'Fish Audio returned empty audio.' });
        expect(fetchMock).toHaveBeenLastCalledWith(
            'https://api.fish.audio/v1/tts',
            expect.objectContaining({
                headers: expect.objectContaining({ model: 'drama-3' }),
            }),
        );
    });
});
