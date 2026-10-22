import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { ChatInfoCache } from '../src/chat-info-cache.js';

process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';
const { createChatSearchMatcher, getChatInfo } = await import('../src/endpoints/chats.js');

function jsonl(message = 'First message', metadata = { note: 'original' }) {
    return [
        { chat_metadata: metadata },
        { name: 'Character', mes: message, send_date: '2026-01-01' },
    ].map(value => JSON.stringify(value)).join('\n');
}

async function fixture(t, count = 1) {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'st-info-cache-'));
    t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
    const files = Array.from({ length: count }, (_, i) => path.join(root, `${i}.jsonl`));
    await Promise.all(files.map(file => fs.promises.writeFile(file, jsonl())));
    return files;
}

function countStreams(t) {
    const original = fs.createReadStream;
    const counts = { total: 0, active: 0, peak: 0 };
    t.mock.method(fs, 'createReadStream', (...args) => {
        counts.total++;
        counts.peak = Math.max(counts.peak, ++counts.active);
        const stream = original(...args);
        stream.once('close', () => counts.active--);
        return stream;
    });
    return counts;
}

test('unchanged summaries avoid content reads and isolate caller data and metadata', async (t) => {
    const [file] = await fixture(t);
    const counts = countStreams(t);
    const first = await getChatInfo(file, { avatar: 'first.png' }, true);
    first.chat_metadata.note = 'mutated by caller';
    const second = await getChatInfo(file, { group: 'second' }, true);
    assert.equal(counts.total, 1);
    assert.equal(second.chat_metadata.note, 'original');
    assert.equal(second.group, 'second');
    assert.equal(second.avatar, undefined);
    assert.equal(first.group, undefined);

    const withoutMetadata = await getChatInfo(file);
    assert.equal(withoutMetadata.chat_metadata, undefined);
    await getChatInfo(file);
    assert.equal(counts.total, 2);
});

test('simultaneous summaries share one scan without sharing mutable metadata', async (t) => {
    const [file] = await fixture(t);
    const counts = countStreams(t);
    const summaries = await Promise.all(Array.from({ length: 20 }, () => getChatInfo(file, {}, true)));
    assert.equal(counts.total, 1);
    summaries[0].chat_metadata.note = 'changed';
    assert.ok(summaries.slice(1).every(summary => summary.chat_metadata.note === 'original'));
});

test('same names in different user directories cannot share a summary', async (t) => {
    const [first] = await fixture(t);
    const [second] = await fixture(t);
    await fs.promises.writeFile(second, jsonl('Another user'));
    assert.equal((await getChatInfo(first)).mes, 'First message');
    assert.equal((await getChatInfo(second)).mes, 'Another user');
});

test('edits, atomic replacement, rename, deletion and recreation invalidate summaries', async (t) => {
    const [file] = await fixture(t);
    await getChatInfo(file);
    const previous = await fs.promises.stat(file);
    await fs.promises.writeFile(file, jsonl('Other message'));
    await fs.promises.utimes(file, previous.atime, previous.mtime);
    assert.equal((await getChatInfo(file)).mes, 'Other message');

    const replacement = `${file}.replacement`;
    await fs.promises.writeFile(replacement, jsonl('Third message'));
    await fs.promises.utimes(replacement, previous.atime, previous.mtime);
    await fs.promises.rename(replacement, file);
    assert.equal((await getChatInfo(file)).mes, 'Third message');

    const renamed = `${file}.renamed`;
    await fs.promises.rename(file, renamed);
    assert.deepEqual(await getChatInfo(file), { match: false });
    assert.equal((await getChatInfo(renamed)).file_name, path.basename(renamed));
    await fs.promises.writeFile(file, jsonl('Recreated message'));
    assert.equal((await getChatInfo(file)).mes, 'Recreated message');
    await fs.promises.unlink(file);
    assert.deepEqual(await getChatInfo(file), { match: false });
});

test('searches always inspect content independently of cached previews and each other', async (t) => {
    const [file] = await fixture(t);
    const counts = countStreams(t);
    await getChatInfo(file);
    const [matching, absent] = await Promise.all([
        getChatInfo(file, {}, false, createChatSearchMatcher(['first'])),
        getChatInfo(file, {}, false, createChatSearchMatcher(['missing'])),
    ]);
    assert.equal(matching.match, true);
    assert.equal(absent.match, false);
    assert.equal((await getChatInfo(file)).match, true);
    assert.equal(counts.total, 3);
});

test('large directory requests keep at most eight streams open and close every descriptor', async (t) => {
    const files = await fixture(t, 80);
    const counts = countStreams(t);
    const results = await Promise.all(files.map(file => getChatInfo(file)));
    assert.equal(results.length, 80);
    assert.ok(results.every(summary => summary.chat_items === 1));
    assert.equal(counts.total, 80);
    assert.ok(counts.peak <= 8, `Opened ${counts.peak} simultaneous streams`);
    assert.equal(counts.active, 0);
});

test('stat identity detects same-size edits even when the mtime is preserved', () => {
    const base = { dev: 1, ino: 2, size: 3, mtimeMs: 4, ctimeMs: 5 };
    for (const key of Object.keys(base)) {
        assert.notEqual(ChatInfoCache.version(base), ChatInfoCache.version({ ...base, [key]: 10 }));
    }
});

test('a file changed during a scan is not cached under the old or the new version', async (t) => {
    const [file] = await fixture(t);
    const cache = new ChatInfoCache();
    const oldStats = await fs.promises.stat(file);
    let reads = 0;
    const first = await cache.read(file, oldStats, false, async () => {
        reads++;
        await fs.promises.writeFile(file, jsonl('changed while reading'));
        return { mes: 'mixed content' };
    });
    assert.equal(first.mes, 'mixed content');
    const newStats = await fs.promises.stat(file);
    const second = await cache.read(file, newStats, false, async () => {
        reads++;
        return { mes: 'correct content' };
    });
    assert.equal(second.mes, 'correct content');
    assert.equal(reads, 2);
});

test('failed and vanished reads are not cached and release the queue slot', async (t) => {
    const [file] = await fixture(t);
    const cache = new ChatInfoCache({ concurrency: 1 });
    const stats = await fs.promises.stat(file);
    const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    await assert.rejects(cache.read(file, stats, false, async () => { throw denied; }), denied);
    assert.equal(await cache.read(file, stats, false, async () => null), null);
    assert.deepEqual(await cache.read(file, stats, false, async () => ({ mes: 'recovered' })), { mes: 'recovered' });
});

test('stream failures reject the scan, close the stream and allow a later retry', async (t) => {
    const [file] = await fixture(t);
    const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const stream = new Readable({ read() { this.destroy(denied); } });
    const mocked = t.mock.method(fs, 'createReadStream', () => stream);
    await assert.rejects(getChatInfo(file), denied);
    assert.equal(stream.closed, true);
    mocked.mock.restore();
    assert.equal((await getChatInfo(file)).mes, 'First message');
});

test('cache evicts the least recently used summary at the entry limit', async (t) => {
    const files = await fixture(t, 3);
    const cache = new ChatInfoCache({ maxEntries: 2 });
    const reads = [0, 0, 0];
    const read = async (index) => cache.read(files[index], await fs.promises.stat(files[index]), false, async () => {
        reads[index]++;
        return { mes: String(index) };
    });
    await read(0);
    await read(1);
    await read(0);
    await read(2);
    await read(0);
    await read(1);
    assert.deepEqual(reads, [1, 2, 1]);
});

test('byte limits evict summaries and oversized entries bypass retention', async (t) => {
    const files = await fixture(t, 2);
    const stats = await Promise.all(files.map(file => fs.promises.stat(file)));
    const summary = { mes: 'x'.repeat(200) };
    const entryBytes = (JSON.stringify([path.resolve(files[0]), false]).length
        + ChatInfoCache.version(stats[0]).length + JSON.stringify(summary).length) * 2;
    const cache = new ChatInfoCache({ maxBytes: entryBytes + 40, maxEntryBytes: entryBytes + 40 });
    let reads = 0;
    const read = (index) => cache.read(files[index], stats[index], false, async () => {
        reads++;
        return summary;
    });
    await read(0);
    await read(1);
    await read(0);
    assert.equal(reads, 3);

    const small = new ChatInfoCache({ maxEntryBytes: 100 });
    let oversizedReads = 0;
    const oversized = () => small.read(files[0], stats[0], false, async () => {
        oversizedReads++;
        return summary;
    });
    await oversized();
    await oversized();
    assert.equal(oversizedReads, 2);
});
