import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';
const { router } = await import('../src/endpoints/chats.js');
const { humanizedDateTime } = await import('../src/util.js');

async function setup(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-chat-import-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const chats = path.join(root, 'chats');
    const groupChats = path.join(root, 'group-chats');
    const characterDirectory = path.join(chats, 'Character');
    await fs.mkdir(characterDirectory, { recursive: true });
    await fs.mkdir(groupChats);
    const upload = path.join(root, 'upload.json');
    const app = express();
    app.use(express.json());
    app.use((request, response, next) => {
        request.user = /** @type {any} */ ({ directories: { chats, groupChats } });
        request.file = /** @type {any} */ ({ destination: root, filename: path.basename(upload) });
        next();
    });
    app.use('/api/chats', router);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const importChat = async (data, fileType = 'json') => {
        await fs.writeFile(upload, typeof data === 'string' ? data : JSON.stringify(data));
        const response = await fetch(`http://127.0.0.1:${address.port}/api/chats/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_type: fileType, avatar_url: 'Character.png', character_name: 'Character', user_name: 'Player' }),
        });
        assert.equal(response.status, 200);
        return response.json();
    };
    const importGroupChat = async (data) => {
        await fs.writeFile(upload, data);
        const response = await fetch(`http://127.0.0.1:${address.port}/api/chats/group/import`, { method: 'POST' });
        assert.equal(response.status, 200);
        return response.json();
    };
    return { characterDirectory, groupChats, upload, importChat, importGroupChat };
}

test('CAI Tools HTTP import preserves every history, message role and existing file at one timestamp', async (t) => {
    const { characterDirectory, upload, importChat } = await setup(t);
    const timestamp = 1767225600000;
    t.mock.method(Date, 'now', () => timestamp);
    const existing = path.join(characterDirectory, `Character - ${humanizedDateTime(timestamp)} imported.jsonl`);
    await fs.writeFile(existing, 'keep the existing chat');
    const response = await importChat({
        histories: {
            histories: [
                { msgs: [{ src: { is_human: true }, text: 'First human message' }, { src: { is_human: false }, text: 'First reply' }] },
                { msgs: [{ src: { is_human: false }, text: 'Second history' }] },
                { msgs: [] },
            ],
        },
    });
    assert.equal(response.res, true);
    assert.equal(response.fileNames.length, 3);
    assert.equal(new Set(response.fileNames).size, 3);
    assert.equal((await fs.readdir(characterDirectory)).length, 4);
    assert.equal(await fs.readFile(existing, 'utf8'), 'keep the existing chat');
    const imported = await Promise.all(response.fileNames.map(async file => {
        const content = await fs.readFile(path.join(characterDirectory, file), 'utf8');
        return content.split('\n').map(line => JSON.parse(line));
    }));
    assert.deepEqual(imported[0][0].chat_metadata, {});
    assert.deepEqual(imported[0].slice(1).map(({ name, is_user, mes }) => ({ name, is_user, mes })), [
        { name: 'Player', is_user: true, mes: 'First human message' },
        { name: 'Character', is_user: false, mes: 'First reply' },
    ]);
    assert.equal(imported[1][1].mes, 'Second history');
    assert.equal(imported[2].length, 1);
    await assert.rejects(fs.stat(upload), { code: 'ENOENT' });
});

test('repeated JSONL HTTP imports cannot overwrite an earlier import in the same millisecond', async (t) => {
    const { characterDirectory, importChat } = await setup(t);
    t.mock.method(Date, 'now', () => 1767225600000);
    const contents = message => [{ chat_metadata: {} }, { name: 'Character', mes: message }].map(value => JSON.stringify(value)).join('\n');
    const first = await importChat(contents('First imported chat'), 'jsonl');
    const second = await importChat(contents('Second imported chat'), 'jsonl');
    assert.equal(first.res, true);
    assert.equal(second.res, true);
    assert.notEqual(first.fileNames[0], second.fileNames[0]);
    assert.equal(await fs.readFile(path.join(characterDirectory, first.fileNames[0]), 'utf8'), contents('First imported chat'));
    assert.equal(await fs.readFile(path.join(characterDirectory, second.fileNames[0]), 'utf8'), contents('Second imported chat'));
});

test('group HTTP imports preserve existing chats and repeated imports at the same timestamp', async (t) => {
    const { groupChats, upload, importGroupChat } = await setup(t);
    const timestamp = 1767225600000;
    t.mock.method(Date, 'now', () => timestamp);
    const existing = path.join(groupChats, `${humanizedDateTime(timestamp)}.jsonl`);
    await fs.writeFile(existing, 'existing group chat');
    const contents = message => [{ chat_metadata: {} }, { name: 'Character', mes: message }].map(value => JSON.stringify(value)).join('\n');
    const first = await importGroupChat(contents('First group import'));
    const second = await importGroupChat(contents('Second group import'));
    assert.equal(typeof first.res, 'string');
    assert.equal(typeof second.res, 'string');
    assert.notEqual(first.res, second.res);
    assert.equal((await fs.readdir(groupChats)).length, 3);
    assert.equal(await fs.readFile(existing, 'utf8'), 'existing group chat');
    assert.equal(await fs.readFile(path.join(groupChats, `${first.res}.jsonl`), 'utf8'), contents('First group import'));
    assert.equal(await fs.readFile(path.join(groupChats, `${second.res}.jsonl`), 'utf8'), contents('Second group import'));
    await assert.rejects(fs.stat(upload), { code: 'ENOENT' });
});
