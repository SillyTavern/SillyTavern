import { describe, expect, jest, test } from '@jest/globals';
import {
    fetchGoogleModels,
    GoogleModelsHttpError,
    GoogleModelsResponseError,
} from '../src/endpoints/backends/google-models.js';

function createResponse(data, overrides = {}) {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => data,
        ...overrides,
    };
}

describe('Google AI Studio model pagination', () => {
    test('fetches every page and returns generateContent models', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createResponse({
                models: [
                    {
                        name: 'models/gemini-2.5-flash',
                        supportedGenerationMethods: ['generateContent', 'countTokens'],
                    },
                    {
                        name: 'models/gemini-embedding-001',
                        supportedGenerationMethods: ['embedContent'],
                    },
                ],
                nextPageToken: 'second-page',
            }))
            .mockResolvedValueOnce(createResponse({
                models: [{
                    name: 'models/gemini-2.5-pro',
                    supportedGenerationMethods: ['generateContent'],
                }],
            }));

        const models = await fetchGoogleModels('https://example.com/v1beta/models?key=secret', fetchMock);

        expect(models).toEqual([
            {
                id: 'gemini-2.5-flash',
                name: 'models/gemini-2.5-flash',
                supportedGenerationMethods: ['generateContent', 'countTokens'],
            },
            {
                id: 'gemini-2.5-pro',
                name: 'models/gemini-2.5-pro',
                supportedGenerationMethods: ['generateContent'],
            },
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const firstUrl = new URL(fetchMock.mock.calls[0][0]);
        expect(firstUrl.searchParams.get('key')).toBe('secret');
        expect(firstUrl.searchParams.get('pageSize')).toBe('1000');
        expect(firstUrl.searchParams.has('pageToken')).toBe(false);

        const secondUrl = new URL(fetchMock.mock.calls[1][0]);
        expect(secondUrl.searchParams.get('key')).toBe('secret');
        expect(secondUrl.searchParams.get('pageSize')).toBe('1000');
        expect(secondUrl.searchParams.get('pageToken')).toBe('second-page');
    });

    test('preserves reverse proxy query parameters', async () => {
        const fetchMock = jest.fn().mockResolvedValue(createResponse({ models: [] }));

        await fetchGoogleModels('https://proxy.example/v1beta/models?tenant=test', fetchMock);

        const requestUrl = new URL(fetchMock.mock.calls[0][0]);
        expect(requestUrl.searchParams.get('tenant')).toBe('test');
        expect(requestUrl.searchParams.get('pageSize')).toBe('1000');
    });

    test('rejects an HTTP failure without returning partial models', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createResponse({
                models: [],
                nextPageToken: 'second-page',
            }))
            .mockResolvedValueOnce(createResponse(null, {
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
            }));

        await expect(fetchGoogleModels('https://example.com/v1beta/models', fetchMock))
            .rejects.toEqual(expect.objectContaining({
                name: GoogleModelsHttpError.name,
                status: 503,
                statusText: 'Service Unavailable',
            }));
    });

    test('rejects a malformed models field', async () => {
        const fetchMock = jest.fn().mockResolvedValue(createResponse({ models: null }));

        await expect(fetchGoogleModels('https://example.com/v1beta/models', fetchMock))
            .rejects.toThrow('invalid models field');
    });

    test('rejects a repeated page token', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(createResponse({ models: [], nextPageToken: 'repeated' }))
            .mockResolvedValueOnce(createResponse({ models: [], nextPageToken: 'repeated' }));

        await expect(fetchGoogleModels('https://example.com/v1beta/models', fetchMock))
            .rejects.toBeInstanceOf(GoogleModelsResponseError);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('rejects a supported model without a valid name', async () => {
        const fetchMock = jest.fn().mockResolvedValue(createResponse({
            models: [{ supportedGenerationMethods: ['generateContent'] }],
        }));

        await expect(fetchGoogleModels('https://example.com/v1beta/models', fetchMock))
            .rejects.toThrow('invalid name');
    });
});
