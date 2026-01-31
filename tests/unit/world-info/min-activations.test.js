import { describe, test, expect } from '@jest/globals';

/**
 * Min activations logic unit tests.
 * These tests document the min activations behavior from scanning/index.js.
 *
 * Min activations ensures a minimum number of WI entries are activated by
 * advancing the scan depth until the threshold is met or depth limit is reached.
 */
describe('Min Activations Check', () => {
    /**
     * Checks if min activations threshold is not satisfied.
     * This mirrors the logic in scanning/index.js line ~774
     */
    function minActivationsNotSatisfied(minActivations, activatedCount) {
        return minActivations > 0 && activatedCount < minActivations;
    }

    test('returns true when activated count is below threshold', () => {
        expect(minActivationsNotSatisfied(5, 3)).toBe(true);
    });

    test('returns false when activated count equals threshold', () => {
        expect(minActivationsNotSatisfied(5, 5)).toBe(false);
    });

    test('returns false when activated count exceeds threshold', () => {
        expect(minActivationsNotSatisfied(5, 10)).toBe(false);
    });

    test('returns false when min activations is 0 (disabled)', () => {
        expect(minActivationsNotSatisfied(0, 0)).toBe(false);
        expect(minActivationsNotSatisfied(0, 5)).toBe(false);
    });

    test('returns false when min activations is negative', () => {
        expect(minActivationsNotSatisfied(-1, 0)).toBe(false);
    });
});

describe('Depth Boundary Checking', () => {
    /**
     * Checks if the depth limit has been exceeded.
     * This mirrors the logic in scanning/index.js line ~779-784
     */
    function isOverDepthMax(currentDepth, depthMax, chatLength) {
        const hitDepthMax = depthMax > 0 && currentDepth > depthMax;
        const hitChatLength = currentDepth > chatLength;
        return hitDepthMax || hitChatLength;
    }

    test('returns false when depth is within limits', () => {
        expect(isOverDepthMax(3, 10, 20)).toBe(false);
    });

    test('returns true when depth exceeds depth max', () => {
        expect(isOverDepthMax(11, 10, 20)).toBe(true);
    });

    test('returns true when depth exceeds chat length', () => {
        expect(isOverDepthMax(25, 30, 20)).toBe(true);
    });

    test('ignores depth max when set to 0 (disabled)', () => {
        expect(isOverDepthMax(100, 0, 200)).toBe(false);
    });

    test('returns true when depth exactly equals chat length + 1', () => {
        // currentDepth > chatLength, so depth of 21 with chat length 20 exceeds
        expect(isOverDepthMax(21, 50, 20)).toBe(true);
    });

    test('returns false when depth exactly equals chat length', () => {
        // currentDepth > chatLength is false when equal
        expect(isOverDepthMax(20, 50, 20)).toBe(false);
    });
});

describe('MIN_ACTIVATIONS Scan State Trigger', () => {
    /**
     * Determines if MIN_ACTIVATIONS scan state should be triggered.
     * This mirrors the logic in scanning/index.js line ~775-784
     */
    function shouldTriggerMinActivationsScan(options) {
        const {
            nextScanState,
            tokenBudgetOverflowed,
            minActivations,
            activatedCount,
            currentDepth,
            depthMax,
            chatLength,
        } = options;

        // Already have a next scan state
        if (nextScanState) return { trigger: false, reason: 'already_has_next_state' };

        // Budget overflowed
        if (tokenBudgetOverflowed) return { trigger: false, reason: 'budget_overflowed' };

        // Min activations satisfied
        const notSatisfied = minActivations > 0 && activatedCount < minActivations;
        if (!notSatisfied) return { trigger: false, reason: 'threshold_met' };

        // Check depth limits
        const hitDepthMax = depthMax > 0 && currentDepth > depthMax;
        const hitChatLength = currentDepth > chatLength;
        if (hitDepthMax || hitChatLength) {
            return { trigger: false, reason: 'depth_limit_reached' };
        }

        return { trigger: true, reason: 'advance_depth' };
    }

    test('triggers scan when threshold not met and depth available', () => {
        const result = shouldTriggerMinActivationsScan({
            nextScanState: null,
            tokenBudgetOverflowed: false,
            minActivations: 5,
            activatedCount: 2,
            currentDepth: 3,
            depthMax: 10,
            chatLength: 20,
        });
        expect(result.trigger).toBe(true);
        expect(result.reason).toBe('advance_depth');
    });

    test('does not trigger when already have next scan state', () => {
        const result = shouldTriggerMinActivationsScan({
            nextScanState: 'RECURSION',
            tokenBudgetOverflowed: false,
            minActivations: 5,
            activatedCount: 2,
            currentDepth: 3,
            depthMax: 10,
            chatLength: 20,
        });
        expect(result.trigger).toBe(false);
        expect(result.reason).toBe('already_has_next_state');
    });

    test('does not trigger when budget overflowed', () => {
        const result = shouldTriggerMinActivationsScan({
            nextScanState: null,
            tokenBudgetOverflowed: true,
            minActivations: 5,
            activatedCount: 2,
            currentDepth: 3,
            depthMax: 10,
            chatLength: 20,
        });
        expect(result.trigger).toBe(false);
        expect(result.reason).toBe('budget_overflowed');
    });

    test('does not trigger when threshold already met', () => {
        const result = shouldTriggerMinActivationsScan({
            nextScanState: null,
            tokenBudgetOverflowed: false,
            minActivations: 5,
            activatedCount: 5,
            currentDepth: 3,
            depthMax: 10,
            chatLength: 20,
        });
        expect(result.trigger).toBe(false);
        expect(result.reason).toBe('threshold_met');
    });

    test('does not trigger when depth max reached', () => {
        const result = shouldTriggerMinActivationsScan({
            nextScanState: null,
            tokenBudgetOverflowed: false,
            minActivations: 5,
            activatedCount: 2,
            currentDepth: 11,
            depthMax: 10,
            chatLength: 20,
        });
        expect(result.trigger).toBe(false);
        expect(result.reason).toBe('depth_limit_reached');
    });

    test('does not trigger when chat length exceeded', () => {
        const result = shouldTriggerMinActivationsScan({
            nextScanState: null,
            tokenBudgetOverflowed: false,
            minActivations: 5,
            activatedCount: 2,
            currentDepth: 25,
            depthMax: 50,
            chatLength: 20,
        });
        expect(result.trigger).toBe(false);
        expect(result.reason).toBe('depth_limit_reached');
    });
});

describe('Min Activations Interaction with Recursion', () => {
    /**
     * After MIN_ACTIVATIONS scan state, a recursive scan should follow
     * if recursion is enabled and buffer has recursion content.
     * This mirrors the logic in scanning/index.js line ~768-772
     */

    test('recursion follows min activations when buffer has recursion content', () => {
        const worldInfoRecursive = true;
        const tokenBudgetOverflowed = false;
        const scanState = 'MIN_ACTIVATIONS';
        const bufferHasRecurse = true;

        const shouldFollowWithRecursion = worldInfoRecursive &&
            !tokenBudgetOverflowed &&
            scanState === 'MIN_ACTIVATIONS' &&
            bufferHasRecurse;

        expect(shouldFollowWithRecursion).toBe(true);
    });

    test('recursion does not follow when buffer has no recursion content', () => {
        const worldInfoRecursive = true;
        const tokenBudgetOverflowed = false;
        const scanState = 'MIN_ACTIVATIONS';
        const bufferHasRecurse = false;

        const shouldFollowWithRecursion = worldInfoRecursive &&
            !tokenBudgetOverflowed &&
            scanState === 'MIN_ACTIVATIONS' &&
            bufferHasRecurse;

        expect(shouldFollowWithRecursion).toBe(false);
    });

    test('recursion does not follow when recursion is disabled', () => {
        const worldInfoRecursive = false;
        const tokenBudgetOverflowed = false;
        const scanState = 'MIN_ACTIVATIONS';
        const bufferHasRecurse = true;

        const shouldFollowWithRecursion = worldInfoRecursive &&
            !tokenBudgetOverflowed &&
            scanState === 'MIN_ACTIVATIONS' &&
            bufferHasRecurse;

        expect(shouldFollowWithRecursion).toBe(false);
    });
});
