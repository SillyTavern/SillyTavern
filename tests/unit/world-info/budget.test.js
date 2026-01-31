import { describe, test, expect } from '@jest/globals';

/**
 * Budget calculation and management unit tests.
 * These tests document the budget logic used in scanning/index.js.
 *
 * The budget is calculated as: Math.round(world_info_budget * maxContext / 100) || 1
 * If world_info_budget_cap > 0 and budget > cap, the cap is used.
 */
describe('Budget Calculation', () => {
    /**
     * Calculates the budget based on percentage of max context.
     * This mirrors the logic in scanning/index.js line ~203
     */
    function calculateBudget(budgetPercent, maxContext, budgetCap = 0) {
        let budget = Math.round(budgetPercent * maxContext / 100) || 1;
        if (budgetCap > 0 && budget > budgetCap) {
            budget = budgetCap;
        }
        return budget;
    }

    test('calculates budget as percentage of max context', () => {
        // 10% of 1000 = 100
        expect(calculateBudget(10, 1000)).toBe(100);
        // 25% of 2000 = 500
        expect(calculateBudget(25, 2000)).toBe(500);
        // 50% of 8000 = 4000
        expect(calculateBudget(50, 8000)).toBe(4000);
    });

    test('rounds budget to nearest integer', () => {
        // 10% of 1005 = 100.5, rounds to 101
        expect(calculateBudget(10, 1005)).toBe(101);
        // 10% of 1004 = 100.4, rounds to 100
        expect(calculateBudget(10, 1004)).toBe(100);
    });

    test('returns minimum budget of 1 when calculation is 0', () => {
        // 0% of anything should still be 1
        expect(calculateBudget(0, 1000)).toBe(1);
        // Very small context with small percentage
        expect(calculateBudget(1, 50)).toBe(1);
    });

    test('applies budget cap when exceeded', () => {
        // Budget would be 500 (50% of 1000) but cap is 200
        expect(calculateBudget(50, 1000, 200)).toBe(200);
    });

    test('does not apply cap when budget is under cap', () => {
        // Budget is 100 (10% of 1000), cap is 200
        expect(calculateBudget(10, 1000, 200)).toBe(100);
    });

    test('does not apply cap when cap is 0 (disabled)', () => {
        // Budget would be 500 but cap is 0 (disabled)
        expect(calculateBudget(50, 1000, 0)).toBe(500);
    });

    test('applies cap when budget equals cap', () => {
        // Budget is exactly 200 (20% of 1000), cap is 200
        // Since budget is not > cap, cap is not applied
        expect(calculateBudget(20, 1000, 200)).toBe(200);
    });
});

describe('Budget Overflow Logic', () => {
    /**
     * Simulates the budget overflow check from scanning/index.js line ~722
     */
    function wouldOverflowBudget(textToScanTokens, runningTokenCount, entryTokens, budget) {
        return (textToScanTokens + runningTokenCount + entryTokens) >= budget;
    }

    test('detects overflow when total exceeds budget', () => {
        // Already at 80 tokens, adding 30 to a 100 budget = overflow
        expect(wouldOverflowBudget(50, 30, 30, 100)).toBe(true);
    });

    test('no overflow when total is under budget', () => {
        // Already at 40 tokens, adding 30 to a 100 budget = 70, no overflow
        expect(wouldOverflowBudget(20, 20, 30, 100)).toBe(false);
    });

    test('overflow when total exactly equals budget', () => {
        // Already at 70 tokens, adding 30 to a 100 budget = 100, considered overflow
        expect(wouldOverflowBudget(50, 20, 30, 100)).toBe(true);
    });

    test('first entry exceeding budget still causes overflow', () => {
        // No tokens yet, but entry has 150 tokens against 100 budget
        expect(wouldOverflowBudget(0, 0, 150, 100)).toBe(true);
    });
});

describe('ignoreBudget Entry Handling', () => {
    /**
     * Entries with ignoreBudget=true bypass budget checks.
     * This mirrors the logic in scanning/index.js line ~676 and ~722.
     */

    test('ignoreBudget entry is processed even after overflow', () => {
        // Simulate the logic:
        // if (token_budget_overflowed && !entry.ignoreBudget) continue
        const entry = { ignoreBudget: true };
        const token_budget_overflowed = true;

        const shouldSkip = token_budget_overflowed && !entry.ignoreBudget;
        expect(shouldSkip).toBe(false);
    });

    test('normal entry is skipped after overflow', () => {
        const entry = { ignoreBudget: false };
        const token_budget_overflowed = true;

        const shouldSkip = token_budget_overflowed && !entry.ignoreBudget;
        expect(shouldSkip).toBe(true);
    });

    test('entry without ignoreBudget property is skipped after overflow', () => {
        const entry = {}; // no ignoreBudget property
        const token_budget_overflowed = true;

        const shouldSkip = token_budget_overflowed && !entry.ignoreBudget;
        expect(shouldSkip).toBe(true);
    });

    test('budget check is skipped for ignoreBudget entries', () => {
        // Budget check: if (!entry.ignoreBudget && wouldOverflow)
        const entry = { ignoreBudget: true };
        const wouldOverflow = true;

        const shouldTriggerOverflow = !entry.ignoreBudget && wouldOverflow;
        expect(shouldTriggerOverflow).toBe(false);
    });
});

describe('Token Accumulation', () => {
    test('running token count accumulates correctly', () => {
        let runningTokenCount = 0;
        const entryTokenCounts = [10, 25, 15, 50];

        for (const tokens of entryTokenCounts) {
            runningTokenCount += tokens;
        }

        expect(runningTokenCount).toBe(100);
    });

    test('only added entries contribute to running token count', () => {
        // Simulates the pattern where only successfully added entries increase the count
        let runningTokenCount = 0;
        const entries = [
            { tokens: 10, added: true },
            { tokens: 25, added: false }, // skipped (budget overflow)
            { tokens: 15, added: true },
            { tokens: 50, added: false }, // skipped
        ];

        for (const entry of entries) {
            if (entry.added) {
                runningTokenCount += entry.tokens;
            }
        }

        expect(runningTokenCount).toBe(25);
    });
});

describe('Budget Interaction with Recursion', () => {
    /**
     * Budget overflow stops recursion.
     * This mirrors the logic in scanning/index.js line ~761 and ~768.
     */

    test('recursion continues when budget not overflowed', () => {
        const world_info_recursive = true;
        const token_budget_overflowed = false;
        const hasNewEntriesForRecursion = true;

        const shouldContinueRecursion = world_info_recursive && !token_budget_overflowed && hasNewEntriesForRecursion;
        expect(shouldContinueRecursion).toBe(true);
    });

    test('recursion stops when budget overflowed', () => {
        const world_info_recursive = true;
        const token_budget_overflowed = true;
        const hasNewEntriesForRecursion = true;

        const shouldContinueRecursion = world_info_recursive && !token_budget_overflowed && hasNewEntriesForRecursion;
        expect(shouldContinueRecursion).toBe(false);
    });

    test('recursion stops when recursion is disabled', () => {
        const world_info_recursive = false;
        const token_budget_overflowed = false;
        const hasNewEntriesForRecursion = true;

        const shouldContinueRecursion = world_info_recursive && !token_budget_overflowed && hasNewEntriesForRecursion;
        expect(shouldContinueRecursion).toBe(false);
    });

    test('min activations check respects budget overflow', () => {
        // From line ~775: if (!nextScanState && !token_budget_overflowed && minActivationsNotSatisfied)
        const token_budget_overflowed = true;
        const minActivationsNotSatisfied = true;
        const noNextScanState = true;

        const shouldContinueForMinActivations = noNextScanState && !token_budget_overflowed && minActivationsNotSatisfied;
        expect(shouldContinueForMinActivations).toBe(false);
    });
});
