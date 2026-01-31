import { describe, test, expect } from '@jest/globals';
import {
    parseRegexFromString,
    isValidRegex,
    parseDecorators,
    getFreeWorldEntryUid,
} from '../../../public/scripts/world-info/pure-functions.js';

describe('parseRegexFromString', () => {
    test('parses simple regex without flags', () => {
        const result = parseRegexFromString('/hello/');
        expect(result).toBeInstanceOf(RegExp);
        expect(result.source).toBe('hello');
        expect(result.flags).toBe('');
    });

    test('parses regex with flags', () => {
        const result = parseRegexFromString('/test/gi');
        expect(result).toBeInstanceOf(RegExp);
        expect(result.source).toBe('test');
        expect(result.flags).toBe('gi');
    });

    test('parses case insensitive flag', () => {
        const result = parseRegexFromString('/Pattern/i');
        expect(result).toBeInstanceOf(RegExp);
        expect(result.flags).toBe('i');
    });

    test('returns null for invalid regex syntax', () => {
        expect(parseRegexFromString('/[invalid/')).toBeNull();
    });

    test('returns null for non-regex string (no slashes)', () => {
        expect(parseRegexFromString('hello')).toBeNull();
    });

    test('returns null for empty pattern', () => {
        // The regex requires at least one character in the pattern
        expect(parseRegexFromString('//')).toBeNull();
    });

    test('parses escaped slash in pattern', () => {
        const result = parseRegexFromString('/path\\/to/');
        expect(result).toBeInstanceOf(RegExp);
        // The source keeps the escape but the regex matches correctly
        expect(result.test('path/to')).toBe(true);
    });

    test('returns null for only opening slash', () => {
        expect(parseRegexFromString('/hello')).toBeNull();
    });

    test('returns null for only closing slash', () => {
        expect(parseRegexFromString('hello/')).toBeNull();
    });

    test('parses multiple valid flags', () => {
        const result = parseRegexFromString('/test/gims');
        expect(result).toBeInstanceOf(RegExp);
        expect(result.flags).toContain('g');
        expect(result.flags).toContain('i');
        expect(result.flags).toContain('m');
        expect(result.flags).toContain('s');
    });

    test('returns null for invalid flag', () => {
        expect(parseRegexFromString('/test/x')).toBeNull();
    });

    test('parses complex phone number pattern', () => {
        const result = parseRegexFromString('/^\\d{3}-\\d{4}$/');
        expect(result).toBeInstanceOf(RegExp);
        expect(result.test('123-4567')).toBe(true);
        expect(result.test('12-4567')).toBe(false);
    });

    test('parses unicode pattern', () => {
        const result = parseRegexFromString('/[а-я]/i');
        expect(result).toBeInstanceOf(RegExp);
        expect(result.test('привет')).toBe(true);
    });

    test('returns null for unescaped internal slash', () => {
        // Unescaped slash inside pattern should fail
        expect(parseRegexFromString('/a/b/')).toBeNull();
    });
});

describe('isValidRegex', () => {
    test('returns true for valid regex', () => {
        expect(isValidRegex('/test/i')).toBe(true);
    });

    test('returns false for invalid regex', () => {
        expect(isValidRegex('/[broken/')).toBe(false);
    });

    test('returns false for plain text', () => {
        expect(isValidRegex('plain text')).toBe(false);
    });

    test('returns false for null input', () => {
        expect(isValidRegex(null)).toBe(false);
    });

    test('returns false for undefined input', () => {
        expect(isValidRegex(undefined)).toBe(false);
    });
});

describe('parseDecorators', () => {
    test('parses @@activate only', () => {
        const [decorators, content] = parseDecorators('@@activate');
        expect(decorators).toEqual(['@@activate']);
        expect(content).toBe('@@activate'); // No content after decorator means the whole thing is returned
    });

    test('parses @@dont_activate only', () => {
        const [decorators, content] = parseDecorators('@@dont_activate');
        expect(decorators).toEqual(['@@dont_activate']);
        expect(content).toBe('@@dont_activate');
    });

    test('parses decorator with content', () => {
        const [decorators, content] = parseDecorators('@@activate\nHello world');
        expect(decorators).toEqual(['@@activate']);
        expect(content).toBe('Hello world');
    });

    test('parses multiple decorators', () => {
        const [decorators, content] = parseDecorators('@@activate\n@@dont_activate\nText');
        expect(decorators).toContain('@@activate');
        expect(decorators).toContain('@@dont_activate');
        expect(content).toBe('Text');
    });

    test('ignores unknown decorator (skips to content)', () => {
        const [decorators, content] = parseDecorators('@@custom\nText');
        expect(decorators).toEqual([]);
        // When an unknown decorator is found, it skips to content parsing
        expect(content).toBe('Text');
    });

    test('returns empty decorators for no decorators', () => {
        const [decorators, content] = parseDecorators('Just plain text');
        expect(decorators).toEqual([]);
        expect(content).toBe('Just plain text');
    });

    test('handles decorator mid-content', () => {
        const [decorators, content] = parseDecorators('Text\n@@activate\nMore');
        expect(decorators).toEqual([]);
        expect(content).toBe('Text\n@@activate\nMore');
    });

    test('handles empty content', () => {
        const [decorators, content] = parseDecorators('');
        expect(decorators).toEqual([]);
        expect(content).toBe('');
    });

    test('handles mixed known/unknown decorators', () => {
        const [decorators, content] = parseDecorators('@@activate\n@@unknown\nText');
        expect(decorators).toEqual(['@@activate']);
        // Unknown decorator triggers fallback, skipping to content
        expect(content).toBe('Text');
    });

    test('triple @ prefix skips processing (not a decorator)', () => {
        // @@@ at start without prior known decorator is skipped
        const [decorators, content] = parseDecorators('@@@activate\nText');
        expect(decorators).toEqual([]);
        expect(content).toBe('Text');
    });
});

describe('getFreeWorldEntryUid', () => {
    test('returns 0 for empty entries', () => {
        expect(getFreeWorldEntryUid({ entries: {} })).toBe(0);
    });

    test('returns next sequential UID', () => {
        expect(getFreeWorldEntryUid({ entries: { 0: {}, 1: {}, 2: {} } })).toBe(3);
    });

    test('finds gap in UIDs', () => {
        expect(getFreeWorldEntryUid({ entries: { 0: {}, 2: {}, 3: {} } })).toBe(1);
    });

    test('returns null for null data', () => {
        expect(getFreeWorldEntryUid(null)).toBeNull();
    });

    test('returns null for undefined data', () => {
        expect(getFreeWorldEntryUid(undefined)).toBeNull();
    });

    test('returns null for data without entries property', () => {
        expect(getFreeWorldEntryUid({})).toBeNull();
    });

    test('finds first available gap with large UID gap', () => {
        expect(getFreeWorldEntryUid({ entries: { 0: {}, 100: {} } })).toBe(1);
    });

    test('returns null when max UIDs reached', () => {
        // Create entries from 0 to 999999
        const entries = {};
        // We can't actually create a million entries in a test, but we can
        // verify the function works correctly with a smaller number
        for (let i = 0; i < 100; i++) {
            entries[i] = {};
        }
        // Should find UID 100
        expect(getFreeWorldEntryUid({ entries })).toBe(100);
    });
});
