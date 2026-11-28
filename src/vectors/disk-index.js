import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import sanitize from 'sanitize-filename';

const MAX_BATCH = 500;
const queues = new Map();
export const VECTOR_INDEX_SETTINGS_VERSION = 2;
export const VECTOR_INDEX_SQL = `CREATE INDEX records_ann ON records(libsql_vector_idx(embedding,
    'metric=cosine', 'compress_neighbors=float8', 'search_l=512', 'insert_l=70', 'alpha=1.2'))`;
const INDEX_PARAMETERS = ['metric=cosine', 'compress_neighbors=float8', 'search_l=512', 'insert_l=70', 'alpha=1.2'];

function digest(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Every user/collection/provider profile has its own DiskANN graph. */
export function vectorStorePath(root, collectionId, source, profile) {
    return path.join(root, '.diskann', digest(source), digest(collectionId), digest(profile), 'index.sqlite');
}

function validateVector(vector, dimensions) {
    if (!Array.isArray(vector) || !vector.length || vector.length > 65536 ||
        vector.some(x => !Number.isFinite(x)) || !vector.some(x => x !== 0) ||
        (dimensions && vector.length !== dimensions)) {
        throw new TypeError('Invalid vector or embedding dimension does not match this profile');
    }
}

/** Stream the old Vectra items, retaining at most one record and one input chunk. */
async function* legacyItems(file) {
    let prefix = '';
    let started = false;
    let body = '';
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let ended = false;
    for await (let chunk of fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 64 * 1024 })) {
        if (!started) {
            prefix += chunk;
            const match = /"items"\s*:\s*\[/.exec(prefix);
            if (!match) {
                if (prefix.length > 1024 * 1024) throw new SyntaxError('Invalid Vectra header');
                continue;
            }
            chunk = prefix.slice(match.index + match[0].length);
            prefix = '';
            started = true;
        }
        for (const char of chunk) {
            if (!depth) {
                if (char === ']') { ended = true; break; }
                if (/[\s,]/.test(char)) continue;
                if (char !== '{') throw new SyntaxError('Invalid Vectra item');
            }
            body += char;
            if (quoted) {
                if (escaped) escaped = false;
                else if (char === '\\') escaped = true;
                else if (char === '"') quoted = false;
            } else if (char === '"') quoted = true;
            else if (char === '{' || char === '[') depth++;
            else if (char === '}' || char === ']') depth--;
            if (!depth) {
                yield JSON.parse(body);
                body = '';
            }
        }
        if (ended) break;
    }
    if (!started || !ended || depth) throw new SyntaxError('Truncated Vectra index; original data was preserved');
}

export class DiskVectorIndex {
    constructor(client, { upgradeIndexes = false } = {}) {
        this.client = client;
        this.dimensions = 0;
        this.upgradeIndexes = upgradeIndexes;
    }

    async initialize() {
        await this.client.execute('PRAGMA cache_size=-2048');
        await this.client.execute('PRAGMA mmap_size=0');
        await this.client.execute('PRAGMA busy_timeout=5000');
        await this.client.execute('PRAGMA foreign_keys=ON');
        await this.client.execute('CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        const result = await this.client.execute('SELECT value FROM state WHERE key=\'dimensions\'');
        this.dimensions = Number(result.rows[0]?.value || 0);
        if (this.dimensions && this.upgradeIndexes) await this.ensureIndexSettings();
    }

    async ensureIndexSettings() {
        const result = await this.client.execute(`SELECT
            (SELECT sql FROM sqlite_master WHERE name='records_ann') AS sql,
            (SELECT value FROM state WHERE key='ann_settings_version') AS version`);
        const sql = String(result.rows[0]?.sql || '').toLowerCase();
        const current = INDEX_PARAMETERS.every(parameter => sql.includes(`'${parameter}'`));
        if (!current) {
            // Atomic, local rebuild from existing F32 vectors. No body reads or
            // embedding provider calls, and a failed rebuild rolls back the old index.
            await this.client.batch([
                'DROP INDEX IF EXISTS records_ann', VECTOR_INDEX_SQL,
                { sql: 'INSERT OR REPLACE INTO state VALUES (\'ann_settings_version\', ?)', args: [String(VECTOR_INDEX_SETTINGS_VERSION)] },
            ], 'write');
        } else if (Number(result.rows[0].version) !== VECTOR_INDEX_SETTINGS_VERSION) {
            await this.client.execute({
                sql: 'INSERT OR REPLACE INTO state VALUES (\'ann_settings_version\', ?)', args: [String(VECTOR_INDEX_SETTINGS_VERSION)],
            });
        }
    }

    async ensureDimensions(dimensions) {
        if (this.dimensions) {
            if (this.dimensions !== dimensions) throw new TypeError('Embedding dimension changed; select a different profile or purge the index');
            return;
        }
        await this.client.batch([
            `CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT, item_key TEXT NOT NULL UNIQUE, hash INTEGER NOT NULL,
                message_id TEXT, version TEXT, swipe_id TEXT, position INTEGER NOT NULL,
                chunk INTEGER NOT NULL, embedding F32_BLOB(${dimensions}) NOT NULL
            )`,
            VECTOR_INDEX_SQL,
            'CREATE INDEX IF NOT EXISTS records_hash ON records(hash)',
            'CREATE INDEX IF NOT EXISTS records_message ON records(message_id)',
            'CREATE TABLE IF NOT EXISTS bodies (id INTEGER PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE, text TEXT NOT NULL)',
            { sql: 'INSERT OR REPLACE INTO state VALUES (\'dimensions\', ?)', args: [String(dimensions)] },
            { sql: 'INSERT OR REPLACE INTO state VALUES (\'ann_settings_version\', ?)', args: [String(VECTOR_INDEX_SETTINGS_VERSION)] },
        ], 'write');
        this.dimensions = dimensions;
    }

    async upsert(items, { replaceMessages = true } = {}) {
        if (!items.length) return;
        if (items.length > MAX_BATCH) throw new RangeError(`At most ${MAX_BATCH} vector chunks per batch`);
        for (const item of items) validateVector(item.vector, this.dimensions || items[0].vector.length);
        await this.ensureDimensions(items[0].vector.length);
        const statements = [];
        if (replaceMessages) {
            for (const id of new Set(items.map(x => x.messageId).filter(Boolean))) {
                statements.push({ sql: 'DELETE FROM records WHERE message_id=?', args: [String(id)] });
            }
        }
        for (const item of items) {
            const messageId = item.messageId == null ? null : String(item.messageId);
            const chunk = Number(item.chunk) || 0;
            const key = item.id || (messageId ? `message:${messageId}:${chunk}` : `hash:${item.hash}:${item.index}:${chunk}:${digest(item.text)}`);
            statements.push({
                sql: `INSERT INTO records(item_key, hash, message_id, version, swipe_id, position, chunk, embedding)
                    VALUES (?, ?, ?, ?, ?, ?, ?, vector32(?))
                    ON CONFLICT(item_key) DO UPDATE SET hash=excluded.hash, message_id=excluded.message_id,
                    version=excluded.version, swipe_id=excluded.swipe_id, position=excluded.position,
                    chunk=excluded.chunk, embedding=excluded.embedding`,
                args: [String(key), Number(item.hash), messageId, item.version == null ? null : String(item.version),
                    item.swipeId == null ? null : String(item.swipeId), Number(item.index) || 0, chunk, JSON.stringify(item.vector)],
            });
            statements.push({
                sql: 'INSERT OR REPLACE INTO bodies(id, text) SELECT id, ? FROM records WHERE item_key=?',
                args: [String(item.text ?? ''), String(key)],
            });
        }
        await this.client.batch(statements, 'write');
    }

    async query(vector, topK = 10, threshold = 0) {
        if (!this.dimensions) return [];
        validateVector(vector, this.dimensions);
        const count = Math.max(1, Math.min(500, Math.floor(topK) || 10));
        const encoded = JSON.stringify(vector);
        // The distance function scores only the bounded ANN candidates, never the full table.
        const result = await this.client.execute({
            sql: `SELECT r.id, r.hash, r.message_id, r.version, r.swipe_id, r.position, r.chunk,
                    1-vector_distance_cos(r.embedding, vector32(?)) AS score
                FROM vector_top_k('records_ann', vector32(?), ?) AS candidates
                JOIN records AS r ON r.id=candidates.id ORDER BY score DESC`,
            args: [encoded, encoded, count],
        });
        return result.rows.filter(x => Number(x.score) >= threshold).map(x => ({
            id: String(x.id), hash: Number(x.hash), index: Number(x.position), chunk: Number(x.chunk),
            messageId: x.message_id, version: x.version, swipeId: x.swipe_id, score: Number(x.score),
        }));
    }

    async bodies(ids) {
        if (!this.dimensions || !ids.length) return [];
        if (ids.length > MAX_BATCH) throw new RangeError('Too many vector body IDs');
        const result = await this.client.execute({
            sql: `SELECT id, text FROM bodies WHERE id IN (${ids.map(() => '?').join(',')})`, args: ids.map(String),
        });
        return result.rows.map(x => ({ id: String(x.id), text: String(x.text) }));
    }

    async hashes() {
        if (!this.dimensions) return [];
        const result = await this.client.execute('SELECT hash FROM records');
        return result.rows.map(x => Number(x.hash));
    }

    async stats() {
        if (!this.dimensions) return { chunks: 0, messages: 0, uniqueHashes: 0 };
        const result = await this.client.execute('SELECT count(*) AS chunks, count(DISTINCT message_id) AS messages, count(DISTINCT hash) AS uniqueHashes FROM records');
        return Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]));
    }

    async messageState(messageIds) {
        if (!this.dimensions || !messageIds.length) return [];
        if (messageIds.length > MAX_BATCH) throw new RangeError('Too many message IDs');
        const result = await this.client.execute({
            sql: `SELECT DISTINCT message_id, version, swipe_id FROM records WHERE message_id IN (${messageIds.map(() => '?').join(',')})`,
            args: messageIds.map(String),
        });
        return result.rows.map(x => ({ messageId: String(x.message_id), version: x.version, swipeId: x.swipe_id }));
    }

    async deleteHashes(hashes) {
        if (!this.dimensions || !hashes.length) return;
        for (let i = 0; i < hashes.length; i += MAX_BATCH) {
            const batch = hashes.slice(i, i + MAX_BATCH);
            await this.client.execute({ sql: `DELETE FROM records WHERE hash IN (${batch.map(() => '?').join(',')})`, args: batch.map(Number) });
        }
    }

    async deleteMessages(ids) {
        if (!this.dimensions || !ids.length) return;
        if (ids.length > MAX_BATCH) throw new RangeError('Too many deleted message IDs');
        await this.client.execute({ sql: `DELETE FROM records WHERE message_id IN (${ids.map(() => '?').join(',')})`, args: ids.map(String) });
    }

    async migrate(legacyPath, claim) {
        const done = await this.client.execute('SELECT value FROM state WHERE key=\'legacy_migrated\'');
        if (done.rows.length) return;
        const file = path.join(legacyPath, 'index.json');
        if (fs.existsSync(file)) {
            // Old Vectra stores did not record endpoint/transform identity. A legacy
            // directory may be claimed only by its exact, unambiguous default scope.
            const claimPath = path.join(legacyPath, '.diskann-claim.json');
            try {
                await fs.promises.writeFile(claimPath, JSON.stringify(claim), { flag: 'wx' });
            } catch (error) {
                if (error.code !== 'EEXIST') throw error;
                const existing = JSON.parse(await fs.promises.readFile(claimPath, 'utf8'));
                if (JSON.stringify(existing) !== JSON.stringify(claim)) return;
            }
            let batch = [];
            for await (const item of legacyItems(file)) {
                let metadata = item.metadata || {};
                if (item.metadataFile && path.basename(item.metadataFile) === item.metadataFile) {
                    metadata = JSON.parse(await fs.promises.readFile(path.join(legacyPath, item.metadataFile), 'utf8'));
                }
                batch.push({ ...metadata, id: `legacy:${item.id}`, vector: item.vector });
                if (batch.length >= 100) {
                    await this.upsert(batch, { replaceMessages: false });
                    batch = [];
                }
            }
            await this.upsert(batch, { replaceMessages: false });
        }
        // The old files remain untouched; an interrupted import can safely replay the same keys.
        await this.client.execute('INSERT INTO state VALUES (\'legacy_migrated\', \'1\')');
    }

    close() {
        this.client.close();
    }
}

/** Open only for the lifetime of an operation; idle collections retain no native page cache. */
export async function withVectorStore(root, collectionId, source, profile, callback, options = {}) {
    const filename = vectorStorePath(root, collectionId, source, profile);
    const previous = queues.get(filename) || Promise.resolve();
    const run = previous.catch(() => {}).then(async () => {
        await fs.promises.mkdir(path.dirname(filename), { recursive: true });
        const store = new DiskVectorIndex(createClient({ url: pathToFileURL(filename).href }), options);
        try {
            await store.initialize();
            const model = profile.model || '';
            const legacyCompatible = source === sanitize(source) && collectionId === sanitize(collectionId) &&
                model === sanitize(model) && !profile.apiUrl && !profile.transform &&
                Object.keys(profile).every(key => ['model', 'apiUrl', 'transform'].includes(key));
            if (legacyCompatible) {
                await store.migrate(path.join(root, source, collectionId, model), { source, collectionId, model, profile: digest(profile) });
            }
            return await callback(store);
        } finally {
            store.close();
        }
    });
    queues.set(filename, run);
    try {
        return await run;
    } finally {
        if (queues.get(filename) === run) queues.delete(filename);
    }
}

export async function purgeVectorStores(root, collectionId) {
    await Promise.allSettled([...queues.values()]);
    const base = path.join(root, '.diskann');
    if (collectionId == null) {
        await fs.promises.rm(base, { recursive: true, force: true });
        return;
    }
    for (const source of await fs.promises.readdir(base).catch(() => [])) {
        await fs.promises.rm(path.join(base, source, digest(collectionId)), { recursive: true, force: true });
    }
}

/** An explicit chat deletion invalidates that message in every provider profile. */
export async function deleteMessageProfiles(root, collectionId, ids) {
    if (!Array.isArray(ids) || ids.length > MAX_BATCH) throw new RangeError('Too many deleted message IDs');
    const base = path.join(root, '.diskann');
    for (const source of await fs.promises.readdir(base).catch(() => [])) {
        const collectionPath = path.join(base, source, digest(collectionId));
        for (const profile of await fs.promises.readdir(collectionPath).catch(() => [])) {
            const filename = path.join(collectionPath, profile, 'index.sqlite');
            if (!fs.existsSync(filename)) continue;
            const store = new DiskVectorIndex(createClient({ url: pathToFileURL(filename).href }));
            try {
                await store.initialize();
                await store.deleteMessages(ids);
            } finally {
                store.close();
            }
        }
    }
}
