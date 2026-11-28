// Offline tuning against a cloned benchmark DB. Never edits the source index.
// Example: node --expose-gc tests/performance/vector-tuning.mjs --source-root .../disk
//   --variant-root .../sl1024-f8 --baseline .../vector-baseline.json --output .../variant.json
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient } from '@libsql/client';
import { DiskVectorIndex, vectorStorePath } from '../../src/vectors/disk-index.js';

const { values } = parseArgs({ options: {
    'source-root': { type: 'string' }, 'variant-root': { type: 'string' }, baseline: { type: 'string' }, output: { type: 'string' },
    dimensions: { type: 'string', default: '768' }, count: { type: 'string', default: '18000' },
    'search-l': { type: 'string', default: '512' }, 'insert-l': { type: 'string', default: '70' },
    compression: { type: 'string', default: 'float8' }, alpha: { type: 'string', default: '1.2' },
    'max-neighbors': { type: 'string' }, candidates: { type: 'string', default: '40' },
    repeats: { type: 'string', default: '3' }, reuse: { type: 'boolean', default: false },
} });
for (const key of ['source-root', 'variant-root', 'baseline', 'output']) if (!values[key]) throw new Error(`--${key} is required`);
const dimensions = Number(values.dimensions);
const count = Number(values.count);
const repeats = Number(values.repeats);
const candidateCount = Number(values.candidates);
const settings = {
    search_l: Number(values['search-l']), insert_l: Number(values['insert-l']),
    compress_neighbors: values.compression, alpha: Number(values.alpha),
};
if (values['max-neighbors']) settings.max_neighbors = Number(values['max-neighbors']);
if (!['float8', 'float16', 'float32'].includes(settings.compress_neighbors)) throw new Error('Unsupported compression');
for (const [key, value] of Object.entries(settings)) if (key !== 'compress_neighbors' && (!Number.isFinite(value) || value <= 0)) throw new Error(`Invalid ${key}`);
const source = vectorStorePath(values['source-root'], 'synthetic-chat', 'synthetic', { model: `synthetic-${dimensions}`, apiUrl: '', transform: 'benchmark-v1' });
const target = path.resolve(values['variant-root'], 'index.sqlite');
if (target === source) throw new Error('The variant must be separate from the source');
const sourceStat = await fsp.stat(source);
const baseline = JSON.parse(await fsp.readFile(values.baseline, 'utf8'));
if (baseline.dimensions !== dimensions || baseline.count !== count) throw new Error('Baseline dimensions/count mismatch');
await fsp.mkdir(path.dirname(target), { recursive: true });
await fsp.mkdir(path.dirname(path.resolve(values.output)), { recursive: true });

function random(seed) {
    let state = seed >>> 0 || 1;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32 - 0.5; };
}
function vector(index) {
    const center = random((index % 64 + 1) * 2246822519);
    const noise = random((index + 1) * 2654435761);
    const perturbation = random((index + 7) * 1597334677);
    return Array.from({ length: dimensions }, () => Math.fround(center() + 0.55 * noise() + 0.04 * perturbation()));
}
const queries = baseline.trials.map((_, index) => vector((index * 7919 + 123) % count));
const result = {
    source, target, dimensions, count, candidateCount, repeats, settings, trials: [],
    syntheticVectors: baseline.syntheticVectors,
    note: 'Same seeded query vectors and exact Vectra top-10 baseline. Random DiskANN start node differs per search. No semantic/embedding-quality claim.',
    eventLoopProtocol: 'Before each timed operation: setImmediate, optional GC, setImmediate; closed native handles can finalize between requests as on the HTTP worker.',
};
const started = performance.now();
if (!values.reuse) {
    if (fs.existsSync(target)) throw new Error('Variant already exists; choose another directory or --reuse');
    if (fs.existsSync(source + '-wal') || fs.existsSync(source + '-journal')) throw new Error('Source has an active journal; wait for a stable baseline');
    await fsp.copyFile(source, target, fs.constants.COPYFILE_FICLONE);
    console.log(JSON.stringify({ phase: 'cloned', sourceBytes: sourceStat.size, settings, target }));
    const client = createClient({ url: pathToFileURL(target).href });
    try {
        await client.execute('PRAGMA cache_size=-8192');
        await client.execute('PRAGMA mmap_size=0');
        await client.execute('DROP INDEX records_ann');
        const indexStarted = performance.now();
        const parameters = Object.entries(settings).map(([key, value]) => `'${key}=${value}'`).join(', ');
        await client.execute(`CREATE INDEX records_ann ON records(libsql_vector_idx(embedding, 'metric=cosine', ${parameters}))`);
        result.buildMs = performance.now() - indexStarted;
        console.log(JSON.stringify({ phase: 'indexed', elapsedMs: result.buildMs, allocatedBytes: (await fsp.stat(target)).size }));
        const vacuumStarted = performance.now();
        await client.execute('VACUUM');
        result.vacuumMs = performance.now() - vacuumStarted;
    } finally {
        client.close();
    }
}
result.databaseBytes = (await fsp.stat(target)).size;
{
    const client = createClient({ url: pathToFileURL(target).href });
    try {
        const schema = await client.execute('SELECT sql FROM sqlite_master WHERE name=\'records_ann\'');
        result.indexSql = schema.rows[0]?.sql;
        for (const [key, value] of Object.entries(settings)) {
            if (!result.indexSql?.includes(`${key}=${value}`)) throw new Error(`Variant DDL does not match requested ${key}`);
        }
        const rows = await client.execute('SELECT count(*) AS count FROM records');
        if (Number(rows.rows[0].count) !== count) throw new Error('Variant vector count differs from baseline');
    } finally {
        client.close();
    }
}
for (let repeat = 0; repeat < repeats; repeat++) {
    for (const [index, query] of queries.entries()) {
        await new Promise(resolve => setImmediate(resolve));
        global.gc?.();
        await new Promise(resolve => setImmediate(resolve));
        const start = performance.now();
        const store = new DiskVectorIndex(createClient({ url: pathToFileURL(target).href }));
        let refs;
        let bodyBytes;
        try {
            await store.initialize();
            refs = (await store.query(query, candidateCount, -1)).slice(0, 10);
            const bodies = await store.bodies(refs.map(x => x.id));
            bodyBytes = bodies.reduce((sum, body) => sum + Buffer.byteLength(body.text), 0);
        } finally {
            store.close();
        }
        const expected = new Set(baseline.trials[index].hashes);
        result.trials.push({ repeat, index, elapsedMs: performance.now() - start,
            recall: refs.filter(x => expected.has(x.hash)).length / 10,
            hashes: refs.map(x => x.hash), bodyBytes,
            heapUsedMiB: process.memoryUsage().heapUsed / 2 ** 20, rssMiB: process.memoryUsage().rss / 2 ** 20,
        });
    }
    const trials = result.trials.filter(x => x.repeat === repeat);
    console.log(JSON.stringify({ phase: 'queries', repeat, averageRecall: trials.reduce((sum, trial) => sum + trial.recall, 0) / trials.length, minimumRecall: Math.min(...trials.map(x => x.recall)) }));
}
const elapsed = result.trials.map(x => x.elapsedMs).sort((a, b) => a - b);
result.averageRecall = result.trials.reduce((sum, trial) => sum + trial.recall, 0) / result.trials.length;
result.minimumRecall = Math.min(...result.trials.map(x => x.recall));
result.repeatsSummary = Array.from({ length: repeats }, (_, repeat) => {
    const trials = result.trials.filter(x => x.repeat === repeat);
    return { repeat, averageRecall: trials.reduce((sum, trial) => sum + trial.recall, 0) / trials.length, minimumRecall: Math.min(...trials.map(x => x.recall)) };
});
result.medianMs = elapsed[Math.floor(elapsed.length / 2)];
result.p95Ms = elapsed[Math.ceil(elapsed.length * 0.95) - 1];
result.elapsedMs = performance.now() - started;
result.maxRssMiB = process.resourceUsage().maxRSS / 1024;
result.maxQueryRssMiB = Math.max(...result.trials.map(x => x.rssMiB));
const finalSource = await fsp.stat(source);
if (finalSource.size !== sourceStat.size || finalSource.mtimeMs !== sourceStat.mtimeMs) throw new Error('Source changed during tuning; discard this comparison');
await fsp.writeFile(values.output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ phase: 'complete', averageRecall: result.averageRecall, minimumRecall: result.minimumRecall,
    medianMs: result.medianMs, p95Ms: result.p95Ms, databaseBytes: result.databaseBytes,
    buildMs: result.buildMs, maxRssMiB: result.maxRssMiB, output: values.output,
}));
