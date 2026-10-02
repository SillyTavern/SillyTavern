import { describe, expect, test } from '@jest/globals';

import { ChatLoadError, parseChatResponse } from '../public/scripts/chat-response.js';

function jsonResponse(body, status = 200, statusText = '') {
    return new Response(JSON.stringify(body), {
        status,
        statusText,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('parseChatResponse', () => {
    test('returns non-empty and empty chat arrays', async () => {
        await expect(parseChatResponse(jsonResponse([{ chat_metadata: {} }]))).resolves.toEqual([{ chat_metadata: {} }]);
        await expect(parseChatResponse(jsonResponse([]))).resolves.toEqual([]);
    });

    test('rejects a non-array successful response', async () => {
        await expect(parseChatResponse(jsonResponse({}))).rejects.toMatchObject({
            name: 'ChatLoadError',
            status: 200,
            serverMessage: 'Invalid chat response.',
        });
    });

    test('uses a JSON error message for an unsuccessful response', async () => {
        await expect(parseChatResponse(jsonResponse({ error: 'Chat could not be loaded.' }, 500, 'Internal Server Error')))
            .rejects.toMatchObject({
                name: 'ChatLoadError',
                status: 500,
                serverMessage: 'Chat could not be loaded.',
            });
    });

    test('falls back to HTTP status data for a non-JSON response', async () => {
        const response = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });

        let caughtError;
        try {
            await parseChatResponse(response);
        } catch (error) {
            caughtError = error;
        }
        expect(caughtError).toBeInstanceOf(ChatLoadError);
        expect(caughtError).toMatchObject({ status: 500, serverMessage: 'Internal Server Error' });
        expect(caughtError?.cause).toMatchObject({ name: 'SyntaxError' });
    });
});
