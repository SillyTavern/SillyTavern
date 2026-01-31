import { describe, test, expect } from '@jest/globals';
import { isWholeWordMatch } from '../../../public/scripts/world-info/pure-functions.js';

describe('isWholeWordMatch', () => {
    test('matches at start of string', () => {
        const text = 'hello world';
        // 'hello' is at index 0-4 (endIndex is inclusive)
        expect(isWholeWordMatch(text, 0, 4, 'hello')).toBe(true);
    });

    test('matches at end of string', () => {
        const text = 'say hello';
        // 'hello' is at index 4-8
        expect(isWholeWordMatch(text, 4, 8, 'hello')).toBe(true);
    });

    test('matches in middle with spaces', () => {
        const text = 'say hello world';
        // 'hello' is at index 4-8
        expect(isWholeWordMatch(text, 4, 8, 'hello')).toBe(true);
    });

    test('fails when no boundary on left', () => {
        const text = 'sayhello world';
        // 'hello' is at index 3-7
        expect(isWholeWordMatch(text, 3, 7, 'hello')).toBe(false);
    });

    test('fails when no boundary on right', () => {
        const text = 'say helloworld';
        // 'hello' is at index 4-8
        expect(isWholeWordMatch(text, 4, 8, 'hello')).toBe(false);
    });

    test('punctuation acts as boundary', () => {
        const text = 'hello, world';
        // 'hello' is at index 0-4
        expect(isWholeWordMatch(text, 0, 4, 'hello')).toBe(true);
    });

    test('unicode boundary', () => {
        // Space acts as boundary between unicode and ascii
        const text = '日本語 hello 世界';
        // 'hello' starts after the space following the Japanese characters
        const startIdx = text.indexOf('hello');
        const endIdx = startIdx + 'hello'.length - 1;
        expect(isWholeWordMatch(text, startIdx, endIdx, 'hello')).toBe(true);
    });

    test('entire string is a match', () => {
        const text = 'hello';
        expect(isWholeWordMatch(text, 0, 4, 'hello')).toBe(true);
    });

    test('apostrophe acts as boundary', () => {
        const text = 'it\'s hello\'s';
        // 'hello' is at index 5-9
        expect(isWholeWordMatch(text, 5, 9, 'hello')).toBe(true);
    });

    test('multi-word keyword always returns true', () => {
        // Multi-word keywords use substring matching, so always pass whole word check
        const text = 'sayhello worldfoo';
        expect(isWholeWordMatch(text, 3, 13, 'hello world')).toBe(true);
    });

    test('handles edge case at exact boundaries', () => {
        const text = 'a hello b';
        // 'hello' is at index 2-6
        expect(isWholeWordMatch(text, 2, 6, 'hello')).toBe(true);
    });

    test('underscore is not a word boundary', () => {
        const text = 'say_hello_world';
        // 'hello' is at index 4-8, underscore is \w so not a boundary
        expect(isWholeWordMatch(text, 4, 8, 'hello')).toBe(false);
    });

    test('digit is not a word boundary', () => {
        const text = 'say1hello2world';
        // 'hello' is at index 4-8, digit is \w so not a boundary
        expect(isWholeWordMatch(text, 4, 8, 'hello')).toBe(false);
    });
});
