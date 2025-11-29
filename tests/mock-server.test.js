
import { MockServer } from './util/mock-server.js';

describe('OpenAI-compatible tests', () => {
    /** @type {MockServer} */
    const mockServer = new MockServer({ port: 3000, host: '127.0.0.1' });

    beforeEach(async () => {
        await mockServer.start();
    });

    afterEach(async () => {
        await mockServer.stop();
    });

    test('should access the server', async () => {
        const response = await fetch('http://127.0.0.1:3000/v1/chat/completions', { method: 'POST' });
        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toBeDefined();
    });
});
