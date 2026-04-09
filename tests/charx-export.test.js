import { describe, test, expect } from '@jest/globals';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCharXCard, collectCharXExportAssets } from '../src/charx.js';
import { writeSyntheticCharacterMediaTree } from './charx-fixtures.js';

describe('collectCharXExportAssets', () => {
    test('collects character-owned media and applies export overrides', () => {
        const root = mkdtempSync(path.join(os.tmpdir(), 'charx-export-'));
        const directories = {
            characters: path.join(root, 'characters'),
        };

        try {
            mkdirSync(directories.characters, { recursive: true });
            writeSyntheticCharacterMediaTree(directories.characters, 'Purrsephone');

            const assets = collectCharXExportAssets(directories, 'Purrsephone', {
                items: [
                    { sourcePath: 'characters/Purrsephone/images/Gallery Pose A.webp', exportName: 'Gallery Final.webp' },
                    { sourcePath: 'characters/Purrsephone/json/Character Regex.json', enabled: false },
                ],
            });

            expect(assets).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    category: 'sprite',
                    exportName: 'excited-smile-final.png',
                    archivePath: 'assets/emotion/images/excited-smile-final.png',
                    assetType: 'emotion',
                }),
                expect.objectContaining({
                    category: 'background',
                    exportName: 'Main Panorama Loop.webm',
                    archivePath: 'assets/background/video/Main Panorama Loop.webm',
                    assetType: 'background',
                }),
                expect.objectContaining({
                    category: 'image',
                    exportName: 'Gallery Final.webp',
                    archivePath: 'assets/other/images/Gallery Final.webp',
                    assetType: 'other',
                }),
                expect.objectContaining({
                    category: 'audio',
                    exportName: 'Theme Mix (Lo-Fi).mp3',
                    archivePath: 'assets/other/audio/Theme Mix (Lo-Fi).mp3',
                    assetType: 'other',
                }),
                expect.objectContaining({
                    category: 'video',
                    exportName: 'Reaction Cam 01.webm',
                    archivePath: 'assets/other/video/Reaction Cam 01.webm',
                    assetType: 'other',
                }),
            ]));
            expect(assets.find(asset => asset.sourcePath.endsWith('Character Regex.json'))).toBeUndefined();
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('buildCharXCard', () => {
    test('builds a v3 card manifest and injects filename regex scripts for character-local media routes', () => {
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
                exportName: 'excited-smile-final.png',
                ext: 'png',
                archivePath: 'assets/emotion/images/excited-smile-final.png',
                assetType: 'emotion',
            },
            {
                category: 'image',
                exportName: 'Gallery Image.webp',
                ext: 'webp',
                archivePath: 'assets/other/images/Gallery Image.webp',
                assetType: 'other',
            },
            {
                category: 'audio',
                exportName: 'Theme Song.mp3',
                ext: 'mp3',
                archivePath: 'assets/other/audio/Theme Song.mp3',
                assetType: 'other',
            },
        ];

        const charxCard = buildCharXCard(card, 'Purrsephone', 'assets/icon/images/main.png', 'png', assets, { generateRegex: true });

        expect(charxCard.spec).toBe('chara_card_v3');
        expect(charxCard.spec_version).toBe('3.0');
        expect(charxCard.data.assets).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'icon', name: 'main', ext: 'png', uri: 'embeded://assets/icon/images/main.png' }),
            expect.objectContaining({ type: 'emotion', name: 'excited-smile-final.png', uri: 'embeded://assets/emotion/images/excited-smile-final.png' }),
            expect.objectContaining({ type: 'other', name: 'Gallery Image.webp', uri: 'embeded://assets/other/images/Gallery Image.webp' }),
            expect.objectContaining({ type: 'other', name: 'Theme Song.mp3', uri: 'embeded://assets/other/audio/Theme Song.mp3' }),
        ]));
        expect(charxCard.data.extensions.regex_scripts).toEqual(expect.arrayContaining([
            expect.objectContaining({ scriptName: 'Existing Regex' }),
            expect.objectContaining({
                scriptName: 'CharX media: Gallery Image.webp',
                replaceString: '/characters/Purrsephone/images/Gallery%20Image.webp',
                markdownOnly: true,
            }),
            expect.objectContaining({
                scriptName: 'CharX media: Theme Song.mp3',
                replaceString: '/characters/Purrsephone/audio/Theme%20Song.mp3',
                markdownOnly: true,
            }),
        ]));
    });
});
