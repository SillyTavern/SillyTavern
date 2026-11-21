import { describe, expect, test } from '@jest/globals';
import { CHARACTER_FILTER_STATES, CHARACTER_FILTER_TYPES, evaluateCharacterFilter, migrateCharacterFilter } from '../public/scripts/world-info-character-filter.js';

const { ONE_OF, REQUIRED, EXCLUDED } = CHARACTER_FILTER_STATES;
const { CHARACTER, TAG, PERSONA } = CHARACTER_FILTER_TYPES;
const item = (type, name, state) => ({ type, name, state });

describe('migrateCharacterFilter', () => {
    test('legacy include list of names keeps "any of these characters"', () => {
        const entry = { uid: 1, characterFilter: { isExclude: false, names: ['Alice', 'Bob'], tags: [] } };
        expect(migrateCharacterFilter(entry)).toBe(true);
        expect(entry.characterFilter).toEqual([item(CHARACTER, 'Alice', ONE_OF), item(CHARACTER, 'Bob', ONE_OF)]);
    });

    test('legacy exclude list turns every name and tag into an excluded item', () => {
        const entry = { uid: 2, characterFilter: { isExclude: true, names: ['Alice'], tags: ['t1'] } };
        expect(migrateCharacterFilter(entry)).toBe(true);
        expect(entry.characterFilter).toEqual([item(CHARACTER, 'Alice', EXCLUDED), item(TAG, 't1', EXCLUDED)]);
    });

    test('legacy names plus tags keep the AND between the two groups', () => {
        const entry = { uid: 3, characterFilter: { isExclude: false, names: ['Alice', 'Bob'], tags: ['t1'] } };
        migrateCharacterFilter(entry);
        expect(entry.characterFilter).toEqual([item(CHARACTER, 'Alice', ONE_OF), item(CHARACTER, 'Bob', ONE_OF), item(TAG, 't1', REQUIRED)]);
        // Same result as the old filter for a matching name with and without the tag
        expect(evaluateCharacterFilter(entry.characterFilter, { character: 'Bob', tags: ['t1'] }).pass).toBe(true);
        expect(evaluateCharacterFilter(entry.characterFilter, { character: 'Bob', tags: [] }).pass).toBe(false);
        expect(evaluateCharacterFilter(entry.characterFilter, { character: 'Carol', tags: ['t1'] }).pass).toBe(false);
    });

    test('a missing filter becomes an empty one, and the intermediate boolean format gets a state', () => {
        const none = { uid: 4 };
        expect(migrateCharacterFilter(none)).toBe(true);
        expect(none.characterFilter).toEqual([]);

        const intermediate = { uid: 5, characterFilter: [{ type: CHARACTER, name: 'Alice', exclude: true }, { type: TAG, name: 't1' }] };
        migrateCharacterFilter(intermediate);
        expect(intermediate.characterFilter).toEqual([item(CHARACTER, 'Alice', EXCLUDED), item(TAG, 't1', ONE_OF)]);
    });

    test('an entry already in the current format is left alone', () => {
        const filter = [item(PERSONA, 'me.png', REQUIRED)];
        const entry = { uid: 6, characterFilter: structuredClone(filter) };
        expect(migrateCharacterFilter(entry)).toBe(false);
        expect(entry.characterFilter).toEqual(filter);
    });
});

describe('evaluateCharacterFilter', () => {
    const current = { character: 'Alice', tags: ['t1', 't2'], persona: 'me.png' };

    test('an empty or absent filter lets everything through', () => {
        expect(evaluateCharacterFilter([], current).pass).toBe(true);
        expect(evaluateCharacterFilter(undefined, current).pass).toBe(true);
    });

    test('"one of" passes when any item of the group matches, across types', () => {
        expect(evaluateCharacterFilter([item(CHARACTER, 'Bob', ONE_OF), item(TAG, 't2', ONE_OF)], current).pass).toBe(true);
        expect(evaluateCharacterFilter([item(CHARACTER, 'Bob', ONE_OF), item(PERSONA, 'other.png', ONE_OF)], current)).toEqual({ pass: false, reason: 'no oneOf item matched' });
    });

    test('every required item has to match', () => {
        expect(evaluateCharacterFilter([item(CHARACTER, 'Alice', REQUIRED), item(TAG, 't1', REQUIRED), item(PERSONA, 'me.png', REQUIRED)], current).pass).toBe(true);
        expect(evaluateCharacterFilter([item(CHARACTER, 'Alice', REQUIRED), item(TAG, 't9', REQUIRED)], current)).toEqual({ pass: false, reason: 'required item not matched' });
    });

    test('an excluded match wins over everything else', () => {
        const filter = [item(CHARACTER, 'Alice', REQUIRED), item(TAG, 't1', ONE_OF), item(PERSONA, 'me.png', EXCLUDED)];
        expect(evaluateCharacterFilter(filter, current)).toEqual({ pass: false, reason: 'excluded item matched' });
        expect(evaluateCharacterFilter(filter, { ...current, persona: 'other.png' }).pass).toBe(true);
    });

    test('a filter of only excluded items passes whenever none of them matches', () => {
        expect(evaluateCharacterFilter([item(CHARACTER, 'Bob', EXCLUDED)], current).pass).toBe(true);
    });

    test('nothing matches when no character or persona is active, and unknown types never match', () => {
        expect(evaluateCharacterFilter([item(CHARACTER, '', ONE_OF)], {}).pass).toBe(false);
        expect(evaluateCharacterFilter([item(PERSONA, 'me.png', REQUIRED)], { character: 'Alice' }).pass).toBe(false);
        expect(evaluateCharacterFilter([item('group', 'x', ONE_OF)], current).pass).toBe(false);
    });
});
