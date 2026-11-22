import { describe, test, expect } from '@jest/globals';
import { setConfigFilePath } from '../src/util.js';

setConfigFilePath(new URL('../default/config.yaml', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'));
const { validateAssetFileName } = await import('../src/endpoints/assets.js');

describe('validateAssetFileName', () => {
    test('accepts a plain file name', () => {
        expect(validateAssetFileName('music_01.mp3').error).toBe(false);
    });

    test('rejects a missing or non-text file name', () => {
        for (const value of [undefined, null, 5, ['a.mp3'], { name: 'a.mp3' }]) {
            // @ts-expect-error Intentionally passing a wrong type
            expect(validateAssetFileName(value).error).toBe(true);
        }
    });

    test('rejects unsafe file names', () => {
        for (const value of ['../a.mp3', '.hidden', 'a b.mp3', 'a.exe']) {
            expect(validateAssetFileName(value).error).toBe(true);
        }
    });
});
