import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { once } from 'node:events';
import { parseArgs } from 'node:util';
import vectra from 'vectra';
import { withVectorStore } from '../../src/vectors/disk-index.js';

const { values } = parseArgs({ options: {
    phase: { type: 'string' }, root: { type: 'string' }, fixture: { type: 'string' },
    dimensions: { type: 'string', default: '768' }, count: { type: 'string', default: '18000' },
    queries: { type: 'string', default: '20' }, candidates: { type: 'string', default: '40' }, output: { type: 'string' },
} });
if (!values.root || !values.phase || !values.output) throw new Error('--root, --phase and --output are required');
const dimensions = Number(values.dimensions);
const count = Number(values.count);
const profile = { model: `synthetic-${dimensions}`, apiUrl: '', transform: 'benchmark-v1' };
const use = callback => withVectorStore(path.join(values.root, 'disk'), 'synthetic-chat', 'synthetic', profile, callback);
const baselinePath = path.join(values.root, 'vectra');
await fsp.mkdir(baselinePath, { recursive: true });
await fsp.mkdir(path.dirname(path.resolve(values.output)), { recursive: true });

function random(seed) {
    let state = seed >>> 0 || 1;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32 - 0.5; };
}
function vector(index, query = false) {
    const center = random((index % 64 + 1) * 2246822519);
    const noise = random((index + 1) * 2654435761);
    const perturbation = random((index + 7) * 1597334677);
    return Array.from({ length: dimensions }, () => Math.fround(center() + 0.55 * noise() + (query ? 0.04 * perturbation() : 0)));
}
const queries = Array.from({ length: Number(values.queries) }, (_, i) => vector((i * 7919 + 123) % count, true));
const started = performance.now();
const result = { phase: values.phase, dimensions, count, queryCount: queries.length, topK: 10, candidateCount: Number(values.candidates), trials: [], syntheticVectors: '64 seeded clusters with noise; not semantic embeddings; cosine baseline is exact.' };

if (values.phase === 'prepare') {
    if (!values.fixture) throw new Error('--fixture must identify the original synthetic chat JSONL');
    if (fs.existsSync(path.join(baselinePath, 'index.json'))) throw new Error('Fixture already exists; choose a fresh benchmark root');
    const target = fs.createWriteStream(path.join(baselinePath, 'index.json'));
    target.write('{"version":1,"metadata_config":{},"items":[');
    const source = fs.createReadStream(values.fixture);
    const lines = readline.createInterface({ input: source, crlfDelay: Infinity });
    let header = true;
    let index = 0;
    for await (const line of lines) {
        if (header) { header = false; continue; }
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        const embedding = vector(index);
        const entry = { id: String(index + 1), vector: embedding, norm: Math.sqrt(embedding.reduce((s, x) => s + x * x, 0)), metadata: { hash: index + 1, index, text: message.mes } };
        if (!target.write((index ? ',' : '') + JSON.stringify(entry))) await once(target, 'drain');
        index++;
        if (index === count) break;
    }
    lines.close();
    source.destroy();
    target.end(']}');
    await once(target, 'finish');
    if (index !== count) throw new Error(`Expected ${count} messages, got ${index}`);
    result.vectorJsonBytes = (await fsp.stat(path.join(baselinePath, 'index.json'))).size;
} else if (values.phase === 'build') {
    if (!values.fixture) throw new Error('--fixture is required');
    const source = fs.createReadStream(values.fixture);
    const lines = readline.createInterface({ input: source, crlfDelay: Infinity });
    let header = true;
    let index = 0;
    let batch = [];
    for await (const line of lines) {
        if (header) { header = false; continue; }
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        batch.push({ hash: index + 1, index, text: message.mes, vector: vector(index) });
        index++;
        if (batch.length === 100 || index === count) {
            await use(store => store.upsert(batch));
            batch = [];
            if (index % 1000 === 0) console.log(JSON.stringify({ inserted: index, elapsedMs: performance.now() - started }));
            await new Promise(resolve => setImmediate(resolve));
        }
        if (index === count) break;
    }
    lines.close(); source.destroy();
    if (index !== count) throw new Error(`Expected ${count} vectors, got ${index}`);
} else if (values.phase === 'baseline' || values.phase === 'optimized') {
    for (const [index, query] of queries.entries()) {
        // Match separate HTTP operations: closed native handles get an event
        // loop turn to finalize before the next operation is timed.
        await new Promise(resolve => setImmediate(resolve));
        global.gc?.();
        await new Promise(resolve => setImmediate(resolve));
        const begin = performance.now();
        let hashes;
        let bodyBytes;
        if (values.phase === 'baseline') {
            const store = new vectra.LocalIndex(baselinePath);
            const matches = await store.queryItems(query, 10);
            hashes = matches.map(x => x.item.metadata.hash);
            bodyBytes = matches.reduce((sum, x) => sum + Buffer.byteLength(x.item.metadata.text), 0);
        } else {
            await use(async store => {
                const refs = (await store.query(query, result.candidateCount, -1)).slice(0, 10);
                const bodies = await store.bodies(refs.map(x => x.id));
                hashes = refs.map(x => x.hash);
                bodyBytes = bodies.reduce((sum, x) => sum + Buffer.byteLength(x.text), 0);
            });
        }
        const elapsedMs = performance.now() - begin;
        result.trials.push({ index, elapsedMs, hashes, bodyBytes, heapUsedMiB: process.memoryUsage().heapUsed / 2 ** 20, rssMiB: process.memoryUsage().rss / 2 ** 20 });
    }
    const sorted = result.trials.map(x => x.elapsedMs).sort((a, b) => a - b);
    result.medianMs = sorted[Math.floor(sorted.length / 2)];
    result.p95Ms = sorted[Math.ceil(sorted.length * 0.95) - 1];
} else throw new Error('Unknown --phase');
result.elapsedMs = performance.now() - started;
result.maxRssMiB = process.resourceUsage().maxRSS / 1024;
await fsp.writeFile(values.output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ phase: result.phase, medianMs: result.medianMs, p95Ms: result.p95Ms, elapsedMs: result.elapsedMs, maxRssMiB: result.maxRssMiB, vectorJsonBytes: result.vectorJsonBytes }));
