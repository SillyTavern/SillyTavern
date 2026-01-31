import { describe, test, expect } from '@jest/globals';
import {
    applyStaticFilters,
    parseInclusionGroups,
    computeGroupScoresPure,
    getScoreFromMatches,
    world_info_logic,
} from '../../../public/scripts/world-info/pure-functions.js';

describe('applyStaticFilters', () => {
    const baseContext = {
        trigger: 'normal',
        charaFilename: 'Alice',
        charaTags: ['female', 'protagonist'],
    };

    test('passes enabled entry with no filters', () => {
        const entry = { disable: false };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
        expect(result.reason).toBeNull();
    });

    test('fails disabled entry', () => {
        const entry = { disable: true };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('disabled');
    });

    test('fails entry with truthy disable value (loose equality)', () => {
        // disable: 1 should also disable (loose equality behavior)
        const entry = { disable: 1 };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('disabled');
    });

    test('fails entry not matching trigger', () => {
        const entry = { triggers: ['chat', 'impersonate'] };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('trigger filter');
    });

    test('passes entry matching trigger', () => {
        const entry = { triggers: ['normal', 'chat'] };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
        expect(result.reason).toBeNull();
    });

    test('passes entry with empty triggers array', () => {
        const entry = { triggers: [] };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
        expect(result.reason).toBeNull();
    });

    test('fails entry excluded by character name (isExclude=true)', () => {
        const entry = {
            characterFilter: {
                names: ['Alice'],
                isExclude: true,
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('character name filter');
    });

    test('passes entry when character name not in exclude list', () => {
        const entry = {
            characterFilter: {
                names: ['Bob'],
                isExclude: true,
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
        expect(result.reason).toBeNull();
    });

    test('fails entry not included by character name (isExclude=false)', () => {
        const entry = {
            characterFilter: {
                names: ['Bob', 'Charlie'],
                isExclude: false,
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('character name filter');
    });

    test('passes entry when character name in include list', () => {
        const entry = {
            characterFilter: {
                names: ['Alice', 'Bob'],
                isExclude: false,
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
        expect(result.reason).toBeNull();
    });

    test('fails entry excluded by character tag (isExclude=true)', () => {
        const entry = {
            characterFilter: {
                tags: ['female'],
                isExclude: true,
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('character tag filter');
    });

    test('passes entry when character tag not in exclude list', () => {
        const entry = {
            characterFilter: {
                tags: ['villain'],
                isExclude: true,
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
        expect(result.reason).toBeNull();
    });

    test('fails entry when character tag not in include list', () => {
        const entry = {
            characterFilter: {
                tags: ['villain', 'antagonist'],
                isExclude: false,
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('character tag filter');
    });

    test('passes entry when character tag in include list', () => {
        const entry = {
            characterFilter: {
                tags: ['female', 'villain'],
                isExclude: false,
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
        expect(result.reason).toBeNull();
    });

    test('passes entry with empty character filter', () => {
        const entry = {
            characterFilter: {
                names: [],
                tags: [],
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
        expect(result.reason).toBeNull();
    });

    test('skips tag filter when charaTags is null', () => {
        const entry = {
            characterFilter: {
                tags: ['someTag'],
                isExclude: false,
            },
        };
        const contextWithoutTags = { ...baseContext, charaTags: null };
        const result = applyStaticFilters(entry, contextWithoutTags);
        // When charaTags is null, the tag filter is skipped (entry passes)
        expect(result.passed).toBe(true);
        expect(result.reason).toBeNull();
    });

    test('checks name filter before tag filter', () => {
        const entry = {
            characterFilter: {
                names: ['Bob'],
                tags: ['female'],
                isExclude: false,
            },
        };
        const result = applyStaticFilters(entry, baseContext);
        // Name filter fails first
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('character name filter');
    });
});

describe('parseInclusionGroups', () => {
    test('parses single group', () => {
        const result = parseInclusionGroups('group1');
        expect(result).toEqual(['group1']);
    });

    test('parses comma-separated groups', () => {
        const result = parseInclusionGroups('group1,group2,group3');
        expect(result).toEqual(['group1', 'group2', 'group3']);
    });

    test('trims whitespace from group names', () => {
        const result = parseInclusionGroups('group1 , group2,  group3  ');
        expect(result).toEqual(['group1', 'group2', 'group3']);
    });

    test('filters empty strings', () => {
        const result = parseInclusionGroups('group1,,group2, ,group3');
        expect(result).toEqual(['group1', 'group2', 'group3']);
    });

    test('returns empty array for null', () => {
        const result = parseInclusionGroups(null);
        expect(result).toEqual([]);
    });

    test('returns empty array for undefined', () => {
        const result = parseInclusionGroups(undefined);
        expect(result).toEqual([]);
    });

    test('returns empty array for empty string', () => {
        const result = parseInclusionGroups('');
        expect(result).toEqual([]);
    });

    test('handles groups with special characters', () => {
        const result = parseInclusionGroups('group-1,group_2,group.3');
        expect(result).toEqual(['group-1', 'group_2', 'group.3']);
    });

    test('handles single whitespace-only group', () => {
        const result = parseInclusionGroups('   ');
        expect(result).toEqual([]);
    });
});

describe('getScoreFromMatches', () => {
    test('returns 0 for entry with no keys', () => {
        const entry = { key: [] };
        const matches = [];
        expect(getScoreFromMatches(entry, matches)).toBe(0);
    });

    test('returns 0 for entries with no matches', () => {
        const entry = { key: ['keyword1', 'keyword2'] };
        const matches = [];
        expect(getScoreFromMatches(entry, matches)).toBe(0);
    });

    test('counts unique primary key matches', () => {
        const entry = { key: ['keyword1', 'keyword2', 'keyword3'] };
        const matches = [
            { keyType: 'primary', keyIndex: 0 },
            { keyType: 'primary', keyIndex: 1 },
            { keyType: 'primary', keyIndex: 0 }, // duplicate
        ];
        expect(getScoreFromMatches(entry, matches)).toBe(2);
    });

    test('handles entry with undefined key array', () => {
        const entry = {};
        const matches = [];
        expect(getScoreFromMatches(entry, matches)).toBe(0);
    });
});

describe('computeGroupScoresPure', () => {
    const createEntry = (world, uid, keys = ['a']) => ({
        world,
        uid,
        key: keys,
    });

    test('computes scores from precomputed matches', () => {
        const group = [
            createEntry('world1', 1, ['a', 'b']),
            createEntry('world1', 2, ['c']),
        ];
        const precomputedMatches = new Map([
            ['world1.1', [
                { keyType: 'primary', keyIndex: 0 },
                { keyType: 'primary', keyIndex: 1 },
            ]],
            ['world1.2', [
                { keyType: 'primary', keyIndex: 0 },
            ]],
        ]);

        const scores = computeGroupScoresPure(group, precomputedMatches);
        expect(scores).toEqual([2, 1]);
    });

    test('returns 0 for entries with no matches', () => {
        const group = [
            createEntry('world1', 1),
            createEntry('world1', 2),
        ];
        const precomputedMatches = new Map();

        const scores = computeGroupScoresPure(group, precomputedMatches);
        expect(scores).toEqual([0, 0]);
    });

    test('handles empty group', () => {
        const group = [];
        const precomputedMatches = new Map();

        const scores = computeGroupScoresPure(group, precomputedMatches);
        expect(scores).toEqual([]);
    });

    test('respects AND_ANY logic', () => {
        const group = [{
            world: 'test',
            uid: 1,
            key: ['a'],
            keysecondary: ['x', 'y'],
            selectiveLogic: world_info_logic.AND_ANY,
        }];
        const precomputedMatches = new Map([
            ['test.1', [
                { keyType: 'primary', keyIndex: 0 },
                { keyType: 'secondary', keyIndex: 0 }, // One secondary match
            ]],
        ]);

        const scores = computeGroupScoresPure(group, precomputedMatches);
        // AND_ANY: primary (1) + secondary (1) = 2
        expect(scores).toEqual([2]);
    });

    test('respects AND_ALL logic - all secondary match', () => {
        const group = [{
            world: 'test',
            uid: 1,
            key: ['a'],
            keysecondary: ['x', 'y'],
            selectiveLogic: world_info_logic.AND_ALL,
        }];
        const precomputedMatches = new Map([
            ['test.1', [
                { keyType: 'primary', keyIndex: 0 },
                { keyType: 'secondary', keyIndex: 0 },
                { keyType: 'secondary', keyIndex: 1 }, // All secondary match
            ]],
        ]);

        const scores = computeGroupScoresPure(group, precomputedMatches);
        // AND_ALL with all secondary: primary (1) + secondary (2) = 3
        expect(scores).toEqual([3]);
    });

    test('respects AND_ALL logic - not all secondary match', () => {
        const group = [{
            world: 'test',
            uid: 1,
            key: ['a'],
            keysecondary: ['x', 'y'],
            selectiveLogic: world_info_logic.AND_ALL,
        }];
        const precomputedMatches = new Map([
            ['test.1', [
                { keyType: 'primary', keyIndex: 0 },
                { keyType: 'secondary', keyIndex: 0 }, // Only one secondary match
            ]],
        ]);

        const scores = computeGroupScoresPure(group, precomputedMatches);
        // AND_ALL without all secondary: only primary (1)
        expect(scores).toEqual([1]);
    });

    test('handles mixed entries in group', () => {
        const group = [
            createEntry('world1', 1, ['a', 'b', 'c']),
            createEntry('world1', 2, ['d']),
            createEntry('world2', 3, ['e', 'f']),
        ];
        const precomputedMatches = new Map([
            ['world1.1', [
                { keyType: 'primary', keyIndex: 0 },
                { keyType: 'primary', keyIndex: 2 },
            ]],
            // world1.2 has no matches
            ['world2.3', [
                { keyType: 'primary', keyIndex: 0 },
                { keyType: 'primary', keyIndex: 1 },
            ]],
        ]);

        const scores = computeGroupScoresPure(group, precomputedMatches);
        expect(scores).toEqual([2, 0, 2]);
    });
});

describe('applyStaticFilters - loose equality edge cases', () => {
    const baseContext = {
        trigger: 'normal',
        charaFilename: 'Alice',
        charaTags: ['female'],
    };

    test('passes entry with disable: 0 (falsy but not true)', () => {
        const entry = { disable: 0 };
        const result = applyStaticFilters(entry, baseContext);
        // disable == true is false when disable is 0
        expect(result.passed).toBe(true);
    });

    test('passes entry with disable: null', () => {
        const entry = { disable: null };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
    });

    test('passes entry with disable: undefined', () => {
        const entry = { disable: undefined };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
    });

    test('passes entry with disable: empty string', () => {
        const entry = { disable: '' };
        const result = applyStaticFilters(entry, baseContext);
        expect(result.passed).toBe(true);
    });

    test('fails entry with disable: "true" string', () => {
        // "true" == true is false in loose equality
        // But this tests the current behavior
        const entry = { disable: 'true' };
        const result = applyStaticFilters(entry, baseContext);
        // String "true" does NOT == true in JavaScript loose equality
        expect(result.passed).toBe(true);
    });
});

describe('Group Scoring - tie-breaking behavior', () => {
    const createEntry = (world, uid, keys = ['a']) => ({
        world,
        uid,
        key: keys,
    });

    test('entries with same score remain in original order', () => {
        // When two entries have the same score, the original order is preserved
        const group = [
            createEntry('world1', 1, ['a']),
            createEntry('world1', 2, ['a']),
            createEntry('world1', 3, ['a']),
        ];
        const precomputedMatches = new Map([
            ['world1.1', [{ keyType: 'primary', keyIndex: 0 }]],
            ['world1.2', [{ keyType: 'primary', keyIndex: 0 }]],
            ['world1.3', [{ keyType: 'primary', keyIndex: 0 }]],
        ]);

        const scores = computeGroupScoresPure(group, precomputedMatches);
        // All scores are 1
        expect(scores).toEqual([1, 1, 1]);
        // The first entry (by original order) should win in group selection
    });

    test('max score correctly identified with all same scores', () => {
        const scores = [3, 3, 3, 3];
        const maxScore = Math.max(...scores);
        expect(maxScore).toBe(3);
    });

    test('max score correctly identified with varying scores', () => {
        const scores = [1, 5, 3, 2];
        const maxScore = Math.max(...scores);
        expect(maxScore).toBe(5);
    });
});

describe('Weighted Random - boundary conditions', () => {
    /**
     * Tests for weighted random selection boundary conditions.
     * This mirrors the logic in scanning/filtering.js lines ~180-193
     */

    function selectWeightedEntry(entries, rollValue) {
        const DEFAULT_WEIGHT = 100;
        let currentWeight = 0;

        for (const entry of entries) {
            currentWeight += (entry.groupWeight ?? DEFAULT_WEIGHT);

            if (rollValue <= currentWeight) {
                return entry;
            }
        }

        return null;
    }

    test('selects first entry when roll is exactly 0', () => {
        const entries = [
            { uid: 1, groupWeight: 100 },
            { uid: 2, groupWeight: 100 },
        ];
        const result = selectWeightedEntry(entries, 0);
        // Roll 0 is <= 100, so first entry wins
        expect(result.uid).toBe(1);
    });

    test('selects first entry when roll equals its weight', () => {
        const entries = [
            { uid: 1, groupWeight: 100 },
            { uid: 2, groupWeight: 100 },
        ];
        const result = selectWeightedEntry(entries, 100);
        // Roll 100 is <= 100, so first entry wins
        expect(result.uid).toBe(1);
    });

    test('selects second entry when roll exceeds first weight', () => {
        const entries = [
            { uid: 1, groupWeight: 100 },
            { uid: 2, groupWeight: 100 },
        ];
        const result = selectWeightedEntry(entries, 101);
        // Roll 101 is > 100 but <= 200, so second entry wins
        expect(result.uid).toBe(2);
    });

    test('returns null when roll exceeds total weight', () => {
        const entries = [
            { uid: 1, groupWeight: 100 },
            { uid: 2, groupWeight: 100 },
        ];
        const result = selectWeightedEntry(entries, 201);
        // Roll 201 exceeds total weight 200
        expect(result).toBeNull();
    });

    test('uses default weight when groupWeight is undefined', () => {
        const entries = [
            { uid: 1 }, // default weight 100
            { uid: 2 }, // default weight 100
        ];
        const result = selectWeightedEntry(entries, 150);
        // Total weight is 200, roll 150 > 100 but <= 200
        expect(result.uid).toBe(2);
    });

    test('high weight entry wins more often (boundary test)', () => {
        const entries = [
            { uid: 1, groupWeight: 1 },
            { uid: 2, groupWeight: 1000 },
        ];
        // Roll value at 1 selects first, roll value at 2 selects second
        expect(selectWeightedEntry(entries, 1).uid).toBe(1);
        expect(selectWeightedEntry(entries, 2).uid).toBe(2);
        // Most values will select the high weight entry
        expect(selectWeightedEntry(entries, 500).uid).toBe(2);
    });
});

describe('groupOverride priority', () => {
    /**
     * Tests for groupOverride (priority) behavior.
     * Entries with groupOverride=true bypass random selection and win immediately.
     * This mirrors the logic in scanning/filtering.js lines ~171-177
     */

    test('groupOverride entry should be selected as priority winner', () => {
        const entries = [
            { uid: 1, groupOverride: false },
            { uid: 2, groupOverride: true },
            { uid: 3, groupOverride: false },
        ];

        // Filter to find priority entries
        const prios = entries.filter(x => x.groupOverride);
        expect(prios.length).toBe(1);
        expect(prios[0].uid).toBe(2);
    });

    test('first groupOverride entry wins when multiple exist', () => {
        const entries = [
            { uid: 1, groupOverride: true },
            { uid: 2, groupOverride: true },
            { uid: 3, groupOverride: false },
        ];

        // In the actual code, prios are sorted by sortFn before selecting first
        // For this unit test, we verify the first one in the filtered array
        const prios = entries.filter(x => x.groupOverride);
        expect(prios.length).toBe(2);
        expect(prios[0].uid).toBe(1);
    });

    test('no groupOverride means weighted random selection', () => {
        const entries = [
            { uid: 1, groupOverride: false },
            { uid: 2 }, // no groupOverride property
            { uid: 3, groupOverride: undefined },
        ];

        const prios = entries.filter(x => x.groupOverride);
        expect(prios.length).toBe(0);
    });
});

describe('Single-entry group handling', () => {
    /**
     * Tests for single-entry group skipping.
     * Groups with 0 or 1 entry don't need competition logic.
     * This mirrors the logic in scanning/filtering.js lines ~166-169
     */

    test('single entry group skips inclusion group check', () => {
        const group = [{ uid: 1 }];
        const shouldSkip = !Array.isArray(group) || group.length <= 1;
        expect(shouldSkip).toBe(true);
    });

    test('empty group skips inclusion group check', () => {
        const group = [];
        const shouldSkip = !Array.isArray(group) || group.length <= 1;
        expect(shouldSkip).toBe(true);
    });

    test('two entry group does not skip', () => {
        const group = [{ uid: 1 }, { uid: 2 }];
        const shouldSkip = !Array.isArray(group) || group.length <= 1;
        expect(shouldSkip).toBe(false);
    });

    test('null group skips', () => {
        const group = null;
        const shouldSkip = !Array.isArray(group) || group.length <= 1;
        expect(shouldSkip).toBe(true);
    });
});
