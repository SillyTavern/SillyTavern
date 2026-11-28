/** Stable scope identity; filenames shared by two characters never share memory. */
export function chatMemoryCollection(scope) {
    return `chat:${JSON.stringify(Object.fromEntries(Object.entries(scope).sort(([a], [b]) => a.localeCompare(b))))}`;
}

export class ChatMemorySync {
    constructor(store, lookup) {
        this.store = store;
        this.lookup = lookup;
        this.session = null;
    }

    begin(profile) {
        const snapshot = this.store.snapshot();
        if (!snapshot) throw new Error('Open a chat before vectorizing history');
        this.session = { snapshot, profile, after: -1, pending: [], done: false };
    }

    end() {
        this.session = null;
    }

    assertSnapshot(snapshot) {
        const current = this.store.snapshot();
        if (!current || current.revision !== snapshot.revision || chatMemoryCollection(current.scope) !== chatMemoryCollection(snapshot.scope)) {
            throw new Error('Chat changed during vector synchronization; retry with the current chat');
        }
    }

    async missing(snapshot, refs, profile) {
        const known = new Map();
        for (let i = 0; i < refs.length; i += 500) {
            const records = await this.lookup(chatMemoryCollection(snapshot.scope), refs.slice(i, i + 500).map(x => x.id), profile);
            for (const record of records) known.set(record.messageId, record);
        }
        this.assertSnapshot(snapshot);
        return refs.filter(ref => String(known.get(ref.id)?.version) !== String(ref.revision));
    }

    async loaded(messages, limit, profile, keepHidden, skipped = new Set()) {
        await this.store.queue;
        const snapshot = this.store.snapshot();
        if (!snapshot) return null;
        const refs = [];
        for (const message of messages) {
            const ref = this.store.messageRef(message);
            if (ref && (keepHidden || !message.is_system)) refs.push({ ...ref, message });
        }
        const pending = (await this.missing(snapshot, refs, profile)).filter(ref => !skipped.has(`${ref.id}:${ref.revision}`));
        return { snapshot, collectionId: chatMemoryCollection(snapshot.scope), items: pending.slice(0, limit), remaining: Math.max(0, pending.length - limit) };
    }

    async next(limit, profile, keepHidden) {
        await this.store.queue;
        if (!this.session) this.begin(profile);
        const session = this.session;
        this.assertSnapshot(session.snapshot);
        if (session.profile !== profile) throw new Error('Embedding settings changed during vectorization');
        while (!session.pending.length && !session.done) {
            const page = await this.store.request('metadata', {
                ...session.snapshot.scope, expectedRevision: session.snapshot.revision,
                after: session.after, limit: 100,
            });
            this.assertSnapshot(session.snapshot);
            if (page.revision !== session.snapshot.revision) throw new Error('Chat changed during vectorization');
            session.pending = await this.missing(session.snapshot, page.items.filter(x => keepHidden || !x.is_system), profile);
            session.after = page.items.at(-1)?.seq ?? session.after;
            session.done = page.next === null;
            if (!page.items.length) session.done = true;
        }
        const selected = session.pending.splice(0, limit);
        const result = selected.length ? await this.store.readByIds(selected.map(x => x.id)) : { messages: [] };
        this.assertSnapshot(session.snapshot);
        const expected = new Map(selected.map(x => [x.id, x.revision]));
        const items = result.messages.filter(x => x.revision === expected.get(x.id));
        return {
            snapshot: session.snapshot, collectionId: chatMemoryCollection(session.snapshot.scope), items,
            remaining: session.pending.length + (session.done ? 0 : Math.max(0, session.snapshot.total - session.after - 1)),
        };
    }

    async hydrate(candidates, options, snapshot = this.store.snapshot()) {
        this.assertSnapshot(snapshot);
        const ids = [...new Set(candidates.map(x => x.messageId).filter(Boolean))];
        if (!ids.length) return [];
        const metadata = await this.store.request('metadata', {
            ...snapshot.scope, ids, expectedRevision: snapshot.revision,
        });
        this.assertSnapshot(snapshot);
        const references = selectMemoryReferences(candidates, metadata.items, options);
        if (!references.length) return [];
        const current = await this.store.readByIds(references.map(x => x.messageId));
        this.assertSnapshot(snapshot);
        return selectCurrentMemories(references, current.messages, options);
    }
}

/** Match only current message revisions/swipes and preserve ANN ranking. */
export function selectMemoryReferences(candidates, metadata, { total, protect, limit, keepHidden }) {
    const byId = new Map(metadata.map(x => [x.id, x]));
    const seen = new Set();
    return candidates.filter(candidate => {
        const current = byId.get(candidate.messageId);
        if (!current || seen.has(current.id) || current.seq >= total - protect ||
            String(current.revision) !== String(candidate.version) || (!keepHidden && current.is_system)) return false;
        seen.add(current.id);
        return true;
    }).slice(0, limit);
}

/** Match only current message revisions/swipes and preserve ANN ranking. */
export function selectCurrentMemories(candidates, envelopes, { total, protect, limit, keepHidden, hash }) {
    const byId = new Map(envelopes.map(x => [x.id, x]));
    const seen = new Set();
    const result = [];
    for (const candidate of candidates) {
        const envelope = byId.get(candidate.messageId);
        if (!envelope || seen.has(envelope.id) || envelope.seq >= total - protect ||
            String(envelope.revision) !== String(candidate.version) ||
            String(envelope.message.swipe_id ?? 0) !== String(candidate.swipeId ?? 0) ||
            (!keepHidden && envelope.message.is_system) || hash(envelope.message) !== Number(candidate.hash)) continue;
        seen.add(envelope.id);
        result.push(envelope);
        if (result.length >= limit) break;
    }
    return result;
}

/** Read the query tail before doing substitutions, hashing or summarization. */
export function queryTail(messages, count, text) {
    const result = [];
    for (let i = messages.length - 1; i >= 0 && result.length < count; i--) {
        const value = text(messages[i]);
        if (value) result.push({ text: value, index: i });
    }
    return result;
}

/** A replacing message write must include all of that message's chunks. */
export function memoryWriteBatches(items, split, maxChunks = 500) {
    const batches = [];
    let batch = [];
    for (const item of items) {
        const chunks = split([item]);
        if (chunks.length > maxChunks) {
            throw new Error(`One message exceeds ${maxChunks} vector chunks. Increase Message Chunk Size before retrying.`, { cause: 'chunk_limit' });
        }
        if (batch.length + chunks.length > maxChunks) {
            batches.push(batch);
            batch = [];
        }
        batch.push(...chunks);
    }
    if (batch.length) batches.push(batch);
    return batches;
}

/** Full-array reconciliation is reserved for the user's explicit compatibility mode. */
export function fullHistoryDelta(messages, savedHashes, { keepHidden, hash, skipped = new Set() }) {
    const saved = new Set(savedHashes);
    const current = new Set();
    const items = [];
    messages.forEach((message, seq) => {
        if (!keepHidden && message.is_system) return;
        const value = hash(message);
        current.add(value);
        if (!saved.has(value) && !skipped.has(value)) items.push({ seq, message });
    });
    return { items, deletedHashes: [...saved].filter(value => !current.has(value)) };
}

export function selectFullHistoryMemories(messages, candidates, { protect, limit, hash, keepHidden = false }) {
    const ranks = new Map(candidates.map((candidate, index) => [Number(candidate.hash), index]).reverse());
    const selected = [];
    const seen = new Set();
    for (let index = 0; index < messages.length - protect; index++) {
        if (!messages[index].mes || (!keepHidden && messages[index].is_system)) continue;
        const value = hash(messages[index]);
        if (!ranks.has(value) || seen.has(value)) continue;
        seen.add(value);
        selected.push({ index, message: messages[index], rank: ranks.get(value) });
    }
    return selected.sort((a, b) => a.rank - b.rank).slice(0, limit);
}
