import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import express from 'express';
import { setConfigFilePath } from '../src/util.js';

const CHARACTER = 'Chatbot #T4LK1-e';
const image = fs.readFileSync(new URL('../public/img/ai4.png', import.meta.url));

let server;
let baseUrl;
let rootDir;
let directories;

beforeAll(async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-sprite-urls-'));
    const configPath = path.join(rootDir, 'config.yaml');
    fs.writeFileSync(configPath, 'enableExtensions: true\n');
    setConfigFilePath(configPath);

    directories = {
        root: rootDir,
        characters: path.join(rootDir, 'characters'),
    };
    fs.mkdirSync(path.join(directories.characters, CHARACTER, 'bgm'), { recursive: true });
    fs.writeFileSync(path.join(directories.characters, CHARACTER, 'joy.png'), image);
    fs.writeFileSync(path.join(directories.characters, CHARACTER, 'bgm', 'theme.mp3'), 'not really audio');

    const { router: spritesRouter } = await import('../src/endpoints/sprites.js');
    const { router: assetsRouter } = await import('../src/endpoints/assets.js');
    const { router: userFilesRouter } = await import('../src/users.js');
    const app = express();
    app.use((req, _res, next) => {
        req.user = { profile: { handle: 'test-user' }, directories };
        next();
    });
    app.use('/api/sprites', spritesRouter);
    app.use('/api/assets', assetsRouter);
    app.use(userFilesRouter);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    fs.rmSync(rootDir, { recursive: true, force: true });
});

describe('character file URLs when the character name contains #', () => {
    test('expression sprite URLs load', async () => {
        const response = await fetch(`${baseUrl}/api/sprites/get?name=${encodeURIComponent(CHARACTER)}`);
        const sprites = await response.json();
        expect(sprites).toHaveLength(1);
        expect(sprites[0].label).toBe('joy');

        // Resolve the URL the way the browser does for <img src>
        const sprite = await fetch(new URL(sprites[0].path, baseUrl));
        expect(sprite.status).toBe(200);
        expect(Buffer.from(await sprite.arrayBuffer()).equals(image)).toBe(true);
    });

    test('character asset URLs load', async () => {
        const response = await fetch(`${baseUrl}/api/assets/character?name=${encodeURIComponent(CHARACTER)}&category=bgm`, { method: 'POST' });
        const assets = await response.json();
        expect(assets).toHaveLength(1);

        const asset = await fetch(new URL(assets[0], baseUrl));
        expect(asset.status).toBe(200);
        expect(await asset.text()).toBe('not really audio');
    });
});
