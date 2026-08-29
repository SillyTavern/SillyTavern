/**
 * Unit tests for the client-side public/scripts/utils-pure.js.
 */
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    shiftUpByOne,
    shiftDownByOne,
    canUseNegativeLookbehind,
    isObject,
    deepMerge,
    ensurePlainObject,
    escapeHtml,
    sanitizeSelector,
    isValidUrl,
    isUuid,
    stringToRange,
    onlyUnique,
    onlyUniqueJson,
    removeFromArray,
    normalizeArray,
    isDigitsOnly,
    shuffle,
    isSameFile,
    getStringHash,
    debounce,
    debounceAsync,
    cancelDebounce,
    throttle,
    debouncedThrottle,
    getUniqueName,
    delay,
    isSubsetOf,
    incrementString,
    stringFormat,
    trimToEndSentence,
    trimToStartSentence,
    humanFileSize,
    formatTime,
    countOccurrences,
    isTrueBoolean,
    isFalseBoolean,
    parseStringArray,
    isOdd,
    sortMoments,
    splitRecursive,
    isDataURL,
    calculateThumbnailSize,
    extractAllWords,
    escapeRegex,
    regexFromString,
    Stopwatch,
    RateLimiter,
    extractDataFromPng,
    getFileExtension,
    waitUntilCondition,
    uuidv4,
    collapseSpaces,
    setValueByPath,
    deleteValueByPath,
    compareIgnoreCaseAndAccents,
    includesIgnoreCaseAndAccents,
    equalsIgnoreCaseAndAccents,
    sortIgnoreCaseAndAccents,
    highlightRegex,
    getFreeName,
    arraysEqual,
    versionCompare,
    logSlashCommandWarn,
    clamp,
    createTimeout,
} from '../public/scripts/utils-pure.js';

/**
 * Yields to the microtask queue a few times.
 * Promises returned from `async` functions need several ticks to settle,
 * so a single `await Promise.resolve()` is not always enough.
 */
async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

//region Helpers

describe('shiftUpByOne / shiftDownByOne', () => {
    test('shiftUpByOne increments every element and returns the incremented value', () => {
        const input = [1, 2, 3];
        const result = input.map(shiftUpByOne);
        expect(result).toEqual([2, 3, 4]);
        // The helper mutates the array it is given (intended for Array.map in-place edits)
        expect(input).toEqual([2, 3, 4]);
    });

    test('shiftDownByOne decrements every element', () => {
        const input = [1, 2, 3];
        const result = input.map(shiftDownByOne);
        expect(result).toEqual([0, 1, 2]);
        expect(input).toEqual([0, 1, 2]);
    });
});

describe('canUseNegativeLookbehind', () => {
    test('returns true on modern V8 (Node supports lookbehind)', () => {
        expect(canUseNegativeLookbehind()).toBe(true);
    });

    test('memoizes the result on the function object', () => {
        canUseNegativeLookbehind();
        expect(canUseNegativeLookbehind.result).toBe(true);
        // Subsequent calls return the cached value
        expect(canUseNegativeLookbehind()).toBe(true);
    });
});

//endregion

//region Objects

describe('isObject', () => {
    test('returns true for plain objects', () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ a: 1 })).toBe(true);
    });

    test('returns false for arrays, strings, numbers and booleans', () => {
        expect(isObject([])).toBe(false);
        expect(isObject('string')).toBe(false);
        expect(isObject(42)).toBe(false);
        expect(isObject(false)).toBe(false);
    });

    test('returns the falsy input itself (not a strict boolean) for nullish/zero input', () => {
        // The implementation short-circuits on `item &&`, returning the raw falsy value
        expect(isObject(null)).toBeFalsy();
        expect(isObject(undefined)).toBeFalsy();
        expect(isObject(0)).toBeFalsy();
    });
});

describe('deepMerge', () => {
    test('merges flat objects', () => {
        expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
    });

    test('recursively merges nested objects', () => {
        const target = { nested: { a: 1, b: 2 } };
        const source = { nested: { b: 3, c: 4 } };
        expect(deepMerge(target, source)).toEqual({ nested: { a: 1, b: 3, c: 4 } });
    });

    test('source primitives override target values', () => {
        expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    });

    test('source arrays override target arrays (no deep merge)', () => {
        expect(deepMerge({ list: [1, 2, 3] }, { list: [9] })).toEqual({ list: [9] });
    });

    test('adds nested objects that only exist in the source', () => {
        expect(deepMerge({ a: 1 }, { b: { c: 2 } })).toEqual({ a: 1, b: { c: 2 } });
    });

    test('does not mutate the inputs', () => {
        const target = { nested: { x: 1 } };
        const source = { nested: { y: 2 } };
        const result = deepMerge(target, source);
        expect(target).toEqual({ nested: { x: 1 } });
        expect(source).toEqual({ nested: { y: 2 } });
        expect(result).toEqual({ nested: { x: 1, y: 2 } });
    });

    test('returns a shallow copy of target when source is not an object', () => {
        expect(deepMerge({ a: 1 }, null)).toEqual({ a: 1 });
        expect(deepMerge({ a: 1 }, 'nope')).toEqual({ a: 1 });
    });
});

describe('ensurePlainObject', () => {
    test('returns the same object for plain objects', () => {
        const obj = { a: 1 };
        expect(ensurePlainObject(obj)).toBe(obj);
    });

    test('returns an empty object for non-objects', () => {
        expect(ensurePlainObject(null)).toEqual({});
        expect(ensurePlainObject(undefined)).toEqual({});
        expect(ensurePlainObject([1, 2])).toEqual({});
        expect(ensurePlainObject('str')).toEqual({});
        expect(ensurePlainObject(42)).toEqual({});
    });
});

//endregion

//region Strings

describe('escapeHtml', () => {
    test('escapes all HTML-special characters', () => {
        expect(escapeHtml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    });

    test('leaves plain text untouched', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });

    test('nullish input yields an empty string', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    test('coerces non-string input', () => {
        expect(escapeHtml(123)).toBe('123');
    });
});

describe('sanitizeSelector', () => {
    test('replaces invalid characters with the default replacement', () => {
        expect(sanitizeSelector('foo/bar baz!')).toBe('foo_bar_baz_');
    });

    test('replaces invalid characters with a custom replacement', () => {
        expect(sanitizeSelector('a.b.c', '-')).toBe('a-b-c');
    });

    test('keeps alphanumerics, dashes and underscores', () => {
        expect(sanitizeSelector('Abc-123_x')).toBe('Abc-123_x');
    });

    test('coerces non-string input', () => {
        expect(sanitizeSelector(42)).toBe('42');
    });
});

describe('isValidUrl', () => {
    test('accepts valid URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
        expect(isValidUrl('http://localhost:8080/path?query=1')).toBe(true);
        expect(isValidUrl('file:///tmp/test.txt')).toBe(true);
    });

    test('rejects invalid URLs', () => {
        expect(isValidUrl('not a url')).toBe(false);
        expect(isValidUrl('')).toBe(false);
        expect(isValidUrl('http://')).toBe(false);
    });
});

describe('isUuid', () => {
    test('accepts valid UUIDs of versions 1-5 (case-insensitive)', () => {
        expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true);
        expect(isUuid('c47b5f8e-4d95-4f2b-9f4f-8f6b1b9c0c52')).toBe(true);
        expect(isUuid('3F2504E0-4F89-11D3-9A0C-0305E82C3301')).toBe(true);
    });

    test('rejects invalid UUIDs', () => {
        expect(isUuid('not-a-uuid')).toBe(false);
        expect(isUuid('3f2504e0-4f89-61d3-9a0c-0305e82c3301')).toBe(false); // version 6 not allowed
        expect(isUuid('3f2504e0-4f89-11d3-ca0c-0305e82c3301')).toBe(false); // invalid variant nibble
        expect(isUuid('')).toBe(false);
        expect(isUuid(undefined)).toBe(false);
    });
});

describe('isDigitsOnly', () => {
    test('returns true for digit-only strings', () => {
        expect(isDigitsOnly('123')).toBe(true);
        expect(isDigitsOnly('0')).toBe(true);
    });

    test('returns false for anything else', () => {
        expect(isDigitsOnly('abc')).toBe(false);
        expect(isDigitsOnly('12a')).toBe(false);
        expect(isDigitsOnly('')).toBe(false);
        expect(isDigitsOnly('12.5')).toBe(false);
        expect(isDigitsOnly('-5')).toBe(false);
    });
});

describe('stringToRange', () => {
    test('parses an inclusive range', () => {
        expect(stringToRange('10-20', 1, 100)).toEqual({ start: 10, end: 20 });
    });

    test('parses a single value as start and end', () => {
        expect(stringToRange('5', 1, 100)).toEqual({ start: 5, end: 5 });
    });

    test('coerces non-string input', () => {
        expect(stringToRange(10, 1, 100)).toEqual({ start: 10, end: 10 });
    });

    test('returns null for invalid input', () => {
        expect(stringToRange('abc', 1, 100)).toBeNull();
        expect(stringToRange('20-10', 1, 100)).toBeNull(); // start > end
        expect(stringToRange('0-5', 1, 100)).toBeNull(); // start < min
        expect(stringToRange('10-200', 1, 100)).toBeNull(); // end > max
        expect(stringToRange('-5', 1, 100)).toBeNull(); // missing start
        expect(stringToRange('10-', 1, 100)).toBeNull(); // missing end
    });

    test('accepts boundary values', () => {
        expect(stringToRange('1', 1, 100)).toEqual({ start: 1, end: 1 });
        expect(stringToRange('100', 1, 100)).toEqual({ start: 100, end: 100 });
    });
});

describe('incrementString', () => {
    test('increments a trailing number', () => {
        expect(incrementString('Hello, world! 1')).toBe('Hello, world! 2');
    });

    test('appends 1 when there is no trailing number', () => {
        expect(incrementString('abc')).toBe('abc1');
    });

    test('increments a string that is only a number', () => {
        expect(incrementString('42')).toBe('43');
        expect(incrementString('9')).toBe('10');
    });
});

describe('stringFormat', () => {
    test('substitutes numbered placeholders', () => {
        expect(stringFormat('Hello, {0}! You are {1}.', 'world', 'fine')).toBe('Hello, world! You are fine.');
    });

    test('reuses an argument by index', () => {
        expect(stringFormat('{0} and {0}', 'x')).toBe('x and x');
    });

    test('leaves unknown placeholders untouched', () => {
        expect(stringFormat('{0} {2}', 'a')).toBe('a {2}');
    });
});

describe('trimToEndSentence', () => {
    test('trims to the last sentence-ending punctuation', () => {
        expect(trimToEndSentence('Hello, world! I am from')).toBe('Hello, world!');
    });

    test('returns the input with trailing whitespace removed when no punctuation is found', () => {
        // Note: only trimEnd is applied, leading whitespace is preserved
        expect(trimToEndSentence('no punctuation here  ')).toBe('no punctuation here');
        expect(trimToEndSentence('  leading kept  ')).toBe('  leading kept');
    });

    test('returns an empty string for falsy input', () => {
        expect(trimToEndSentence('')).toBe('');
        expect(trimToEndSentence(null)).toBe('');
        expect(trimToEndSentence(undefined)).toBe('');
    });

    test('trims to the last emoji', () => {
        expect(trimToEndSentence('Hi there 👍 ok')).toBe('Hi there 👍');
    });

    test('drops trailing whitespace before punctuation', () => {
        // The '.' is preceded by a space, so the space is excluded from the result
        expect(trimToEndSentence('end . rest')).toBe('end');
    });

    test('supports CJK and other full-width punctuation', () => {
        expect(trimToEndSentence('こんにちは。 こんにちは')).toBe('こんにちは。');
    });
});

describe('trimToStartSentence', () => {
    test('removes everything up to and including the first full stop', () => {
        expect(trimToStartSentence('One. Two')).toBe('Two');
        expect(trimToStartSentence('Hello there. General Kenobi!')).toBe('General Kenobi!');
    });

    test('returns the input unchanged when there is no delimiter', () => {
        expect(trimToStartSentence('No delimiters')).toBe('No delimiters');
    });

    test('ignores !, ? and newline delimiters when no full stop exists', () => {
        // `first` is initialized to the (missing) '.' index (-1), so the
        // comparisons against the other delimiter positions never succeed
        // and the input is returned unchanged.
        expect(trimToStartSentence('Hello there! You there!')).toBe('Hello there! You there!');
        expect(trimToStartSentence('What? A question')).toBe('What? A question');
        expect(trimToStartSentence('First line\nSecond line')).toBe('First line\nSecond line');
    });

    test('skips two characters after the delimiter, assuming trailing whitespace', () => {
        // The implementation cuts at `first + 2` (delimiter plus one space),
        // so a delimiter that is not followed by a space eats a character.
        expect(trimToStartSentence('One.Two')).toBe('wo');
    });

    test('returns an empty string for falsy input', () => {
        expect(trimToStartSentence('')).toBe('');
        expect(trimToStartSentence(null)).toBe('');
    });
});

describe('humanFileSize', () => {
    test('formats bytes below the threshold without a unit suffix', () => {
        expect(humanFileSize(0)).toBe('0 B');
        expect(humanFileSize(999)).toBe('999 B');
        expect(humanFileSize(999, true)).toBe('999 B');
    });

    test('formats using binary (IEC) units by default', () => {
        expect(humanFileSize(1024)).toBe('1.0 KiB');
        expect(humanFileSize(1024 * 1024)).toBe('1.0 MiB');
        expect(humanFileSize(1500)).toBe('1.5 KiB');
    });

    test('formats using metric (SI) units when si is true', () => {
        expect(humanFileSize(1000, true)).toBe('1.0 kB');
        expect(humanFileSize(1000 * 1000, true)).toBe('1.0 MB');
    });

    test('honours the decimal places parameter', () => {
        expect(humanFileSize(1024, false, 2)).toBe('1.00 KiB');
        expect(humanFileSize(1536, false, 0)).toBe('2 KiB');
    });

    test('handles negative values', () => {
        expect(humanFileSize(-1024)).toBe('-1.0 KiB');
    });
});

describe('formatTime', () => {
    test('formats seconds as MM:SS', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(5)).toBe('0:05');
        expect(formatTime(65)).toBe('1:05');
        expect(formatTime(3599)).toBe('59:59');
        expect(formatTime(3600)).toBe('60:00');
    });

    test('truncates fractional seconds', () => {
        expect(formatTime(65.9)).toBe('1:05');
    });

    test('returns 0:00 for non-finite or NaN input', () => {
        expect(formatTime(NaN)).toBe('0:00');
        expect(formatTime(Infinity)).toBe('0:00');
        expect(formatTime(-Infinity)).toBe('0:00');
    });
});

describe('countOccurrences', () => {
    test('counts single-character occurrences', () => {
        expect(countOccurrences('Hello, world!', 'l')).toBe(3);
        expect(countOccurrences('Hello, world!', 'x')).toBe(0);
    });

    test('counts multi-character occurrences (overlapping ones included)', () => {
        expect(countOccurrences('ababab', 'ab')).toBe(3);
        expect(countOccurrences('aaaa', 'aa')).toBe(3);
    });

    test('returns 0 for an empty string', () => {
        expect(countOccurrences('', 'a')).toBe(0);
    });
});

describe('isTrueBoolean / isFalseBoolean', () => {
    test('isTrueBoolean accepts on/true/1 case-insensitively and with whitespace', () => {
        expect(isTrueBoolean('true')).toBe(true);
        expect(isTrueBoolean('TRUE')).toBe(true);
        expect(isTrueBoolean(' on ')).toBe(true);
        expect(isTrueBoolean('1')).toBe(true);
    });

    test('isTrueBoolean rejects everything else', () => {
        expect(isTrueBoolean('yes')).toBe(false);
        expect(isTrueBoolean('off')).toBe(false);
        expect(isTrueBoolean('')).toBe(false);
        expect(isTrueBoolean(undefined)).toBe(false);
    });

    test('isFalseBoolean accepts off/false/0 case-insensitively and with whitespace', () => {
        expect(isFalseBoolean('false')).toBe(true);
        expect(isFalseBoolean('FALSE')).toBe(true);
        expect(isFalseBoolean(' off ')).toBe(true);
        expect(isFalseBoolean('0')).toBe(true);
    });

    test('isFalseBoolean rejects everything else', () => {
        expect(isFalseBoolean('no')).toBe(false);
        expect(isFalseBoolean('true')).toBe(false);
        expect(isFalseBoolean(undefined)).toBe(false);
    });
});

describe('parseStringArray', () => {
    test('parses a JSON array string', () => {
        expect(parseStringArray('["a", "b"]')).toEqual(['a', 'b']);
    });

    test('coerces JSON array members to strings', () => {
        expect(parseStringArray('[1, true, null]')).toEqual(['1', 'true', 'null']);
    });

    test('falls back to comma-separated parsing with trimming', () => {
        expect(parseStringArray('a, b ,c')).toEqual(['a', 'b', 'c']);
    });

    test('falls back to comma-separated parsing for non-array JSON', () => {
        expect(parseStringArray('42')).toEqual(['42']);
        expect(parseStringArray('not [json')).toEqual(['not [json']);
    });

    test('filters out empty entries in comma-separated fallback', () => {
        expect(parseStringArray('a,,b,')).toEqual(['a', 'b']);
    });

    test('returns an empty array for empty or non-string input', () => {
        expect(parseStringArray('')).toEqual([]);
        expect(parseStringArray(null)).toEqual([]);
        expect(parseStringArray(42)).toEqual([]);
    });
});

describe('collapseSpaces', () => {
    test('collapses consecutive whitespace into single spaces and trims', () => {
        expect(collapseSpaces('  a   b \n c \t')).toBe('a b c');
    });

    test('leaves clean strings unchanged', () => {
        expect(collapseSpaces('a b c')).toBe('a b c');
    });
});

describe('extractAllWords', () => {
    test('extracts lower-cased words ignoring punctuation', () => {
        expect(extractAllWords('Hello, World!')).toEqual(['hello', 'world']);
    });

    test('treats underscores as word characters', () => {
        expect(extractAllWords('Foo_bar baz')).toEqual(['foo_bar', 'baz']);
    });

    test('returns an empty array for falsy input', () => {
        expect(extractAllWords('')).toEqual([]);
        expect(extractAllWords(null)).toEqual([]);
    });
});

describe('escapeRegex', () => {
    test('escapes regex special characters', () => {
        expect(escapeRegex('^Hello$')).toBe('\\^Hello\\$');
        expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c');
        expect(escapeRegex('(group)')).toBe('\\(group\\)');
    });

    test('escaped strings match themselves literally', () => {
        const special = '^$.*+?()[]{}|\\/';
        expect(new RegExp(escapeRegex(special)).test(special)).toBe(true);
    });

    test('leaves ordinary characters untouched', () => {
        expect(escapeRegex('abc123')).toBe('abc123');
    });
});

describe('regexFromString', () => {
    test('parses a delimited regex with flags', () => {
        const re = regexFromString('/foo/gi');
        expect(re).toBeInstanceOf(RegExp);
        expect(re.source).toBe('foo');
        expect(re.flags).toBe('gi');
    });

    test('parses a bare regex without delimiters', () => {
        const re = regexFromString('foo');
        expect(re.source).toBe('foo');
        expect(re.test('a foo b')).toBe(true);
    });

    test('returns undefined for invalid regex input', () => {
        expect(regexFromString('[unclosed')).toBeUndefined();
    });
});

describe('highlightRegex', () => {
    test('wraps the whole string in a highlight span', () => {
        const result = highlightRegex('abc');
        expect(result).toBe('<span class="regex-highlight">abc</span>');
    });

    test('escapes HTML special characters', () => {
        const result = highlightRegex('a<b>');
        expect(result).toContain('a&lt;b&gt;');
        expect(result).not.toContain('<b>');
    });

    test('wraps detected tokens in typed spans', () => {
        const result = highlightRegex('/a[b]+/gi');
        expect(result).toContain('regex-delimiter');
        expect(result).toContain('regex-brackets');
        expect(result).toContain('regex-quantifier');
        expect(result).toContain('regex-flags');
    });

    test('does not highlight escaped special characters as operators', () => {
        const result = highlightRegex('a\\.b');
        // The escaped dot is wrapped as a special char, not as an operator
        expect(result).toContain('regex-special');
        expect(result).not.toContain('<span class="regex-operator">.</span>');
    });
});

describe('isDataURL', () => {
    test('accepts valid data URLs', () => {
        expect(isDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg')).toBe(true);
        expect(isDataURL('data:text/plain,hello')).toBe(true);
        expect(isDataURL('data:,')).toBe(true);
    });

    test('rejects non-data-URL strings and non-strings', () => {
        expect(isDataURL('http://example.com')).toBe(false);
        expect(isDataURL('data image png')).toBe(false);
        expect(isDataURL('data:')).toBe(false); // a comma is required
        expect(isDataURL('')).toBe(false);
        expect(isDataURL(undefined)).toBe(false);
    });
});

//endregion

//region Arrays

describe('onlyUnique', () => {
    test('keeps only the first occurrence of each value', () => {
        expect([1, 2, 1, 3, 2].filter(onlyUnique)).toEqual([1, 2, 3]);
    });

    test('works with strings', () => {
        expect(['a', 'b', 'a'].filter(onlyUnique)).toEqual(['a', 'b']);
    });
});

describe('onlyUniqueJson', () => {
    test('keeps only the first occurrence of structurally equal objects', () => {
        const input = [{ a: 1 }, { a: 1 }, { a: 2 }];
        expect(input.filter(onlyUniqueJson)).toEqual([{ a: 1 }, { a: 2 }]);
    });
});

describe('removeFromArray', () => {
    test('removes the first occurrence and returns true', () => {
        const arr = [1, 2, 3, 2];
        expect(removeFromArray(arr, 2)).toBe(true);
        expect(arr).toEqual([1, 3, 2]);
    });

    test('returns false when the item is not present', () => {
        const arr = [1, 2, 3];
        expect(removeFromArray(arr, 9)).toBe(false);
        expect(arr).toEqual([1, 2, 3]);
    });
});

describe('normalizeArray', () => {
    test('trims strings, drops falsy values and dedupes', () => {
        expect(normalizeArray([' a ', 'b', '', 'a', null, undefined])).toEqual(['a', 'b']);
    });

    test('passes non-string values through, but falsy values are filtered out', () => {
        // 0 is falsy and therefore removed by the filter(Boolean) step
        expect(normalizeArray([0, 1, 'x', 'x'])).toEqual([1, 'x']);
    });

    test('returns an empty array for nullish input', () => {
        expect(normalizeArray(null)).toEqual([]);
        expect(normalizeArray(undefined)).toEqual([]);
    });
});

describe('shuffle', () => {
    test('returns a permutation of the input', () => {
        const input = Array.from({ length: 50 }, (_, i) => i);
        const shuffled = shuffle([...input]);
        expect(shuffled).toHaveLength(input.length);
        expect([...shuffled].sort((a, b) => a - b)).toEqual(input);
    });

    test('mutates and returns the given array', () => {
        const arr = [1, 2, 3];
        const result = shuffle(arr);
        expect(result).toBe(arr);
    });

    test('handles empty and single-element arrays', () => {
        expect(shuffle([])).toEqual([]);
        expect(shuffle([1])).toEqual([1]);
    });
});

describe('isSubsetOf', () => {
    test('returns true when every element of b is in a', () => {
        expect(isSubsetOf([1, 2, 3], [2, 3])).toBe(true);
        expect(isSubsetOf([1, 2, 3], [])).toBe(true);
    });

    test('returns false when b has an element not in a', () => {
        expect(isSubsetOf([1, 2], [2, 3])).toBe(false);
    });

    test('returns false when either argument is not an array', () => {
        expect(isSubsetOf(null, [1])).toBe(false);
        expect(isSubsetOf([1], null)).toBe(false);
        expect(isSubsetOf('abc', 'b')).toBe(false);
    });
});

describe('arraysEqual', () => {
    test('equal arrays compare true', () => {
        expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    test('same reference compares true', () => {
        const a = [1];
        expect(arraysEqual(a, a)).toBe(true);
    });

    test('different content or length compares false', () => {
        expect(arraysEqual([1, 2], [2, 1])).toBe(false);
        expect(arraysEqual([1], [1, 2])).toBe(false);
    });

    test('null handling', () => {
        expect(arraysEqual(null, null)).toBe(true);
        expect(arraysEqual(null, [])).toBe(false);
        expect(arraysEqual([], null)).toBe(false);
    });
});

describe('sortMoments', () => {
    const momentStub = (ts) => ({
        ts,
        isBefore: (other) => ts < other.ts,
        isAfter: (other) => ts > other.ts,
    });

    test('returns 1 when a is before b (descending order)', () => {
        expect(sortMoments(momentStub(1), momentStub(2))).toBe(1);
    });

    test('returns -1 when a is after b', () => {
        expect(sortMoments(momentStub(2), momentStub(1))).toBe(-1);
    });

    test('returns 0 for equal moments', () => {
        expect(sortMoments(momentStub(1), momentStub(1))).toBe(0);
    });

    test('sorts an array from newest to oldest', () => {
        const moments = [1, 3, 2].map(momentStub);
        const sorted = moments.sort(sortMoments);
        expect(sorted.map(m => m.ts)).toEqual([3, 2, 1]);
    });
});

describe('splitRecursive', () => {
    test('splits into chunks no longer than length', () => {
        expect(splitRecursive('Hello, world!', 3)).toEqual(['Hel', 'lo,', 'wor', 'ld!']);
    });

    test('merges short chunks back together when they fit', () => {
        expect(splitRecursive('aaaa\nbbbb', 10)).toEqual(['aaaa\nbbbb']);
        expect(splitRecursive('aaaa\nbbbb', 5)).toEqual(['aaaa', 'bbbb']);
    });

    test('splits on newlines first and spaces second', () => {
        expect(splitRecursive('aa bb\ncc dd', 5)).toEqual(['aa bb', 'cc dd']);
        expect(splitRecursive('aa bb cc', 5)).toEqual(['aa bb', 'cc']);
    });

    test('returns the input as a single part for non-positive length', () => {
        expect(splitRecursive('anything', 0)).toEqual(['anything']);
        expect(splitRecursive('anything', -1)).toEqual(['anything']);
    });

    test('handles custom delimiters', () => {
        expect(splitRecursive('a,b,c,d', 3, [','])).toEqual(['a,b', 'c,d']);
    });
});

//endregion

//region Numbers

describe('isOdd', () => {
    test('identifies odd numbers', () => {
        expect(isOdd(3)).toBe(true);
        expect(isOdd(-3)).toBe(true);
    });

    test('identifies even numbers', () => {
        expect(isOdd(4)).toBe(false);
        expect(isOdd(0)).toBe(false);
    });
});

describe('clamp', () => {
    test('returns the value when within bounds', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    test('clamps below the minimum', () => {
        expect(clamp(-1, 0, 10)).toBe(0);
    });

    test('clamps above the maximum', () => {
        expect(clamp(11, 0, 10)).toBe(10);
    });
});

describe('getStringHash', () => {
    test('is deterministic for the same input and seed', () => {
        expect(getStringHash('a')).toBe(7929297801672961);
        expect(getStringHash('hello')).toBe(4625896200565286);
        expect(getStringHash('')).toBe(3338908027751811);
    });

    test('different seeds produce different hashes', () => {
        expect(getStringHash('a', 0)).not.toBe(getStringHash('a', 1));
        expect(getStringHash('a', 1)).toBe(5368154436228575);
    });

    test('returns 0 for non-string input', () => {
        expect(getStringHash(42)).toBe(0);
        expect(getStringHash(null)).toBe(0);
        expect(getStringHash(undefined)).toBe(0);
    });

    test('different strings usually produce different hashes', () => {
        expect(getStringHash('foo')).not.toBe(getStringHash('bar'));
    });
});

describe('calculateThumbnailSize', () => {
    test('scales landscape images to fit the max width', () => {
        expect(calculateThumbnailSize(800, 400, 100, 100)).toEqual({ thumbnailWidth: 100, thumbnailHeight: 50 });
    });

    test('scales portrait images to fit the max height', () => {
        expect(calculateThumbnailSize(400, 800, 100, 100)).toEqual({ thumbnailWidth: 50, thumbnailHeight: 100 });
    });

    test('does not upscale images smaller than the maximums', () => {
        expect(calculateThumbnailSize(50, 25, 100, 100)).toEqual({ thumbnailWidth: 50, thumbnailHeight: 25 });
    });

    test('null maximums keep the original dimensions', () => {
        expect(calculateThumbnailSize(100, 50, null, null)).toEqual({ thumbnailWidth: 100, thumbnailHeight: 50 });
    });

    test('null maxWidth with bounded height constrains the height', () => {
        // width fits (400 <= 400 via null -> width), height 800 > 400: portrait -> width = 400 * (400/800)
        expect(calculateThumbnailSize(400, 800, null, 400)).toEqual({ thumbnailWidth: 200, thumbnailHeight: 400 });
    });

    test('rounds to integers', () => {
        const { thumbnailWidth, thumbnailHeight } = calculateThumbnailSize(1000, 333, 100, 100);
        expect(Number.isInteger(thumbnailWidth)).toBe(true);
        expect(Number.isInteger(thumbnailHeight)).toBe(true);
    });
});

describe('versionCompare', () => {
    test('srcVersion greater than minVersion', () => {
        expect(versionCompare('1.2.0', '1.1.9')).toBe(true);
    });

    test('equal versions', () => {
        expect(versionCompare('1.0.0', '1.0.0')).toBe(true);
    });

    test('srcVersion lower than minVersion', () => {
        expect(versionCompare('0.9.9', '1.0.0')).toBe(false);
    });

    test('compares numerically, not lexically', () => {
        expect(versionCompare('1.10.0', '1.9.0')).toBe(true);
        expect(versionCompare('1.9.0', '1.10.0')).toBe(false);
    });

    test('empty srcVersion falls back to 0.0.0', () => {
        expect(versionCompare('', '0.0.0')).toBe(true);
        expect(versionCompare('', '0.0.1')).toBe(false);
        expect(versionCompare(undefined, '1.0.0')).toBe(false);
    });
});

describe('uuidv4', () => {
    test('returns a valid UUID v4 string', () => {
        expect(uuidv4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(isUuid(uuidv4())).toBe(true);
    });

    test('returns unique values', () => {
        const set = new Set(Array.from({ length: 100 }, () => uuidv4()));
        expect(set.size).toBe(100);
    });
});

//endregion

//region Accent/case-insensitive comparisons

describe('compareIgnoreCaseAndAccents', () => {
    test('normalizes both strings before comparing', () => {
        expect(compareIgnoreCaseAndAccents('Café', 'cafe', (a, b) => a === b)).toBe(true);
    });

    test('falls back to the raw comparison when either input is falsy', () => {
        expect(compareIgnoreCaseAndAccents('', 'a', (a, b) => a === b)).toBe(false);
        expect(compareIgnoreCaseAndAccents(null, null, (a, b) => a === b)).toBe(true);
    });
});

describe('includesIgnoreCaseAndAccents', () => {
    test('finds substrings ignoring case and accents', () => {
        expect(includesIgnoreCaseAndAccents('Café Menu', 'CAFE')).toBe(true);
        expect(includesIgnoreCaseAndAccents('Über Straße', 'strasse')).toBe(false); // ß is not sz-normalized
        expect(includesIgnoreCaseAndAccents('Hello', 'xyz')).toBe(false);
    });

    test('returns false for nullish input', () => {
        expect(includesIgnoreCaseAndAccents(null, 'x')).toBe(false);
        expect(includesIgnoreCaseAndAccents('x', null)).toBe(false);
    });
});

describe('equalsIgnoreCaseAndAccents', () => {
    test('compares equal ignoring case and accents', () => {
        expect(equalsIgnoreCaseAndAccents('Héllo', 'hello')).toBe(true);
        expect(equalsIgnoreCaseAndAccents('HELLO', 'hello')).toBe(true);
    });

    test('returns false for different strings', () => {
        expect(equalsIgnoreCaseAndAccents('ABC', 'abd')).toBe(false);
    });
});

describe('sortIgnoreCaseAndAccents', () => {
    test('sorts normalized strings', () => {
        expect(sortIgnoreCaseAndAccents('éclair', 'zebra')).toBeLessThan(0);
        expect(sortIgnoreCaseAndAccents('zebra', 'éclair')).toBeGreaterThan(0);
        expect(sortIgnoreCaseAndAccents('café', 'cafe')).toBe(0);
    });

    test('sorts an array with mixed case and accents', () => {
        const arr = ['Éclair', 'apple', 'Banana'];
        expect([...arr].sort(sortIgnoreCaseAndAccents)).toEqual(['apple', 'Banana', 'Éclair']);
    });
});

//endregion

//region Path helpers

describe('setValueByPath', () => {
    test('creates nested objects for a deep path', () => {
        const obj = {};
        setValueByPath(obj, 'a.b.c', 1);
        expect(obj).toEqual({ a: { b: { c: 1 } } });
    });

    test('overwrites an existing leaf value', () => {
        const obj = { a: { b: 1 } };
        setValueByPath(obj, 'a.b', 2);
        expect(obj).toEqual({ a: { b: 2 } });
    });

    test('sets a top-level key for a dot-free path', () => {
        const obj = {};
        setValueByPath(obj, 'key', 'value');
        expect(obj).toEqual({ key: 'value' });
    });
});

describe('deleteValueByPath', () => {
    test('deletes a deeply nested key', () => {
        const obj = { a: { b: { c: 1, d: 2 } } };
        deleteValueByPath(obj, 'a.b.c');
        expect(obj).toEqual({ a: { b: { d: 2 } } });
    });

    test('deletes a top-level key', () => {
        const obj = { a: 1, b: 2 };
        deleteValueByPath(obj, 'a');
        expect(obj).toEqual({ b: 2 });
    });

    test('is a no-op when the path does not exist', () => {
        const obj = { a: 1 };
        expect(() => deleteValueByPath(obj, 'x.y.z')).not.toThrow();
        expect(obj).toEqual({ a: 1 });
    });

    test('is a no-op for nullish objects', () => {
        expect(() => deleteValueByPath(null, 'a.b')).not.toThrow();
    });
});

//endregion

//region Timers

describe('debounce', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('delays invocation until the timeout elapses', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced();
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('only invokes once for a burst of calls, with the latest arguments', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced(1);
        debounced(2);
        debounced(3);
        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(3);
    });

    test('resets the timer on each call', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced();
        jest.advanceTimersByTime(90);
        debounced();
        jest.advanceTimersByTime(90);
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(10);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('defaults to the standard timeout (300 ms)', () => {
        const fn = jest.fn();
        const debounced = debounce(fn);
        debounced();
        jest.advanceTimersByTime(299);
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('debounceAsync', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('resolves with the result of the last call', async () => {
        const fn = jest.fn(x => x * 2);
        const debounced = debounceAsync(fn, 100);
        const promise = debounced(21);
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(100);
        await expect(promise).resolves.toBe(42);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('shares a single promise across calls made in the same window', async () => {
        const fn = jest.fn(x => x);
        const debounced = debounceAsync(fn, 100);
        const p1 = debounced(1);
        const p2 = debounced(2);
        expect(p1).toBe(p2);
        jest.advanceTimersByTime(100);
        await expect(p2).resolves.toBe(2);
    });

    test('supports sequential debounced calls after the promise resolves', async () => {
        const fn = jest.fn(x => x + 1);
        const debounced = debounceAsync(fn, 50);
        const first = debounced(1);
        jest.advanceTimersByTime(50);
        await expect(first).resolves.toBe(2);
        const second = debounced(10);
        jest.advanceTimersByTime(50);
        await expect(second).resolves.toBe(11);
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

describe('cancelDebounce', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('cancels a pending debounced call (by debounced function)', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced();
        cancelDebounce(debounced);
        jest.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();
    });

    test('cancels a pending debounced call (by original function)', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced();
        cancelDebounce(fn);
        jest.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();
    });

    test('is a no-op for functions that were never debounced', () => {
        expect(() => cancelDebounce(() => {})).not.toThrow();
    });

    test('does not cancel a call scheduled after the cancellation', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced();
        cancelDebounce(debounced);
        debounced(); // schedule again
        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('throttle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // Use a non-zero epoch: throttle treats a 0 timestamp as "never called"
        jest.setSystemTime(1000);
    });
    afterEach(() => jest.useRealTimers());

    test('invokes immediately on the first call', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('suppresses calls within the limit', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);
        throttled();
        throttled();
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('invokes again after the limit has elapsed', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);
        throttled(); // called at t=1000
        jest.setSystemTime(1101);
        throttled('arg');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenCalledWith('arg');
    });
});

describe('debouncedThrottle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // Use a non-zero epoch: debouncedThrottle treats a 0 timestamp as "never called"
        jest.setSystemTime(1000);
    });
    afterEach(() => jest.useRealTimers());

    test('does not invoke immediately; invokes after the limit elapses', () => {
        const fn = jest.fn();
        const throttled = debouncedThrottle(fn, 100);
        throttled();
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('invokes immediately once the throttle window has fully passed', () => {
        const fn = jest.fn();
        const throttled = debouncedThrottle(fn, 100);
        throttled(); // called at t=1000
        jest.advanceTimersByTime(100); // trailing call fires, last = 1000 (time of first call)
        jest.setSystemTime(1400); // well beyond last + limit
        throttled();
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

describe('delay', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('resolves after the specified time', async () => {
        let resolved = false;
        delay(50).then(() => { resolved = true; });
        expect(resolved).toBe(false);
        jest.advanceTimersByTime(50);
        await Promise.resolve();
        expect(resolved).toBe(true);
    });

    test('does not resolve early', async () => {
        let resolved = false;
        delay(100).then(() => { resolved = true; });
        jest.advanceTimersByTime(99);
        await Promise.resolve();
        expect(resolved).toBe(false);
    });
});

describe('createTimeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('rejects after the delay with the given message', async () => {
        const promise = createTimeout(100, 'boom');
        promise.catch(() => {}); // avoid unhandled rejection while timers advance
        jest.advanceTimersByTime(100);
        await expect(promise).rejects.toThrow('boom');
    });

    test('rejects with an empty message by default (the documented default message is dead code)', async () => {
        // The parameter default is `''`, which is not nullish, so the
        // `errorMessage ??= ...` fallback never kicks in.
        const promise = createTimeout(250);
        promise.catch(() => {}); // avoid unhandled rejection while timers advance
        jest.advanceTimersByTime(250);
        await expect(promise).rejects.toThrow();
        const error = await promise.catch(e => e);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('');
    });

    test('does not reject before the delay elapses', () => {
        let rejected = false;
        createTimeout(100).catch(() => { rejected = true; });
        jest.advanceTimersByTime(99);
        expect(rejected).toBe(false);
    });
});

describe('waitUntilCondition', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('resolves once the condition becomes true', async () => {
        let flag = false;
        const promise = waitUntilCondition(() => flag, 1000, 100);
        let resolved = false;
        promise.then(() => { resolved = true; });

        jest.advanceTimersByTime(200); // still false
        expect(resolved).toBe(false);

        flag = true;
        jest.advanceTimersByTime(100); // interval fires, condition true
        await flushMicrotasks();
        expect(resolved).toBe(true);
    });

    test('rejects on timeout by default', async () => {
        const promise = waitUntilCondition(() => false, 500, 100);
        promise.catch(() => {}); // avoid unhandled rejection while timers advance
        jest.advanceTimersByTime(500);
        await expect(promise).rejects.toThrow('Timed out waiting for condition to be true');
    });

    test('resolves on timeout when rejectOnTimeout is false (with the timeout Error as value)', async () => {
        const promise = waitUntilCondition(() => false, 500, 100, { rejectOnTimeout: false });
        jest.advanceTimersByTime(600);
        await expect(promise).resolves.toBeInstanceOf(Error);
        const error = await promise;
        expect(error.message).toBe('Timed out waiting for condition to be true');
    });
});

//endregion

//region Stopwatch / RateLimiter

describe('Stopwatch', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('does not tick before the interval has passed', async () => {
        const stopwatch = new Stopwatch(1000);
        const action = jest.fn();
        await stopwatch.tick(action);
        expect(action).not.toHaveBeenCalled();
    });

    test('executes the action after the interval has passed', async () => {
        const stopwatch = new Stopwatch(1000);
        const action = jest.fn();
        jest.advanceTimersByTime(1500);
        await stopwatch.tick(action);
        expect(action).toHaveBeenCalledTimes(1);
    });

    test('resets the timer after a successful tick', async () => {
        const stopwatch = new Stopwatch(1000);
        const action = jest.fn();
        jest.advanceTimersByTime(1500);
        await stopwatch.tick(action); // tick, lastAction = now
        await stopwatch.tick(action); // not enough time passed
        expect(action).toHaveBeenCalledTimes(1);
    });

    test('falls back to a 1ms interval for invalid intervals', () => {
        const stopwatch = new Stopwatch(NaN);
        expect(stopwatch.interval).toBe(1);
        expect(console.warn).toHaveBeenCalled();
        expect(new Stopwatch(-5).interval).toBe(1);
        expect(new Stopwatch(Infinity).interval).toBe(1);
    });
});

describe('RateLimiter', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // Start at epoch 0 so the initial lastResolveTime of 0 yields the full interval
        jest.setSystemTime(0);
        jest.spyOn(console, 'debug').mockImplementation(() => {});
    });
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('the first call resolves immediately (it only schedules the internal wait)', async () => {
        const limiter = new RateLimiter(1000);
        let resolved = false;
        limiter.waitForResolve().then(() => { resolved = true; });
        expect(resolved).toBe(false);
        await flushMicrotasks();
        expect(resolved).toBe(true); // resolves after scheduling, without waiting 1000 ms
    });

    test('a subsequent call waits for the interval scheduled by the previous call', async () => {
        const limiter = new RateLimiter(1000);
        limiter.waitForResolve(); // first call: schedules a 1000 ms wait
        await flushMicrotasks();

        let secondResolved = false;
        limiter.waitForResolve().then(() => { secondResolved = true; }); // awaits the first wait
        await flushMicrotasks();

        jest.advanceTimersByTime(999);
        await flushMicrotasks();
        expect(secondResolved).toBe(false);

        jest.advanceTimersByTime(1); // first interval elapses -> second call resolves
        await flushMicrotasks();
        expect(secondResolved).toBe(true);

        // The second call scheduled another wait: a third call must wait for it
        let thirdResolved = false;
        limiter.waitForResolve().then(() => { thirdResolved = true; });
        await flushMicrotasks();
        jest.advanceTimersByTime(999);
        await flushMicrotasks();
        expect(thirdResolved).toBe(false);
        jest.advanceTimersByTime(1);
        await flushMicrotasks();
        expect(thirdResolved).toBe(true);
    });

    test('a call made long after the last resolve does not wait a full interval', async () => {
        const limiter = new RateLimiter(100);
        // Simulate the previous resolve having happened long ago
        limiter.lastResolveTime = Date.now() - 10_000;
        let resolved = false;
        limiter.waitForResolve().then(() => { resolved = true; });
        await flushMicrotasks();
        // Remaining time is 0, so nothing is actually awaited
        expect(resolved).toBe(true);
    });

    test('rejects when aborted via an AbortSignal', async () => {
        const limiter = new RateLimiter(1000);
        const controller = new AbortController();
        limiter.waitForResolve(controller.signal); // schedules the internal wait
        await flushMicrotasks(); // let waitForResolve reach the abort listener registration
        limiter.pendingResolve.catch(() => {}); // avoid unhandled rejection before abort
        controller.abort();
        await expect(limiter.pendingResolve).rejects.toThrow('Aborted');
        // A subsequent caller awaiting the limiter sees the aborted wait
        await expect(limiter.waitForResolve()).rejects.toThrow('Aborted');
    });
});

//endregion

//region Naming

describe('getUniqueName', () => {
    test('returns the base name when it does not exist', () => {
        expect(getUniqueName('Alice', () => false)).toBe('Alice');
    });

    test('appends an index when the base name exists', () => {
        const existing = new Set(['Alice']);
        expect(getUniqueName('Alice', name => existing.has(name))).toBe('Alice (1)');
    });

    test('increments the index until the name is unique', () => {
        const existing = new Set(['Bob', 'Bob (1)', 'Bob (2)']);
        expect(getUniqueName('Bob', name => existing.has(name))).toBe('Bob (3)');
    });

    test('supports a custom nameBuilder', () => {
        // The builder is called with i = startIndex (default 0) first
        const existing = new Set(['doc (0).txt']);
        const result = getUniqueName('doc.txt', name => existing.has(name), {
            nameBuilder: (base, i) => `doc (${i}).txt`,
        });
        expect(result).toBe('doc (1).txt');
    });

    test('returns null when maxTries is exhausted', () => {
        expect(getUniqueName('X', () => true, { maxTries: 3 })).toBeNull();
    });

    test('honours startIndex', () => {
        const existing = new Set(['Item 0', 'Item 1']);
        const result = getUniqueName('Item', name => existing.has(name), {
            nameBuilder: (base, i) => `${base} ${i}`,
        });
        expect(result).toBe('Item 2');
    });
});

describe('getFreeName', () => {
    test('returns the name unchanged if it is free', () => {
        expect(getFreeName('Bob', ['Alice'])).toBe('Bob');
    });

    test('appends #1 for the first collision', () => {
        expect(getFreeName('Bob', ['Bob'])).toBe('Bob #1');
    });

    test('increments the counter until the name is free', () => {
        expect(getFreeName('Bob', ['Bob', 'Bob #1', 'Bob #2'])).toBe('Bob #3');
    });

    test('supports a custom number formatter', () => {
        expect(getFreeName('Bob', ['Bob'], n => `_${n}`)).toBe('Bob_1');
    });
});

//endregion

//region Files

describe('isSameFile', () => {
    const makeFile = (name, size, type = 'text/plain', lastModified = 1234) => {
        const file = new File([new Uint8Array(size)], name, { type, lastModified });
        return file;
    };

    test('returns true for files with identical attributes', () => {
        expect(isSameFile(makeFile('a.txt', 10), makeFile('a.txt', 10))).toBe(true);
    });

    test('returns false when any attribute differs', () => {
        const a = makeFile('a.txt', 10);
        expect(isSameFile(a, makeFile('b.txt', 10))).toBe(false); // name
        expect(isSameFile(a, makeFile('a.txt', 11))).toBe(false); // size
        expect(isSameFile(a, makeFile('a.txt', 10, 'image/png'))).toBe(false); // type
        expect(isSameFile(a, makeFile('a.txt', 10, 'text/plain', 5678))).toBe(false); // lastModified
    });
});

describe('getFileExtension', () => {
    test('extracts and lower-cases the extension', () => {
        expect(getFileExtension({ name: 'file.TXT' })).toBe('txt');
        expect(getFileExtension({ name: 'archive.tar.gz' })).toBe('gz');
    });

    test('returns an empty string when there is no extension', () => {
        expect(getFileExtension({ name: 'noext' })).toBe('');
    });

    test('treats the name after the leading dot of a dotfile as the extension', () => {
        expect(getFileExtension({ name: '.gitignore' })).toBe('gitignore');
    });

    test('works with real File objects', () => {
        const file = new File(['x'], 'photo.jpeg', { type: 'image/jpeg' });
        expect(getFileExtension(file)).toBe('jpeg');
    });
});

describe('extractDataFromPng', () => {
    const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    /**
     * Builds a PNG chunk: [length(big-endian, data only)] [name] [data] [CRC].
     * The parser adds 4 (the chunk name) to the length field itself.
     * The parser does not verify CRCs, so a dummy value is used.
     */
    const makeChunk = (name, dataBytes) => {
        const length = dataBytes.length;
        return [
            (length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff,
            ...[...name].map(c => c.charCodeAt(0)),
            ...dataBytes,
            0xde, 0xad, 0xbe, 0xef, // dummy CRC
        ];
    };

    const stringToBytes = (str) => [...str].map(c => c.charCodeAt(0));

    const makePng = (chunks) => new Uint8Array([...PNG_SIGNATURE, ...chunks.flat()]);

    const makeTextPng = (identifier, value) => makeChunk('tEXt', stringToBytes(`${identifier}\0${btoa(JSON.stringify(value))}`));

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('extracts JSON from a tEXt chunk with the default identifier', () => {
        const png = makePng([
            makeChunk('IHDR', new Uint8Array(13)),
            makeTextPng('chara', { name: 'Test Char', age: 42 }),
            makeChunk('IEND', []),
        ]);
        expect(extractDataFromPng(png)).toEqual({ name: 'Test Char', age: 42 });
    });

    test('extracts JSON with a custom identifier', () => {
        const png = makePng([
            makeChunk('IHDR', new Uint8Array(13)),
            makeTextPng('mydata', [1, 2, 3]),
            makeChunk('IEND', []),
        ]);
        expect(extractDataFromPng(png, 'mydata')).toEqual([1, 2, 3]);
    });

    test('returns null for data without a PNG signature', () => {
        expect(extractDataFromPng(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toBeNull();
        expect(extractDataFromPng(null)).toBeNull();
        expect(extractDataFromPng(new Uint8Array(0))).toBeNull();
    });

    test('returns null when no matching tEXt chunk exists', () => {
        const png = makePng([
            makeChunk('IHDR', new Uint8Array(13)),
            makeTextPng('other', { a: 1 }),
            makeChunk('IEND', []),
        ]);
        expect(extractDataFromPng(png)).toBeNull();
    });

    test('returns null when the chunk payload is not valid base64/JSON', () => {
        const png = makePng([
            makeChunk('IHDR', new Uint8Array(13)),
            makeChunk('tEXt', stringToBytes('chara\0!!!not-base64!!!')),
            makeChunk('IEND', []),
        ]);
        expect(extractDataFromPng(png)).toBeNull();
    });

    test('parses a truncated PNG that still contains the tEXt chunk (missing IEND)', () => {
        const png = makePng([
            makeChunk('IHDR', new Uint8Array(13)),
            makeTextPng('chara', { ok: true }),
        ]);
        expect(extractDataFromPng(png)).toEqual({ ok: true });
    });
});

//endregion

//region Logging

describe('logSlashCommandWarn', () => {
    afterEach(() => jest.restoreAllMocks());

    test('logs a warning with args, stripping keys that start with an underscore', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        logSlashCommandWarn('Something went wrong', { _pipeline: 'x', _index: 1, visible: 'yes' });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith('Something went wrong', { visible: 'yes' });
    });

    test('includes the value object when provided', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        logSlashCommandWarn('Oops', { a: 1, _secret: 2 }, { uid: 7 });
        expect(warn).toHaveBeenCalledWith('Oops', { uid: 7 }, { a: 1 });
    });
});

//endregion
