import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const mediaRoots = [
    ['backgrounds', '/backgrounds'],
    ['characters', '/characters'],
    ['avatars', '/User%20Avatars'],
    ['assets', '/assets'],
    ['userImages', '/user/images'],
    ['files', '/user/files'],
];

describe('user file URL paths', () => {
    let server, origin, fixture, directories;

    beforeAll(async () => {
        const { setConfigFilePath } = await import('../src/util.js');
        setConfigFilePath(fileURLToPath(new URL('../default/config.yaml', import.meta.url)));
        const { router } = await import('../src/users.js');
        const app = express();
        app.use((request, _response, next) => {
            request.user = { directories };
            next();
        });
        app.use(router);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
        origin = `http://127.0.0.1:${server.address().port}`;
    });

    beforeEach(() => {
        fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'st-user-file-paths-'));
        directories = Object.fromEntries(mediaRoots.map(([key]) => [key, path.join(fixture, key)]));
        for (const directory of Object.values(directories)) fs.mkdirSync(directory);
    });

    afterEach(() => {
        if (!fixture) return;
        if (!path.isAbsolute(fixture) || path.dirname(fixture) !== path.resolve(os.tmpdir())
            || !path.basename(fixture).startsWith('st-user-file-paths-')) throw new Error('Unexpected fixture path.');
        fs.rmSync(fixture, { recursive: true, force: true });
        fixture = undefined;
    });

    afterAll(async () => {
        if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });

    async function get(url) {
        return fetch(origin + url, { headers: { Connection: 'close' } });
    }

    test.each(mediaRoots)('keeps spaced and literal-percent filenames distinct in %s', async (key, prefix) => {
        const folder = path.join(directories[key], 'folder');
        fs.mkdirSync(folder);
        fs.writeFileSync(path.join(folder, 'space name.txt'), 'spaced');
        fs.writeFileSync(path.join(folder, 'space%20name.txt'), 'literal');
        const spaced = await get(`${prefix}/folder/space%20name.txt`);
        const literal = await get(`${prefix}/folder/space%2520name.txt`);
        expect(spaced.status).toBe(200);
        expect(await spaced.text()).toBe('spaced');
        expect(literal.status).toBe(200);
        expect(await literal.text()).toBe('literal');
    });

    test.each(['100%', '%2e%2e', '角色 #1', 'a%2fb'])('serves literal directory %s after one URL decode', async directory => {
        const folder = path.join(directories.userImages, directory);
        fs.mkdirSync(folder);
        fs.writeFileSync(path.join(folder, 'image.gif'), 'original bytes');
        const response = await get(`/user/images/${encodeURIComponent(directory)}/image.gif`);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('original bytes');
    });

    test('rejects decoded traversal outside the permitted file root', async () => {
        fs.writeFileSync(path.join(fixture, 'outside.txt'), 'outside data');
        const response = await get('/user/files/%2e%2e%2foutside.txt');
        expect(response.status).toBe(403);
        expect(await response.text()).not.toContain('outside data');
    });
});
