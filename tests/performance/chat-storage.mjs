import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ChatStore } from '../../src/chat-store.js';

const { values } = parseArgs({ options: {
    fixture: { type: 'string' }, scratch: { type: 'string' }, output: { type: 'string' },
} });
if (!values.fixture || !values.scratch || !values.output) throw new Error('--fixture, --scratch (new directory), --output are required');
await fs.mkdir(values.scratch); // Never overwrite a previous run or a real chat.
const file = path.join(values.scratch, 'synthetic.jsonl');
await fs.copyFile(values.fixture, file);
const store = new ChatStore(file);
const result = { fixtureBytes: (await fs.stat(file)).size, trials: [], cache: 'OS file cache is not flushed; sidecar initially absent.' };
const timed = async (label, callback) => {
    const before = { ...store.stats };
    const start = performance.now();
    const value = await callback();
    const elapsedMs = performance.now() - start;
    const delta = Object.fromEntries(Object.entries(store.stats).map(([key, count]) => [key, count - before[key]]));
    result.trials.push({ label, elapsedMs, ...delta, rssMiB: process.memoryUsage().rss / 2 ** 20 });
    return value;
};
try {
    const first = await timed('firstIndexAndPage', () => store.page({ limit: 100 }));
    result.total = first.total;
    assert.equal(first.messages.length, 100);
    for (let i = 0; i < 20; i++) {
        const before = 100 + (i * 7919) % (first.total - 100);
        const page = await timed('indexedPage100', () => store.page({ before, limit: 100 }));
        assert.equal(page.messages.length, 100);
        assert.equal(result.trials.at(-1).importedBytes, 0);
        assert.equal(result.trials.at(-1).bodyRowsRead, 100);
    }
    const refs = [];
    for (let i = 0; i < 10; i++) {
        const metadata = await store.metadata({ after: Math.floor(i * first.total / 10) - 1, limit: 1 });
        refs.push(metadata.items[0].id);
    }
    const selected = await timed('selected10Bodies', () => store.readByIds(refs, first.revision));
    assert.equal(selected.messages.length, 10);
    const edit = await store.page({ before: 101, limit: 1 });
    edit.messages[0].message.mes += '\nSynthetic storage write benchmark';
    const saved = await timed('editOneWithJsonlProjection', () => store.replaceWindow({
        expectedRevision: edit.revision, window: edit.window, header: edit.header, messages: edit.messages,
    }));
    assert.equal(saved.total, first.total);
    const after = await store.page({ before: 101, limit: 1 });
    assert.match(after.messages[0].message.mes, /Synthetic storage write benchmark$/);
    result.sidecarBytes = (await fs.stat(`${file}.sqlite`)).size;
    const pages = result.trials.filter(x => x.label === 'indexedPage100').map(x => x.elapsedMs).sort((a, b) => a - b);
    result.pageMedianMs = (pages[9] + pages[10]) / 2;
    result.pageP95Ms = pages[Math.ceil(pages.length * .95) - 1];
    result.maxRssMiB = process.resourceUsage().maxRSS / 1024;
    result.success = true;
} finally {
    store.close();
    await fs.mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
    await fs.writeFile(values.output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
}
