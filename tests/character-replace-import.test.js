import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';

import { DEFAULT_AVATAR_PATH } from '../src/constants.js';

// Keep the character cache in memory; characters.js reads this setting at module load
process.env.SILLYTAVERN_PERFORMANCE_USEDISKCACHE = 'false';

// The default avatar and the config file are resolved relative to the repo root
const originalCwd = process.cwd();
beforeAll(() => process.chdir(path.resolve(originalCwd, '..')));
afterAll(() => process.chdir(originalCwd));

describe('character import', () => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;
    let tempDir;
    let charactersDir;
    let Jimp;
    let readCard;
    let writeCard;

    beforeAll(async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-character-import-'));
        charactersDir = path.join(tempDir, 'characters');
        const thumbnailsDir = path.join(tempDir, 'thumbnails');
        fs.mkdirSync(charactersDir);
        fs.mkdirSync(thumbnailsDir);

        // Jimp loads its WASM codecs from file URLs, which the server's fetch patch allows
        await import('../src/fetch-patch.js');
        const { setConfigFilePath } = await import('../src/util.js');
        setConfigFilePath(path.resolve('default/config.yaml'));
        ({ Jimp } = await import('../src/jimp.js'));
        ({ read: readCard, write: writeCard } = await import('../src/character-card-parser.js'));

        const { default: express } = await import('express');
        const { default: multer } = await import('multer');
        const { router } = await import('../src/endpoints/characters.js');
        const app = express();
        app.use(multer({ dest: path.join(tempDir, 'uploads') }).single('avatar'));
        app.use((req, _res, next) => {
            req.user = {
                profile: { handle: 'test-user' },
                directories: { characters: charactersDir, thumbnailsAvatar: thumbnailsDir },
            };
            next();
        });
        app.use(router);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterAll(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    /**
     * Sends a character file to the import endpoint.
     * @param {string} fileType Character file type
     * @param {string} content Character file contents
     * @param {string} [preservedName] Avatar of the character to replace
     * @returns {Promise<string>} Internal name of the imported character
     */
    async function importCharacter(fileType, content, preservedName) {
        const formData = new FormData();
        formData.append('avatar', new Blob([content]), `character.${fileType}`);
        formData.append('file_type', fileType);
        if (preservedName) {
            formData.append('preserved_name', preservedName);
        }
        const response = await fetch(`${baseUrl}/import`, { method: 'POST', body: formData });
        expect(response.status).toBe(200);
        const { file_name } = await response.json();
        return file_name;
    }

    /**
     * Builds a V2 character card.
     * @param {string} name Character name
     * @param {string} description Character description
     * @returns {string} Card JSON
     */
    function makeV2Card(name, description) {
        return JSON.stringify({
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: { name, description, personality: '', scenario: '', first_mes: '', mes_example: '', tags: [] },
        });
    }

    /**
     * Checks that two images have the same size and pixels.
     * @param {object} a First Jimp image
     * @param {object} b Second Jimp image
     * @returns {boolean} True if the images are identical
     */
    function isSameImage(a, b) {
        return a.bitmap.width === b.bitmap.width
            && a.bitmap.height === b.bitmap.height
            && Buffer.compare(a.bitmap.data, b.bitmap.data) === 0;
    }

    test.each([
        ['V2 JSON', 'json', makeV2Card('Seraphina', 'Updated')],
        ['V1 JSON', 'json', JSON.stringify({ name: 'Seraphina', description: 'Updated' })],
        ['Gradio JSON', 'json', JSON.stringify({ char_name: 'Seraphina', char_persona: 'Updated' })],
        ['YAML', 'yaml', 'name: Seraphina\ncontext: Updated\n'],
    ])('replacing a character with a %s card keeps its avatar', async (_format, fileType, content) => {
        const avatarPath = path.join(charactersDir, 'Seraphina.png');
        const avatar = new Jimp({ width: 400, height: 600, color: 0xff0000ff });
        fs.writeFileSync(avatarPath, writeCard(await avatar.getBuffer('image/png'), makeV2Card('Seraphina', 'Original')));

        expect(await importCharacter(fileType, content, 'Seraphina.png')).toBe('Seraphina');

        expect(JSON.parse(readCard(fs.readFileSync(avatarPath))).data.description).toBe('Updated');
        expect(isSameImage(await Jimp.read(avatarPath), avatar)).toBe(true);
    });

    test('importing a new character from a JSON card uses the default avatar', async () => {
        expect(await importCharacter('json', makeV2Card('Newcomer', 'New'))).toBe('Newcomer');

        const imported = await Jimp.read(path.join(charactersDir, 'Newcomer.png'));
        expect(isSameImage(imported, await Jimp.read(DEFAULT_AVATAR_PATH))).toBe(true);
    });
});
