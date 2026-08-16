import { afterEach, beforeEach, describe, test, expect, jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getImages } from '../src/util';
import { MEDIA_REQUEST_TYPE } from '../src/constants';

describe('getImages', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-getimages-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeFile(name, mtimeMs = null) {
        const filePath = path.join(tmpDir, name);
        fs.writeFileSync(filePath, '');
        if (mtimeMs !== null) {
            const secs = mtimeMs / 1000;
            fs.utimesSync(filePath, secs, secs);
        }
    }

    test('sorts by name with natural collation', () => {
        writeFile('b.png');
        writeFile('a.png');
        writeFile('c.png');
        expect(getImages(tmpDir, 'name')).toEqual(['a.png', 'b.png', 'c.png']);
    });

    test('sorts by date oldest-first using file mtime', () => {
        writeFile('newest.png', 3_000_000);
        writeFile('oldest.png', 1_000_000);
        writeFile('middle.png', 2_000_000);
        expect(getImages(tmpDir, 'date')).toEqual(['oldest.png', 'middle.png', 'newest.png']);
    });

    test('reads each file mtime only once when sorting by date', () => {
        for (let i = 0; i < 8; i++) {
            writeFile(`img${i}.png`, (8 - i) * 1_000_000);
        }
        const spy = jest.spyOn(fs, 'statSync');
        try {
            const result = getImages(tmpDir, 'date');
            expect(result).toEqual(['img7.png', 'img6.png', 'img5.png', 'img4.png', 'img3.png', 'img2.png', 'img1.png', 'img0.png']);
            expect(spy).toHaveBeenCalledTimes(8);
        } finally {
            spy.mockRestore();
        }
    });

    test('falls back to mtime 0 if a file disappears between readdir and stat', () => {
        writeFile('survivor.png', 2_000_000);
        writeFile('ghost.png', 1_000_000);
        const realStat = fs.statSync;
        const spy = jest.spyOn(fs, 'statSync').mockImplementation((p, ...rest) => {
            if (typeof p === 'string' && p.endsWith('ghost.png')) {
                const err = new Error('ENOENT');
                err.code = 'ENOENT';
                throw err;
            }
            return realStat(p, ...rest);
        });
        try {
            expect(getImages(tmpDir, 'date')).toEqual(['ghost.png', 'survivor.png']);
        } finally {
            spy.mockRestore();
        }
    });

    test('propagates non-ENOENT stat errors (e.g. EACCES) instead of masking them', () => {
        writeFile('readable.png', 1_000_000);
        writeFile('forbidden.png', 2_000_000);
        const realStat = fs.statSync;
        const spy = jest.spyOn(fs, 'statSync').mockImplementation((p, ...rest) => {
            if (typeof p === 'string' && p.endsWith('forbidden.png')) {
                const err = new Error('EACCES');
                err.code = 'EACCES';
                throw err;
            }
            return realStat(p, ...rest);
        });
        try {
            expect(() => getImages(tmpDir, 'date')).toThrow(/EACCES/);
        } finally {
            spy.mockRestore();
        }
    });

    test('filters to image types by default', () => {
        writeFile('keep.png');
        writeFile('keep.jpg');
        writeFile('drop.mp4');
        writeFile('drop.mp3');
        writeFile('drop.txt');
        writeFile('no-extension');
        expect(getImages(tmpDir, 'name')).toEqual(['keep.jpg', 'keep.png']);
    });

    test('filters to video types when requested', () => {
        writeFile('drop.png');
        writeFile('keep.mp4');
        writeFile('keep.webm');
        expect(getImages(tmpDir, 'name', MEDIA_REQUEST_TYPE.VIDEO)).toEqual(['keep.mp4', 'keep.webm']);
    });

    test('filters to audio types when requested', () => {
        writeFile('drop.png');
        writeFile('keep.mp3');
        writeFile('keep.wav');
        expect(getImages(tmpDir, 'name', MEDIA_REQUEST_TYPE.AUDIO)).toEqual(['keep.mp3', 'keep.wav']);
    });

    test('accepts combined media-type bitmask', () => {
        writeFile('img.png');
        writeFile('clip.mp4');
        writeFile('song.mp3');
        const result = getImages(tmpDir, 'name', MEDIA_REQUEST_TYPE.IMAGE | MEDIA_REQUEST_TYPE.AUDIO);
        expect(result).toEqual(['img.png', 'song.mp3']);
    });

    test('skips subdirectories', () => {
        writeFile('real.png');
        fs.mkdirSync(path.join(tmpDir, 'sub.png'));
        expect(getImages(tmpDir, 'name')).toEqual(['real.png']);
    });

    test('returns empty array for an empty directory', () => {
        expect(getImages(tmpDir, 'name')).toEqual([]);
        expect(getImages(tmpDir, 'date')).toEqual([]);
    });
});
