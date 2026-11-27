import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import extract from 'png-chunks-extract';
import encode from '../src/png/encode.js';
import '../src/fetch-patch.js';
import { Jimp } from '../src/jimp.js';
import { setConfigFilePath } from '../src/util.js';

let rootDir;
let directories;
let generateThumbnail;
let stripApngAnimation;
const avatar = fs.readFileSync(new URL('../public/img/ai4.png', import.meta.url));

/**
 * Turns a static PNG into a one-frame APNG.
 * @param {Buffer} buffer Static PNG
 * @param {number} padding Size of a text chunk placed before the animation control chunk
 * @returns {Buffer} APNG buffer
 */
function makeApng(buffer, padding = 0) {
    const chunks = extract(new Uint8Array(buffer));
    const actl = new Uint8Array(8);
    new DataView(actl.buffer).setUint32(0, 1);
    const fctl = new Uint8Array(26);
    const view = new DataView(fctl.buffer);
    view.setUint32(4, new DataView(chunks[0].data.buffer, chunks[0].data.byteOffset).getUint32(0));
    view.setUint32(8, new DataView(chunks[0].data.buffer, chunks[0].data.byteOffset).getUint32(4));
    view.setUint16(20, 1);
    view.setUint16(22, 1);
    const extra = padding ? [{ name: 'tEXt', data: new Uint8Array(Buffer.from('Comment\0' + 'x'.repeat(padding))) }] : [];
    const idat = chunks.findIndex(chunk => chunk.name === 'IDAT');
    chunks.splice(idat, 0, ...extra, { name: 'acTL', data: actl }, { name: 'fcTL', data: fctl });
    return Buffer.from(encode(chunks));
}

beforeAll(async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-thumbnails-'));
    const configPath = path.join(rootDir, 'config.yaml');
    fs.writeFileSync(configPath, 'thumbnails:\n  enabled: true\n');
    setConfigFilePath(configPath);

    directories = {};
    for (const key of ['characters', 'avatars', 'backgrounds', 'thumbnailsAvatar', 'thumbnailsPersona', 'thumbnailsBg']) {
        directories[key] = path.join(rootDir, key);
        fs.mkdirSync(directories[key]);
    }
    fs.writeFileSync(path.join(directories.characters, 'early.png'), makeApng(avatar));
    fs.writeFileSync(path.join(directories.characters, 'late.png'), makeApng(avatar, 500));
    fs.writeFileSync(path.join(directories.backgrounds, 'early.png'), makeApng(avatar));

    ({ generateThumbnail } = await import('../src/endpoints/thumbnails.js'));
    ({ stripApngAnimation } = await import('../src/endpoints/image-metadata.js'));
});

afterAll(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
});

describe('APNG thumbnails', () => {
    test('stripApngAnimation leaves static PNGs untouched', () => {
        expect(stripApngAnimation(avatar)).toBe(avatar);
    });

    for (const file of ['early.png', 'late.png']) {
        test(`creates a static avatar thumbnail for ${file}`, async () => {
            const result = await generateThumbnail(directories, 'avatar', file);
            expect(result.path).toBe(path.join(directories.thumbnailsAvatar, file));
            const thumbnail = await Jimp.read(fs.readFileSync(result.path));
            expect([thumbnail.bitmap.width, thumbnail.bitmap.height]).toEqual([96, 144]);
        });
    }

    test('keeps serving animated backgrounds as originals', async () => {
        const result = await generateThumbnail(directories, 'bg', 'early.png');
        expect(result.path).toBeNull();
    });
});
