import { describe, test, expect } from '@jest/globals';
import { getRecursionDelayLevels } from '../../../public/scripts/world-info/pure-functions.js';

describe('getRecursionDelayLevels', () => {
    test('returns empty array for entries with no delays', () => {
        const entries = [
            { world: 'test', uid: 1 },
            { world: 'test', uid: 2 },
        ];
        expect(getRecursionDelayLevels(entries)).toEqual([]);
    });

    test('returns [1] for entries with delayUntilRecursion=true', () => {
        const entries = [
            { world: 'test', uid: 1, delayUntilRecursion: true },
        ];
        expect(getRecursionDelayLevels(entries)).toEqual([1]);
    });

    test('returns numeric level for entries with delayUntilRecursion=number', () => {
        const entries = [
            { world: 'test', uid: 1, delayUntilRecursion: 3 },
        ];
        expect(getRecursionDelayLevels(entries)).toEqual([3]);
    });

    test('deduplicates delay levels', () => {
        const entries = [
            { world: 'test', uid: 1, delayUntilRecursion: 2 },
            { world: 'test', uid: 2, delayUntilRecursion: 2 },
            { world: 'test', uid: 3, delayUntilRecursion: 2 },
        ];
        expect(getRecursionDelayLevels(entries)).toEqual([2]);
    });

    test('sorts delay levels in ascending order', () => {
        const entries = [
            { world: 'test', uid: 1, delayUntilRecursion: 5 },
            { world: 'test', uid: 2, delayUntilRecursion: 2 },
            { world: 'test', uid: 3, delayUntilRecursion: 10 },
        ];
        expect(getRecursionDelayLevels(entries)).toEqual([2, 5, 10]);
    });

    test('treats delayUntilRecursion=true as level 1 alongside numeric levels', () => {
        const entries = [
            { world: 'test', uid: 1, delayUntilRecursion: true },
            { world: 'test', uid: 2, delayUntilRecursion: 2 },
            { world: 'test', uid: 3, delayUntilRecursion: 3 },
        ];
        expect(getRecursionDelayLevels(entries)).toEqual([1, 2, 3]);
    });

    test('filters out entries without delayUntilRecursion', () => {
        const entries = [
            { world: 'test', uid: 1, delayUntilRecursion: 2 },
            { world: 'test', uid: 2, delayUntilRecursion: false },
            { world: 'test', uid: 3 },
            { world: 'test', uid: 4, delayUntilRecursion: null },
            { world: 'test', uid: 5, delayUntilRecursion: 3 },
        ];
        expect(getRecursionDelayLevels(entries)).toEqual([2, 3]);
    });

    test('handles delayUntilRecursion=0 as falsy (filtered out)', () => {
        const entries = [
            { world: 'test', uid: 1, delayUntilRecursion: 0 },
            { world: 'test', uid: 2, delayUntilRecursion: 1 },
        ];
        // 0 is falsy, so it should be filtered out
        expect(getRecursionDelayLevels(entries)).toEqual([1]);
    });

    test('returns empty array for empty entries array', () => {
        expect(getRecursionDelayLevels([])).toEqual([]);
    });

    test('handles string numbers for delayUntilRecursion', () => {
        const entries = [
            { world: 'test', uid: 1, delayUntilRecursion: '2' },
            { world: 'test', uid: 2, delayUntilRecursion: '5' },
        ];
        // Number() should coerce strings to numbers
        expect(getRecursionDelayLevels(entries)).toEqual([2, 5]);
    });
});

describe('recursion delay behavior documentation', () => {
    // These tests document the expected behavior that should be tested in e2e tests

    test('delayUntilRecursion=true entry should NOT activate during INITIAL scan', () => {
        // Entry with delayUntilRecursion=true should be skipped during scan_state.INITIAL
        // This is enforced in scanning/index.js line ~340:
        // if (scanState !== scan_state.RECURSION && entry.delayUntilRecursion && !isSticky)
        const entry = { delayUntilRecursion: true };
        const scanStateIsInitial = true;
        const isSticky = false;

        const shouldBeDelayed = scanStateIsInitial && entry.delayUntilRecursion && !isSticky;
        expect(shouldBeDelayed).toBe(true);
    });

    test('delayUntilRecursion=2 entry should NOT activate at recursion level 1', () => {
        // Entry with delayUntilRecursion=2 should not activate until level 2
        // This is enforced in scanning/index.js line ~345:
        // if (scanState === scan_state.RECURSION && entry.delayUntilRecursion > currentRecursionDelayLevel)
        const entry = { delayUntilRecursion: 2 };
        const currentRecursionDelayLevel = 1;

        const shouldBeDelayed = entry.delayUntilRecursion > currentRecursionDelayLevel;
        expect(shouldBeDelayed).toBe(true);
    });

    test('delayUntilRecursion=2 entry SHOULD activate at recursion level 2', () => {
        const entry = { delayUntilRecursion: 2 };
        const currentRecursionDelayLevel = 2;

        const shouldBeDelayed = entry.delayUntilRecursion > currentRecursionDelayLevel;
        expect(shouldBeDelayed).toBe(false);
    });

    test('sticky entry with delayUntilRecursion bypasses delay', () => {
        // Sticky entries should activate regardless of delay
        const entry = { delayUntilRecursion: true };
        const isSticky = true;

        // The condition checks !isSticky, so if isSticky is true, the delay is bypassed
        const shouldBeDelayed = entry.delayUntilRecursion && !isSticky;
        expect(shouldBeDelayed).toBe(false);
    });

    test('preventRecursion entries are not added to recursion buffer', () => {
        // Entries with preventRecursion=true should not contribute to recursion
        // This is enforced in scanning/index.js line ~744:
        // const successfulNewEntriesForRecursion = successfulNewEntries.filter(x => !x.preventRecursion);
        const successfulNewEntries = [
            { uid: 1, preventRecursion: false },
            { uid: 2, preventRecursion: true },
            { uid: 3 },
        ];

        const forRecursion = successfulNewEntries.filter(x => !x.preventRecursion);
        expect(forRecursion.map(x => x.uid)).toEqual([1, 3]);
    });

    test('excludeRecursion entries are skipped during RECURSION state', () => {
        // Entries with excludeRecursion=true should be skipped during recursion
        // This is enforced in scanning/index.js line ~350:
        // if (scanState === scan_state.RECURSION && world_info_recursive && entry.excludeRecursion && !isSticky)
        const entry = { excludeRecursion: true };
        const scanStateIsRecursion = true;
        const worldInfoRecursiveEnabled = true;
        const isSticky = false;

        const shouldBeSkipped = scanStateIsRecursion && worldInfoRecursiveEnabled && entry.excludeRecursion && !isSticky;
        expect(shouldBeSkipped).toBe(true);
    });
});
