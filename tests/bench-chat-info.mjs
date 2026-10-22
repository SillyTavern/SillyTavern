// Compare chat-summary implementations without checking out another worktree.
// Timings are informational; this is not an application-wide speed benchmark.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        baseline: { type: 'string', default: 'b34249a6c' },
        rounds: { type: 'string', default: '5' },
        help: { type: 'boolean', short: 'h' },
    },
});
if (values.help) {
    console.log('Usage: node tests/bench-chat-info.mjs [--baseline REF] [--rounds N] [chat-count] [messages-per-chat]\n'
        + 'Defaults: --baseline b34249a6c --rounds 5 32 1000\n'
        + 'Compares the Git baseline chat endpoint with the working tree, using current dependencies.\n'
        + 'Each message contains 2048 text characters. Temporary fixtures are removed on completion.');
    process.exit(0);
}
const chatCount = Number(positionals[0] ?? 32);
const messageCount = Number(positionals[1] ?? 1000);
const roundCount = Number(values.rounds);
if (positionals.length > 2 || ![chatCount, messageCount, roundCount].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new Error('Chat count, messages per chat and rounds must be positive integers. See --help.');
}

const repository = fileURLToPath(new URL('../', import.meta.url));
const endpointUrl = new URL('../src/endpoints/chats.js', import.meta.url);

/**
 * Load the baseline endpoint with the same supporting modules and dependencies
 * as the working tree. This isolates the endpoint change and requires only the
 * requested source to exist in local Git history, not a checkout or installation.
 * @param {string} ref Local Git revision
 * @returns {Promise<{commit: string, getChatInfo: typeof import('../src/endpoints/chats.js').getChatInfo}>} Baseline implementation
 */
async function loadBaseline(ref) {
    const gitOptions = { cwd: repository, encoding: /** @type {const} */ ('utf8') };
    const commit = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], gitOptions).trim();
    const source = execFileSync('git', ['show', `${commit}:src/endpoints/chats.js`], gitOptions);

    // A data URL has no package or directory context. Resolve static import
    // specifiers against the original endpoint location before loading it.
    const resolvedSource = source.replace(/\bfrom\s+(['"])([^'"\r\n]+)\1(?=\s*;)/g, (_, quote, specifier) => {
        const resolved = specifier.startsWith('.') || specifier.startsWith('/')
            ? new URL(specifier, endpointUrl).href
            : import.meta.resolve(specifier);
        return `from '${resolved}'`;
    });
    const module = await import('data:text/javascript;base64,' + Buffer.from(resolvedSource).toString('base64'));
    if (typeof module.getChatInfo !== 'function') throw new Error(`Baseline ${ref} does not export getChatInfo.`);
    return { commit, getChatInfo: module.getChatInfo };
}

process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';
const baseline = await loadBaseline(values.baseline);
const current = await import(endpointUrl.href);

const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'st-bench-info-'));
const createReadStream = fs.createReadStream;
let counters;
fs.createReadStream = (...args) => {
    const sample = counters;
    sample.contentReads++;
    sample.peakStreams = Math.max(sample.peakStreams, ++sample.activeStreams);
    const stream = createReadStream(...args);
    stream.once('close', () => {
        sample.bytesRead += stream.bytesRead;
        sample.activeStreams--;
    });
    return stream;
};

try {
    const messageText = 'x'.repeat(2048);
    const message = JSON.stringify({ name: 'Character', mes: messageText, send_date: '2026-01-01' });
    const contents = JSON.stringify({ chat_metadata: { note: 'benchmark' } }) + '\n' + Array(messageCount).fill(message).join('\n');
    const rounds = [];

    for (let round = 0; round < roundCount; round++) {
        // Fresh paths keep the working-tree summary cache cold at each round.
        const roundDirectory = path.join(root, String(round));
        await fs.promises.mkdir(roundDirectory);
        const files = Array.from({ length: chatCount }, (_, i) => path.join(roundDirectory, `${i}.jsonl`));
        for (const file of files) await fs.promises.writeFile(file, contents);

        const measure = async (getChatInfo) => {
            counters = { contentReads: 0, bytesRead: 0, activeStreams: 0, peakStreams: 0 };
            const start = performance.now();
            const results = await Promise.allSettled(files.map(file => getChatInfo(file, {}, true)));
            // The baseline resolves on readline close, before the file descriptor
            // closes. Use the same end boundary for both versions and never reset
            // counters while old streams can still emit their close events.
            while (counters.activeStreams > 0) await new Promise(resolve => setImmediate(resolve));
            const durationMs = +(performance.now() - start).toFixed(2);
            for (const result of results) {
                if (result.status === 'rejected') throw result.reason;
                if (result.value.chat_items !== messageCount || result.value.mes !== messageText) {
                    throw new Error('Benchmark implementation returned an incorrect chat summary.');
                }
            }
            return { durationMs, ...counters };
        };

        const order = round % 2 ? ['current', 'baseline'] : ['baseline', 'current'];
        const result = { round: round + 1, order };
        for (const name of order) {
            const implementation = name === 'baseline' ? baseline : current;
            result[name] = {
                firstScan: await measure(implementation.getChatInfo),
                repeatedScan: await measure(implementation.getChatInfo),
            };
        }
        rounds.push(result);
        await fs.promises.rm(roundDirectory, { recursive: true, force: true });
    }

    const summary = {};
    for (const name of ['baseline', 'current']) {
        summary[name] = {};
        for (const scan of ['firstScan', 'repeatedScan']) {
            const samples = rounds.map(round => round[name][scan]);
            const durations = samples.map(sample => sample.durationMs).sort((a, b) => a - b);
            const middle = Math.floor(durations.length / 2);
            const median = durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
            summary[name][scan] = {
                medianMs: +median.toFixed(2),
                minMs: durations[0],
                maxMs: durations.at(-1),
                peakStreams: Math.max(...samples.map(sample => sample.peakStreams)),
                contentReadsPerRound: samples.map(sample => sample.contentReads),
                bytesReadPerRound: samples.map(sample => sample.bytesRead),
            };
        }
    }
    console.log(JSON.stringify({
        baseline: { ref: values.baseline, commit: baseline.commit, scope: 'Git chat endpoint with current supporting modules and dependencies' },
        chatCount,
        messagesPerChat: messageCount,
        inputMiB: +(Buffer.byteLength(contents) * chatCount / 1024 / 1024).toFixed(2),
        note: 'System disk cache is not cleared. First scan means no retained summary for these paths. Both timings include stream closure.',
        summary,
        rounds,
    }, null, 2));
} finally {
    fs.createReadStream = createReadStream;
    await fs.promises.rm(root, { recursive: true, force: true });
}
