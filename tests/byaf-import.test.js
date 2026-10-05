import path from 'node:path';
import process from 'node:process';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import archiver from 'archiver';

import { ByafParser } from '../src/byaf.js';
import { getArrayBufferSlice } from '../src/util.js';

// The parser reads the default avatar from a repo-root-relative path
const originalCwd = process.cwd();
beforeAll(() => process.chdir(path.resolve(originalCwd, '..')));
afterAll(() => process.chdir(originalCwd));

/**
 * Builds a minimal valid BYAF archive in memory.
 * @returns {Promise<Buffer>} Zipped BYAF bytes
 */
function buildByafArchive() {
    return new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks = [];
        archive.on('data', chunk => chunks.push(chunk));
        archive.on('error', reject);
        archive.on('end', () => resolve(Buffer.concat(chunks)));

        archive.append(JSON.stringify({
            characters: ['characters/character.json'],
            scenarios: ['scenarios/scenario.json'],
        }), { name: 'manifest.json' });
        archive.append(JSON.stringify({
            name: 'Byaf Test Character',
            persona: 'A test persona.',
            images: [{ path: 'images/icon.png', label: '' }],
        }), { name: 'characters/character.json' });
        const pngPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        archive.append(pngPixel, { name: 'characters/images/icon.png' });
        archive.append(JSON.stringify({
            name: 'Test Scenario',
            messages: [],
        }), { name: 'scenarios/scenario.json' });
        archive.finalize();
    });
}

describe('BYAF import buffer handling', () => {
    /** @type {Buffer} */
    let zipBuffer;
    /** @type {Buffer} */
    let pooledView;

    beforeAll(async () => {
        zipBuffer = await buildByafArchive();
        // Simulate Node's buffer pooling: the archive bytes sit at an offset inside
        // a larger backing buffer surrounded by unrelated bytes.
        const backing = Buffer.alloc(zipBuffer.length + 8192, 0xFF);
        zipBuffer.copy(backing, 4096);
        pooledView = backing.subarray(4096, 4096 + zipBuffer.length);
    });

    test('parses a real BYAF archive from an exact ArrayBuffer slice of a pooled view', async () => {
        const exact = getArrayBufferSlice(pooledView);
        expect(exact.byteLength).toBe(zipBuffer.length);

        const parser = new ByafParser(exact);
        const result = await parser.parse();
        expect(result.card?.data?.name).toBe('Byaf Test Character');
    });

    test('the raw oversized backing buffer is not parseable, which is why callers must slice', async () => {
        const parser = new ByafParser(pooledView.buffer);
        await expect(parser.parse()).rejects.toThrow();
    });
});
