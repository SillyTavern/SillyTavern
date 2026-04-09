import { describe, test, expect } from '@jest/globals';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CharXParser, persistCharXAssets } from '../src/charx.js';

describe('CharXParser.mapCharXAssetsForStorage', () => {
    test('preserves non-sprite names while normalizing sprite names', () => {
        const parser = new CharXParser(Buffer.alloc(0));

        const assets = parser.mapCharXAssetsForStorage([
            { type: 'expression', name: 'Happy Face.png', ext: 'png', zipPath: 'assets/sprites/happy-face.png', order: 0 },
            { type: 'background', name: 'Main Scene.webm', ext: 'webm', zipPath: 'assets/backgrounds/1.webm', order: 1 },
            { type: 'x-risu-asset', name: 'Theme Song.mp3', ext: 'mp3', zipPath: 'assets/other/audio/2.mp3', order: 2 },
            { type: 'custom', name: 'Character Regex.json', ext: 'json', zipPath: 'assets/custom/files/3.json', order: 3 },
            { type: 'custom', name: 'Gallery Image.webp', ext: 'webp', zipPath: 'assets/custom/images/4.webp', order: 4 },
        ]);

        expect(assets).toEqual([
            expect.objectContaining({ storageCategory: 'sprite', baseName: 'happy-face', ext: 'png' }),
            expect.objectContaining({ storageCategory: 'background', baseName: 'Main Scene', ext: 'webm' }),
            expect.objectContaining({ storageCategory: 'misc', baseName: 'Theme Song', ext: 'mp3' }),
            expect.objectContaining({ storageCategory: 'misc', baseName: 'Character Regex', ext: 'json' }),
            expect.objectContaining({ storageCategory: 'misc', baseName: 'Gallery Image', ext: 'webp' }),
        ]);
    });
});

describe('persistCharXAssets', () => {
    test('writes gallery images to user/images and non-images to user/files', () => {
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

            const assets = [
                { zipPath: 'sprite', storageCategory: 'sprite', baseName: 'happy-face', ext: 'png', name: 'Happy Face' },
                { zipPath: 'background', storageCategory: 'background', baseName: 'Main Scene', ext: 'webm', name: 'Main Scene' },
                { zipPath: 'gallery', storageCategory: 'misc', baseName: 'Gallery Image', ext: 'webp', name: 'Gallery Image' },
                { zipPath: 'audio', storageCategory: 'misc', baseName: 'Theme Song', ext: 'mp3', name: 'Theme Song' },
                { zipPath: 'regex', storageCategory: 'misc', baseName: 'Character Regex', ext: 'json', name: 'Character Regex' },
            ];

            const buffers = new Map([
                ['sprite', Buffer.from('sprite')],
                ['background', Buffer.from('background')],
                ['gallery', Buffer.from('gallery')],
                ['audio', Buffer.from('audio')],
                ['regex', Buffer.from('regex')],
            ]);

            const summary = persistCharXAssets(assets, buffers, directories, 'Purrsephone');

            expect(summary).toEqual({ sprites: 1, backgrounds: 1, misc: 3 });
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'happy-face.png'))).toBe(true);
            expect(existsSync(path.join(directories.characters, 'Purrsephone', 'backgrounds', 'Main Scene.webm'))).toBe(true);
            expect(existsSync(path.join(directories.userImages, 'Purrsephone', 'Gallery Image.webp'))).toBe(true);
            expect(existsSync(path.join(directories.files, 'Purrsephone', 'Theme Song.mp3'))).toBe(true);
            expect(existsSync(path.join(directories.files, 'Purrsephone', 'Character Regex.json'))).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
