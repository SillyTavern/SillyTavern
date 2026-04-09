import { describe, test, expect } from '@jest/globals';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CharXParser, persistCharXAssets } from '../src/charx.js';
import { buildSyntheticCharXArchive } from './charx-fixtures.js';

describe('CharXParser.mapCharXAssetsForStorage', () => {
    test('preserves non-sprite names while normalizing sprite names across synthetic asset classes', async () => {
        const parser = new CharXParser(await buildSyntheticCharXArchive());
        const { auxiliaryAssets } = await parser.parse();

        expect(auxiliaryAssets).toEqual(expect.arrayContaining([
            expect.objectContaining({ storageCategory: 'sprite', baseName: 'excited-smile-final', ext: 'png' }),
            expect.objectContaining({ storageCategory: 'sprite', baseName: 'smug-face-final', ext: 'webp' }),
            expect.objectContaining({ storageCategory: 'background', baseName: 'Forest Dawn Scene', ext: 'webp' }),
            expect.objectContaining({ storageCategory: 'background', baseName: 'Main Panorama Loop', ext: 'webm' }),
            expect.objectContaining({ storageCategory: 'image', baseName: 'Gallery Pose A', ext: 'webp' }),
            expect.objectContaining({ storageCategory: 'audio', baseName: 'Theme Mix (Lo-Fi)', ext: 'mp3' }),
            expect.objectContaining({ storageCategory: 'video', baseName: 'Reaction Cam 01', ext: 'webm' }),
            expect.objectContaining({ storageCategory: 'json', baseName: 'Character Regex', ext: 'json' }),
        ]));
    });
});

describe('persistCharXAssets', () => {
    test('writes non-sprite character media into character-local folders', async () => {
        const root = mkdtempSync(path.join(os.tmpdir(), 'charx-test-'));

        const directories = {
            root,
            characters: path.join(root, 'characters'),
            userImages: path.join(root, 'user/images'),
            files: path.join(root, 'user/files'),
        };

        try {
            mkdirSync(directories.characters, { recursive: true });
            mkdirSync(directories.userImages, { recursive: true });
            mkdirSync(directories.files, { recursive: true });
            const parser = new CharXParser(await buildSyntheticCharXArchive());
            const { auxiliaryAssets, extractedBuffers } = await parser.parse();
            const summary = persistCharXAssets(auxiliaryAssets, extractedBuffers, directories, 'Purrsephone');

            expect(summary).toEqual({ sprites: 2, backgrounds: 2, misc: 4 });
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'excited-smile-final.png'))).toBe(true);
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'smug-face-final.webp'))).toBe(true);
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'backgrounds', 'Forest Dawn Scene.webp'))).toBe(true);
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'backgrounds', 'Main Panorama Loop.webm'))).toBe(true);
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'images', 'Gallery Pose A.webp'))).toBe(true);
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'audio', 'Theme Mix (Lo-Fi).mp3'))).toBe(true);
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'video', 'Reaction Cam 01.webm'))).toBe(true);
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'json', 'Character Regex.json'))).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
