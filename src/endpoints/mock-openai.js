import express from 'express';
import { getConfigValue } from '../util.js';

export const router = express.Router();

/**
 * Creates a mock OpenAI-compatible response.
 * Intended for debugging and e2e tests.
 * @param {object} prompt /v1/chat/completions prompt.
 * @returns {object} response body.
 */
function getMockResponse(prompt) {
    const messages = prompt.messages;
    const lastMessage = messages?.[messages.length - 1];
    return {
        'choices': [
            {
                'finish_reason': 'stop',
                'index': 0,
                'message': {
                    'role': 'assistant',
                    'reasoning_content': `${prompt.model}\n${messages?.length}\n${prompt.max_tokens}`,
                    'content': String(lastMessage?.content ?? 'No prompt messages.'),
                },
            },
        ],
        'created': 0,
        'model': prompt.model,
    };
}

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
        const mockResponse = getMockResponse(prompt);

        return response.send(mockResponse);

    } catch (error) {
        console.error('Error', error);
        return response.sendStatus(500);
    }
});
