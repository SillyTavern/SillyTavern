import { describe, expect, test } from '@jest/globals';

import {
    OPENAI_FIXED_REASONING_EFFORT as SERVER_OPENAI_FIXED_REASONING_EFFORT,
    getOpenAIReasoningEffort,
} from '../src/constants.js';
import {
    OPENAI_FIXED_REASONING_EFFORT as FRONTEND_OPENAI_FIXED_REASONING_EFFORT,
    supportsOpenAIXHighReasoningEffort,
} from '../public/scripts/openai-reasoning.js';

describe('OpenAI xhigh reasoning effort support', () => {
    test('detects GPT-5.2 and newer chat-completions models by pattern on frontend', () => {
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.2')).toBe(true);
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.4-mini')).toBe(true);
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.5-2026-04-23')).toBe(true);
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.6-nano')).toBe(true);
    });

    test('does not opt in earlier, fixed-effort, pro, or codex models by pattern', () => {
        expect(supportsOpenAIXHighReasoningEffort('gpt-5')).toBe(false);
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.1')).toBe(false);
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.3-chat-latest')).toBe(false);
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.2-codex')).toBe(false);
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.3-codex')).toBe(false);
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.4-pro')).toBe(false);
        expect(supportsOpenAIXHighReasoningEffort('gpt-5.4-pro-2026-03-05')).toBe(false);
    });

    test('keeps OpenRouter-hosted models out of OpenAI xhigh detection', () => {
        expect(supportsOpenAIXHighReasoningEffort('openai/gpt-5.2')).toBe(false);
    });

    test('shares fixed effort exceptions between frontend detection and backend guard', () => {
        expect(FRONTEND_OPENAI_FIXED_REASONING_EFFORT).toBe(SERVER_OPENAI_FIXED_REASONING_EFFORT);
    });
});

describe('getOpenAIReasoningEffort', () => {
    test('passes through frontend-resolved provider effort values for supported models', () => {
        expect(getOpenAIReasoningEffort('gpt-5.2', 'xhigh')).toBe('xhigh');
        expect(getOpenAIReasoningEffort('gpt-5.4-mini', 'xhigh')).toBe('xhigh');
        expect(getOpenAIReasoningEffort('gpt-5.5-2026-04-23', 'xhigh')).toBe('xhigh');
        expect(getOpenAIReasoningEffort('gpt-5.6-nano', 'xhigh')).toBe('xhigh');
        expect(getOpenAIReasoningEffort('gpt-5.1', 'high')).toBe('high');
    });

    test('keeps fixed effort overrides and unsupported models unchanged', () => {
        expect(getOpenAIReasoningEffort('gpt-5.3-chat-latest', 'xhigh')).toBe('medium');
        expect(getOpenAIReasoningEffort('gpt-4o', 'high')).toBeUndefined();
    });

    test('does not opt in pro or codex models for the Chat Completions API', () => {
        expect(getOpenAIReasoningEffort('gpt-5.2-codex', 'xhigh')).toBeUndefined();
        expect(getOpenAIReasoningEffort('gpt-5.3-codex', 'xhigh')).toBeUndefined();
        expect(getOpenAIReasoningEffort('gpt-5.4-pro', 'xhigh')).toBeUndefined();
        expect(getOpenAIReasoningEffort('gpt-5.4-pro-2026-03-05', 'xhigh')).toBeUndefined();
    });
});
