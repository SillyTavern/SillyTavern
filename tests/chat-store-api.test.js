import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

import { discardChatStore } from '../src/chat-store.js';

process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';

describe('on-demand chat routes with legacy JSONL compatibility', () => {
    let server;
    let baseUrl;
    let directory;
    let directories;
    let filePath;
    const scope = { avatar_url: 'Fixture.png', file_name: 'synthetic' };
    const header = { user_name: 'unused', character_name: 'unused', chat_metadata: { integrity: 'fixture-integrity' } };
    const messages = Array.from({ length: 30 }, (_, index) => ({ name: 'Fixture', mes: `Synthetic message ${index}`, extra: {} }));

    async function post(route, payload) {
        const response = await fetch(`${baseUrl}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        return { status: response.status, data };
    }

    function writeChat(target = filePath, data = messages) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, [header, ...data].map(value => JSON.stringify(value)).join('\n'));
    }

    function windowPayload(page, replacement = page.messages) {
        return { ...scope, expectedRevision: page.revision, window: page.window, header: page.header, messages: replacement };
    }

    beforeAll(async () => {
        const chats = await import('../src/endpoints/chats.js');
        const app = express();
        app.use(express.json());
        app.use((request, response, next) => {
            request.user = { profile: { handle: 'test-user' }, directories };
            next();
        });
        app.use('/api/chats', chats.router);
        server = await new Promise(resolve => {
            const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        });
        baseUrl = `http://127.0.0.1:${server.address().port}/api/chats`;
    });

    afterAll(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });

    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chat-api-'));
        directories = Object.fromEntries(['chats', 'groupChats', 'backups'].map(name => [name, path.join(directory, name)]));
        Object.values(directories).forEach(value => fs.mkdirSync(value));
        filePath = path.join(directories.chats, 'Fixture', 'synthetic.jsonl');
        writeChat();
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        for (const item of fs.readdirSync(directory, { recursive: true })) {
            if (item.endsWith('.sqlite')) await discardChatStore(path.join(directory, item.slice(0, -7)));
        }
        fs.rmSync(directory, { force: true, recursive: true });
    });

    test('pages, reads IDs/metadata and safely saves a tail while leaving unloaded messages on disk', async () => {
        const { status, data: page } = await post('/page', { ...scope, limit: 3 });
        expect(status).toBe(200);
        expect(page.start).toBe(27);
        expect(page.header.chat_metadata.__chatStoreWindow).toBe(true);
        const { data: metadata } = await post('/metadata', { ...scope, limit: 2 });
        expect(metadata.items.map(item => item.seq)).toEqual([0, 1]);
        const selected = await post('/messages', { ...scope, ids: [metadata.items[1].id], expectedRevision: page.revision });
        expect(selected.data.messages[0].message).toEqual(messages[1]);
        const selectedMetadata = await post('/metadata', { ...scope, ids: [metadata.items[1].id, 'deleted-id'], expectedRevision: page.revision });
        expect(selectedMetadata.data.items).toEqual([metadata.items[1]]);
        expect(selectedMetadata.data.next).toBeNull();
        const replacement = [page.messages[0], { message: { name: 'Fixture', mes: 'Appended' } }];
        const saved = await post('/window', windowPayload(page, replacement));
        expect(saved.status).toBe(200);
        expect(saved.data.total).toBe(29);
        const disk = fs.readFileSync(filePath, 'utf8').split('\n').map(line => JSON.parse(line));
        expect(disk.slice(1, 28)).toEqual(messages.slice(0, 27));
        expect(disk[0].chat_metadata.__chatStoreWindow).toBeUndefined();
        const stale = await post('/window', windowPayload(page, []));
        expect(stale.status).toBe(409);
        expect(stale.data.error).toBe('conflict');
    });

    test('rejects protected partial arrays in both old full-save routes even with force', async () => {
        const { data: page } = await post('/page', { ...scope, limit: 2 });
        const before = fs.readFileSync(filePath);
        const single = await post('/save', { ...scope, chat: [page.header, ...page.messages.map(item => item.message)], force: true });
        expect(single).toMatchObject({ status: 409, data: { error: 'window_save_required' } });
        const flagged = await post('/save', { ...scope, windowed: true, chat: [header] });
        expect(flagged.status).toBe(409);
        const group = await post('/group/save', { id: 'group', chat: [page.header], force: true });
        expect(group).toMatchObject({ status: 409, data: { error: 'window_save_required' } });
        expect(fs.readFileSync(filePath)).toEqual(before);
    });

    test('legacy full reads and saves remain explicit operations and invalidate cached pages', async () => {
        const { data: page } = await post('/page', { ...scope, limit: 2 });
        const full = await post('/get', scope);
        expect(full.data).toEqual([header, ...messages]);
        expect(full.data[0].chat_metadata.__chatStoreWindow).toBeUndefined();
        const saved = await post('/save', { ...scope, chat: [header, ...messages.slice(0, 4)] });
        expect(saved.status).toBe(200);
        const stale = await post('/page', { ...scope, cursor: page.before });
        expect(stale.status).toBe(409);
        const current = await post('/page', scope);
        expect(current.data.total).toBe(4);
    });

    test('uses the same safe window protocol for groups, including headerless legacy files', async () => {
        const groupPath = path.join(directories.groupChats, 'legacy-group.jsonl');
        fs.writeFileSync(groupPath, messages.map(message => JSON.stringify(message)).join('\n'));
        const groupScope = { is_group: true, id: 'legacy-group' };
        const { data: page } = await post('/page', { ...groupScope, limit: 2 });
        expect(page.total).toBe(30);
        const saved = await post('/window', { ...windowPayload(page), ...groupScope, messages: [...page.messages, { message: { mes: 'Group append' } }] });
        expect(saved.status).toBe(200);
        expect(saved.data.total).toBe(31);
        const legacy = await post('/group/get', { id: 'legacy-group' });
        expect(legacy.data).toHaveLength(32);
        expect(legacy.data[1]).toEqual(messages[0]);
    });

    test('exports, renames, deletes, and recreates files without stale sidecar content', async () => {
        const { data: page } = await post('/page', { ...scope, limit: 1 });
        const saved = await post('/window', windowPayload(page, [{ ...page.messages[0], message: { mes: 'Exported change' } }]));
        expect(saved.status).toBe(200);
        const exported = await post('/export', { ...scope, file: 'synthetic.jsonl', is_group: false, format: 'jsonl', exportfilename: 'fixture.jsonl' });
        expect(exported.data.result).toBe(fs.readFileSync(filePath, 'utf8'));
        const renamed = await post('/rename', { ...scope, original_file: 'synthetic.jsonl', renamed_file: 'renamed.jsonl', is_group: false });
        expect(renamed.status).toBe(200);
        expect(fs.existsSync(`${filePath}.sqlite`)).toBe(false);
        const targetScope = { ...scope, file_name: 'renamed' };
        expect((await post('/page', targetScope)).data.messages.at(-1).message.mes).toBe('Exported change');
        const deleted = await post('/delete', { ...targetScope, chatfile: 'renamed.jsonl' });
        expect(deleted.status).toBe(200);
        expect((await post('/page', targetScope)).data.total).toBe(0);
    });

    test('forks a prefix on the server and strips protection metadata from the new file', async () => {
        const { data: page } = await post('/page', { ...scope, before: 12, limit: 1 });
        const target = { ...scope, file_name: 'forked' };
        const result = await post('/fork', { ...scope, target, expectedRevision: page.revision, throughId: page.messages[0].id, header: page.header, lastMessage: { mes: 'Swipe variant' } });
        expect(result).toMatchObject({ status: 200, data: { ok: true, total: 12 } });
        const branchPath = path.join(directories.chats, 'Fixture', 'forked.jsonl');
        const branch = fs.readFileSync(branchPath, 'utf8').split('\n').map(line => JSON.parse(line));
        expect(branch).toHaveLength(13);
        expect(branch.at(-1)).toEqual({ mes: 'Swipe variant' });
        expect(branch[0].chat_metadata.__chatStoreWindow).toBeUndefined();
        expect((await post('/fork', { ...scope, target, expectedRevision: page.revision, throughId: null })).status).toBe(409);
    });

    test('returns bounded validation failures for invalid scopes, cursors, windows, and ID lists', async () => {
        expect((await post('/page', { file_name: 'missing-avatar' })).status).toBe(400);
        expect((await post('/page', { ...scope, limit: 501 })).status).toBe(400);
        expect((await post('/messages', { ...scope, ids: new Array(501).fill('id') })).status).toBe(400);
        const { data: page } = await post('/page', { ...scope, limit: 1 });
        expect((await post('/window', { ...windowPayload(page), window: { start: 0, ids: page.window.ids } })).status).toBe(409);
        expect((await post('/fork', { ...scope, target: { ...scope, avatar_url: '../../escape.png' }, expectedRevision: page.revision, throughId: null })).status).toBe(400);
    });
});
