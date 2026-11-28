import { beforeEach, afterEach, describe, expect, test } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { withVectorStore, vectorStorePath, purgeVectorStores } from '../src/vectors/disk-index.js';

let root;
const profile = { model: 'synthetic-3', apiUrl: '', transform: '' };
const item = (hash, vector, other = {}) => ({ hash, vector, text: `body-${hash}`, index: hash, ...other });
const use = callback => withVectorStore(root, 'chat', 'webllm', profile, callback);

beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-vector-disk-test-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('local DiskANN vector storage', () => {
    test('creates a real native ANN index and reads only candidate metadata until bodies are requested', async () => {
        await use(async store => {
            await store.upsert([item(1, [1, 0, 0]), item(2, [0, 1, 0]), item(3, [-1, 0, 0])]);
            const schema = await store.client.execute("SELECT sql FROM sqlite_master WHERE name='records_ann'");
            expect(schema.rows[0].sql).toContain('libsql_vector_idx');
            const query = await store.query([1, 0, 0], 1, 0.5);
            expect(query).toHaveLength(1);
            expect(query[0]).toMatchObject({ hash: 1, score: 1 });
            expect(query[0]).not.toHaveProperty('text');
            expect(await store.bodies(query.map(x => x.id))).toEqual([{ id: query[0].id, text: 'body-1' }]);
            const plan = await store.client.execute("EXPLAIN QUERY PLAN SELECT r.id FROM vector_top_k('records_ann', vector32('[1,0,0]'), 1) c JOIN records r ON r.id=c.id");
            expect(plan.rows.map(x => x.detail).join('\n')).toMatch(/VIRTUAL TABLE/);
            expect(plan.rows.map(x => x.detail).join('\n')).toMatch(/INTEGER PRIMARY KEY/);
        });
    });

    test('persists vectors across close/open and keeps the response bounded', async () => {
        await use(store => store.upsert(Array.from({ length: 300 }, (_, i) => item(i, [Math.cos(i), Math.sin(i), 1]))));
        await use(async store => {
            const result = await store.query([1, 0, 1], 4);
            expect(result).toHaveLength(4);
            expect(result[0].hash).toBe(0);
            expect(JSON.stringify(result).length).toBeLessThan(1500);
        });
    });

    test('isolates the exact collection, user root, source and embedding profile including sanitized-name collisions', async () => {
        await use(store => store.upsert([item(1, [1, 0, 0])]));
        for (const args of [
            [root, 'chat?', 'webllm', profile],
            [root, 'chat', 'koboldcpp', profile],
            [root, 'chat', 'webllm', { ...profile, apiUrl: 'http://other-model' }],
            [path.join(root, 'other-user'), 'chat', 'webllm', profile],
        ]) {
            await withVectorStore(...args, async store => {
                expect(await store.query([1, 0, 0], 3)).toEqual([]);
                expect(await store.bodies(['1'])).toEqual([]);
            });
        }
        expect(vectorStorePath(root, 'chat?', 'webllm', profile)).not.toBe(vectorStorePath(root, 'chat', 'webllm', profile));
    });

    test('replaces every chunk of an edited message and records the current revision/swipe', async () => {
        await use(async store => {
            await store.upsert([
                item(1, [1, 0, 0], { messageId: 'm1', version: 1, swipeId: 0, chunk: 0 }),
                item(1, [1, 0, 0], { messageId: 'm1', version: 1, swipeId: 0, chunk: 1 }),
                item(2, [0, 1, 0], { messageId: 'unloaded-history', version: 1 }),
            ]);
            const old = await store.query([1, 0, 0], 1);
            await store.upsert([item(4, [0, 0, 1], { messageId: 'm1', version: 2, swipeId: 1 })]);
            expect(await store.messageState(['m1'])).toEqual([{ messageId: 'm1', version: '2', swipeId: '1' }]);
            expect(await store.bodies([old[0].id])).toEqual([]);
            const result = await store.query([0, 0, 1], 10);
            expect(result.filter(x => x.messageId === 'm1')).toHaveLength(1);
            expect(result.find(x => x.messageId === 'm1')).toMatchObject({ version: '2', swipeId: '1' });
            expect(result.find(x => x.messageId === 'unloaded-history')).toBeDefined();
        });
    });

    test('does not overwrite same-hash chunks and explicitly deletes all matching chunks', async () => {
        await use(async store => {
            await store.upsert([item(1, [1, 0, 0], { text: 'chunk1' }), item(1, [1, 0, 0], { text: 'chunk2' })]);
            expect(await store.hashes()).toEqual([1, 1]);
            await store.deleteHashes([1]);
            expect(await store.hashes()).toEqual([]);
            expect(await store.bodies(['1', '2'])).toEqual([]);
        });
    });

    test('rejects invalid or mismatched vectors before deleting existing message chunks', async () => {
        await use(async store => {
            await store.upsert([item(1, [1, 0, 0], { messageId: 'm1', version: 1 })]);
            await expect(store.upsert([item(2, [0, 0], { messageId: 'm1', version: 2 })])).rejects.toThrow(/dimension/);
            await expect(store.query([0, 0, 0], 1)).rejects.toThrow(/Invalid vector/);
            expect(await store.messageState(['m1'])).toMatchObject([{ version: '1' }]);
        });
    });

    test('streams legacy Vectra JSON once, preserving source files and escaped metadata', async () => {
        const legacyPath = path.join(root, 'webllm', 'chat', profile.model);
        await fs.mkdir(legacyPath, { recursive: true });
        const legacy = JSON.stringify({ version: 1, items: [
            { id: 'a', vector: [1, 0, 0], metadata: { hash: 4, index: 2, text: '中文 ] } \\" body' } },
            { id: 'b', vector: [0, 1, 0], metadata: { hash: 5, index: 3 }, metadataFile: 'body.json' },
        ] });
        await fs.writeFile(path.join(legacyPath, 'index.json'), legacy);
        await fs.writeFile(path.join(legacyPath, 'body.json'), JSON.stringify({ hash: 5, index: 3, text: 'external metadata' }));
        await use(async store => {
            const result = await store.query([1, 0, 0], 2);
            expect(result[0].hash).toBe(4);
            expect(await store.bodies(result.map(x => x.id))).toHaveLength(2);
        });
        expect(await fs.readFile(path.join(legacyPath, 'index.json'), 'utf8')).toBe(legacy);
        // A normal indexed read must never revisit the large legacy file.
        await fs.writeFile(path.join(legacyPath, 'index.json'), 'invalid original, already imported');
        await use(async store => { expect(await store.hashes()).toEqual([4, 5]); });
    });

    test('preserves corrupt legacy data and reports an interrupted import', async () => {
        const legacyPath = path.join(root, 'webllm', 'chat', profile.model);
        await fs.mkdir(legacyPath, { recursive: true });
        const bytes = '{"items":[{"id":"a","vector":[1,0,0],"metadata":{"hash":1}}';
        await fs.writeFile(path.join(legacyPath, 'index.json'), bytes);
        await expect(use(store => store.hashes())).rejects.toThrow(/Truncated/);
        expect(await fs.readFile(path.join(legacyPath, 'index.json'), 'utf8')).toBe(bytes);
    });

    test('never imports ambiguous legacy vectors into another endpoint, transform or sanitized scope', async () => {
        const legacyPath = path.join(root, 'webllm', 'chat', profile.model);
        await fs.mkdir(legacyPath, { recursive: true });
        await fs.writeFile(path.join(legacyPath, 'index.json'), JSON.stringify({ items: [
            { id: 'a', vector: [1, 0, 0], metadata: { hash: 1, text: 'legacy-default' } },
        ] }));
        for (const [collectionId, selectedProfile] of [
            ['chat?', profile],
            ['chat', { ...profile, apiUrl: 'http://another-endpoint' }],
            ['chat', { ...profile, transform: 'summary' }],
        ]) {
            await withVectorStore(root, collectionId, 'webllm', selectedProfile, async store => {
                expect(await store.hashes()).toEqual([]);
            });
        }
        await use(async store => { expect(await store.hashes()).toEqual([1]); });
        expect(JSON.parse(await fs.readFile(path.join(legacyPath, '.diskann-claim.json'), 'utf8'))).toMatchObject({ collectionId: 'chat', model: profile.model });
    });

    test('serializes concurrent writers and purges only the selected collection', async () => {
        await Promise.all(Array.from({ length: 8 }, (_, i) => use(store => store.upsert([item(i, [1, i, 1])]))));
        await withVectorStore(root, 'other', 'webllm', profile, store => store.upsert([item(9, [0, 1, 0])]));
        await use(async store => { expect(await store.hashes()).toHaveLength(8); });
        await purgeVectorStores(root, 'chat');
        await use(async store => { expect(await store.hashes()).toEqual([]); });
        await withVectorStore(root, 'other', 'webllm', profile, async store => { expect(await store.hashes()).toEqual([9]); });
    });
});
