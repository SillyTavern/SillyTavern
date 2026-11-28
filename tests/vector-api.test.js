import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { closeVectorWorker } from '../src/vectors/disk-worker-client.js';

let root;
let server;
let baseUrl;
const identity = { source: 'webllm', model: 'deterministic-local-test', collectionId: 'chat', profile: 'test-transform' };

async function post(route, payload = {}) {
    const response = await fetch(`${baseUrl}${route}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...identity, ...payload }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data };
}

beforeAll(async () => {
    const { setConfigFilePath } = await import('../src/util.js');
    setConfigFilePath(fileURLToPath(new URL('../default/config.yaml', import.meta.url)));
    const { router } = await import('../src/endpoints/vectors.js');
    const app = express();
    app.use(express.json());
    app.use((request, response, next) => { request.user = { directories: { vectors: root } }; next(); });
    app.use('/api/vector', router);
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    baseUrl = `http://127.0.0.1:${server.address().port}/api/vector`;
});

beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-vector-api-')); });
afterEach(async () => { jest.restoreAllMocks(); if (root) await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => {
    await closeVectorWorker();
    if (server) await new Promise(resolve => server.close(resolve));
});

describe('bounded vector HTTP API with deterministic local embeddings', () => {
    test('handles multiple provider batches and returns metadata before bounded bodies', async () => {
        const items = Array.from({ length: 21 }, (_, i) => ({ hash: i, text: `synthetic-${i}`, index: i, messageId: `m${i}`, version: 1, swipeId: 0 }));
        const embeddings = Object.fromEntries(items.map((item, i) => [item.text, [Math.cos(i), Math.sin(i), 1]]));
        expect((await post('/insert', { items, embeddings })).status).toBe(200);
        expect((await post('/stats')).data).toEqual({ chunks: 21, messages: 21, uniqueHashes: 21 });
        const result = await post('/query', { searchText: 'query', embeddings: { query: [1, 0, 1] }, topK: 2, threshold: 0.5, metadataOnly: true });
        expect(result.status).toBe(200);
        expect(result.data.metadata).toHaveLength(2);
        expect(result.data.metadata[0]).toMatchObject({ messageId: 'm0', version: '1', swipeId: '0' });
        expect(result.data.metadata[0]).not.toHaveProperty('text');
        expect((await post('/bodies', { ids: [result.data.metadata[0].id] })).data.items).toEqual([{ id: result.data.metadata[0].id, text: 'synthetic-0' }]);
        expect((await post('/state', { messageIds: ['m0', 'not-indexed'] })).data.items).toEqual([{ messageId: 'm0', version: '1', swipeId: '0' }]);
        expect((await post('/state', { messageIds: Array(501).fill('m0') })).status).toBe(400);
    });

    test('keeps profiles isolated, replaces current revisions atomically and deletes all profiles by explicit ID', async () => {
        for (const profile of ['test-transform', 'other-transform']) {
            expect((await post('/insert', { profile, items: [
                { hash: 1, text: 'old-0', index: 0, chunk: 0, messageId: 'm0', version: 1, swipeId: 0 },
                { hash: 1, text: 'old-1', index: 0, chunk: 1, messageId: 'm0', version: 1, swipeId: 0 },
            ], embeddings: { 'old-0': [1, 0, 0], 'old-1': [1, 0, 0] } })).status).toBe(200);
        }
        expect((await post('/stats', { profile: 'empty-transform' })).data.chunks).toBe(0);
        expect((await post('/insert', { items: [{ hash: 2, text: 'new', index: 0, messageId: 'm0', version: 2, swipeId: 1 }], embeddings: { new: [0, 1, 0] } })).status).toBe(200);
        expect((await post('/stats')).data.chunks).toBe(1);
        expect((await post('/state', { messageIds: ['m0'] })).data.items).toMatchObject([{ version: '2', swipeId: '1' }]);
        expect((await post('/delete-messages', { messageIds: ['m0'], allProfiles: true })).status).toBe(200);
        expect((await post('/stats')).data.chunks).toBe(0);
        expect((await post('/stats', { profile: 'other-transform' })).data.chunks).toBe(0);
    });

    test('rejects a changed embedding dimension while preserving the previous current message', async () => {
        await post('/insert', { items: [{ hash: 1, text: 'old', index: 0, messageId: 'm0', version: 1 }], embeddings: { old: [1, 0, 0] } });
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const failed = await post('/insert', { items: [{ hash: 2, text: 'new', index: 0, messageId: 'm0', version: 2 }], embeddings: { new: [1, 0] } });
        expect(failed.status).toBe(400);
        expect((await post('/state', { messageIds: ['m0'] })).data.items).toMatchObject([{ version: '1' }]);
    });
});
