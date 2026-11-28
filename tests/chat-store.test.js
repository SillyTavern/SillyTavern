import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ChatStore } from '../src/chat-store.js';

describe('indexed ChatStore', () => {
    let directory;
    let filePath;
    let store;
    const header = { user_name: 'unused', character_name: 'unused', chat_metadata: { integrity: 'test-chat' } };

    function writeChat(messages, chatHeader = header) {
        fs.writeFileSync(filePath, [chatHeader, ...messages].map(value => JSON.stringify(value)).join('\n'));
    }

    function messages(count) {
        return Array.from({ length: count }, (_, index) => ({ name: 'Fixture', mes: `Synthetic message ${index}`, extra: {} }));
    }

    function savePayload(page, replacement = page.messages) {
        return { expectedRevision: page.revision, window: page.window, header: page.header, messages: replacement };
    }

    function readFile() {
        return fs.readFileSync(filePath, 'utf8').split('\n').map(line => JSON.parse(line));
    }

    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chat-store-'));
        filePath = path.join(directory, 'synthetic.jsonl');
        store = new ChatStore(filePath);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        store.close();
        fs.rmSync(directory, { force: true, recursive: true });
    });

    test('reads bounded tail/older/newer pages without rereading JSONL or unloaded bodies', async () => {
        writeChat(messages(250));
        const tail = await store.page({ limit: 10 });
        expect(tail.start).toBe(240);
        expect(tail.total).toBe(250);
        expect(tail.messages).toHaveLength(10);
        expect(tail.after).toBeNull();
        expect(store.stats.bodyRowsRead).toBe(10);
        const imported = store.stats.importedBytes;
        const older = await store.page({ limit: 10, cursor: tail.before });
        expect(older.start).toBe(230);
        const newer = await store.page({ limit: 10, cursor: older.after });
        expect(newer.messages).toEqual(tail.messages);
        expect(store.stats.bodyRowsRead).toBe(30);
        expect(store.stats.importedBytes).toBe(imported);

        store.close();
        const reopened = await store.page({ limit: 3 });
        expect(reopened.messages.map(message => message.id)).toEqual(tail.messages.slice(-3).map(message => message.id));
        expect(store.stats.importedBytes).toBe(imported);
    });

    test('metadata and latest summaries do not hydrate history bodies', async () => {
        const data = messages(100);
        data[2].extra.memory = 'A synthetic earlier summary';
        data[60].extra.memory = 'A synthetic latest summary';
        writeChat(data);
        const page = await store.page({ limit: 2 });
        expect(page.latestSummary).toEqual({ id: expect.any(String), seq: 60, memory: 'A synthetic latest summary' });
        const bodyReads = store.stats.bodyRowsRead;
        const first = await store.metadata({ limit: 3 });
        const second = await store.metadata({ after: first.next, limit: 3, expectedRevision: first.revision });
        expect(first.items.map(message => message.seq)).toEqual([0, 1, 2]);
        expect(second.items.map(message => message.seq)).toEqual([3, 4, 5]);
        expect(first.items[0].hash).toMatch(/^[a-f0-9]{64}$/);
        expect(store.stats.bodyRowsRead).toBe(bodyReads);
    });

    test('reads only requested IDs in requested order and applies revision checks', async () => {
        writeChat(messages(100));
        const metadata = await store.metadata({ limit: 100 });
        const ids = [metadata.items[70].id, 'missing', metadata.items[2].id];
        const result = await store.readByIds(ids, metadata.revision);
        expect(result.messages.map(message => message.seq)).toEqual([70, 2]);
        expect(store.stats.bodyRowsRead).toBe(2);
        await expect(store.readByIds(ids, 'stale')).rejects.toMatchObject({ status: 409 });
    });

    test('replaces the loaded tail while preserving unloaded history and stable IDs', async () => {
        const data = messages(20);
        writeChat(data);
        const allMetadata = await store.metadata({ limit: 20 });
        const tail = await store.page({ limit: 2 });
        const imported = store.stats.importedBytes;
        const replacement = [
            { ...tail.messages[0], message: { ...tail.messages[0].message, mes: 'Edited synthetic tail' } },
            tail.messages[1],
            { message: { name: 'Fixture', mes: 'New synthetic tail', extra: {} } },
        ];
        const result = await store.replaceWindow(savePayload(tail, replacement));
        expect(result.total).toBe(21);
        expect(result.start).toBe(18);
        expect(result.messages[0].id).toBe(tail.messages[0].id);
        expect(result.messages[0].revision).toBe(2);
        expect(result.messages[1].revision).toBe(1);
        expect(readFile().slice(1, 19)).toEqual(data.slice(0, 18));
        const metadata = await store.metadata({ limit: 30 });
        expect(metadata.items.slice(0, 18)).toEqual(allMetadata.items.slice(0, 18));
        expect(store.stats.importedBytes).toBe(imported);
        await expect(store.page({ cursor: tail.before })).rejects.toMatchObject({ status: 409 });
    });

    test('an interior window delete preserves the unloaded suffix and shifts its sequence only', async () => {
        const data = messages(10);
        writeChat(data);
        const all = await store.metadata({ limit: 10 });
        const middle = await store.page({ before: 6, limit: 2 });
        const result = await store.replaceWindow(savePayload(middle, [middle.messages[1]]));
        expect(result.total).toBe(9);
        expect(readFile().slice(1)).toEqual([...data.slice(0, 4), ...data.slice(5)]);
        const suffix = await store.readByIds([all.items[9].id]);
        expect(suffix.messages[0]).toMatchObject({ id: all.items[9].id, seq: 8, revision: 1 });
    });

    test('editing an interior page does not update sequence numbers in the unloaded suffix', async () => {
        writeChat(messages(500));
        const page = await store.page({ before: 2, limit: 1 });
        const executeCalls = [];
        const transaction = store.client.transaction.bind(store.client);
        jest.spyOn(store.client, 'transaction').mockImplementationOnce(async (...args) => {
            const tx = await transaction(...args);
            const execute = tx.execute.bind(tx);
            jest.spyOn(tx, 'execute').mockImplementation(async statement => {
                executeCalls.push(typeof statement === 'string' ? statement : statement.sql);
                return execute(statement);
            });
            return tx;
        });
        const edited = { ...page.messages[0], message: { ...page.messages[0].message, mes: 'Interior edit' } };
        const result = await store.replaceWindow(savePayload(page, [edited]));
        expect(result.total).toBe(500);
        expect(executeCalls.some(sql => /UPDATE messages SET seq/.test(sql))).toBe(false);
    });

    test('imports headerless legacy group chats without discarding their first message', async () => {
        const legacy = messages(3);
        fs.writeFileSync(filePath, legacy.map(message => JSON.stringify(message)).join('\n'));
        const page = await store.page();
        expect(page.header).toEqual({});
        expect(page.total).toBe(3);
        expect(page.messages.map(message => message.message)).toEqual(legacy);
    });

    test('rejects stale windows, foreign/duplicate IDs, body revisions and integrity changes', async () => {
        writeChat(messages(5));
        const page = await store.page({ limit: 2 });
        const before = fs.readFileSync(filePath);
        await expect(store.replaceWindow({ ...savePayload(page), expectedRevision: 'stale' })).rejects.toMatchObject({ status: 409 });
        await expect(store.replaceWindow({ ...savePayload(page), window: { start: 0, ids: page.window.ids } })).rejects.toMatchObject({ status: 409 });
        await expect(store.replaceWindow(savePayload(page, [{ ...page.messages[0], id: 'foreign' }]))).rejects.toMatchObject({ status: 400 });
        await expect(store.replaceWindow(savePayload(page, [page.messages[0], page.messages[0]]))).rejects.toMatchObject({ status: 400 });
        await expect(store.replaceWindow(savePayload(page, [{ ...page.messages[0], revision: 9 }]))).rejects.toMatchObject({ status: 409 });
        await expect(store.replaceWindow({ ...savePayload(page), header: { chat_metadata: { integrity: 'different' } } })).rejects.toMatchObject({ status: 409 });
        expect(fs.readFileSync(filePath)).toEqual(before);
    });

    test('serializes simultaneous saves and rejects the losing stale revision', async () => {
        writeChat(messages(3));
        const page = await store.page({ limit: 1 });
        const replacement = [{ ...page.messages[0], message: { ...page.messages[0].message, mes: 'Changed' } }];
        const results = await Promise.allSettled([store.replaceWindow(savePayload(page, replacement)), store.replaceWindow(savePayload(page, replacement))]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.find(result => result.status === 'rejected').reason).toMatchObject({ status: 409 });
        expect(readFile()).toHaveLength(4);
    });

    test('projection failure leaves the source file and committed index unchanged', async () => {
        writeChat(messages(5));
        const page = await store.page({ limit: 1 });
        const bytes = fs.readFileSync(filePath);
        jest.spyOn(store, 'writeProjection').mockRejectedValueOnce(new Error('Synthetic disk failure'));
        await expect(store.replaceWindow(savePayload(page, []))).rejects.toThrow('Synthetic disk failure');
        expect(fs.readFileSync(filePath)).toEqual(bytes);
        expect((await store.page({ limit: 1 })).messages).toEqual(page.messages);
        expect(fs.readdirSync(directory).filter(name => name.endsWith('.tmp'))).toEqual([]);
    });

    test('commit failure after atomic JSONL replacement rebuilds the disposable index', async () => {
        writeChat(messages(5));
        const page = await store.page({ limit: 1 });
        const transaction = store.client.transaction.bind(store.client);
        jest.spyOn(store.client, 'transaction').mockImplementationOnce(async (...args) => {
            const tx = await transaction(...args);
            jest.spyOn(tx, 'commit').mockRejectedValueOnce(new Error('Synthetic commit failure'));
            return tx;
        });
        await expect(store.replaceWindow(savePayload(page, []))).rejects.toThrow('Synthetic commit failure');
        expect(readFile()).toHaveLength(5);
        const recovered = await store.page({ limit: 2 });
        expect(recovered.total).toBe(4);
        expect(recovered.revision).not.toBe(page.revision);
        expect(recovered.messages[1].message.mes).toBe('Synthetic message 3');
    });

    test('detects external JSONL changes and never overwrites them with an old window', async () => {
        writeChat(messages(5));
        const page = await store.page({ limit: 2 });
        const external = messages(7);
        writeChat(external);
        await expect(store.replaceWindow(savePayload(page, []))).rejects.toMatchObject({ status: 409 });
        expect(readFile().slice(1)).toEqual(external);
        expect((await store.page()).total).toBe(7);
    });

    test('creates a new chat through an empty revisioned window', async () => {
        const empty = await store.page();
        expect(empty.total).toBe(0);
        const result = await store.replaceWindow({ ...savePayload(empty, [{ message: messages(1)[0] }]), header });
        expect(result.total).toBe(1);
        expect(readFile()).toEqual([header, messages(1)[0]]);
    });

    test('unchanged saves do not rewrite the compatibility file or advance revisions', async () => {
        writeChat(messages(20));
        const page = await store.page({ limit: 3 });
        const projection = jest.spyOn(store, 'writeProjection');
        const saved = await store.replaceWindow(savePayload(page));
        expect(saved.revision).toBe(page.revision);
        expect(projection).not.toHaveBeenCalled();
    });

    test('bounds page bytes while allowing one oversized message to remain accessible', async () => {
        writeChat(Array.from({ length: 6 }, (_, index) => ({ mes: `${index}:` + 'x'.repeat(1024 * 1024) })));
        const tail = await store.page({ limit: 6 });
        expect(tail.messages.length).toBeLessThan(6);
        expect(tail.messages.length).toBeGreaterThan(0);
        expect(Buffer.byteLength(JSON.stringify(tail))).toBeLessThan(4 * 1024 * 1024 + 4096);
        const older = await store.page({ limit: 6, cursor: tail.before });
        expect(older.start + older.messages.length).toBe(tail.start);
    });

    test('rejects malformed or out-of-range cursors and invalid paging limits', async () => {
        writeChat(messages(3));
        const page = await store.page({ limit: 1 });
        const forged = Buffer.from(JSON.stringify({ revision: page.revision, position: 1000, direction: 'after' })).toString('base64url');
        await expect(store.page({ cursor: forged })).rejects.toMatchObject({ status: 400 });
        await expect(store.page({ cursor: '' })).rejects.toMatchObject({ status: 400 });
        await expect(store.page({ before: 4 })).rejects.toMatchObject({ status: 400 });
        await expect(store.page({ limit: 501 })).rejects.toMatchObject({ status: 400 });
    });
});
