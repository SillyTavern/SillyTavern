import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const image = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const fixturePrefix = path.join(os.tmpdir(), 'st-image-directories-');

describe('image upload directories', () => {
    let server, baseUrl, temporaryRoot, directories;

    beforeAll(async () => {
        const { default: express } = await import('express');
        const { setConfigFilePath } = await import('../src/util.js');
        setConfigFilePath(fileURLToPath(new URL('../default/config.yaml', import.meta.url)));
        const { router } = await import('../src/endpoints/images.js');
        const { router: userFilesRouter } = await import('../src/users.js');
        const app = express();
        app.use(express.json());
        app.use((request, _response, next) => {
            request.user = { profile: { handle: 'test-user' }, directories };
            next();
        });
        app.use('/api/images', router);
        app.use(userFilesRouter);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    beforeEach(() => {
        temporaryRoot = fs.mkdtempSync(fixturePrefix);
        directories = { root: path.join(temporaryRoot, 'account'), userImages: path.join(temporaryRoot, 'account', 'user', 'images') };
        fs.mkdirSync(directories.userImages, { recursive: true });
    });

    afterEach(() => {
        if (!temporaryRoot) return;
        const target = path.resolve(temporaryRoot);
        if (target !== temporaryRoot || !target.startsWith(fixturePrefix)) throw new Error('Unexpected test fixture path.');
        fs.rmSync(target, { recursive: true, force: true });
        temporaryRoot = undefined;
    });
    afterAll(async () => {
        if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });

    function post(endpoint, body) {
        return fetch(`${baseUrl}/api/images${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }

    async function upload(options = {}) {
        const response = await post('/upload', { image: image.toString('base64'), format: 'gif', filename: 'face', ...options });
        expect(response.status).toBe(200);
        return response.json();
    }

    test('preserves legacy root and single-folder uploads and sanitization', async () => {
        expect(await upload()).toEqual({ path: '/user/images/face.gif' });
        expect((await upload({ ch_name: 'Alice/outfit', filename: 'joy/face.png' })).path).toBe('/user/images/Aliceoutfit/joyface.gif');
        expect(fs.readFileSync(path.join(directories.userImages, 'Aliceoutfit', 'joyface.gif'))).toEqual(image);
        expect((await post('/delete', { path: '/user/images/face.gif' })).status).toBe(200);
        expect((await post('/delete', { path: '/user/images/face.gif' })).status).toBe(404);
    });

    test('an explicit directory takes precedence over the legacy character name', async () => {
        expect((await upload({ directory: '', ch_name: 'Alice' })).path).toBe('/user/images/face.gif');
        expect((await upload({ directory: 'library/character/expression', ch_name: 'Alice' })).path).toBe('/user/images/library/character/expression/face.gif');
        expect(fs.existsSync(path.join(directories.userImages, 'Alice'))).toBe(false);
    });

    test.each(['library/角色 A/开心', 'library/folder #1/100%', 'library/角色😀/开心'])('preserves GIF bytes at the returned URL for %s', async directory => {
        const result = await upload({ directory });
        expect(result.path).toBe(`/user/images/${directory}/face.gif`);
        const response = await fetch(baseUrl + result.url);
        expect(response.status).toBe(200);
        expect(Buffer.from(await response.arrayBuffer())).toEqual(image);
        expect(fs.readFileSync(path.join(directories.userImages, directory, 'face.gif'))).toEqual(image);
        expect((await post('/delete', { path: result.path })).status).toBe(200);
        expect(fs.existsSync(path.join(directories.userImages, directory, 'face.gif'))).toBe(false);
    });

    test('keeps encoded URLs separate from raw paths when percent names collide', async () => {
        const alternateImage = Buffer.concat([image, Buffer.from('alternate')]);
        const spaced = await upload({ directory: 'library/space folder' });
        const literal = await upload({ directory: 'library/space%20folder', image: alternateImage.toString('base64') });
        expect(spaced.url).toBe('/user/images/library/space%20folder/face.gif');
        expect(literal.url).toBe('/user/images/library/space%2520folder/face.gif');
        expect(Buffer.from(await (await fetch(baseUrl + spaced.url)).arrayBuffer())).toEqual(image);
        expect(Buffer.from(await (await fetch(baseUrl + literal.url)).arrayBuffer())).toEqual(alternateImage);
        expect((await post('/delete', { path: literal.path })).status).toBe(200);
        expect(fs.readFileSync(path.join(directories.userImages, 'library', 'space folder', 'face.gif'))).toEqual(image);
        expect((await post('/delete', { path: spaced.path })).status).toBe(200);
    });

    test('lists images and immediate child directories without changing legacy listing', async () => {
        await upload({ directory: 'library/group', filename: 'a' });
        await upload({ directory: 'library/group', filename: 'b' });
        await upload({ directory: 'library/group/child' });
        await upload({ ch_name: 'legacy' });
        const response = await post('/list', { directory: 'library/group', folder: 'ignored', sortField: 'name', sortOrder: 'desc' });
        expect(await response.json()).toEqual(['b.gif', 'a.gif']);
        expect(await (await post('/folders', { directory: 'library/group' })).json()).toEqual(['child']);
        expect((await (await post('/folders', {})).json()).sort()).toEqual(['legacy', 'library']);
        expect(await (await post('/list', { folder: 'legacy' })).json()).toEqual(['face.gif']);
        expect(await (await post('/list/legacy', {})).json()).toEqual(['face.gif']);
        expect((await post('/list/legacy', { folder: 'legacy' })).status).toBe(400);
    });

    test('keeps file-name sanitization and media-format restrictions in nested uploads', async () => {
        expect((await upload({ directory: 'library/group', filename: 'face/evil.png' })).path).toBe('/user/images/library/group/faceevil.gif');
        const response = await post('/upload', { directory: 'library/group', filename: 'script', format: 'html', image: image.toString('base64') });
        expect(response.status).toBe(400);
        expect(fs.readdirSync(path.join(directories.userImages, 'library', 'group'))).toEqual(['faceevil.gif']);
    });

    test.each([
        '../other-account', '/absolute', 'C:/absolute', 'folder\\child', 'folder/../child',
        null, 1, {}, [], false, 'library/\uD800', 'library/\uDC00',
    ].map(directory => [directory]))('rejects invalid directory %j across upload and lookup', async directory => {
        const response = await post('/upload', { directory, filename: 'face', format: 'gif', image: image.toString('base64') });
        expect(response.status).toBe(400);
        expect((await post('/list', { directory })).status).toBe(400);
        expect((await post('/folders', { directory })).status).toBe(400);
        expect(fs.readdirSync(directories.userImages)).toEqual([]);
    });

    test.each(['face\uD800.png', 'face\uDC00.png'])('rejects malformed filename %j before creating directories', async filename => {
        const response = await post('/upload', { directory: 'library/group', filename, format: 'gif', image: image.toString('base64') });
        expect(response.status).toBe(400);
        expect(fs.readdirSync(directories.userImages)).toEqual([]);
    });

    test('rejects a directory link to another account', async () => {
        const otherAccount = path.join(temporaryRoot, 'other-account');
        fs.mkdirSync(otherAccount);
        fs.writeFileSync(path.join(otherAccount, 'face.gif'), 'unchanged');
        fs.symlinkSync(otherAccount, path.join(directories.userImages, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
        const response = await post('/upload', { directory: 'linked/subfolder', filename: 'face', format: 'gif', image: image.toString('base64') });
        expect(response.status).toBe(400);
        expect((await post('/list', { directory: 'linked' })).status).toBe(400);
        expect((await post('/folders', { directory: 'linked' })).status).toBe(400);
        expect((await post('/delete', { path: '/user/images/linked/face.gif' })).status).toBe(400);
        expect(fs.readFileSync(path.join(otherAccount, 'face.gif'), 'utf8')).toBe('unchanged');
        expect(fs.readdirSync(otherAccount)).toEqual(['face.gif']);
    });
});
