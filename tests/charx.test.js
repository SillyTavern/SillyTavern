import { describe, test, expect } from '@jest/globals';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CharXParser, persistCharXAssets } from '../src/charx.js';
import { buildSyntheticCharXArchive } from './charx-fixtures.js';

describe('CharXParser.mapCharXAssetsForStorage', () => {
    test('retains existing support for APNG and AVIF images', async () => {
        const parser = new CharXParser(await buildSyntheticCharXArchive('Image formats', ['apng', 'avif'].map(ext => ({
            type: 'custom', name: `Gallery.${ext}`, ext,
            archivePath: `assets/other/images/Gallery.${ext}`, content: 'image',
        }))));
        const { auxiliaryAssets } = await parser.parse();
        expect(auxiliaryAssets).toEqual(['apng', 'avif'].map(ext =>
            expect.objectContaining({ storageCategory: 'image', baseName: 'Gallery', ext }),
        ));
    });

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
    test('preserves colliding asset bytes without taking a later original filename', async () => {
        const root = mkdtempSync(path.join(os.tmpdir(), 'charx-collisions-'));
        const assets = [
            { type: 'custom', name: 'Gallery.png', ext: 'png', archivePath: 'assets/1.png', content: 'first image' },
            { type: 'custom', name: 'Gallery.png', ext: 'png', archivePath: 'assets/2.png', content: 'second image' },
            { type: 'custom', name: 'Gallery (2).png', ext: 'png', archivePath: 'assets/3.png', content: 'original suffix' },
            { type: 'background', name: 'Scene.png', ext: 'png', archivePath: 'assets/4.png', content: 'first background' },
            { type: 'background', name: 'Scene.webp', ext: 'webp', archivePath: 'assets/5.webp', content: 'second background' },
            { type: 'background', name: 'Scene (2).png', ext: 'png', archivePath: 'assets/6.png', content: 'background suffix' },
        ];
        try {
            const parser = new CharXParser(await buildSyntheticCharXArchive('Collisions', assets));
            const { auxiliaryAssets, extractedBuffers } = await parser.parse();
            const summary = persistCharXAssets(auxiliaryAssets, extractedBuffers, { characters: root }, 'Collisions');
            expect(summary).toEqual({ sprites: 0, backgrounds: 3, misc: 3 });
            const expectedFiles = [
                'images/Gallery.png', 'images/Gallery (3).png', 'images/Gallery (2).png',
                'backgrounds/Scene.png', 'backgrounds/Scene (3).webp', 'backgrounds/Scene (2).png',
            ];
            expect(expectedFiles.map(file => readFileSync(path.join(root, 'Collisions', file), 'utf8')))
                .toEqual(assets.map(asset => asset.content));
            // Re-imports choose the same names and retain all payloads.
            persistCharXAssets(auxiliaryAssets, extractedBuffers, { characters: root }, 'Collisions');
            expect(expectedFiles.map(file => readFileSync(path.join(root, 'Collisions', file), 'utf8')))
                .toEqual(assets.map(asset => asset.content));
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

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
