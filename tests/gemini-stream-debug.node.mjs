import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import express from 'express';
import fetch from 'node-fetch';
import { ProtocolCounter, StreamDebugStore, safeError } from '../src/diagnostics/gemini-stream-debug.js';
import { forwardFetchResponse } from '../src/util.js';

const body = { stream: true, model: 'gemini-4-argon', chat_completion_source: 'vertexai', messages: [{ role: 'user', content: 'PROMPT_PRIVATE' }], tools: [{ type: 'function', function: { name: 'actual_content' } }] };
const frame = obj => 'data: ' + JSON.stringify(obj) + '\n\n';
const answer = text => ({ candidates: [{ content: { parts: [{ functionCall: { name: 'actual_content', args: { content: text } } }] }, finishReason: 'STOP' }] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function request(root = '/unused/user-a', overrides = {}) {
    return Object.assign(new EventEmitter(), { user: { directories: { root } }, body: structuredClone(body), ...overrides });
}
function response() {
    const res = new EventEmitter();
    res.writes = []; res.headers = {}; res.statusCode = 200; res.destroyed = false; res.writableEnded = false; res.writableFinished = false;
    res.setHeader = (key, value) => { res.headers[key] = value; };
    res.write = function (chunk, ...args) { this.writes.push(chunk); const callback = args.at(-1); if (typeof callback === 'function') callback(); return false; };
    res.end = function (chunk) { if (chunk) this.writes.push(chunk); this.writableEnded = this.writableFinished = true; this.emit('finish'); return this; };
    return res;
}
function setup(t, options = { persist: false }) {
    const store = new StreamDebugStore(options);
    t.after(() => store.close());
    return store;
}
function start(t) {
    const store = setup(t); const req = request(); const res = response();
    store.control(req, 'start');
    const trace = store.begin(req, res);
    return { store, req, res, trace };
}

test('off by default; non-Gemini and non-streaming requests keep their original response methods', t => {
    const store = setup(t), req = request(), res = response(), write = res.write;
    assert.equal(store.begin(req, res), null);
    store.control(req, 'start');
    assert.equal(store.begin(request(undefined, { body: { ...body, stream: false } }), res), null);
    assert.equal(store.begin(request(undefined, { body: { ...body, chat_completion_source: 'openai' } }), res), null);
    assert.equal(res.write, write);
});

test('response wrappers preserve bytes, return values, callbacks and backpressure', t => {
    const { res, trace } = start(t);
    const bytes = Buffer.from(frame(answer('中文🙂')));
    let callbackCount = 0;
    assert.equal(res.write(bytes, () => { callbackCount++; }), false);
    assert.equal(callbackCount, 1);
    assert.equal(res.end('TAIL'), res);
    assert.equal(Buffer.concat(res.writes.map(x => Buffer.from(x))).toString(), bytes.toString() + 'TAIL');
    assert.equal(trace.snapshot().downstream.bytes, bytes.length + 4);
});

test('protocol counters handle every UTF-8/SSE byte boundary without keeping content', () => {
    const counter = new ProtocolCounter();
    const input = Buffer.from(': turing-bridge waiting\r\n\r\n' + frame(answer('中文🙂PRIVATE')) + frame({ usageMetadata: { trafficType: 'ON_DEMAND_PRIORITY', thoughtsTokenCount: 88 } }) + 'data: [DONE]\n\n');
    for (const byte of input) counter.push(Buffer.from([byte]));
    counter.end();
    assert.equal(counter.stats.bridgeHeartbeats, 1);
    assert.equal(counter.stats.argumentContentChars, '中文🙂PRIVATE'.length);
    assert.deepEqual(counter.stats.finishReasons, ['STOP']);
    assert.equal(counter.stats.usage.trafficType, 'ON_DEMAND_PRIORITY');
    assert.equal(counter.stats.doneMarker, true);
    assert.ok(!JSON.stringify(counter.stats).includes('PRIVATE'));
    assert.equal(counter.buffer, '');
});

test('oversized events are bounded; following valid events are still counted', () => {
    const counter = new ProtocolCounter();
    counter.push(frame(answer('X'.repeat(400000))) + frame({ candidates: [{ finishReason: 'MAX_TOKENS' }] }));
    counter.end();
    assert.equal(counter.stats.oversizedEvents, 1);
    assert.ok(counter.stats.finishReasons.includes('MAX_TOKENS'));
    assert.equal(counter.buffer.length, 0);
});

test('private headers, URLs, messages, stacks and content never enter exported diagnostics', t => {
    const { store, req, trace } = start(t);
    trace.startUpstream('https://aiplatform.googleapis.com/v1/projects/PROJECT_PRIVATE?key=KEY_PRIVATE',
        { generationConfig: {}, toolConfig: { functionCallingConfig: { streamFunctionCallArguments: true } } },
        { Authorization: 'Bearer KEY_PRIVATE', Cookie: 'COOKIE_PRIVATE', 'X-Vertex-AI-LLM-Shared-Request-Type': 'priority' }, new AbortController().signal);
    trace.data('upstream', Buffer.from(frame(answer('CHAT_PRIVATE'))));
    trace.failure(Object.assign(new Error('request https://PRIVATE.invalid?key=KEY_PRIVATE failed: socket hang up'), { code: 'ECONNRESET', stack: 'STACK_PRIVATE' }));
    const report = store.report(req);
    assert.equal(report.traces[0].effectiveRequest.priorityHeader, 'priority');
    assert.equal(report.traces[0].upstream.errors[0].kind, 'socket_hang_up');
    assert.ok(!JSON.stringify(report).includes('PRIVATE'));
});

test('response-body errors are captured while the downstream can remain open', t => {
    const { trace } = start(t);
    const remote = new PassThrough();
    trace.responseHeaders({ status: 200, headers: new Map([['content-type', 'text/event-stream']]), body: remote });
    remote.write(frame({ usageMetadata: { thoughtsTokenCount: 1 } }));
    remote.emit('error', Object.assign(new Error('Premature close'), { code: 'ERR_STREAM_PREMATURE_CLOSE' }));
    const row = trace.snapshot();
    assert.equal(row.state, 'upstream_error');
    assert.equal(row.downstreamOpen, true);
    assert.ok(row.upstream.bytes > 0);
    assert.equal(row.upstream.protocol.argumentContentChars, 0);
});

test('abort timing and downstream closure are separate from upstream network failure', t => {
    const { trace, res } = start(t), controller = new AbortController();
    trace.startUpstream('https://aiplatform.googleapis.com/', {}, {}, controller.signal);
    res.destroyed = true; res.emit('close'); controller.abort();
    trace.failure(Object.assign(new Error('aborted'), { name: 'AbortError', code: 'ABORT_ERR' }));
    const row = trace.snapshot();
    assert.equal(row.downstream.finished, false);
    assert.ok(row.events.some(e => e.type === 'abort_signal' && e.downstreamClosed));
    assert.equal(row.upstream.errors[0].kind, 'aborted');
});

test('same-body plugin/native requests have distinct IDs and matching bodyGroup; accounts are isolated', t => {
    const store = setup(t), a = request(), b = request('/unused/user-b');
    store.control(a, 'start');
    const first = store.begin(a, response(), 'keepalive-plugin');
    const second = store.begin(a, response());
    assert.notEqual(first.record.id, second.record.id);
    assert.equal(first.record.bodyGroup, second.record.bodyGroup);
    assert.equal(store.report(b).traces.length, 0);
    assert.equal(store.report(b).recording, false);
});

test('stop preserves current collection; clear detaches without aborting generation', t => {
    const { store, req, res, trace } = start(t);
    store.control(req, 'stop');
    assert.equal(store.begin(req, response()), null);
    assert.equal(trace.observing, true);
    store.control(req, 'clear');
    assert.equal(trace.observing, false);
    assert.equal(res.destroyed, false);
    assert.equal(res.writableEnded, false);
    assert.equal(store.report(req).traces.length, 0);
});

test('concurrency cap bounds hanging observations and exposes skipped count', t => {
    const store = setup(t), req = request(); store.control(req, 'start');
    for (let i = 0; i < 20; i++) store.begin(request(), response());
    assert.equal(store.report(req).traces.length, 12);
    assert.equal(store.report(req).skippedRequests, 8);
});

test('private report persists and is recovered after restart with recording disabled', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-stream-debug-test-'));
    const store = new StreamDebugStore(); const req = request(root);
    t.after(async () => { await store.close(); fs.rmSync(root, { recursive: true, force: true }); });
    store.control(req, 'start'); const trace = store.begin(req, response());
    trace.failure(Object.assign(new Error('SECRET_PRIVATE socket hang up'), { code: 'ECONNRESET' }));
    await store.flush(store.owner(req));
    const disk = fs.readFileSync(path.join(root, 'stream-debug/latest.json'), 'utf8');
    assert.ok(!disk.includes('PRIVATE'));
    const restarted = new StreamDebugStore();
    const report = restarted.report(req);
    assert.equal(report.recording, false);
    assert.equal(report.traces.length, 1);
    assert.equal(report.traces[0].restoredAfterRestart, true);
    await restarted.close();
});

test('arbitrary error codes and cause text are excluded', () => {
    const result = safeError({ name: 'PRIVATE', code: 'PRIVATE', message: 'PRIVATE', cause: { code: 'PRIVATE' } });
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

async function listen(t, app) {
    const server = http.createServer(app);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    t.after(() => { server.closeAllConnections(); server.close(); });
    return `http://127.0.0.1:${server.address().port}`;
}

test('real TCP socket hang-up is exported despite the native HTTP 500 losing details', async t => {
    const store = setup(t), reqOwner = request(); store.control(reqOwner, 'start');
    const upstream = await listen(t, (req, _res) => req.socket.destroy());
    const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = reqOwner.user; next(); });
    app.use('/api/stream-debug', store.router);
    app.post('/generate', async (req, res) => {
        const trace = store.begin(req, res);
        trace.startUpstream(upstream, {}, {}, new AbortController().signal);
        try { const remote = await fetch(upstream); trace.responseHeaders(remote); await forwardFetchResponse(remote, res); }
        catch (error) { trace.failure(error); res.status(500).json({ error: true }); }
    });
    const base = await listen(t, app);
    const result = await fetch(base + '/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(result.status, 500); assert.deepEqual(await result.json(), { error: true });
    const report = await (await fetch(base + '/api/stream-debug/export')).json();
    assert.equal(report.traces[0].upstream.errors[0].code, 'ECONNRESET');
    assert.equal(report.traces[0].upstream.errors[0].kind, 'socket_hang_up');
    assert.equal(report.traces[0].upstream.bytes, 0);
});

test('actual native forwarder midstream disconnect is recorded before a client stop', async t => {
    const store = setup(t), owner = request(); store.control(owner, 'start');
    const upstream = await listen(t, (req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(frame({ usageMetadata: { thoughtsTokenCount: 1 } }));
        setTimeout(() => req.socket.destroy(), 40);
    });
    const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = owner.user; next(); });
    app.post('/generate', async (req, res) => {
        const trace = store.begin(req, res), controller = new AbortController();
        req.socket.on('close', () => controller.abort());
        trace.startUpstream(upstream, {}, {}, controller.signal);
        try { const remote = await fetch(upstream, { signal: controller.signal }); trace.responseHeaders(remote); await forwardFetchResponse(remote, res); }
        catch (error) { trace.failure(error); if (!res.headersSent) res.status(500).json({ error: true }); }
    });
    const base = await listen(t, app), controller = new AbortController();
    const response = await fetch(base + '/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    response.body.on('error', () => {}); response.body.resume();
    await sleep(120);
    const row = store.report(owner).traces[0];
    assert.equal(row.state, 'upstream_error');
    assert.equal(row.downstreamOpen, true);
    assert.equal(row.signalAbortedAtMs, undefined);
    assert.equal(row.upstream.protocol.argumentContentChars, 0);
    controller.abort();
});

test('diagnostic routes require user context, validate actions and serve a usable page', async t => {
    const store = setup(t), app = express(); app.use(express.json());
    app.use((req, _res, next) => { if (req.headers['x-test-user']) req.user = request().user; next(); });
    app.use('/api/stream-debug', store.router);
    const base = await listen(t, app);
    assert.equal((await fetch(base + '/api/stream-debug/export')).status, 401);
    const headers = { 'x-test-user': '1', 'content-type': 'application/json' };
    const page = await fetch(base + '/api/stream-debug', { headers });
    assert.match(await page.text(), /下载诊断 JSON/);
    assert.equal((await fetch(base + '/api/stream-debug/control', { method: 'POST', headers, body: '{"action":"bad"}' })).status, 400);
    const result = await fetch(base + '/api/stream-debug/control', { method: 'POST', headers, body: '{"action":"start"}' });
    assert.equal((await result.json()).recording, true);
});
