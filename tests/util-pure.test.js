import { describe, test, expect, jest } from '@jest/globals';
import {
    keyToEnv,
    getBasicAuthHeader,
    getHexString,
    normalizeZipEntryPath,
    deepMerge,
    uuidv4,
    humanizedDateTime,
    tryParse,
    clientRelativePath,
    getUniqueName,
    removeFileExtension,
    removeColorFormatting,
    getSeparator,
    isValidUrl,
    urlHostnameToIPv6,
    toBoolean,
    stringToBool,
    trimV1,
    trimTrailingSlash,
    mutateJsonString,
    isPathUnderParent,
    isFileURL,
    getRequestURL,
} from '../src/util';

describe('keyToEnv', () => {
    test('should convert dotted key to env var format', () => {
        expect(keyToEnv('extensions.models.speechToText')).toBe('SILLYTAVERN_EXTENSIONS_MODELS_SPEECHTOTEXT');
    });

    test('should handle simple key without dots', () => {
        expect(keyToEnv('port')).toBe('SILLYTAVERN_PORT');
    });

    test('should coerce non-string input via String()', () => {
        expect(keyToEnv(42)).toBe('SILLYTAVERN_42');
    });
});

describe('getBasicAuthHeader', () => {
    test('should return a valid Basic auth header', () => {
        expect(getBasicAuthHeader('user:pass')).toBe('Basic dXNlcjpwYXNz');
    });

    test('should handle empty string', () => {
        expect(getBasicAuthHeader('')).toBe('Basic ');
    });
});

describe('getHexString', () => {
    test('should return a string of the requested length', () => {
        expect(getHexString(8)).toHaveLength(8);
        expect(getHexString(32)).toHaveLength(32);
    });

    test('should only contain hex characters', () => {
        expect(getHexString(64)).toMatch(/^[0-9a-f]+$/);
    });

    test('should return empty string for length 0', () => {
        expect(getHexString(0)).toBe('');
    });
});

describe('normalizeZipEntryPath', () => {
    test('should normalize backslashes to forward slashes', () => {
        expect(normalizeZipEntryPath('foo\\bar\\baz.txt')).toBe('foo/bar/baz.txt');
    });

    test('should strip leading ./', () => {
        expect(normalizeZipEntryPath('./file.txt')).toBe('file.txt');
    });

    test('should strip leading /', () => {
        expect(normalizeZipEntryPath('/absolute/path.txt')).toBe('absolute/path.txt');
    });

    test('should reject path traversal', () => {
        expect(normalizeZipEntryPath('../etc/passwd')).toBeNull();
    });

    test('should reject non-string input', () => {
        expect(normalizeZipEntryPath(42)).toBeNull();
        expect(normalizeZipEntryPath(null)).toBeNull();
    });

    test('should reject empty or whitespace-only string', () => {
        expect(normalizeZipEntryPath('')).toBeNull();
        expect(normalizeZipEntryPath('   ')).toBeNull();
    });
});

describe('deepMerge', () => {
    test('should merge flat objects', () => {
        expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
    });

    test('should recursively merge nested objects', () => {
        const target = { nested: { a: 1, b: 2 } };
        const source = { nested: { b: 3, c: 4 } };
        expect(deepMerge(target, source)).toEqual({ nested: { a: 1, b: 3, c: 4 } });
    });

    test('should override primitives with source values', () => {
        expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    });

    test('should not mutate original objects', () => {
        const target = { a: { x: 1 } };
        const source = { a: { y: 2 } };
        const result = deepMerge(target, source);
        expect(target).toEqual({ a: { x: 1 } });
        expect(result).toEqual({ a: { x: 1, y: 2 } });
    });

    test('should handle empty source', () => {
        expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
    });
});

describe('uuidv4', () => {
    test('should return a valid UUIDv4 format', () => {
        const uuid = uuidv4();
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test('should return unique values', () => {
        const a = uuidv4();
        const b = uuidv4();
        expect(a).not.toBe(b);
    });
});

describe('humanizedDateTime', () => {
    test('should format a known timestamp correctly', () => {
        // 2024-01-15 09:05:03.007 UTC
        const timestamp = Date.UTC(2024, 0, 15, 9, 5, 3, 7);
        const result = humanizedDateTime(timestamp);
        // The output uses local time, so just check the format pattern
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m\d{2}s\d{3}ms$/);
    });
});

describe('tryParse', () => {
    test('should parse valid JSON', () => {
        expect(tryParse('{"a":1}')).toEqual({ a: 1 });
    });

    test('should parse JSON array', () => {
        expect(tryParse('[1,2,3]')).toEqual([1, 2, 3]);
    });

    test('should return undefined for invalid JSON', () => {
        expect(tryParse('not json')).toBeUndefined();
    });

    test('should return undefined for empty string', () => {
        expect(tryParse('')).toBeUndefined();
    });
});

describe('clientRelativePath', () => {
    test('should strip the root prefix and use forward slashes', () => {
        expect(clientRelativePath('/data/user', '/data/user/images/pic.png')).toBe('/images/pic.png');
    });

    test('should throw if path does not start with root', () => {
        expect(() => clientRelativePath('/data/user', '/other/path')).toThrow();
    });
});

describe('getUniqueName', () => {
    test('should return base name with index when first try collides', () => {
        const existing = new Set(['Alice']);
        const result = getUniqueName('Alice', name => existing.has(name));
        expect(result).toBe('Alice (1)');
    });

    test('should increment index until unique', () => {
        const existing = new Set(['Bob', 'Bob (1)', 'Bob (2)']);
        const result = getUniqueName('Bob', name => existing.has(name));
        expect(result).toBe('Bob (3)');
    });

    test('should return null when maxTries exceeded', () => {
        const result = getUniqueName('X', () => true, { maxTries: 3 });
        expect(result).toBeNull();
    });

    test('should support custom nameBuilder', () => {
        const existing = new Set(['doc.txt']);
        const result = getUniqueName('doc.txt', name => existing.has(name), {
            nameBuilder: (base, i) => `doc (${i}).txt`,
        });
        expect(result).toBe('doc (1).txt');
    });

    test('should check basename first when startIndex is 0', () => {
        const result = getUniqueName('Free', () => false, { startIndex: 0 });
        expect(result).toBe('Free');
    });
});

describe('removeFileExtension', () => {
    test('should remove a single extension', () => {
        expect(removeFileExtension('image.png')).toBe('image');
    });

    test('should remove only the last extension', () => {
        expect(removeFileExtension('archive.tar.gz')).toBe('archive.tar');
    });

    test('should return filename unchanged if no extension', () => {
        expect(removeFileExtension('README')).toBe('README');
    });

    test('should handle dotfiles', () => {
        expect(removeFileExtension('.gitignore')).toBe('');
    });
});

describe('removeColorFormatting', () => {
    test('should strip ANSI color codes', () => {
        expect(removeColorFormatting('\x1b[31mError\x1b[0m')).toBe('Error');
    });

    test('should return plain text unchanged', () => {
        expect(removeColorFormatting('no colors here')).toBe('no colors here');
    });
});

describe('getSeparator', () => {
    test('should return n equals signs', () => {
        expect(getSeparator(5)).toBe('=====');
    });

    test('should return empty string for 0', () => {
        expect(getSeparator(0)).toBe('');
    });
});

describe('isValidUrl', () => {
    test('should accept valid HTTP URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
        expect(isValidUrl('http://localhost:8080/path')).toBe(true);
    });

    test('should accept file URLs', () => {
        expect(isValidUrl('file:///tmp/test.txt')).toBe(true);
    });

    test('should reject non-URL strings', () => {
        expect(isValidUrl('not a url')).toBe(false);
        expect(isValidUrl('')).toBe(false);
    });
});

describe('urlHostnameToIPv6', () => {
    test('should strip surrounding brackets', () => {
        expect(urlHostnameToIPv6('[::1]')).toBe('::1');
    });

    test('should handle already-clean hostname', () => {
        expect(urlHostnameToIPv6('::1')).toBe('::1');
    });

    test('should handle IPv4 passthrough', () => {
        expect(urlHostnameToIPv6('127.0.0.1')).toBe('127.0.0.1');
    });
});

describe('toBoolean', () => {
    test('should handle "true" and "false" strings case-insensitively', () => {
        expect(toBoolean('true')).toBe(true);
        expect(toBoolean('TRUE')).toBe(true);
        expect(toBoolean('false')).toBe(false);
        expect(toBoolean('False')).toBe(false);
    });

    test('should handle whitespace around boolean strings', () => {
        expect(toBoolean('  true  ')).toBe(true);
    });

    test('should use JS truthiness for non-boolean strings', () => {
        expect(toBoolean('hello')).toBe(true);
        expect(toBoolean('')).toBe(false);
    });

    test('should handle non-string values', () => {
        expect(toBoolean(1)).toBe(true);
        expect(toBoolean(0)).toBe(false);
        expect(toBoolean(null)).toBe(false);
        expect(toBoolean(undefined)).toBe(false);
    });
});

describe('stringToBool', () => {
    test('should convert "true" to true', () => {
        expect(stringToBool('true')).toBe(true);
        expect(stringToBool(' TRUE ')).toBe(true);
    });

    test('should convert "false" to false', () => {
        expect(stringToBool('false')).toBe(false);
    });

    test('should pass through non-boolean strings', () => {
        expect(stringToBool('hello')).toBe('hello');
    });

    test('should pass through null', () => {
        expect(stringToBool(null)).toBe(null);
    });
});

describe('trimV1', () => {
    test('should remove trailing /v1', () => {
        expect(trimV1('https://api.example.com/v1')).toBe('https://api.example.com');
    });

    test('should remove trailing slash', () => {
        expect(trimV1('https://api.example.com/')).toBe('https://api.example.com');
    });

    test('should remove trailing slash then /v1', () => {
        expect(trimV1('https://api.example.com/v1/')).toBe('https://api.example.com');
    });

    test('should handle null/undefined gracefully', () => {
        expect(trimV1(null)).toBe('');
        expect(trimV1(undefined)).toBe('');
    });
});

describe('trimTrailingSlash', () => {
    test('should remove trailing slash', () => {
        expect(trimTrailingSlash('https://example.com/')).toBe('https://example.com');
    });

    test('should leave non-trailing-slash URLs unchanged', () => {
        expect(trimTrailingSlash('https://example.com')).toBe('https://example.com');
    });

    test('should handle null/undefined gracefully', () => {
        expect(trimTrailingSlash(null)).toBe('');
    });
});

describe('mutateJsonString', () => {
    test('should apply mutation and re-serialize', () => {
        const result = mutateJsonString('{"a":1}', obj => { obj.b = 2; });
        expect(JSON.parse(result)).toEqual({ a: 1, b: 2 });
    });

    test('should return original string on invalid JSON', () => {
        const input = 'not json';
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(mutateJsonString(input, () => {})).toBe(input);
        spy.mockRestore();
    });
});

describe('isPathUnderParent', () => {
    test('should accept child paths', () => {
        expect(isPathUnderParent('/data', '/data/users/file.txt')).toBe(true);
    });

    test('should reject traversal attempts', () => {
        expect(isPathUnderParent('/data', '/data/../etc/passwd')).toBe(false);
    });

    test('should reject sibling paths', () => {
        expect(isPathUnderParent('/data/a', '/data/b')).toBe(false);
    });

    test('should accept the parent path itself', () => {
        expect(isPathUnderParent('/data', '/data')).toBe(true);
    });
});

describe('isFileURL', () => {
    test('should detect file:// string URLs', () => {
        expect(isFileURL('file:///tmp/test.txt')).toBe(true);
    });

    test('should reject non-file string URLs', () => {
        expect(isFileURL('https://example.com')).toBe(false);
    });

    test('should detect file:// URL objects', () => {
        expect(isFileURL(new URL('file:///tmp/test.txt'))).toBe(true);
    });

    test('should detect file:// Request objects', () => {
        expect(isFileURL(new Request('file:///tmp/test.txt'))).toBe(true);
    });

    test('should return false for non-matching types', () => {
        expect(isFileURL(42)).toBe(false);
    });
});

describe('getRequestURL', () => {
    test('should return string URLs as-is', () => {
        expect(getRequestURL('https://example.com')).toBe('https://example.com');
    });

    test('should extract href from URL objects', () => {
        expect(getRequestURL(new URL('https://example.com/path'))).toBe('https://example.com/path');
    });

    test('should extract url from Request objects', () => {
        expect(getRequestURL(new Request('https://example.com/path'))).toBe('https://example.com/path');
    });

    test('should throw for invalid types', () => {
        expect(() => getRequestURL(42)).toThrow(TypeError);
    });
});
