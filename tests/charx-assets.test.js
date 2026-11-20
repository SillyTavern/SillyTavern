import { afterEach, beforeEach, describe, test, expect, jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { persistCharXAssets } from '../src/charx';

describe('persistCharXAssets', () => {
    let tmpDir;
    let directories;

    const asset = (storageCategory, baseName) => ({ zipPath: `assets/${baseName}.png`, storageCategory, baseName, ext: 'png', name: baseName });
    const buffers = (assets) => new Map(assets.map(x => [x.zipPath, Buffer.from('new')]));
    const listFiles = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(x => x.isFile()).map(x => x.name).sort();

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-charx-'));
        directories = { characters: path.join(tmpDir, 'characters'), userImages: path.join(tmpDir, 'user', 'images') };
        fs.mkdirSync(directories.characters, { recursive: true });
        fs.mkdirSync(directories.userImages, { recursive: true });
        fs.writeFileSync(path.join(directories.characters, 'seraphina.png'), 'card');
        jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('stores assets in folders named after the character', () => {
        const assets = [asset('sprite', 'joy'), asset('background', 'forest'), asset('misc', 'map')];

        const summary = persistCharXAssets(assets, buffers(assets), directories, 'Alice');

        expect(summary).toEqual({ sprites: 1, backgrounds: 1, misc: 1 });
        expect(fs.existsSync(path.join(directories.characters, 'Alice', 'joy.png'))).toBe(true);
        expect(fs.existsSync(path.join(directories.characters, 'Alice', 'backgrounds', 'forest.png'))).toBe(true);
        expect(fs.existsSync(path.join(directories.userImages, 'Alice', 'map.png'))).toBe(true);
        expect(fs.readFileSync(path.join(directories.characters, 'seraphina.png'), 'utf8')).toBe('card');
    });

    test.each(['', '.', '..', 'a/b', '../a', undefined, null])('stores nothing when the character name is %p', (name) => {
        const assets = [asset('sprite', 'joy'), asset('background', 'forest'), asset('misc', 'map')];

        const summary = persistCharXAssets(assets, buffers(assets), directories, name);

        expect(summary).toEqual({ sprites: 0, backgrounds: 0, misc: 0 });
        expect(listFiles(tmpDir)).toEqual(['seraphina.png']);
        expect(fs.readFileSync(path.join(directories.characters, 'seraphina.png'), 'utf8')).toBe('card');
    });
});
