import { describe, expect, test } from '@jest/globals';
import {
    PF_TRIGGER_RATIO,
    PF_RETENTION_RATIO,
    PF_SUMMARY_TARGET_TOKENS,
    isThresholdExceeded,
    calculateRawRetention,
    clampPointer,
    formatSummaryInjection,
    buildSummarizePrompt,
    buildMergePrompt,
    formatConversationRange,
} from '../public/scripts/prefill-friendly-core.js';

describe('Prefill Friendly core logic', () => {
    describe('isThresholdExceeded (80% trigger)', () => {
        test('triggers at 80% of the configured maximum context', () => {
            const maxContext = 32768;
            expect(isThresholdExceeded(Math.floor(0.8 * maxContext), maxContext)).toBe(true);
        });

        test('does not trigger below 80%', () => {
            const maxContext = 32768;
            expect(isThresholdExceeded(Math.floor(0.8 * maxContext) - 1, maxContext)).toBe(false);
            expect(isThresholdExceeded(100, 32768)).toBe(false);
        });

        test('uses the actual configured limit, not a fixed value', () => {
            expect(isThresholdExceeded(12800, 16000)).toBe(true);
            expect(isThresholdExceeded(51200, 64000)).toBe(true);
            expect(isThresholdExceeded(51199, 64000)).toBe(false);
        });
    });

    describe('calculateRawRetention (~20% budget, complete messages only)', () => {
        const allIncluded = () => true;

        test('retains newest complete messages within the budget', () => {
            // Messages: A=1200, B=2100, C=1800, D=2000. Budget=6400.
            // Walking backward: D (2000) -> C+B+D = 5900 fits -> adding A = 7100 exceeds.
            // Backward order accumulates D, then C (3800), then B (5900), then A would be 7100 > 6400.
            const tokens = [1200, 2100, 1800, 2000];
            expect(calculateRawRetention(tokens, 6400, allIncluded)).toBe(1); // B+C+D retained
        });

        test('never splits an individual message', () => {
            // One huge message exceeding the whole budget must still be fully included.
            const tokens = [50000];
            expect(calculateRawRetention(tokens, 6400, allIncluded)).toBe(0);
        });

        test('returns 0 when everything fits in the budget', () => {
            const tokens = [100, 200, 300];
            expect(calculateRawRetention(tokens, 6400, allIncluded)).toBe(0);
        });

        test('skips ineligible (system/empty) messages without counting their tokens', () => {
            // index 2 is system; boundary should pass over it.
            const tokens = [1000, 1000, 0, 1000];
            const isIncluded = i => i !== 2;
            // Budget 2500: includes idx3 (1000), idx2 skipped (boundary moves to 2),
            // idx1 fits (2000 <= 2500) boundary=1, idx0 would exceed (3000 > 2500).
            expect(calculateRawRetention(tokens, 2500, isIncluded)).toBe(1);
        });

        test('handles empty chat', () => {
            expect(calculateRawRetention([], 6400, allIncluded)).toBe(0);
        });

        test('matches the 32k example: ~6.4k retention from ~20% ratio', () => {
            const maxContext = 32768;
            const budget = Math.floor(maxContext * PF_RETENTION_RATIO);
            expect(budget).toBe(6553);

            // Seven ~1k messages: last six fit (6k <= 6553), the first pushes to 7k > budget.
            const tokens = Array(7).fill(1000);
            expect(calculateRawRetention(tokens, budget, allIncluded)).toBe(1);
        });
    });

    describe('clampPointer', () => {
        test('keeps valid pointers unchanged', () => {
            expect(clampPointer(5, 10)).toBe(5);
            expect(clampPointer(0, 10)).toBe(0);
        });

        test('clamps pointers beyond chat length after deletions', () => {
            expect(clampPointer(50, 10)).toBe(9);
        });

        test('handles empty chats', () => {
            expect(clampPointer(10, 0)).toBe(0);
        });

        test('clamps negative pointers', () => {
            expect(clampPointer(-3, 10)).toBe(0);
        });
    });

    describe('formatSummaryInjection', () => {
        test('wraps summary in a stable prefix-friendly format', () => {
            const out = formatSummaryInjection('The hero left home.');
            expect(out).toBe('[Summary of earlier events:\nThe hero left home.\n]');
        });

        test('returns empty string for no summary', () => {
            expect(formatSummaryInjection('')).toBe('');
        });
    });

    describe('buildSummarizePrompt (two-stage pipeline stage 1)', () => {
        test('first compaction has no previous summary section', () => {
            const prompt = buildSummarizePrompt('', 'Message 1\nMessage 2');
            expect(prompt).toContain('SUMMARISE THIS ENTIRE ROLEPLAY IN ~3K TOKENS');
            expect(prompt).not.toContain('[PREVIOUS SUMMARY]');
            expect(prompt).toContain('[CONVERSATION FROM CURRENT POINTER]');
            expect(prompt).toContain('Message 1\nMessage 2');
        });

        test('subsequent compactions include the previous canonical summary', () => {
            const prompt = buildSummarizePrompt('Summary A text', 'New conversation');
            expect(prompt).toContain('[PREVIOUS SUMMARY]');
            expect(prompt).toContain('Summary A text');
            expect(prompt).toContain('[CONVERSATION FROM CURRENT POINTER]');
            expect(prompt.indexOf('[PREVIOUS SUMMARY]')).toBeLessThan(prompt.indexOf('[CONVERSATION FROM CURRENT POINTER]'));
        });

        test('requests the static ~3k token target regardless of context size', () => {
            expect(buildSummarizePrompt('', 'x')).toContain('~3K TOKENS');
            expect(PF_SUMMARY_TARGET_TOKENS).toBe(3000);
        });
    });

    describe('buildMergePrompt (two-stage pipeline stage 2)', () => {
        test('contains both summaries under labeled sections', () => {
            const prompt = buildMergePrompt('Summary A', 'Summary B');
            expect(prompt).toContain('MERGE THE STORY EVENTS OF THESE TWO SUMMARIES');
            expect(prompt).toContain('[PREVIOUS CANONICAL SUMMARY]');
            expect(prompt).toContain('Summary A');
            expect(prompt).toContain('[NEWLY GENERATED SUMMARY]');
            expect(prompt).toContain('Summary B');
        });
    });

    describe('formatConversationRange', () => {
        const chat = [
            { name: 'Alice', mes: 'Hello' },
            { name: 'System', mes: 'hidden', is_system: true },
            { name: 'Bob', mes: 'Hi there' },
            { name: 'Alice', mes: 'How are you?' },
        ];

        test('formats a range with names, skipping system and empty messages', () => {
            const out = formatConversationRange(chat, 0, 4);
            expect(out).toContain('Alice:\nHello');
            expect(out).not.toContain('hidden');
            expect(out).toContain('Bob:\nHi there');
        });

        test('respects pointer boundaries', () => {
            const out = formatConversationRange(chat, 2, 4);
            expect(out).not.toContain('Hello');
            expect(out).toContain('How are you?');
        });

        test('returns empty text when nothing eligible exists in range', () => {
            expect(formatConversationRange([{ is_system: true, mes: 'x' }], 0, 1)).toBe('');
        });
    });

    describe('ratios', () => {
        test('uses the specified 80%/20% and static summary target', () => {
            expect(PF_TRIGGER_RATIO).toBe(0.8);
            expect(PF_RETENTION_RATIO).toBe(0.2);
            expect(PF_SUMMARY_TARGET_TOKENS).toBe(3000);
        });
    });
});
