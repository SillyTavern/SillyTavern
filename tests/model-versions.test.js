import { describe, test, expect } from '@jest/globals';
import { OPENAI_REASONING_EFFORT_PATTERN, OPENAI_VERBOSITY_MODELS } from '../src/constants.js';

describe('OPENAI_REASONING_EFFORT_PATTERN', () => {
    test('matches later o-series and GPT-5 to GPT-9 models', () => {
        for (const model of ['o3', 'o4-mini', 'o9-preview', 'gpt-5', 'gpt-5.2', 'gpt-7-mini']) {
            expect(OPENAI_REASONING_EFFORT_PATTERN.test(model)).toBe(true);
        }
    });

    test('does not match older, chat, search or Azure GPT-3.5 models', () => {
        for (const model of ['gpt-4o', 'gpt-4.1', 'gpt-35-turbo', 'gpt-35-turbo-16k', 'gpt-5-chat-latest', 'gpt-5-search-api', 'o1-mini', 'o1-preview', 'chatgpt-4o-latest', 'gpt-50']) {
            expect(OPENAI_REASONING_EFFORT_PATTERN.test(model)).toBe(false);
        }
    });
});

describe('OPENAI_VERBOSITY_MODELS', () => {
    test('matches GPT-5 to GPT-9', () => {
        for (const model of ['gpt-5-mini', 'gpt-5-chat-latest', 'gpt-6-astra', 'gpt-7']) {
            expect(OPENAI_VERBOSITY_MODELS.test(model)).toBe(true);
        }
    });

    test('does not match older or Azure GPT-3.5 models', () => {
        for (const model of ['gpt-4o', 'gpt-35-turbo', 'gpt-50']) {
            expect(OPENAI_VERBOSITY_MODELS.test(model)).toBe(false);
        }
    });
});
