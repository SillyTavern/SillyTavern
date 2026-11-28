/**
 * A revisioned, bounded view of a chat. The public chat array contains only this
 * view; server-owned IDs are kept separately so plugins cannot accidentally
 * serialize a partial array as a complete chat file.
 */
export class ChatStore {
    constructor({ fetch: fetcher = (...args) => fetch(...args), headers = () => ({ 'Content-Type': 'application/json' }) } = {}) {
        this.fetch = fetcher;
        this.headers = headers;
        this.epoch = 0;
        this.queue = Promise.resolve();
        this.listeners = new Set();
        this.reset();
    }

    reset() {
        this.controller?.abort();
        this.controller = new AbortController();
        this.epoch++;
        this.scope = null;
        this.revision = null;
        this.start = 0;
        this.total = 0;
        this.ids = [];
        this.refs = new WeakMap();
        this.before = null;
        this.after = null;
        this.latestSummary = null;
        this.saved = '';
        this.queue = Promise.resolve();
    }

    matches(scope) {
        return !!this.scope && JSON.stringify(this.scope) === JSON.stringify(scope);
    }

    snapshot() {
        return this.scope ? {
            scope: { ...this.scope }, revision: this.revision, start: this.start,
            total: this.total, ids: [...this.ids], hasEarlier: this.start > 0,
            hasLater: !!this.after, latestSummary: this.latestSummary,
        } : null;
    }

    subscribeChanges(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyChanges(change) {
        for (const listener of this.listeners) {
            Promise.resolve().then(() => listener(change)).catch(console.error);
        }
    }

    messageRef(message) {
        const ref = this.refs.get(message);
        return ref ? { ...ref } : null;
    }

    async request(route, data, epoch = this.epoch) {
        const response = await this.fetch(`/api/chats/${route}`, {
            method: 'POST', headers: this.headers(), cache: 'no-cache',
            signal: this.controller.signal, body: JSON.stringify(data),
        });
        if (epoch !== this.epoch) throw new DOMException('Chat changed', 'AbortError');
        if (!response.ok) {
            const details = await response.json().catch(() => ({}));
            const error = new Error(details.message || `Chat ${route} failed (${response.status})`);
            error.status = response.status;
            throw error;
        }
        const result = await response.json();
        if (epoch !== this.epoch) throw new DOMException('Chat changed', 'AbortError');
        return result;
    }

    adopt(page, messages) {
        this.revision = page.revision;
        this.start = page.start;
        this.total = page.total;
        this.ids = [...page.window.ids];
        this.before = page.before;
        this.after = page.after;
        this.latestSummary = page.latestSummary ?? null;
        this.refs = new WeakMap();
        const bodies = page.messages.map(envelope => {
            this.refs.set(envelope.message, { id: envelope.id, revision: envelope.revision, seq: envelope.seq });
            return envelope.message;
        });
        messages.splice(0, messages.length, ...bodies);
        this.saved = JSON.stringify({ header: page.header, messages });
        return page;
    }

    async open(scope, messages, limit = 100) {
        this.reset();
        this.scope = { ...scope };
        const page = await this.request('page', { ...scope, limit: this.pageSize(limit) });
        return this.adopt(page, messages);
    }

    pageSize(limit) {
        return Math.max(1, Math.min(500, Number(limit) || 100));
    }

    assertEpoch(epoch) {
        if (epoch !== this.epoch) throw new DOMException('Chat changed', 'AbortError');
    }

    save(messages, header) {
        const epoch = this.epoch;
        const operation = this.queue.then(async () => {
            if (epoch !== this.epoch) throw new DOMException('Chat changed', 'AbortError');
            if (!this.revision) throw new Error('The chat has not finished loading. Reload it before saving.');
            const saved = JSON.stringify({ header, messages });
            if (saved === this.saved) return;
            const submitted = messages.slice();
            // Freeze the request before awaiting the network. Edits during the
            // request remain in memory and are picked up by the following save.
            const payload = JSON.parse(JSON.stringify({
                ...this.scope, expectedRevision: this.revision,
                window: { start: this.start, ids: this.ids }, header,
                messages: submitted.map(message => ({ ...this.refs.get(message), message })),
            }));
            const page = await this.request('window', payload, epoch);
            const responseIds = new Set(page.window.ids);
            const deletedIds = payload.window.ids.filter(id => !responseIds.has(id));
            this.revision = page.revision;
            this.total = page.total;
            this.start = page.start;
            this.ids = [...page.window.ids];
            this.before = page.before;
            this.after = page.after;
            this.latestSummary = page.latestSummary ?? null;
            page.messages.forEach((envelope, i) => this.refs.set(submitted[i], {
                id: envelope.id, revision: envelope.revision, seq: envelope.seq,
            }));
            this.saved = saved;
            this.notifyChanges({ scope: { ...this.scope }, revision: page.revision, deletedIds, changedIds: [...responseIds] });
        });
        this.queue = operation.catch(() => {});
        return operation;
    }

    /** Replaces the view with another bounded page after persisting its edits. */
    async navigate(messages, header, { direction = 'older', limit = 100, before, beforeAdopt = () => {} } = {}) {
        const epoch = this.epoch;
        await this.save(messages, header);
        this.assertEpoch(epoch);
        if (direction === 'older' && before === undefined) before = this.start || undefined;
        const cursor = direction === 'older' ? this.before : direction === 'newer' ? this.after : null;
        if (direction !== 'latest' && !cursor && before === undefined) return null;
        const snapshot = JSON.stringify({ header, messages });
        const page = await this.request('page', {
            ...this.scope, limit: this.pageSize(limit),
            ...(before !== undefined ? { before } : cursor ? { cursor } : {}),
        }, epoch);
        if (page.revision !== this.revision) throw new Error('Chat changed while navigating. Reload it before saving.');
        if (snapshot !== JSON.stringify({ header, messages })) throw new Error('A message was edited while loading. Save the edit and navigate again.');
        beforeAdopt();
        return this.adopt(page, messages);
    }

    /** Fetch only enough recent bodies to fill the model's context budget. */
    async ensureContext(messages, header, budget, countTokens, limit = 100, assertWindowChange = () => {}) {
        assertWindowChange();
        const epoch = this.epoch;
        await this.save(messages, header);
        this.assertEpoch(epoch);
        assertWindowChange();
        if (this.after) await this.navigate(messages, header, { direction: 'latest', limit, beforeAdopt: assertWindowChange });
        const persisted = JSON.parse(this.saved);
        const baseline = new Map(this.ids.map((id, index) => [id, persisted.messages[index]]));
        const target = Math.max(1, Number(budget) || 4096);
        let tokens = 0;
        let firstNeeded = messages.length;
        while (firstNeeded > 0 && (tokens < target || messages.length - firstNeeded < this.pageSize(limit))) {
            tokens += await countTokens(messages[--firstNeeded]);
        }
        this.assertEpoch(epoch);
        assertWindowChange();
        if (JSON.stringify({ header, messages }) !== this.saved) throw new Error('A message was edited while preparing context. Save it and generate again.');
        // Discard already-saved bodies outside the next prompt/UI budget. This
        // changes the base window, not the messages stored on the server.
        while (firstNeeded > 0 && messages[firstNeeded - 1]?.is_system && Array.isArray(messages[firstNeeded - 1]?.extra?.tool_invocations)) firstNeeded--;
        if (firstNeeded > 0) {
            messages.splice(0, firstNeeded);
            this.ids.splice(0, firstNeeded);
            this.start += firstNeeded;
        }
        // Message overhead counts toward the budget even for empty/system text.
        while (this.start > 0 && tokens < target) {
            const page = await this.request('page', { ...this.scope, before: this.start, limit: this.pageSize(limit) });
            if (page.revision !== this.revision) throw new Error('Chat changed while loading context. Reload it before generating.');
            assertWindowChange();
            const previous = page.messages.map(envelope => {
                baseline.set(envelope.id, structuredClone(envelope.message));
                this.refs.set(envelope.message, { id: envelope.id, revision: envelope.revision, seq: envelope.seq });
                return envelope.message;
            });
            if (!previous.length) break;
            messages.unshift(...previous);
            this.start = page.start;
            this.ids.unshift(...page.window.ids);
            this.before = page.before;
            // Reasoning additions are limited from newest to oldest, exactly
            // like prompt assembly. Page boundaries must preserve that order.
            for (let index = previous.length - 1; index >= 0; index--) tokens += await countTokens(previous[index]);
            this.assertEpoch(epoch);
        }
        // A page boundary can fall between a tool result and the assistant
        // response that follows it. Keep the immediately preceding tool group.
        while (this.start > 0 && messages[0] && !messages[0].is_user) {
            const page = await this.request('page', { ...this.scope, before: this.start, limit: 1 }, epoch);
            const envelope = page.messages.at(-1);
            if (!envelope?.message?.is_system || !Array.isArray(envelope.message.extra?.tool_invocations)) break;
            assertWindowChange();
            this.refs.set(envelope.message, { id: envelope.id, revision: envelope.revision, seq: envelope.seq });
            baseline.set(envelope.id, structuredClone(envelope.message));
            messages.unshift(envelope.message);
            this.ids.unshift(envelope.id);
            this.start = envelope.seq;
            this.before = page.before;
        }
        // Merely fetching older messages must never mark them as user edits.
        this.saved = JSON.stringify({ header: persisted.header, messages: this.ids.map(id => baseline.get(id)) });
    }

    readByIds(ids) {
        return this.request('messages', { ...this.scope, ids, expectedRevision: this.revision });
    }

    /** Explicit range reads for /messages and similar user-invoked operations. */
    async readRange(start, end) {
        const epoch = this.epoch;
        const revision = this.revision;
        const result = [];
        let before = Math.min(end + 1, this.total);
        while (before > start) {
            const page = await this.request('page', { ...this.scope, before, limit: Math.min(500, before - start) }, epoch);
            if (page.revision !== revision) throw new Error('Chat changed while reading messages. Reload it and retry.');
            if (!page.messages.length) break;
            result.unshift(...page.messages.filter(envelope => envelope.seq >= start && envelope.seq <= end));
            before = page.start;
        }
        return result;
    }

    /** Chronological, bounded reads for incremental summarization. */
    async* messagesAfter(sequence, stopBefore = this.total - 1) {
        const epoch = this.epoch;
        const revision = this.revision;
        if (sequence + 1 >= stopBefore) return;
        let page = await this.request('page', { ...this.scope, before: sequence + 2, limit: 1 }, epoch);
        while (page.messages.length) {
            if (page.revision !== revision) throw new Error('Chat changed during summarization. Retry after saving.');
            for (const envelope of page.messages) {
                if (envelope.seq >= stopBefore) return;
                if (envelope.seq > sequence) yield envelope;
            }
            if (!page.after) return;
            page = await this.request('page', { ...this.scope, cursor: page.after, limit: 100 }, epoch);
        }
    }

    /** Save a summary on an unloaded message without moving the UI window. */
    async saveSummary(messages, header, reference, memory) {
        const epoch = this.epoch;
        await this.save(messages, header);
        this.assertEpoch(epoch);
        const operation = this.queue.then(async () => {
            this.assertEpoch(epoch);
            const result = await this.readByIds([reference.id]);
            const envelope = result.messages[0];
            if (!envelope || envelope.revision !== reference.revision) throw new Error('The summarized message changed. Summarize it again.');
            const message = { ...envelope.message, extra: { ...envelope.message.extra, memory } };
            const page = await this.request('window', {
                ...this.scope, expectedRevision: this.revision,
                window: { start: envelope.seq, ids: [envelope.id] }, header,
                messages: [{ id: envelope.id, revision: envelope.revision, message }],
            }, epoch);
            this.revision = page.revision;
            this.latestSummary = page.latestSummary ?? null;
            this.notifyChanges({ scope: { ...this.scope }, revision: page.revision, deletedIds: [], changedIds: [envelope.id] });
            const loaded = messages.find(body => this.refs.get(body)?.id === envelope.id);
            if (loaded) {
                loaded.extra = { ...loaded.extra, memory };
                const updated = page.messages[0];
                this.refs.set(loaded, { id: updated.id, revision: updated.revision, seq: updated.seq });
            }
            // Cursors contain the revision; reconstruct the newer cursor only
            // when an older UI window actually needs it.
            if (this.after && this.ids.length) {
                const boundary = await this.request('page', { ...this.scope, before: this.start + this.ids.length, limit: 1 }, epoch);
                this.after = boundary.after;
            }
        });
        this.queue = operation.catch(() => {});
        return operation;
    }

    async fork(messages, sourceHeader, target, header, through, lastMessage) {
        const targetMessage = through === undefined ? messages.at(-1) : messages[through];
        await this.save(messages, sourceHeader);
        const throughId = targetMessage ? this.refs.get(targetMessage)?.id : null;
        if (targetMessage && !throughId) throw new Error('Cannot branch from an unsaved message.');
        return this.request('fork', {
            ...this.scope, expectedRevision: this.revision, target, header, throughId,
            ...(lastMessage ? { lastMessage } : {}),
        });
    }
}

export const activeChatStore = new ChatStore();

export function toGlobalMessageId(localIndex, state = activeChatStore.snapshot()) {
    return Number(localIndex) + (state?.start || 0);
}

/** Count the same selected reasoning that will be added to prompt messages. */
export function createContextTokenCounter({ countTokens, formatMessage, formatReasoning, reasoning, type, canUseTools, groupCharacter = null }) {
    let rawSeen = false;
    let usableSeen = false;
    let depth = 0;
    return async message => {
        const firstRaw = !rawSeen;
        rawSeen = true;
        if (type === 'regenerate' && firstRaw && !message.is_user) return 0;
        const tools = canUseTools && Array.isArray(message.extra?.tool_invocations);
        if (message.is_system && !tools) return 0;
        const firstUsable = !usableSeen;
        usableSeen = true;
        if (type === 'swipe' && firstUsable) return 0;
        const isPrefix = type === 'continue' && depth === 0;
        const messageDepth = depth++ - (type === 'continue' ? 1 : 0);
        let text = await formatMessage(message, messageDepth);
        if (groupCharacter === null || message.name === groupCharacter) {
            text = reasoning.addToMessage(text, formatReasoning(message, messageDepth), isPrefix, message.extra?.reasoning_duration);
        }
        if (tools) text += `\n${JSON.stringify(message.extra.tool_invocations)}`;
        return 8 + await countTokens(text);
    };
}

/** The last message is intentionally excluded by the summarization extension. */
export function findChatSummary(messages, state = activeChatStore.snapshot()) {
    if (!Array.isArray(messages) || !messages.length) return { memory: '', index: -1 };
    for (let index = messages.length - 2; index >= 0; index--) {
        if (messages[index].extra?.memory) return { memory: messages[index].extra.memory, index };
    }
    // A preceding summary is already represented by its saved text. The next
    // summary starts at local zero, rather than treating its global seq as an
    // index into the small in-memory window.
    const summary = state?.latestSummary;
    return { memory: summary && summary.seq < state.start ? summary.memory : '', index: -1 };
}
