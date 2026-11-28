import { afterEach, describe, expect, test } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { closeVectorWorker, withVectorWorker, vectorOperation } from '../src/vectors/disk-worker-client.js';
import { withVectorStore } from '../src/vectors/disk-index.js';

afterEach(async () => { await closeVectorWorker(); });

describe('vector storage worker', () => {
    test('keeps the server event loop available during native indexing and returns candidate bodies by ID', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-vector-worker-'));
        try {
            let completed = false;
            const insertion = withVectorWorker(root, 'synthetic', 'test', { model: 'local' }, store => store.upsert(
                Array.from({ length: 400 }, (_, i) => ({
                    hash: i, index: i, text: `body-${i}`,
                    vector: Array.from({ length: 128 }, (_, j) => Math.sin(i + j) + Math.cos(i * j)),
                })),
            )).then(() => { completed = true; });
            await new Promise(resolve => setImmediate(resolve));
            expect(completed).toBe(false);
            await insertion;
            const metadata = await withVectorWorker(root, 'synthetic', 'test', { model: 'local' }, store => store.query(
                Array.from({ length: 128 }, (_, j) => Math.sin(j) + 1), 2,
            ));
            expect(metadata).toHaveLength(2);
            expect(metadata[0].hash).toBe(0);
            expect(metadata[0]).not.toHaveProperty('text');
            const bodies = await withVectorWorker(root, 'synthetic', 'test', { model: 'local' }, store => store.bodies([metadata[0].id]));
            expect(bodies).toEqual([{ id: metadata[0].id, text: 'body-0' }]);
        } finally {
            await fs.rm(root, { recursive: true, force: true });
        }
    });

    test('serializes purge and subsequent writes and recovers from unsupported and uncloneable requests', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-vector-worker-queue-'));
        const request = { root, collectionId: 'chat', source: 'test', profile: { model: 'local' } };
        try {
            const first = vectorOperation({ ...request, method: 'upsert', args: [[{ hash: 1, text: 'old', index: 0, vector: [1, 0, 0] }]] });
            const purge = vectorOperation({ ...request, method: 'purge', args: [] });
            const last = vectorOperation({ ...request, method: 'upsert', args: [[{ hash: 2, text: 'new', index: 1, vector: [0, 1, 0] }]] });
            await Promise.all([first, purge, last]);
            expect(await vectorOperation({ ...request, method: 'hashes', args: [] })).toEqual([2]);
            await expect(vectorOperation({ ...request, method: 'unsupported', args: [] })).rejects.toThrow(/Unsupported/);
            await expect(vectorOperation({ ...request, method: 'upsert', args: [() => {}] })).rejects.toThrow();
            expect(await vectorOperation({ ...request, method: 'hashes', args: [] })).toEqual([2]);
        } finally {
            await fs.rm(root, { recursive: true, force: true });
        }
    });

    test('bounds pending work and keeps heartbeat timers running during native indexing', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-vector-worker-bound-'));
        const request = { root, collectionId: 'chat', source: 'test', profile: { model: 'local' } };
        let heartbeat;
        try {
            const queued = Array.from({ length: 64 }, () => vectorOperation({ ...request, method: 'hashes', args: [] }));
            await expect(vectorOperation({ ...request, method: 'hashes', args: [] })).rejects.toMatchObject({ code: 'VECTOR_STORAGE_BUSY' });
            await Promise.all(queued);
            let indexing = false;
            let beats = 0;
            heartbeat = setInterval(() => { if (indexing) beats++; }, 1);
            await vectorOperation({ ...request, method: 'upsert', args: [
                Array.from({ length: 500 }, (_, i) => ({ hash: i, text: '', index: i,
                    vector: Array.from({ length: 512 }, (_, j) => Math.sin(i + j) + Math.cos(i * j)),
                })),
            ] }, { onStarted: () => { indexing = true; } });
            indexing = false;
            expect(beats).toBeGreaterThan(1);
        } finally {
            clearInterval(heartbeat);
            await fs.rm(root, { recursive: true, force: true });
        }
    });

    test('upgrades an existing default graph in the storage worker without calling an embedding provider', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-vector-worker-upgrade-'));
        const profile = { model: 'local' };
        try {
            await withVectorStore(root, 'chat', 'test', profile, async store => {
                await store.upsert([{ hash: 1, index: 0, text: 'preserved', vector: [1, 0, 0] }]);
                await store.client.batch([
                    'DROP INDEX records_ann',
                    'CREATE INDEX records_ann ON records(libsql_vector_idx(embedding))',
                    'DELETE FROM state WHERE key=\'ann_settings_version\'',
                ], 'write');
            });
            const result = await withVectorWorker(root, 'chat', 'test', profile, store => store.query([1, 0, 0], 1));
            expect(result[0].hash).toBe(1);
            await withVectorStore(root, 'chat', 'test', profile, async store => {
                const schema = await store.client.execute('SELECT sql FROM sqlite_master WHERE name=\'records_ann\'');
                expect(schema.rows[0].sql).toContain('search_l=512');
                expect(schema.rows[0].sql).toContain('compress_neighbors=float8');
                expect(await store.bodies([result[0].id])).toEqual([{ id: result[0].id, text: 'preserved' }]);
            });
        } finally {
            await fs.rm(root, { recursive: true, force: true });
        }
    });
});
