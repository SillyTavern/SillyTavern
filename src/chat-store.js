import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { setImmediate } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

import { createClient } from '@libsql/client';

const PAGE_LIMIT = 500;
const BATCH_SIZE = 64;
const PAGE_BYTES = 4 * 1024 * 1024;
const stores = new Map();
const locks = new Map();

/** A request that cannot safely be applied to a chat. */
export class ChatStoreError extends Error {
    constructor(message, status = 400, code = 'invalid_request') {
        super(message);
        this.status = status;
        this.code = code;
    }
}

/** Serialize file and index mutations, including the legacy JSONL writer. */
export async function withChatFileLock(filePath, action) {
    const key = path.resolve(filePath);
    const previous = locks.get(key) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    locks.set(key, current);
    await previous;
    try {
        return await action();
    } finally {
        release();
        if (locks.get(key) === current) locks.delete(key);
    }
}

function conflict(message) {
    throw new ChatStoreError(message, 409, 'conflict');
}

function integer(value, name, maximum = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
        throw new ChatStoreError(`Invalid ${name}.`);
    }
    return value;
}

function limitValue(value, defaultValue = 50) {
    return integer(value ?? defaultValue, 'limit', PAGE_LIMIT) || 1;
}

function jsonObject(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new ChatStoreError(`Invalid ${name}.`);
    }
    return JSON.stringify(value);
}

function messageMetadata(message) {
    return {
        hash: crypto.createHash('sha256').update(String(message.mes ?? '')).digest('hex'),
        isSystem: message.is_system ? 1 : 0,
        memory: typeof message.extra?.memory === 'string' ? message.extra.memory : null,
    };
}

async function fingerprint(filePath) {
    try {
        const stat = await fs.promises.stat(filePath);
        return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
    } catch (error) {
        if (error.code === 'ENOENT') return 'missing';
        throw error;
    }
}

function cursor(revision, position, direction) {
    return Buffer.from(JSON.stringify({ revision, position, direction })).toString('base64url');
}

function decodeCursor(value, revision, total) {
    let decoded;
    try {
        if (typeof value !== 'string' || value.length > 1000) throw new Error();
        decoded = JSON.parse(Buffer.from(value, 'base64url').toString());
    } catch {
        throw new ChatStoreError('Invalid cursor.');
    }
    integer(decoded.position, 'cursor position', total);
    if (!['before', 'after'].includes(decoded.direction)) throw new ChatStoreError('Invalid cursor direction.');
    if (decoded.revision !== revision) conflict('The chat changed. Reload the page before continuing.');
    return decoded;
}

/**
 * Indexed JSONL chat with separate metadata and body tables.
 *
 * The JSONL file remains an atomically updated compatibility projection. The
 * SQLite database is a disposable index: external file edits rebuild it in a
 * bounded stream. No ordinary page/ID/metadata read parses the complete chat.
 */
export class ChatStore {
    constructor(filePath) {
        this.filePath = path.resolve(filePath);
        this.databasePath = `${this.filePath}.sqlite`;
        this.client = null;
        this.stats = { importedBytes: 0, bodyRowsRead: 0, metadataRowsRead: 0 };
    }

    async initialize() {
        if (this.client) return;
        await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
        this.client = createClient({ url: pathToFileURL(this.databasePath).href });
        await this.client.execute('PRAGMA journal_mode = WAL');
        await this.client.execute('PRAGMA foreign_keys = ON');
        await this.client.execute('PRAGMA cache_size = -4096');
        await this.client.execute('PRAGMA mmap_size = 0');
        await this.client.execute('PRAGMA busy_timeout = 5000');
        await this.client.batch([
            'CREATE TABLE IF NOT EXISTS chat_state (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), revision TEXT NOT NULL, total INTEGER NOT NULL, header_json TEXT NOT NULL, fingerprint TEXT NOT NULL)',
            'CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, seq INTEGER NOT NULL UNIQUE, revision INTEGER NOT NULL, hash TEXT NOT NULL, is_system INTEGER NOT NULL, memory TEXT, body_bytes INTEGER NOT NULL)',
            'CREATE TABLE IF NOT EXISTS message_bodies (id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE, json TEXT NOT NULL)',
            'CREATE INDEX IF NOT EXISTS messages_memory ON messages(seq DESC) WHERE memory IS NOT NULL',
        ], 'write');
    }

    async state(executor = this.client) {
        const result = await executor.execute('SELECT revision, total, header_json, fingerprint FROM chat_state WHERE singleton = 1');
        const row = result.rows[0];
        return row ? { revision: String(row.revision), total: Number(row.total), header: JSON.parse(String(row.header_json)), fingerprint: String(row.fingerprint) } : null;
    }

    async ensureCurrent() {
        await this.initialize();
        const source = await fingerprint(this.filePath);
        const state = await this.state();
        if (state?.fingerprint === source) return state;
        return await this.importJsonl(source);
    }

    async importJsonl(source) {
        const transaction = await this.client.transaction('write');
        let header = {};
        let total = 0;
        let foundHeader = false;
        let stream;
        let lines;
        try {
            await transaction.execute('DELETE FROM message_bodies');
            await transaction.execute('DELETE FROM messages');
            let batch = [];
            let batchBytes = 0;
            if (source !== 'missing') {
                stream = fs.createReadStream(this.filePath, { highWaterMark: 64 * 1024 });
                stream.on('data', chunk => { this.stats.importedBytes += chunk.length; });
                lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
                for await (const line of lines) {
                    let message;
                    try {
                        message = JSON.parse(foundHeader ? line : line.replace(/^\uFEFF/, ''));
                    } catch {
                        continue; // Match the legacy reader's handling of corrupt lines.
                    }
                    if (!message || typeof message !== 'object' || Array.isArray(message)) continue;
                    if (!foundHeader) {
                        foundHeader = true;
                        // Legacy group chats may start directly with a message.
                        const isHeader = ['chat_metadata', 'user_name', 'character_name'].some(key => Object.hasOwn(message, key))
                            || !['mes', 'name', 'is_user'].some(key => Object.hasOwn(message, key));
                        if (isHeader) {
                            header = message;
                            continue;
                        }
                    }
                    const id = crypto.randomUUID();
                    batch.push(...this.insertStatements(id, total++, 1, message));
                    batchBytes += Buffer.byteLength(line);
                    if (batch.length >= BATCH_SIZE * 2 || batchBytes >= PAGE_BYTES) {
                        await transaction.batch(batch);
                        batch = [];
                        batchBytes = 0;
                        await setImmediate();
                    }
                }
                if (batch.length) await transaction.batch(batch);
            }
            if (source !== await fingerprint(this.filePath)) conflict('The chat file changed while its index was being built. Retry the request.');
            const revision = crypto.randomUUID();
            await transaction.execute({
                sql: 'INSERT OR REPLACE INTO chat_state VALUES (1, ?, ?, ?, ?)',
                args: [revision, total, JSON.stringify(header), source],
            });
            await transaction.commit();
            return { revision, total, header, fingerprint: source };
        } catch (error) {
            await transaction.rollback();
            throw error;
        } finally {
            lines?.close();
            stream?.destroy();
            transaction.close();
        }
    }

    insertStatements(id, seq, revision, message) {
        const metadata = messageMetadata(message);
        return [
            { sql: 'INSERT INTO messages (id, seq, revision, hash, is_system, memory, body_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [id, seq, revision, metadata.hash, metadata.isSystem, metadata.memory, Buffer.byteLength(JSON.stringify(message))] },
            { sql: 'INSERT INTO message_bodies (id, json) VALUES (?, ?)', args: [id, JSON.stringify(message)] },
        ];
    }

    async envelopes(executor, start, count) {
        const result = await executor.execute({
            sql: 'SELECT m.id, m.seq, m.revision, b.json FROM messages m JOIN message_bodies b ON b.id = m.id WHERE m.seq >= ? AND m.seq < ? ORDER BY m.seq',
            args: [start, start + count],
        });
        this.stats.bodyRowsRead += result.rows.length;
        return result.rows.map(row => ({ id: String(row.id), revision: Number(row.revision), seq: Number(row.seq), message: JSON.parse(String(row.json)) }));
    }

    async pageResult(state, start, count) {
        const messages = await this.envelopes(this.client, start, count);
        const summary = await this.client.execute('SELECT id, seq, memory FROM messages WHERE memory IS NOT NULL ORDER BY seq DESC LIMIT 1');
        const latest = summary.rows[0];
        const end = start + messages.length;
        return {
            header: state.header,
            revision: state.revision,
            total: state.total,
            start,
            messages,
            before: start > 0 ? cursor(state.revision, start, 'before') : null,
            after: end < state.total ? cursor(state.revision, end, 'after') : null,
            window: { start, ids: messages.map(message => message.id) },
            latestSummary: latest ? { id: String(latest.id), seq: Number(latest.seq), memory: String(latest.memory) } : null,
        };
    }

    async getState() {
        return withChatFileLock(this.filePath, async () => {
            const { revision, total, header } = await this.ensureCurrent();
            return { revision, total, header };
        });
    }

    async page(options = {}) {
        return withChatFileLock(this.filePath, async () => {
            const state = await this.ensureCurrent();
            const limit = limitValue(options.limit);
            let start;
            let count;
            let direction = 'before';
            if (options.cursor !== undefined) {
                if (options.before !== undefined) throw new ChatStoreError('Do not combine cursor and before.');
                const decoded = decodeCursor(options.cursor, state.revision, state.total);
                direction = decoded.direction;
                start = decoded.direction === 'before' ? Math.max(0, decoded.position - limit) : decoded.position;
                count = decoded.direction === 'before' ? decoded.position - start : limit;
            } else {
                const before = options.before === undefined ? state.total : integer(options.before, 'before', state.total);
                start = Math.max(0, before - limit);
                count = before - start;
            }
            count = Math.max(0, Math.min(count, state.total - start));
            const sizes = await this.client.execute({ sql: `SELECT seq, body_bytes FROM messages WHERE seq >= ? AND seq < ? ORDER BY seq ${direction === 'before' ? 'DESC' : 'ASC'}`, args: [start, start + count] });
            let bytes = 0;
            let boundedCount = 0;
            for (const row of sizes.rows) {
                if (boundedCount && bytes + Number(row.body_bytes) > PAGE_BYTES) break;
                bytes += Number(row.body_bytes);
                boundedCount++;
            }
            if (direction === 'before') start += count - boundedCount;
            count = boundedCount;
            return this.pageResult(state, start, Math.min(count, state.total - start));
        });
    }

    async readByIds(ids, expectedRevision) {
        if (!Array.isArray(ids) || ids.length > PAGE_LIMIT || ids.some(id => typeof id !== 'string' || id.length > 100)) throw new ChatStoreError('Invalid message IDs.');
        return withChatFileLock(this.filePath, async () => {
            const state = await this.ensureCurrent();
            if (expectedRevision !== undefined && expectedRevision !== state.revision) conflict('The chat changed. Reload its message metadata.');
            if (!ids.length) return { revision: state.revision, messages: [] };
            const sizes = await this.client.execute({ sql: `SELECT SUM(body_bytes) AS bytes, COUNT(*) AS count FROM messages WHERE id IN (${ids.map(() => '?').join(',')})`, args: ids });
            if (Number(sizes.rows[0].count) > 1 && Number(sizes.rows[0].bytes) > PAGE_BYTES * 4) throw new ChatStoreError('Fetch fewer message IDs per request.', 413, 'payload_too_large');
            const result = await this.client.execute({
                sql: `SELECT m.id, m.seq, m.revision, b.json FROM messages m JOIN message_bodies b ON b.id = m.id WHERE m.id IN (${ids.map(() => '?').join(',')})`,
                args: ids,
            });
            this.stats.bodyRowsRead += result.rows.length;
            const byId = new Map(result.rows.map(row => [String(row.id), { id: String(row.id), revision: Number(row.revision), seq: Number(row.seq), message: JSON.parse(String(row.json)) }]));
            return { revision: state.revision, messages: ids.map(id => byId.get(id)).filter(Boolean) };
        });
    }

    async metadata(options = {}) {
        return withChatFileLock(this.filePath, async () => {
            const state = await this.ensureCurrent();
            if (options.expectedRevision !== undefined && options.expectedRevision !== state.revision) conflict('The chat changed. Restart the metadata scan.');
            const after = options.after === undefined || options.after === -1 ? -1 : integer(options.after, 'after');
            const limit = limitValue(options.limit, 100);
            const result = await this.client.execute({ sql: 'SELECT id, seq, revision, hash, is_system FROM messages WHERE seq > ? ORDER BY seq LIMIT ?', args: [after, limit] });
            this.stats.metadataRowsRead += result.rows.length;
            const items = result.rows.map(row => ({ id: String(row.id), revision: Number(row.revision), seq: Number(row.seq), hash: String(row.hash), is_system: !!row.is_system }));
            const last = items.at(-1)?.seq;
            return { revision: state.revision, total: state.total, items, next: last !== undefined && last + 1 < state.total ? last : null };
        });
    }

    /** Replace an explicitly identified window, preserving all rows outside it. */
    async replaceWindow(payload) {
        return withChatFileLock(this.filePath, async () => {
            const state = await this.ensureCurrent();
            if (!payload.expectedRevision || payload.expectedRevision !== state.revision) conflict('The chat changed. Reload before saving.');
            const start = integer(payload.window?.start, 'window start', state.total);
            const ids = payload.window?.ids;
            if (!Array.isArray(ids) || ids.length > 2000 || start + ids.length > state.total || ids.some(id => typeof id !== 'string')) throw new ChatStoreError('Invalid base window.');
            if (!Array.isArray(payload.messages) || payload.messages.length > 2000) throw new ChatStoreError('Invalid replacement messages.');
            const originals = await this.envelopes(this.client, start, ids.length);
            if (originals.length !== ids.length || originals.some((message, index) => message.id !== ids[index])) conflict('The base message window no longer matches the chat.');
            const originalById = new Map(originals.map(message => [message.id, message]));
            const seen = new Set();
            const replacement = payload.messages.map((envelope, index) => {
                const json = jsonObject(envelope?.message, 'message');
                if (envelope.id !== undefined && typeof envelope.id !== 'string') throw new ChatStoreError('Invalid message ID.');
                const original = envelope.id ? originalById.get(envelope.id) : null;
                if (envelope.id && (!original || seen.has(envelope.id))) throw new ChatStoreError('A replacement ID must belong to the base window exactly once.');
                if (original && envelope.revision !== original.revision) conflict('A message revision changed. Reload before saving.');
                const id = original?.id || crypto.randomUUID();
                seen.add(id);
                const changed = original ? json !== JSON.stringify(original.message) : true;
                return { id, seq: start + index, revision: original ? original.revision + Number(changed) : 1, message: envelope.message };
            });
            const header = payload.header === undefined ? state.header : payload.header;
            const headerJson = jsonObject(header, 'chat header');
            const integrity = state.header?.chat_metadata?.integrity;
            if (integrity && header?.chat_metadata?.integrity !== integrity) conflict('The chat integrity metadata does not match.');
            const unchanged = headerJson === JSON.stringify(state.header)
                && originals.length === replacement.length
                && originals.every((original, index) => original.id === replacement[index].id && original.revision === replacement[index].revision);
            if (unchanged) return this.pageResult(state, start, replacement.length);

            const transaction = await this.client.transaction('write');
            const tempPath = `${this.filePath}.ondemand-${crypto.randomUUID()}.tmp`;
            let projected = false;
            try {
                // Move the untouched suffix out of the unique sequence range.
                const end = start + ids.length;
                const delta = replacement.length - ids.length;
                if (delta) await transaction.execute({ sql: 'UPDATE messages SET seq = -seq - 1 WHERE seq >= ?', args: [end] });
                await transaction.execute({ sql: 'DELETE FROM messages WHERE seq >= ? AND seq < ?', args: [start, end] });
                for (let index = 0; index < replacement.length; index += BATCH_SIZE) {
                    await transaction.batch(replacement.slice(index, index + BATCH_SIZE).flatMap(message => this.insertStatements(message.id, message.seq, message.revision, message.message)));
                }
                if (delta) await transaction.execute({ sql: 'UPDATE messages SET seq = -seq - 1 + ? WHERE seq < 0', args: [delta] });
                const next = { revision: crypto.randomUUID(), total: state.total + replacement.length - ids.length, header };
                await this.writeProjection(transaction, tempPath, headerJson);
                // A plugin or external editor may have changed JSONL while we streamed.
                if (await fingerprint(this.filePath) !== state.fingerprint) conflict('The chat file changed during the save. Reload before saving.');
                await fs.promises.rename(tempPath, this.filePath);
                projected = true;
                const source = await fingerprint(this.filePath);
                await transaction.execute({ sql: 'UPDATE chat_state SET revision = ?, total = ?, header_json = ?, fingerprint = ? WHERE singleton = 1', args: [next.revision, next.total, headerJson, source] });
                await transaction.commit();
                return await this.pageResult(next, start, replacement.length);
            } catch (error) {
                await transaction.rollback();
                // JSONL is renamed before the cache transaction commits. If commit
                // fails, invalidate the fingerprint; the next read rebuilds from
                // the complete, atomically replaced file rather than stale rows.
                if (projected) await this.client.execute('UPDATE chat_state SET fingerprint = \'\' WHERE singleton = 1');
                throw error;
            } finally {
                transaction.close();
                await fs.promises.rm(tempPath, { force: true });
            }
        });
    }

    /** Write the compatibility file without materializing all message bodies. */
    async writeProjection(executor, tempPath, headerJson) {
        const handle = await fs.promises.open(tempPath, 'wx', 0o600);
        try {
            await handle.writeFile(headerJson);
            let after = -1;
            while (true) {
                const metadata = await executor.execute({ sql: 'SELECT seq, body_bytes FROM messages WHERE seq > ? ORDER BY seq LIMIT ?', args: [after, BATCH_SIZE] });
                if (!metadata.rows.length) break;
                let bytes = 0;
                let through = after;
                for (const row of metadata.rows) {
                    if (through !== after && bytes + Number(row.body_bytes) > PAGE_BYTES) break;
                    bytes += Number(row.body_bytes);
                    through = Number(row.seq);
                }
                const result = await executor.execute({ sql: 'SELECT m.seq, b.json FROM messages m JOIN message_bodies b ON b.id = m.id WHERE m.seq > ? AND m.seq <= ? ORDER BY m.seq', args: [after, through] });
                // Count is bounded, including during the necessary full-file projection.
                await handle.writeFile(result.rows.map(row => `\n${row.json}`).join(''));
                after = Number(result.rows.at(-1).seq);
                await setImmediate();
            }
            await handle.sync();
        } finally {
            await handle.close();
        }
    }

    close() {
        this.client?.close();
        this.client = null;
    }
}

/** Obtain a store; its first request checks/rebuilds the disposable index. */
export function getChatStore(filePath) {
    const key = path.resolve(filePath);
    if (!stores.has(key)) stores.set(key, new ChatStore(key));
    const store = stores.get(key);
    stores.delete(key);
    stores.set(key, store);
    // Bound native SQLite page caches across many visited chats. Avoid closing
    // a connection with an active operation; its lock is present until finished.
    for (const [candidate, previous] of stores) {
        if (stores.size <= 8) break;
        if (candidate !== key && !locks.has(candidate)) {
            previous.close();
            stores.delete(candidate);
        }
    }
    return store;
}

/** Remove an index after deleting/renaming its source. Call inside its file lock. */
export async function discardChatStore(filePath) {
    const key = path.resolve(filePath);
    stores.get(key)?.close();
    stores.delete(key);
    await Promise.all(['', '-wal', '-shm'].map(suffix => fs.promises.rm(`${key}.sqlite${suffix}`, { force: true })));
}
