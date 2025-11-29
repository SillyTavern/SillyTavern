import express from 'express';
import { getConfigValue } from '../util.js';
import { MockServer } from '../../tests/util/mock-server.js';

export const router = express.Router();

/** @type {MockServer} */
const mockServer = new MockServer({ port: 0, host: '127.0.0.1' });


const enableMockCompletionsApi = !!getConfigValue('enableMockCompletionsApi', false, 'boolean');

router.post('/chat/completions', (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    try {
        if (!enableMockCompletionsApi) {
            console.error('Set enableMockCompletionsApi to true in config.yaml.');
            return response.sendStatus(403);
        }

        const prompt = request.body;
        const mockResponse = mockServer.handleChatCompletions(prompt);

        return response.send(mockResponse);

    } catch (error) {
        console.error('Error', error);
        return response.sendStatus(500);
    }
});
