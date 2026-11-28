import { describe, expect, test } from '@jest/globals';
import { ChatMemorySync, chatMemoryCollection, selectCurrentMemories, queryTail, memoryWriteBatches, fullHistoryDelta, selectFullHistoryMemories } from '../public/scripts/extensions/vectors/chat-memory.js';

function fixture(total = 18000) {
    const scope = { avatar_url: 'char.png', file_name: 'shared-name' };
    const snapshot = { scope, revision: 'revision-1', total };
    const metadata = Array.from({ length: total }, (_, seq) => ({ id: `m${seq}`, revision: 1, seq, is_system: false }));
    const reads = [];
    const pages = [];
    const lookups = [];
    const indexed = new Map();
    const refs = new WeakMap();
    const store = {
        queue: Promise.resolve(), snapshot: () => ({ ...snapshot }),
        messageRef: message => refs.get(message),
        request: async (route, args) => {
            expect(route).toBe('metadata');
            pages.push(args);
            const items = args.ids ? args.ids.map(id => metadata[Number(id.slice(1))]).filter(Boolean) : metadata.slice(args.after + 1, args.after + 1 + args.limit);
            return { revision: snapshot.revision, total, items, next: items.at(-1)?.seq < total - 1 ? items.at(-1).seq : null };
        },
        readByIds: async ids => {
            reads.push(ids);
            return { revision: snapshot.revision, messages: ids.map(id => {
                const meta = metadata[Number(id.slice(1))];
                return { ...meta, message: { mes: `body-${id}`, swipe_id: 0 } };
            }) };
        },
    };
    const lookup = async (collection, ids) => {
        lookups.push({ collection, ids });
        return ids.filter(id => indexed.has(id)).map(id => ({ messageId: id, version: indexed.get(id) }));
    };
    return { scope, snapshot, metadata, reads, pages, lookups, indexed, refs, store, sync: new ChatMemorySync(store, lookup) };
}

describe('on-demand chat vector synchronization', () => {
    test('checks only loaded stable IDs and never reads or deletes unseen historical bodies', async () => {
        const f = fixture();
        const window = f.metadata.slice(-50).map(meta => {
            const message = { mes: `body-${meta.id}` };
            f.refs.set(message, meta);
            return message;
        });
        f.indexed.set('m17950', 1);
        f.indexed.set('m20', 1); // unseen history is never inferred to be deleted
        const result = await f.sync.loaded(window, 5, 'profile', false);
        expect(f.lookups).toHaveLength(1);
        expect(f.lookups[0].ids).toHaveLength(50);
        expect(result.items.map(x => x.id)).toEqual(['m17951', 'm17952', 'm17953', 'm17954', 'm17955']);
        expect(result.remaining).toBe(44);
        expect(f.reads).toEqual([]);
        expect(f.pages).toEqual([]);
        expect(f.indexed.get('m20')).toBe(1);
    });

    test('explicit history vectorization scans metadata pages and fetches only missing message bodies in bounded batches', async () => {
        const f = fixture(220);
        for (let i = 0; i < 205; i++) f.indexed.set(`m${i}`, 1);
        f.sync.begin('profile');
        const first = await f.sync.next(5, 'profile', false);
        expect(first.items.map(x => x.id)).toEqual(['m205', 'm206', 'm207', 'm208', 'm209']);
        expect(first.remaining).toBe(10);
        expect(f.pages).toHaveLength(3);
        expect(f.pages.every(x => x.limit === 100)).toBe(true);
        expect(f.reads).toEqual([['m205', 'm206', 'm207', 'm208', 'm209']]);
        const second = await f.sync.next(5, 'profile', false);
        expect(second.items[0].id).toBe('m210');
        expect(second.remaining).toBe(5);
        expect(f.pages).toHaveLength(3);
        await f.sync.next(5, 'profile', false);
        const final = await f.sync.next(5, 'profile', false);
        expect(final.remaining).toBe(0);
        expect(final.items).toEqual([]);
        expect(f.reads.flat()).toHaveLength(15);
    });

    test('reindexes changed revisions and aborts a history job after scope/revision or profile changes', async () => {
        const f = fixture(10);
        f.indexed.set('m0', 1);
        f.metadata[0].revision = 2;
        f.sync.begin('p1');
        const first = await f.sync.next(1, 'p1', false);
        expect(first.items[0]).toMatchObject({ id: 'm0', revision: 2 });
        await expect(f.sync.next(1, 'p2', false)).rejects.toThrow(/settings changed/);
        f.snapshot.revision = 'revision-2';
        await expect(f.sync.next(1, 'p1', false)).rejects.toThrow(/Chat changed/);
        expect(f.reads).toHaveLength(1);
    });

    test('refreshes an explicitly changed unloaded message by ID without scanning or downloading its surrounding history', async () => {
        const f = fixture(1000);
        f.indexed.set('m20', 1);
        f.metadata[20].revision = 2;
        f.sync.enqueueChanges({ scope: f.scope, changedIds: ['m20'], deletedIds: [] });
        const batch = await f.sync.changed(5, 'profile', false);
        expect(batch.items.map(x => x.id)).toEqual(['m20']);
        expect(f.pages).toHaveLength(1);
        expect(f.pages[0]).toMatchObject({ ids: ['m20'] });
        expect(f.reads).toEqual([['m20']]);
        expect(f.lookups[0].ids).toEqual(['m20']);
        // Persisting the matching vector revision is the acknowledgement boundary.
        f.indexed.set('m20', 2);
        batch.complete(['m20']);
        expect(await f.sync.changed(5, 'profile', false)).toBeNull();
    });

    test('retains failed changed-ID work and does not acknowledge a newer edit arriving during an embedding request', async () => {
        const f = fixture(1000);
        f.indexed.set('m20', 1);
        f.metadata[20].revision = 2;
        f.sync.enqueueChanges({ scope: f.scope, changedIds: ['m20'], deletedIds: [] });
        await f.sync.changed(5, 'profile', false); // no acknowledgement: embedding failed
        const retry = await f.sync.changed(5, 'profile', false);
        expect(retry.items.map(x => x.id)).toEqual(['m20']);
        f.sync.enqueueChanges({ scope: f.scope, changedIds: ['m20'], deletedIds: [] });
        f.metadata[20].revision = 3;
        f.indexed.set('m20', 2);
        retry.complete(['m20']); // must leave the newer queued edit intact
        expect((await f.sync.changed(5, 'profile', false)).items[0].revision).toBe(3);
    });

    test('does not fetch bodies for already indexed changed IDs and isolates queued work by chat scope', async () => {
        const f = fixture(1000);
        f.indexed.set('m20', 1);
        f.sync.enqueueChanges({ scope: { avatar_url: 'other.png', file_name: 'shared-name' }, changedIds: ['m20'], deletedIds: [] });
        expect(await f.sync.changed(5, 'profile', false)).toBeNull();
        expect(f.pages).toEqual([]);
        f.sync.enqueueChanges({ scope: f.scope, changedIds: ['m20'], deletedIds: [] });
        expect(await f.sync.changed(5, 'profile', false)).toBeNull();
        expect(f.reads).toEqual([]);
        f.sync.enqueueChanges({ scope: f.scope, changedIds: ['m21'], deletedIds: ['m21'] });
        expect(await f.sync.changed(5, 'profile', false)).toBeNull();
    });

    test('uses the exact character/group scope independent of object key order', () => {
        expect(chatMemoryCollection({ file_name: 'same', avatar_url: 'a' })).toBe(chatMemoryCollection({ avatar_url: 'a', file_name: 'same' }));
        expect(chatMemoryCollection({ file_name: 'same', avatar_url: 'a' })).not.toBe(chatMemoryCollection({ file_name: 'same', avatar_url: 'b' }));
        expect(chatMemoryCollection({ is_group: true, id: 'same' })).not.toBe(chatMemoryCollection({ file_name: 'same', avatar_url: 'a' }));
    });

    test('drops stale revisions, inactive swipes, changed text, deleted IDs, hidden messages and protected tail before injection', () => {
        const envelope = (id, revision = 1, seq = 1, message = {}) => ({ id, revision, seq, message: { mes: 'current', swipe_id: 0, ...message } });
        const candidate = (messageId, other = {}) => ({ messageId, version: '1', swipeId: '0', hash: 7, ...other });
        const candidates = ['old-revision', 'old-swipe', 'old-text', 'deleted', 'hidden', 'tail', 'good', 'good', 'next'].map(id => candidate(id, id === 'old-text' ? { hash: 6 } : {}));
        const result = selectCurrentMemories(candidates, [
            envelope('old-revision', 2), envelope('old-swipe', 1, 1, { swipe_id: 1 }),
            envelope('old-text'), envelope('hidden', 1, 1, { is_system: true }),
            envelope('tail', 1, 99), envelope('good', 1, 2), envelope('next', 1, 3),
        ], { total: 100, protect: 5, limit: 2, keepHidden: false, hash: () => 7 });
        expect(result.map(x => x.id)).toEqual(['good', 'next']);
    });

    test('reads only the query tail before transforming text, even with a large history', () => {
        let transformed = 0;
        const messages = Array.from({ length: 18000 }, (_, i) => ({ mes: String(i) }));
        const result = queryTail(messages, 2, message => { transformed++; return message.mes; });
        expect(transformed).toBe(2);
        expect(result.map(x => x.index)).toEqual([17999, 17998]);
    });

    test('validates all ANN candidates against metadata before reading only the requested K bodies', async () => {
        const f = fixture(100);
        f.metadata[0].revision = 2;
        f.metadata[1].is_system = true;
        const candidates = Array.from({ length: 80 }, (_, seq) => ({ messageId: `m${seq}`, version: '1', hash: 7, swipeId: '0' }));
        const selected = await f.sync.hydrate(candidates, {
            total: 100, protect: 5, limit: 2, keepHidden: false, hash: () => 7,
        });
        expect(f.pages[0].ids).toHaveLength(80);
        expect(f.reads).toEqual([['m2', 'm3']]);
        expect(selected.map(x => x.id)).toEqual(['m2', 'm3']);
    });

    test('never splits one replacing message across requests and rejects a single oversized message', () => {
        const split = items => Array.from({ length: items[0].chunks }, (_, chunk) => ({ id: items[0].id, chunk }));
        const batches = memoryWriteBatches([{ id: 'a', chunks: 300 }, { id: 'b', chunks: 300 }], split);
        expect(batches.map(x => x.length)).toEqual([300, 300]);
        expect(new Set(batches[0].map(x => x.id))).toEqual(new Set(['a']));
        expect(new Set(batches[1].map(x => x.id))).toEqual(new Set(['b']));
        expect(() => memoryWriteBatches([{ id: 'oversized', chunks: 501 }], split)).toThrow(/Increase Message Chunk Size/);
    });

    test('keeps explicit full-history compatibility synchronization functional without a ChatStore', () => {
        const messages = [
            { mes: 'known', hash: 1 }, { mes: 'new', hash: 2 },
            { mes: 'hidden', hash: 3, is_system: true }, { mes: 'failed', hash: 4 },
        ];
        const delta = fullHistoryDelta(messages, [1, 8], { keepHidden: false, hash: message => message.hash, skipped: new Set([4]) });
        expect(delta.items.map(x => x.seq)).toEqual([1]);
        expect(delta.deletedHashes).toEqual([8]);
        expect(fullHistoryDelta(messages, [1], { keepHidden: true, hash: message => message.hash }).items.map(x => x.seq)).toEqual([1, 2, 3]);
    });

    test('matches bounded ANN candidates to current full-history bodies with protection, deduplication and ranking', () => {
        const messages = [
            { mes: 'second relevance', hash: 2 }, { mes: 'highest relevance', hash: 1 },
            { mes: 'duplicate', hash: 1 }, { mes: 'hidden', hash: 3, is_system: true },
            { mes: 'protected', hash: 4 },
        ];
        const selected = selectFullHistoryMemories(messages, [{ hash: 1 }, { hash: 2 }, { hash: 3 }, { hash: 4 }], {
            protect: 1, limit: 2, hash: message => message.hash,
        });
        expect(selected.map(x => x.index)).toEqual([1, 0]);
    });
});
