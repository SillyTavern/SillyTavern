import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { MockServer } from './util/mock-server.js';

describe('MockServer tests', () => {
    /** @type {MockServer} */
    const mockServer = new MockServer({ port: 3000, host: '127.0.0.1' });

    beforeAll(async () => {
        await mockServer.start();
    });

    afterAll(async () => {
        await mockServer.stop();
    });

    test('should provide OpenAI-compatible endpoint', async () => {
        const requestBody = {
            model: 'gpt-4o',
            max_tokens: 400,
            messages: [
                { role: 'user', content: 'Hello, world!' },
            ],
        };
        const response = await fetch('http://127.0.0.1:3000/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });
        const expectedResponse = { 'choices': [{ 'finish_reason': 'stop', 'index': 0, 'message': { 'role': 'assistant', 'reasoning_content': 'gpt-4o\n1\n400', 'content': 'Hello, world!' } }], 'created': 0, 'model': 'gpt-4o' };
        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toEqual(expectedResponse);
    });
});
