import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { finished } from 'node:stream/promises';

export const SYNTHETIC_CHARX_FIXTURE_ASSETS = Object.freeze([
    {
        type: 'emotion',
        name: 'Excited Smile.Final.PNG',
        ext: 'png',
        archivePath: 'assets/emotion/images/Excited Smile.Final.PNG',
        content: 'sprite-emotion',
    },
    {
        type: 'expression',
        name: 'smug_face FINAL.webp',
        ext: 'webp',
        archivePath: 'assets/emotion/images/smug_face FINAL.webp',
        content: 'sprite-expression',
    },
    {
        type: 'background',
        name: 'Forest Dawn Scene.webp',
        ext: 'webp',
        archivePath: 'assets/background/images/Forest Dawn Scene.webp',
        content: 'background-image',
    },
    {
        type: 'background',
        name: 'Main Panorama Loop.webm',
        ext: 'webm',
        archivePath: 'assets/background/video/Main Panorama Loop.webm',
        content: 'background-video',
    },
    {
        type: 'x-risu-asset',
        name: 'Gallery Pose A.webp',
        ext: 'webp',
        archivePath: 'assets/other/images/Gallery Pose A.webp',
        content: 'gallery-image',
    },
    {
        type: 'custom',
        name: 'Theme Mix (Lo-Fi).mp3',
        ext: 'mp3',
        archivePath: 'assets/other/audio/Theme Mix (Lo-Fi).mp3',
        content: 'theme-audio',
    },
    {
        type: 'custom',
        name: 'Reaction Cam 01.webm',
        ext: 'webm',
        archivePath: 'assets/other/video/Reaction Cam 01.webm',
        content: 'reaction-video',
    },
    {
        type: 'custom',
        name: 'Character Regex.json',
        ext: 'json',
        archivePath: 'assets/other/other/Character Regex.json',
        content: '{"version":1}',
    },
]);

function buildSyntheticCharXCard(characterName, assets) {
    return {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
            name: characterName,
            description: '',
            character_version: '1.0',
            personality: '',
            scenario: '',
            first_mes: '',
            mes_example: '',
            creator_notes: '',
            tags: [],
            creator: 'test',
            system_prompt: '',
            post_history_instructions: '',
            alternate_greetings: [],
            extensions: {},
            assets: [
                {
                    type: 'icon',
                    name: 'main',
                    ext: 'png',
                    uri: 'embeded://assets/icon/images/main.png',
                },
                ...assets.map(asset => ({
                    type: asset.type,
                    name: asset.name,
                    ext: asset.ext,
                    uri: `embeded://${asset.archivePath}`,
                })),
            ],
        },
    };
}

export async function buildSyntheticCharXArchive(characterName = 'Purrsephone', assets = SYNTHETIC_CHARX_FIXTURE_ASSETS) {
    const archive = archiver('zip');
    const output = new PassThrough();
    /** @type {Buffer[]} */
    const chunks = [];

    output.on('data', chunk => chunks.push(Buffer.from(chunk)));
    archive.pipe(output);

    archive.append(JSON.stringify(buildSyntheticCharXCard(characterName, assets), null, 2), { name: 'card.json' });
    archive.append(Buffer.from('avatar'), { name: 'assets/icon/images/main.png' });

    for (const asset of assets) {
        archive.append(Buffer.from(asset.content), { name: asset.archivePath });
    }

    await archive.finalize();
    await finished(output);
    return Buffer.concat(chunks);
}

export function writeSyntheticCharacterMediaTree(charactersDirectory, characterFolder = 'Purrsephone') {
    mkdirSync(path.join(charactersDirectory, characterFolder, 'backgrounds'), { recursive: true });
    mkdirSync(path.join(charactersDirectory, characterFolder, 'images'), { recursive: true });
    mkdirSync(path.join(charactersDirectory, characterFolder, 'audio'), { recursive: true });
    mkdirSync(path.join(charactersDirectory, characterFolder, 'video'), { recursive: true });
    mkdirSync(path.join(charactersDirectory, characterFolder, 'json'), { recursive: true });

    writeFileSync(path.join(charactersDirectory, characterFolder, 'excited-smile-final.png'), 'sprite-emotion');
    writeFileSync(path.join(charactersDirectory, characterFolder, 'smug-face-final.webp'), 'sprite-expression');
    writeFileSync(path.join(charactersDirectory, characterFolder, 'backgrounds', 'Forest Dawn Scene.webp'), 'background-image');
    writeFileSync(path.join(charactersDirectory, characterFolder, 'backgrounds', 'Main Panorama Loop.webm'), 'background-video');
    writeFileSync(path.join(charactersDirectory, characterFolder, 'images', 'Gallery Pose A.webp'), 'gallery-image');
    writeFileSync(path.join(charactersDirectory, characterFolder, 'audio', 'Theme Mix (Lo-Fi).mp3'), 'theme-audio');
    writeFileSync(path.join(charactersDirectory, characterFolder, 'video', 'Reaction Cam 01.webm'), 'reaction-video');
    writeFileSync(path.join(charactersDirectory, characterFolder, 'json', 'Character Regex.json'), '{"version":1}');
}
