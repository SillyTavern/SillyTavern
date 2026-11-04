import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import { read, write } from '../src/character-card-parser.js';
import { Jimp } from '../src/jimp.js';
import { setConfigFilePath } from '../src/util.js';

let server;
let baseUrl;
let rootDir;
let testDir;
let directories;
let avatarPath;
let uploadPath;
let thumbnailPath;
let originalCard;
const avatar = fs.readFileSync(new URL('../public/img/ai4.png', import.meta.url));

beforeAll(async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-character-edit-'));
    const configPath = path.join(rootDir, 'config.yaml');
    fs.writeFileSync(configPath, 'performance:\n  useDiskCache: false\ncacheBuster:\n  enabled: true\n');
    setConfigFilePath(configPath);

    const { router } = await import('../src/endpoints/characters.js');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user = { profile: { handle: 'test-user' }, directories };
        if (req.query.upload === 'true') {
            req.file = { destination: testDir, filename: path.basename(uploadPath) };
        }
        next();
    });
    app.use('/api/characters', router);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    fs.rmSync(rootDir, { recursive: true, force: true });
});

beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(rootDir, 'case-'));
    directories = {
        characters: path.join(testDir, 'characters'),
        thumbnailsAvatar: path.join(testDir, 'thumbnails'),
    };
    for (const directory of Object.values(directories)) fs.mkdirSync(directory);
    avatarPath = path.join(directories.characters, 'Test.png');
    uploadPath = path.join(testDir, 'upload.png');
    thumbnailPath = path.join(directories.thumbnailsAvatar, 'Test.png');
    originalCard = write(avatar, JSON.stringify({ name: 'Test', chat: 'chat-A' }));
    fs.writeFileSync(avatarPath, originalCard);
    fs.writeFileSync(thumbnailPath, avatar);
    // Image resizing is unrelated to the metadata and atomic-write behavior under test.
    const image = new Jimp({ width: 1, height: 1 });
    jest.spyOn(image, 'cover').mockReturnValue(image);
    jest.spyOn(image, 'getBuffer').mockResolvedValue(avatar);
    jest.spyOn(Jimp, 'read').mockResolvedValue(image);
});

afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(testDir, { recursive: true, force: true });
});

async function editCharacter(withUpload) {
    if (withUpload) fs.writeFileSync(uploadPath, avatar);
    return fetch(`${baseUrl}/api/characters/edit?upload=${withUpload}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ch_name: 'Test',
            avatar_url: 'Test.png',
            chat: 'chat-B',
            description: 'Updated description',
        }),
    });
}

describe.each([false, true])('character edits (avatar upload: %s)', withUpload => {
    test('returns 500 and preserves the card when atomic replacement fails', async () => {
        const renameSync = fs.renameSync;
        const error = Object.assign(new Error('EPERM: character card is locked'), { code: 'EPERM' });
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(fs, 'renameSync').mockImplementation((source, destination) => {
            if (destination === avatarPath) throw error;
            return renameSync(source, destination);
        });

        const response = await editCharacter(withUpload);

        expect(response.status).toBe(500);
        expect(console.error).toHaveBeenCalledWith(error);
        expect(fs.readFileSync(avatarPath)).toEqual(originalCard);
        expect(fs.existsSync(uploadPath)).toBe(false);
        expect(fs.existsSync(thumbnailPath)).toBe(true);
        expect(response.headers.get('Clear-Site-Data')).toBeNull();
    });

    test('returns 200 and persists the new chat after a successful write', async () => {
        const response = await editCharacter(withUpload);

        expect(response.status).toBe(200);
        const card = JSON.parse(read(fs.readFileSync(avatarPath)));
        expect(card.chat).toBe('chat-B');
        expect(card.data.description).toBe('Updated description');
        expect(fs.existsSync(uploadPath)).toBe(false);
        expect(fs.existsSync(thumbnailPath)).toBe(!withUpload);
        expect(response.headers.get('Clear-Site-Data')).toBe(withUpload ? '"cache"' : null);
    });
});
