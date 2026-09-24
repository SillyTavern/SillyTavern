import { describe, test, expect } from '@jest/globals';
import { encryptObjectAes256, decryptObjectAes256, isEncryptedData } from '../src/util-crypto.js';

describe('encryptObjectAes256', () => {
    test('returns an object with salt, iv, encrypted, and authTag properties', () => {
        const result = encryptObjectAes256({ hello: 'world' }, 'secret');
        expect(result).toBeInstanceOf(Object);
        expect(typeof result.salt).toBe('string');
        expect(typeof result.iv).toBe('string');
        expect(typeof result.encrypted).toBe('string');
        expect(typeof result.authTag).toBe('string');
    });

    test('all properties are valid hex strings', () => {
        const result = encryptObjectAes256({ hello: 'world' }, 'secret');
        expect(result.salt).toMatch(/^[0-9a-f]+$/i);
        expect(result.iv).toMatch(/^[0-9a-f]+$/i);
        expect(result.encrypted).toMatch(/^[0-9a-f]+$/i);
        expect(result.authTag).toMatch(/^[0-9a-f]+$/i);
    });

    test('produces different salt and IV each call', () => {
        const a = encryptObjectAes256({ value: 42 }, 'key');
        const b = encryptObjectAes256({ value: 42 }, 'key');
        expect(a.salt).not.toBe(b.salt);
        expect(a.iv).not.toBe(b.iv);
    });

    test('salt is 32 bytes (64 hex characters)', () => {
        const result = encryptObjectAes256({}, 'anykey');
        expect(result.salt).toHaveLength(64);
    });

    test('IV is 12 bytes (24 hex characters)', () => {
        const result = encryptObjectAes256({}, 'anykey');
        expect(result.iv).toHaveLength(24);
    });

    test('authTag is 16 bytes (32 hex characters)', () => {
        const result = encryptObjectAes256({}, 'anykey');
        expect(result.authTag).toHaveLength(32);
    });
});

describe('decryptObjectAes256', () => {
    test('round-trips a plain object', () => {
        const original = { foo: 'bar', num: 123 };
        const encrypted = encryptObjectAes256(original, 'mypassword');
        const decrypted = decryptObjectAes256(encrypted, 'mypassword');
        expect(decrypted).toEqual(original);
    });

    test('round-trips a nested object', () => {
        const original = { a: { b: { c: [1, 2, 3] } } };
        const encrypted = encryptObjectAes256(original, 'nestedkey');
        const decrypted = decryptObjectAes256(encrypted, 'nestedkey');
        expect(decrypted).toEqual(original);
    });

    test('round-trips a string value', () => {
        const original = 'hello world';
        const encrypted = encryptObjectAes256(original, 'strkey');
        const decrypted = decryptObjectAes256(encrypted, 'strkey');
        expect(decrypted).toBe(original);
    });

    test('round-trips a number value', () => {
        const original = 9007199254740991;
        const encrypted = encryptObjectAes256(original, 'numkey');
        const decrypted = decryptObjectAes256(encrypted, 'numkey');
        expect(decrypted).toBe(original);
    });

    test('round-trips an array', () => {
        const original = [1, 'two', { three: 3 }];
        const encrypted = encryptObjectAes256(original, 'arrkey');
        const decrypted = decryptObjectAes256(encrypted, 'arrkey');
        expect(decrypted).toEqual(original);
    });

    test('round-trips null', () => {
        const encrypted = encryptObjectAes256(null, 'nullkey');
        const decrypted = decryptObjectAes256(encrypted, 'nullkey');
        expect(decrypted).toBeNull();
    });

    test('round-trips boolean false', () => {
        const encrypted = encryptObjectAes256(false, 'boolkey');
        const decrypted = decryptObjectAes256(encrypted, 'boolkey');
        expect(decrypted).toBe(false);
    });

    test('throws with wrong key (auth tag mismatch)', () => {
        const encrypted = encryptObjectAes256({ secret: 'data' }, 'correctkey');
        expect(() => decryptObjectAes256(encrypted, 'wrongkey')).toThrow();
    });

    test('throws when authTag is tampered', () => {
        const encrypted = encryptObjectAes256({ v: 1 }, 'k');
        const tamperedTag = encrypted.authTag.slice(0, -2) + (encrypted.authTag.slice(-2) === 'ff' ? '00' : 'ff');
        const tampered = { ...encrypted, authTag: tamperedTag };
        expect(() => decryptObjectAes256(tampered, 'k')).toThrow();
    });

    test('throws when ciphertext is tampered', () => {
        const encrypted = encryptObjectAes256({ v: 'hello' }, 'k');
        const tamperedCipher = encrypted.encrypted.slice(0, -2) + (encrypted.encrypted.slice(-2) === 'ff' ? '00' : 'ff');
        const tampered = { ...encrypted, encrypted: tamperedCipher };
        expect(() => decryptObjectAes256(tampered, 'k')).toThrow();
    });
});

describe('isEncryptedData', () => {
    test('returns true for a valid encrypted object', () => {
        const encrypted = encryptObjectAes256({ a: 1 }, 'key');
        expect(isEncryptedData(encrypted)).toBe(true);
    });

    test('returns false for a plain string', () => {
        expect(isEncryptedData('hello world')).toBe(false);
    });

    test('returns false for null', () => {
        expect(isEncryptedData(null)).toBe(false);
    });

    test('returns false for an array', () => {
        expect(isEncryptedData(['ab', 'cd', 'ef', '12'])).toBe(false);
    });

    test('returns false for a number', () => {
        expect(isEncryptedData(42)).toBe(false);
    });

    test('returns false when a required property is missing', () => {
        const encrypted = encryptObjectAes256({ a: 1 }, 'key');
        const { salt: _salt, ...withoutSalt } = encrypted;
        expect(_salt).toBeDefined();
        expect(isEncryptedData(withoutSalt)).toBe(false);

        const { iv: _iv, ...withoutIv } = encrypted;
        expect(_iv).toBeDefined();
        expect(isEncryptedData(withoutIv)).toBe(false);

        const { encrypted: _enc, ...withoutEncrypted } = encrypted;
        expect(_enc).toBeDefined();
        expect(isEncryptedData(withoutEncrypted)).toBe(false);

        const { authTag: _tag, ...withoutAuthTag } = encrypted;
        expect(_tag).toBeDefined();
        expect(isEncryptedData(withoutAuthTag)).toBe(false);
    });

    test('returns false when a property contains non-hex characters', () => {
        const base = encryptObjectAes256({ a: 1 }, 'key');
        expect(isEncryptedData({ ...base, salt: 'zzzz' })).toBe(false);
        expect(isEncryptedData({ ...base, iv: 'zzzz' })).toBe(false);
        expect(isEncryptedData({ ...base, encrypted: 'zzzz' })).toBe(false);
        expect(isEncryptedData({ ...base, authTag: 'zzzz' })).toBe(false);
    });

    test('returns false when a property is an empty string', () => {
        const base = encryptObjectAes256({ a: 1 }, 'key');
        expect(isEncryptedData({ ...base, salt: '' })).toBe(false);
        expect(isEncryptedData({ ...base, iv: '' })).toBe(false);
        expect(isEncryptedData({ ...base, authTag: '' })).toBe(false);
    });

    test('returns true for valid hex values with uppercase characters', () => {
        const base = encryptObjectAes256({ a: 1 }, 'key');
        const upper = {
            salt: base.salt.toUpperCase(),
            iv: base.iv.toUpperCase(),
            encrypted: base.encrypted.toUpperCase(),
            authTag: base.authTag.toUpperCase(),
        };
        expect(isEncryptedData(upper)).toBe(true);
    });
});
