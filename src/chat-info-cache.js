import fs from 'node:fs';
import path from 'node:path';

/**
 * Bounds chat preview reads and retains small, unchanged summaries in memory.
 * Every lookup is validated against a fresh stat by the caller; there is no TTL
 * during which a saved, replaced or externally edited chat may remain stale.
 */
export class ChatInfoCache {
    #entries = new Map();
    #pending = new Map();
    #queue = [];
    #active = 0;
    #bytes = 0;

    constructor({ maxEntries = 256, maxBytes = 8 * 1024 * 1024, maxEntryBytes = 256 * 1024, concurrency = 8 } = {}) {
        this.maxEntries = maxEntries;
        this.maxBytes = maxBytes;
        this.maxEntryBytes = maxEntryBytes;
        this.concurrency = Math.max(1, concurrency);
    }

    /**
     * Includes inode identity and ctime so atomic replacement and same-size
     * edits with a restored mtime invalidate a previously cached summary.
     * @param {import('node:fs').Stats} stats File stats
     * @returns {string} File version
     */
    static version(stats) {
        return [stats.dev, stats.ino, stats.size, stats.mtimeMs, stats.ctimeMs].join(':');
    }

    /**
     * @template T
     * @param {() => Promise<T>} task Read operation
     * @returns {Promise<T>} Task result
     */
    async #run(task) {
        if (this.#active >= this.concurrency) {
            await new Promise(resolve => this.#queue.push(resolve));
        } else {
            this.#active++;
        }

        try {
            return await task();
        } finally {
            const next = this.#queue.shift();
            if (next) next();
            else this.#active--;
        }
    }

    #delete(key) {
        const entry = this.#entries.get(key);
        if (entry) this.#bytes -= entry.bytes;
        this.#entries.delete(key);
    }

    /**
     * Drops both metadata variants when a file disappears.
     * @param {string} filePath Chat file path
     */
    delete(filePath) {
        this.#delete(JSON.stringify([path.resolve(filePath), false]));
        this.#delete(JSON.stringify([path.resolve(filePath), true]));
    }

    /**
     * @param {string} filePath Chat file path
     * @param {import('node:fs').Stats} stats Fresh file stats
     * @param {boolean} withMetadata Whether the header metadata is requested
     * @param {() => Promise<import('./endpoints/chats.js').ChatInfo|null>} read Reads a summary, or null if the file vanished
     * @param {boolean} cacheable False for searches, whose matchers must run independently
     * @returns {Promise<import('./endpoints/chats.js').ChatInfo|null>} A caller-owned summary
     */
    async read(filePath, stats, withMetadata, read, cacheable = true) {
        if (!cacheable) return this.#run(read);

        const key = JSON.stringify([path.resolve(filePath), !!withMetadata]);
        const version = ChatInfoCache.version(stats);
        const cached = this.#entries.get(key);
        if (cached?.version === version) {
            this.#entries.delete(key);
            this.#entries.set(key, cached);
            return JSON.parse(cached.serialized);
        }
        this.#delete(key);

        const pending = this.#pending.get(key);
        if (pending?.version === version) {
            return globalThis.structuredClone(await pending.promise);
        }

        const promise = this.#run(async () => {
            const summary = await read();
            if (summary === null) return summary;

            // A write or rename during the scan must not poison the cache. A
            // failure to re-stat also leaves the result usable but uncached.
            let currentStats;
            try {
                currentStats = await fs.promises.stat(filePath);
            } catch {
                return summary;
            }
            if (ChatInfoCache.version(currentStats) !== version) return summary;

            // Avoid serializing an exceptionally large final message twice.
            if (typeof summary.mes === 'string' && summary.mes.length * 2 > this.maxEntryBytes) return summary;
            const serialized = JSON.stringify(summary);
            const bytes = (key.length + version.length + serialized.length) * 2;
            if (this.maxEntries <= 0 || bytes > this.maxEntryBytes || bytes > this.maxBytes) return summary;

            this.#delete(key);
            while (this.#entries.size >= this.maxEntries || this.#bytes + bytes > this.maxBytes) {
                this.#delete(this.#entries.keys().next().value);
            }
            this.#entries.set(key, { version, serialized, bytes });
            this.#bytes += bytes;
            return summary;
        });
        const entry = { version, promise };

        // The queue already limits open streams; also cap retained deduplication
        // keys when a client asks for an unusually large directory at once.
        if (this.#pending.size < this.maxEntries) this.#pending.set(key, entry);
        try {
            return await promise;
        } finally {
            if (this.#pending.get(key) === entry) this.#pending.delete(key);
        }
    }
}
