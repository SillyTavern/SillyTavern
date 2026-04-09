import { describe, test, expect } from '@jest/globals';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCharXCard, collectCharXExportAssets } from '../src/charx.js';

describe('collectCharXExportAssets', () => {
    test('collects character-owned media and applies export overrides', () => {
        const root = mkdtempSync(path.join(os.tmpdir(), 'charx-export-'));
        const directories = {
            characters: path.join(root, 'characters'),
            userImages: path.join(root, 'user/images'),
            files: path.join(root, 'user/files'),
        };

        try {
            mkdirSync(path.join(directories.characters, 'Purrsephone', 'backgrounds'), { recursive: true });
            mkdirSync(path.join(directories.characters, 'Purrsephone', 'bgm'), { recursive: true });
            mkdirSync(path.join(directories.userImages, 'Purrsephone'), { recursive: true });
            mkdirSync(path.join(directories.files, 'Purrsephone'), { recursive: true });

            writeFileSync(path.join(directories.characters, 'Purrsephone', 'happy-face.png'), 'sprite');
            writeFileSync(path.join(directories.characters, 'Purrsephone', 'backgrounds', 'Main Scene.webm'), 'background');
            writeFileSync(path.join(directories.characters, 'Purrsephone', 'bgm', 'Theme Song.mp3'), 'audio');
            writeFileSync(path.join(directories.userImages, 'Purrsephone', 'Gallery Image.webp'), 'gallery');
            writeFileSync(path.join(directories.files, 'Purrsephone', 'Character Regex.json'), '{}');

            const assets = collectCharXExportAssets(directories, 'Purrsephone', {
                items: [
                    { sourcePath: 'user/images/Purrsephone/Gallery Image.webp', exportName: 'Gallery Final.webp' },
                    { sourcePath: 'user/files/Purrsephone/Character Regex.json', enabled: false },
                ],
            });

            expect(assets).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    category: 'sprite',
                    exportName: 'happy-face.png',
                    archivePath: 'assets/expression/image/happy-face.png',
                    assetType: 'expression',
                }),
                expect.objectContaining({
                    category: 'background',
                    exportName: 'Main Scene.webm',
                    archivePath: 'assets/background/image/Main Scene.webm',
                    assetType: 'background',
                }),
                expect.objectContaining({
                    category: 'gallery',
                    exportName: 'Gallery Final.webp',
                    archivePath: 'assets/custom/images/Gallery Final.webp',
                    assetType: 'custom',
                }),
                expect.objectContaining({
                    category: 'bgm',
                    exportName: 'Theme Song.mp3',
                    archivePath: 'assets/custom/audio/Theme Song.mp3',
                    assetType: 'custom',
                }),
            ]));
            expect(assets.find(asset => asset.sourcePath.endsWith('Character Regex.json'))).toBeUndefined();
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('buildCharXCard', () => {
    test('builds a v3 card manifest and injects filename regex scripts for custom media', () => {
        const card = {
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name: 'Purrsephone',
                extensions: {
                    regex_scripts: [
                        { scriptName: 'Existing Regex' },
                    ],
                },
            },
        };

        const assets = [
            {
                category: 'sprite',
                exportName: 'happy-face.png',
                ext: 'png',
                archivePath: 'assets/expression/image/happy-face.png',
                assetType: 'expression',
            },
            {
                category: 'gallery',
                exportName: 'Gallery Image.webp',
                ext: 'webp',
                archivePath: 'assets/custom/images/Gallery Image.webp',
                assetType: 'custom',
            },
            {
                category: 'bgm',
                exportName: 'Theme Song.mp3',
                ext: 'mp3',
                archivePath: 'assets/custom/audio/Theme Song.mp3',
                assetType: 'custom',
            },
        ];

        const charxCard = buildCharXCard(card, 'Purrsephone', 'assets/icon/image/main.png', 'png', assets, { generateRegex: true });

        expect(charxCard.spec).toBe('chara_card_v3');
        expect(charxCard.spec_version).toBe('3.0');
        expect(charxCard.data.assets).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'icon', name: 'main', ext: 'png', uri: 'embeded://assets/icon/image/main.png' }),
            expect.objectContaining({ type: 'expression', name: 'happy-face.png', uri: 'embeded://assets/expression/image/happy-face.png' }),
            expect.objectContaining({ type: 'custom', name: 'Gallery Image.webp', uri: 'embeded://assets/custom/images/Gallery Image.webp' }),
            expect.objectContaining({ type: 'custom', name: 'Theme Song.mp3', uri: 'embeded://assets/custom/audio/Theme Song.mp3' }),
        ]));
        expect(charxCard.data.extensions.regex_scripts).toEqual(expect.arrayContaining([
            expect.objectContaining({ scriptName: 'Existing Regex' }),
            expect.objectContaining({
                scriptName: 'CharX media: Gallery Image.webp',
                replaceString: '/characters/Purrsephone/Gallery%20Image.webp',
                markdownOnly: true,
            }),
            expect.objectContaining({
                scriptName: 'CharX media: Theme Song.mp3',
                replaceString: '/characters/Purrsephone/Theme%20Song.mp3',
                markdownOnly: true,
            }),
        ]));
    });
});
