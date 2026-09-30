import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const fetchMock = jest.fn();
const readSecretMock = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: readSecretMock,
    SECRET_KEYS: { PARALLEL: 'api_key_parallel' },
}));

let server;
let baseUrl;
const directories = { root: '/test/current-user' };
const results = [{ title: 'Example', url: 'https://example.com/', excerpts: ['Relevant text.'] }];

beforeAll(async () => {
    const { router } = await import('../src/endpoints/search.js');
    const { default: express } = await import('express');
    const app = express();
    app.use(express.json());
    app.use((request, _response, next) => {
        request.user = { directories };
        next();
    });
    app.use('/api/search', router);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

beforeEach(() => {
    readSecretMock.mockReset().mockReturnValue('test-key');
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ results }) });
});

function search(body) {
    return fetch(`${baseUrl}/api/search/parallel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/search/parallel', () => {
    test('uses the current user key and sends a bounded v1 search request', async () => {
        const response = await search({ query: ' example query ', max_chars_total: 500 });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ results });
        expect(readSecretMock).toHaveBeenCalledWith(directories, 'api_key_parallel');
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.parallel.ai/v1/search');
        expect(options.method).toBe('POST');
        expect(options.headers).toEqual({ 'Content-Type': 'application/json', 'x-api-key': 'test-key' });
        expect(JSON.parse(options.body)).toEqual({
            search_queries: ['example query'], mode: 'fast', max_chars_total: 500,
            advanced_settings: { max_results: 10 },
        });
        expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    test('uses a default excerpt budget', async () => {
        await search({ query: 'example' });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_chars_total).toBe(2000);
    });

    for (const body of [{}, { query: '' }, { query: '   ' }, { query: 123 }, { query: 'x'.repeat(2001) },
        ...[0, -1, 20001, 1.5, '500', null].map(max_chars_total => ({ query: 'example', max_chars_total })),
    ]) {
        test(`rejects invalid input without contacting Parallel: ${JSON.stringify(body).slice(0, 80)}`, async () => {
            expect((await search(body)).status).toBe(400);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    }

    test('does not contact Parallel without a stored key', async () => {
        readSecretMock.mockReturnValue(undefined);
        expect((await search({ query: 'example' })).status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    for (const status of [401, 402, 422, 429, 500, 503]) {
        test(`preserves upstream HTTP ${status} without exposing its body`, async () => {
            fetchMock.mockResolvedValue({ ok: false, status, text: async () => 'private upstream details test-key' });
            const response = await search({ query: 'example' });
            expect(response.status).toBe(status);
            expect(await response.json()).toEqual({ error: `Parallel search failed (HTTP ${status}).` });
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    }

    test('returns empty results and nonfatal warnings without treating them as errors', async () => {
        const data = { results: [], warnings: [{ type: 'warning', message: 'Adjusted input' }] };
        fetchMock.mockResolvedValue({ ok: true, json: async () => data });
        const response = await search({ query: 'example' });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(data);
    });

    for (const data of [null, {}, { results: 'invalid' }]) {
        test(`rejects malformed results: ${JSON.stringify(data)}`, async () => {
            fetchMock.mockResolvedValue({ ok: true, json: async () => data });
            expect((await search({ query: 'example' })).status).toBe(502);
        });
    }

    test('handles invalid JSON without leaking the upstream payload', async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('test-key'); } });
        const response = await search({ query: 'example' });
        expect(response.status).toBe(502);
        expect(await response.text()).not.toContain('test-key');
    });

    for (const name of ['AbortError', 'TimeoutError', 'FetchError']) {
        test(`handles ${name} without retrying or exposing credentials`, async () => {
            fetchMock.mockRejectedValue(Object.assign(new Error('test-key'), { name }));
            const response = await search({ query: 'example' });
            expect(response.status).toBe(name === 'FetchError' ? 502 : 504);
            expect(await response.text()).not.toContain('test-key');
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    }
});
