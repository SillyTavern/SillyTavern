import { describe, test, expect } from '@jest/globals';
import {
    simpleHash,
    getBufferSignaturePure,
    groupEntriesBySignaturePure,
    computeEntriesHashPure,
} from '../../../public/scripts/world-info/pure-functions.js';

describe('simpleHash', () => {
    test('returns consistent hash for empty string', () => {
        const hash1 = simpleHash('');
        const hash2 = simpleHash('');
        expect(hash1).toBe(hash2);
        expect(typeof hash1).toBe('string');
    });

    test('returns consistent hash for simple string', () => {
        const hash1 = simpleHash('hello');
        const hash2 = simpleHash('hello');
        expect(hash1).toBe(hash2);
    });

    test('returns different hashes for different strings', () => {
        const hash1 = simpleHash('hello');
        const hash2 = simpleHash('world');
        expect(hash1).not.toBe(hash2);
    });

    test('returns same hash for same string called twice', () => {
        const hash = simpleHash('test');
        expect(simpleHash('test')).toBe(hash);
    });

    test('handles unicode string', () => {
        const hash = simpleHash('日本語');
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(0);
    });

    test('handles long string', () => {
        const longString = 'a'.repeat(10000);
        const hash = simpleHash(longString);
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(0);
    });

    test('handles special characters', () => {
        const hash = simpleHash('!@#$%^&*()');
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(0);
    });
});

describe('getBufferSignaturePure', () => {
    test('uses global depth when entry has no scanDepth', () => {
        const entry = {};
        const globalDepth = 4;
        const signature = JSON.parse(getBufferSignaturePure(entry, globalDepth));
        expect(signature.scanDepth).toBe(4);
    });

    test('uses entry scanDepth when specified', () => {
        const entry = { scanDepth: 10 };
        const globalDepth = 4;
        const signature = JSON.parse(getBufferSignaturePure(entry, globalDepth));
        expect(signature.scanDepth).toBe(10);
    });

    test('includes matchPersonaDescription in signature', () => {
        const entry1 = { matchPersonaDescription: true };
        const entry2 = { matchPersonaDescription: false };
        const globalDepth = 4;

        const sig1 = getBufferSignaturePure(entry1, globalDepth);
        const sig2 = getBufferSignaturePure(entry2, globalDepth);

        expect(sig1).not.toBe(sig2);
        expect(JSON.parse(sig1).matchPersonaDescription).toBe(true);
        expect(JSON.parse(sig2).matchPersonaDescription).toBe(false);
    });

    test('identical entries produce same signature', () => {
        const entry1 = { scanDepth: 5, matchPersonaDescription: true };
        const entry2 = { scanDepth: 5, matchPersonaDescription: true };
        const globalDepth = 4;

        const sig1 = getBufferSignaturePure(entry1, globalDepth);
        const sig2 = getBufferSignaturePure(entry2, globalDepth);

        expect(sig1).toBe(sig2);
    });

    test('all match flags produce unique signature', () => {
        const entry = {
            scanDepth: 4,
            matchPersonaDescription: true,
            matchCharacterDescription: true,
            matchCharacterPersonality: true,
            matchCharacterDepthPrompt: true,
            matchScenario: true,
            matchCreatorNotes: true,
        };
        const globalDepth = 4;
        const signature = JSON.parse(getBufferSignaturePure(entry, globalDepth));

        expect(signature.matchPersonaDescription).toBe(true);
        expect(signature.matchCharacterDescription).toBe(true);
        expect(signature.matchCharacterPersonality).toBe(true);
        expect(signature.matchCharacterDepthPrompt).toBe(true);
        expect(signature.matchScenario).toBe(true);
        expect(signature.matchCreatorNotes).toBe(true);
    });

    test('null scanDepth uses global depth', () => {
        const entry = { scanDepth: null };
        const globalDepth = 8;
        const signature = JSON.parse(getBufferSignaturePure(entry, globalDepth));
        expect(signature.scanDepth).toBe(8);
    });
});

describe('groupEntriesBySignaturePure', () => {
    const globalDepth = 4;

    // Helper to create entries with uid/world for identification
    const createEntry = (overrides = {}) => ({
        uid: 0,
        world: 'test',
        ...overrides,
    });

    test('returns empty Map for empty array', () => {
        const result = groupEntriesBySignaturePure([], globalDepth);
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
    });

    test('groups entries with same signature', () => {
        const entries = [
            createEntry({ uid: 1 }),
            createEntry({ uid: 2 }),
            createEntry({ uid: 3 }),
        ];
        const result = groupEntriesBySignaturePure(entries, globalDepth);

        expect(result.size).toBe(1);
        const group = Array.from(result.values())[0];
        expect(group.length).toBe(3);
    });

    test('separates entries with different signatures', () => {
        const entries = [
            createEntry({ uid: 1, scanDepth: 4 }),
            createEntry({ uid: 2, scanDepth: 8 }),
            createEntry({ uid: 3, matchPersonaDescription: true }),
        ];
        const result = groupEntriesBySignaturePure(entries, globalDepth);

        expect(result.size).toBe(3);
    });

    test('handles mixed entries (2 same, 1 different)', () => {
        const entries = [
            createEntry({ uid: 1, scanDepth: 4 }),
            createEntry({ uid: 2, scanDepth: 4 }),
            createEntry({ uid: 3, scanDepth: 8 }),
        ];
        const result = groupEntriesBySignaturePure(entries, globalDepth);

        expect(result.size).toBe(2);
        // Find the group with 2 entries
        let foundGroupOfTwo = false;
        for (const group of result.values()) {
            if (group.length === 2) {
                foundGroupOfTwo = true;
                break;
            }
        }
        expect(foundGroupOfTwo).toBe(true);
    });
});

describe('computeEntriesHashPure', () => {
    const identity = (s) => s;

    test('returns consistent hash for empty entries', () => {
        const hash1 = computeEntriesHashPure([], identity);
        const hash2 = computeEntriesHashPure([], identity);
        expect(hash1).toBe(hash2);
    });

    test('returns consistent hash for single entry', () => {
        const entries = [{ world: 'test', uid: 0, key: ['a'] }];
        const hash1 = computeEntriesHashPure(entries, identity);
        const hash2 = computeEntriesHashPure(entries, identity);
        expect(hash1).toBe(hash2);
    });

    test('returns different hashes for different keys', () => {
        const entries1 = [{ world: 'test', uid: 0, key: ['a'] }];
        const entries2 = [{ world: 'test', uid: 0, key: ['b'] }];
        const hash1 = computeEntriesHashPure(entries1, identity);
        const hash2 = computeEntriesHashPure(entries2, identity);
        expect(hash1).not.toBe(hash2);
    });

    test('returns same hash for keys in different order (sorted)', () => {
        const entries1 = [{ world: 'test', uid: 0, key: ['a', 'b'] }];
        const entries2 = [{ world: 'test', uid: 0, key: ['b', 'a'] }];
        const hash1 = computeEntriesHashPure(entries1, identity);
        const hash2 = computeEntriesHashPure(entries2, identity);
        expect(hash1).toBe(hash2);
    });

    test('applies substitutor to keys', () => {
        const entries = [{ world: 'test', uid: 0, key: ['{{char}}'] }];
        const substitutor = (s) => s === '{{char}}' ? 'Alice' : s;

        // With substitutor that replaces {{char}}
        const hashWithSub = computeEntriesHashPure(entries, substitutor);

        // With identity (no substitution)
        const hashNoSub = computeEntriesHashPure(entries, identity);

        expect(hashWithSub).not.toBe(hashNoSub);
    });

    test('includes secondary keys in hash', () => {
        const entries1 = [{ world: 'test', uid: 0, key: ['a'], keysecondary: ['x'] }];
        const entries2 = [{ world: 'test', uid: 0, key: ['a'], keysecondary: ['y'] }];
        const hash1 = computeEntriesHashPure(entries1, identity);
        const hash2 = computeEntriesHashPure(entries2, identity);
        expect(hash1).not.toBe(hash2);
    });

    test('caseSensitive affects hash', () => {
        const entries1 = [{ world: 'test', uid: 0, key: ['a'], caseSensitive: true }];
        const entries2 = [{ world: 'test', uid: 0, key: ['a'], caseSensitive: false }];
        const hash1 = computeEntriesHashPure(entries1, identity);
        const hash2 = computeEntriesHashPure(entries2, identity);
        expect(hash1).not.toBe(hash2);
    });
});
