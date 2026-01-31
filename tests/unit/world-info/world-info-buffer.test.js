import { describe, test, expect } from '@jest/globals';
import {
    transformString,
    matchKeysPure,
    getScoreFromMatches,
    world_info_logic,
} from '../../../public/scripts/world-info/pure-functions.js';

describe('transformString', () => {
    test('returns original string when entry is case sensitive', () => {
        const result = transformString('Hello', { caseSensitive: true }, false);
        expect(result).toBe('Hello');
    });

    test('returns lowercase when entry is case insensitive', () => {
        const result = transformString('Hello', { caseSensitive: false }, true);
        expect(result).toBe('hello');
    });

    test('uses global setting when entry has null caseSensitive (global true)', () => {
        const result = transformString('Hello', {}, true);
        expect(result).toBe('Hello');
    });

    test('uses global setting when entry has null caseSensitive (global false)', () => {
        const result = transformString('Hello', {}, false);
        expect(result).toBe('hello');
    });

    test('handles already lowercase string', () => {
        const result = transformString('hello', {}, false);
        expect(result).toBe('hello');
    });

    test('handles unicode string', () => {
        const result = transformString('ПРИВЕТ', {}, false);
        expect(result).toBe('привет');
    });
});

describe('matchKeysPure', () => {
    const defaultGlobalSettings = { caseSensitive: false, matchWholeWords: false };

    test('exact match returns true', () => {
        const result = matchKeysPure('hello world', 'hello', {}, defaultGlobalSettings);
        expect(result).toBe(true);
    });

    test('no match returns false', () => {
        const result = matchKeysPure('hello world', 'foo', {}, defaultGlobalSettings);
        expect(result).toBe(false);
    });

    test('entry overrides global case sensitivity', () => {
        // Entry is case sensitive, global is not
        const result = matchKeysPure('Hello', 'hello', { caseSensitive: true }, { caseSensitive: false, matchWholeWords: false });
        expect(result).toBe(false);
    });

    test('uses global case sensitivity when entry is null', () => {
        // Global is case sensitive
        const result = matchKeysPure('Hello', 'hello', {}, { caseSensitive: true, matchWholeWords: false });
        expect(result).toBe(false);
    });

    test('entry overrides global whole words', () => {
        // Entry requires whole words, global does not
        const result = matchKeysPure('helloworld', 'hello', { matchWholeWords: true }, { caseSensitive: false, matchWholeWords: false });
        expect(result).toBe(false);
    });

    test('uses global whole words when entry is null', () => {
        // Global requires whole words
        const result = matchKeysPure('helloworld', 'hello', {}, { caseSensitive: false, matchWholeWords: true });
        expect(result).toBe(false);
    });

    test('whole word match with spaces succeeds', () => {
        const result = matchKeysPure('hello world', 'hello', {}, { caseSensitive: false, matchWholeWords: true });
        expect(result).toBe(true);
    });

    test('regex ignores other settings', () => {
        // Even with case sensitive and whole words, regex does its own thing
        const result = matchKeysPure('TEST123', '/test\\d+/i', {}, { caseSensitive: true, matchWholeWords: true });
        expect(result).toBe(true);
    });

    test('empty needle returns false', () => {
        const result = matchKeysPure('text', '', {}, defaultGlobalSettings);
        expect(result).toBe(false);
    });

    test('whitespace needle returns false', () => {
        const result = matchKeysPure('text', '   ', {}, defaultGlobalSettings);
        expect(result).toBe(false);
    });

    test('needle is trimmed', () => {
        const result = matchKeysPure('hello', ' hello ', {}, defaultGlobalSettings);
        expect(result).toBe(true);
    });

    test('unicode match', () => {
        const result = matchKeysPure('日本語テスト', '日本', {}, defaultGlobalSettings);
        expect(result).toBe(true);
    });

    test('multi-word whole word match', () => {
        const result = matchKeysPure('hello world test', 'hello world', {}, { caseSensitive: false, matchWholeWords: true });
        expect(result).toBe(true);
    });

    test('punctuation acts as word boundary', () => {
        const result = matchKeysPure('hello, world', 'hello', {}, { caseSensitive: false, matchWholeWords: true });
        expect(result).toBe(true);
    });
});

describe('getScoreFromMatches', () => {
    test('single primary match returns score 1', () => {
        const entry = { key: ['a'], keysecondary: [] };
        const matches = [
            { entryId: 'test.0', keyType: 'primary', keyIndex: 0, matchedKeyword: 'a' },
        ];
        expect(getScoreFromMatches(entry, matches)).toBe(1);
    });

    test('multiple primary matches returns count', () => {
        const entry = { key: ['a', 'b'], keysecondary: [] };
        const matches = [
            { entryId: 'test.0', keyType: 'primary', keyIndex: 0, matchedKeyword: 'a' },
            { entryId: 'test.0', keyType: 'primary', keyIndex: 1, matchedKeyword: 'b' },
        ];
        expect(getScoreFromMatches(entry, matches)).toBe(2);
    });

    test('AND_ANY adds both primary and secondary scores', () => {
        const entry = { key: ['a'], keysecondary: ['x'], selectiveLogic: world_info_logic.AND_ANY };
        const matches = [
            { entryId: 'test.0', keyType: 'primary', keyIndex: 0, matchedKeyword: 'a' },
            { entryId: 'test.0', keyType: 'secondary', keyIndex: 0, matchedKeyword: 'x' },
        ];
        expect(getScoreFromMatches(entry, matches)).toBe(2);
    });

    test('AND_ALL adds both scores when all secondary keys match', () => {
        const entry = { key: ['a'], keysecondary: ['x', 'y'], selectiveLogic: world_info_logic.AND_ALL };
        const matches = [
            { entryId: 'test.0', keyType: 'primary', keyIndex: 0, matchedKeyword: 'a' },
            { entryId: 'test.0', keyType: 'secondary', keyIndex: 0, matchedKeyword: 'x' },
            { entryId: 'test.0', keyType: 'secondary', keyIndex: 1, matchedKeyword: 'y' },
        ];
        expect(getScoreFromMatches(entry, matches)).toBe(3);
    });

    test('AND_ALL returns only primary score when partial secondary match', () => {
        const entry = { key: ['a'], keysecondary: ['x', 'y'], selectiveLogic: world_info_logic.AND_ALL };
        const matches = [
            { entryId: 'test.0', keyType: 'primary', keyIndex: 0, matchedKeyword: 'a' },
            { entryId: 'test.0', keyType: 'secondary', keyIndex: 0, matchedKeyword: 'x' },
            // Missing 'y' secondary key
        ];
        expect(getScoreFromMatches(entry, matches)).toBe(1);
    });

    test('no primary keys returns 0', () => {
        const entry = { key: [], keysecondary: ['x'] };
        const matches = [
            { entryId: 'test.0', keyType: 'secondary', keyIndex: 0, matchedKeyword: 'x' },
        ];
        expect(getScoreFromMatches(entry, matches)).toBe(0);
    });

    test('duplicate key matches count as one', () => {
        const entry = { key: ['a'], keysecondary: [] };
        // Same key matched multiple times (e.g., appears twice in text)
        const matches = [
            { entryId: 'test.0', keyType: 'primary', keyIndex: 0, matchedKeyword: 'a' },
            { entryId: 'test.0', keyType: 'primary', keyIndex: 0, matchedKeyword: 'a' },
        ];
        expect(getScoreFromMatches(entry, matches)).toBe(1);
    });
});
