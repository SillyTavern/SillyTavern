import { describe, test, expect } from '@jest/globals';
import { sanitizeBackupName } from '../src/util';

describe('sanitizeBackupName', () => {
    test('preserves ASCII letters and digits, lowercases', () => {
        expect(sanitizeBackupName('Alice')).toBe('alice');
        expect(sanitizeBackupName('John Doe')).toBe('john_doe');
        expect(sanitizeBackupName('Character123')).toBe('character123');
    });

    test('preserves Chinese characters (regression for issue #5780)', () => {
        // Before the fix, both names collapsed to `____` and shared one backup pool.
        expect(sanitizeBackupName('雷电将军')).toBe('雷电将军');
        expect(sanitizeBackupName('测试角色')).toBe('测试角色');
        // Distinct prefixes are the whole point of the fix.
        expect(sanitizeBackupName('雷电将军')).not.toBe(sanitizeBackupName('测试角色'));
    });

    test('preserves other non-Latin scripts (Cyrillic, Arabic, Hiragana)', () => {
        expect(sanitizeBackupName('Алиса')).toBe('алиса');
        expect(sanitizeBackupName('محمد')).toBe('محمد');
        expect(sanitizeBackupName('ひなた')).toBe('ひなた');
    });

    test('replaces punctuation, spaces, and symbols with underscores', () => {
        expect(sanitizeBackupName('Alice!')).toBe('alice_');
        expect(sanitizeBackupName('A/B\\C')).toBe('a_b_c');
        expect(sanitizeBackupName('foo.bar.baz')).toBe('foo_bar_baz');
        expect(sanitizeBackupName('  spaces  ')).toBe('__spaces__');
    });

    test('mixed Latin + CJK + symbols', () => {
        expect(sanitizeBackupName('雷电-Sama')).toBe('雷电_sama');
        expect(sanitizeBackupName('Yuki (v2)')).toBe('yuki__v2_');
    });

    test('returns empty string for non-string or empty inputs', () => {
        expect(sanitizeBackupName('')).toBe('');
        expect(sanitizeBackupName(null)).toBe('');
        expect(sanitizeBackupName(undefined)).toBe('');
        expect(sanitizeBackupName(42)).toBe('');
    });

    test('names without any letter or digit collapse to underscores', () => {
        expect(sanitizeBackupName('!!!')).toBe('___');
        expect(sanitizeBackupName('---')).toBe('___');
        // Empty-after-sanitize is still a non-empty placeholder; downstream code
        // appends a timestamp so the file is still uniquely named.
        expect(sanitizeBackupName('   ')).toBe('___');
    });

    test('strips filesystem-unsafe characters via sanitize-filename', () => {
        // `..` would otherwise let a caller escape the backups directory.
        expect(sanitizeBackupName('../etc/passwd')).not.toContain('..');
        expect(sanitizeBackupName('../etc/passwd')).not.toContain('/');
        // NUL bytes and control characters must be removed.
        expect(sanitizeBackupName('safe\u0000.txt')).not.toContain('\u0000');
    });

    test('is idempotent', () => {
        const once = sanitizeBackupName('雷电-Sama');
        const twice = sanitizeBackupName(once);
        expect(twice).toBe(once);
    });
});
