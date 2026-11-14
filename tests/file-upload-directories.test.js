import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

describe('Files API directories', () => {
    let server, origin, temporaryDirectory, root, files;
    const bytes = Buffer.from([0, 255, 1, 128, 13, 10, 42]);

    beforeAll(async () => {
        const { setConfigFilePath } = await import('../src/util.js');
        setConfigFilePath(fileURLToPath(new URL('../default/config.yaml', import.meta.url)));
        const { router } = await import('../src/endpoints/files.js');
        const { router: userFilesRouter } = await import('../src/users.js');
        const app = express();
        app.use(express.json());
        app.use((request, _response, next) => {
            request.user = { profile: { handle: 'test-user' }, directories: { root, files } };
            next();
        });
        app.use('/api/files', router);
        app.use(userFilesRouter);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
        origin = `http://127.0.0.1:${server.address().port}`;
        for (const method of ['info', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
    });

    afterAll(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'st-file-directories-'));
        root = path.join(temporaryDirectory, 'account');
        files = path.join(root, 'user', 'files');
        fs.mkdirSync(files, { recursive: true });
    });

    afterEach(() => {
        if (temporaryDirectory) {
            if (!path.isAbsolute(temporaryDirectory) || path.dirname(temporaryDirectory) !== path.resolve(os.tmpdir())
                || !path.basename(temporaryDirectory).startsWith('st-file-directories-')) throw new Error('Unexpected fixture path');
            fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        }
        temporaryDirectory = undefined;
    });

    function post(endpoint, body) {
        return fetch(`${origin}/api/files/${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' },
            body: JSON.stringify(body),
        });
    }

    test('preserves legacy uploads, atomic overwrites, verification and deletion', async () => {
        const upload = await post('upload', { name: 'record.json', data: bytes.toString('base64') });
        expect(upload.status).toBe(200);
        const { path: url } = await upload.json();
        expect(url).toBe('/user/files/record.json');
        expect(fs.readFileSync(path.join(files, 'record.json'))).toEqual(bytes);
        const replacement = Buffer.from('{"updated":true}');
        expect((await post('upload', { name: 'record.json', data: replacement.toString('base64') })).status).toBe(200);
        expect(fs.readFileSync(path.join(files, 'record.json'))).toEqual(replacement);
        expect(await (await post('verify', { urls: [url] })).json()).toEqual({ [url]: true });
        expect((await post('delete', { path: url })).status).toBe(200);
        expect((await post('delete', { path: url })).status).toBe(404);
    });

    test.each(['my-extension/data/archive', '资料/角色 A/开心 #1/100%', 'emoji/😀/🎉'])('creates and serves nested directory %s', async directory => {
        const upload = await post('upload', { name: 'record.json', data: bytes.toString('base64'), directory });
        expect(upload.status).toBe(200);
        const { path: rawPath, url } = await upload.json();
        expect(rawPath).toBe(`/user/files/${directory}/record.json`);
        expect(decodeURIComponent(url)).toBe(rawPath);
        const target = path.join(files, directory, 'record.json');
        expect(fs.readFileSync(target)).toEqual(bytes);
        const served = await fetch(origin + url, { headers: { Connection: 'close' } });
        expect(served.status).toBe(200);
        expect(Buffer.from(await served.arrayBuffer())).toEqual(bytes);
        expect(await (await post('verify', { urls: [rawPath] })).json()).toEqual({ [rawPath]: true });
        expect((await post('delete', { path: rawPath })).status).toBe(200);
        expect(fs.existsSync(target)).toBe(false);
        expect(await (await post('verify', { urls: [rawPath] })).json()).toEqual({ [rawPath]: false });
    });

    test('accepts an explicitly empty directory as the files root', async () => {
        const upload = await post('upload', { name: 'record.json', data: 'e30=', directory: '' });
        expect(upload.status).toBe(200);
        expect((await upload.json()).path).toBe('/user/files/record.json');
    });

    test.each(['nested/file.json', '../file.json', '.hidden.json', 'bad name.json', '资料.json', 'CON.json', 'file.js', 'file.exe', 'file.html'])('retains existing filename restrictions for %s', async name => {
        expect((await post('upload', { name, data: 'e30=', directory: 'extension/data' })).status).toBe(400);
        expect(fs.readdirSync(files)).toEqual([]);
    });

    test.each([null, 1, [], '/outside', 'C:/outside', String.raw`\\server\share`, '../outside', 'data/../outside', 'data//nested', 'data\\nested', 'CON', 'bad?name', String.fromCharCode(0xD800), String.fromCharCode(0xDC00)].map(directory => [directory]))('rejects invalid directory %j without writing', async directory => {
        expect((await post('upload', { name: 'record.json', data: 'e30=', directory })).status).toBe(400);
        expect(fs.readdirSync(files)).toEqual([]);
    });

    test('preserves existing raw paths containing a literal percent sign', async () => {
        const directory = 'legacy% folder';
        fs.mkdirSync(path.join(files, directory));
        fs.writeFileSync(path.join(files, directory, 'record.json'), bytes);
        const url = `/user/files/${directory}/record.json`;
        expect(await (await post('verify', { urls: [url] })).json()).toEqual({ [url]: true });
        expect((await post('delete', { path: url })).status).toBe(200);
    });

    test('skips invalid path values while verifying valid files', async () => {
        fs.writeFileSync(path.join(files, 'record.json'), bytes);
        const url = '/user/files/record.json';
        expect((await post('delete', { path: { toString: 'invalid' } })).status).toBe(400);
        expect(await (await post('verify', { urls: [null, 1, [], { toString: 'invalid' }, url] })).json()).toEqual({ [url]: true });
    });

    test('keeps raw path identities distinct from percent-encoded-looking directory names', async () => {
        const uploads = [];
        for (const directory of ['space folder', 'space%20folder', '%2e%2e']) {
            const upload = await post('upload', { directory, name: 'record.json', data: Buffer.from(directory).toString('base64') });
            expect(upload.status).toBe(200);
            uploads.push(await upload.json());
        }
        for (const upload of uploads) {
            const served = await fetch(origin + upload.url, { headers: { Connection: 'close' } });
            expect(await served.text()).toBe(path.basename(path.dirname(upload.path)));
        }
        expect((await post('delete', { path: uploads[0].path })).status).toBe(200);
        expect(await (await post('verify', { urls: uploads.map(upload => upload.path) })).json()).toEqual({
            [uploads[0].path]: false, [uploads[1].path]: true, [uploads[2].path]: true,
        });
        expect(fs.readFileSync(path.join(files, 'space%20folder', 'record.json'), 'utf8')).toBe('space%20folder');
    });

    test.each(['/user/files-backup/secret.json', '/user/files/../../settings.json', '../other/user/files/secret.json'])('rejects out-of-root path %s', async url => {
        const backup = path.join(root, 'user', 'files-backup');
        const other = path.join(temporaryDirectory, 'other', 'user', 'files');
        fs.mkdirSync(backup);
        fs.mkdirSync(other, { recursive: true });
        fs.writeFileSync(path.join(backup, 'secret.json'), bytes);
        fs.writeFileSync(path.join(other, 'secret.json'), bytes);
        fs.writeFileSync(path.join(root, 'settings.json'), bytes);
        expect((await post('delete', { path: url })).status).toBe(400);
        expect(await (await post('verify', { urls: [url] })).json()).toEqual({});
        expect(fs.readFileSync(path.join(backup, 'secret.json'))).toEqual(bytes);
        expect(fs.readFileSync(path.join(root, 'settings.json'))).toEqual(bytes);
        expect(fs.readFileSync(path.join(other, 'secret.json'))).toEqual(bytes);
    });

    test('does not follow a descendant directory link when uploading, verifying or deleting', async () => {
        const other = path.join(temporaryDirectory, 'other');
        fs.mkdirSync(other);
        fs.writeFileSync(path.join(other, 'record.json'), bytes);
        fs.symlinkSync(other, path.join(files, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
        expect((await post('upload', { directory: 'link', name: 'record.json', data: 'e30=' })).status).toBe(400);
        const url = '/user/files/link/record.json';
        expect((await post('delete', { path: url })).status).toBe(400);
        expect(await (await post('verify', { urls: [url] })).json()).toEqual({});
        expect(fs.readFileSync(path.join(other, 'record.json'))).toEqual(bytes);
    });

    test('reports a filesystem failure as 500', async () => {
        const failure = Object.assign(new Error('permission denied'), { code: 'EACCES' });
        const mkdir = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => { throw failure; });
        try {
            expect((await post('upload', { directory: 'nested', name: 'record.json', data: 'e30=' })).status).toBe(500);
        } finally { mkdir.mockRestore(); }
    });
});
