import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Response } from 'node-fetch';
import { setConfigFilePath } from '../src/util.js';
setConfigFilePath(fileURLToPath(new URL('../default/config.yaml', import.meta.url)));
const { vertexOptions, buildVertexRequest, readVertexSse, VertexFunctionStream } = await import('../src/endpoints/backends/vertex-protocol.js');
const { createVertexHandler, resolveVertexConnection, vertexHost } = await import('../src/endpoints/backends/vertex-native.js');
const { StreamDebugStore } = await import('../src/diagnostics/gemini-stream-debug.js');
const base = { model: 'gemini-4-argon', stream: true, chat_completion_source: 'vertexai', max_tokens: 500000,
    messages: [{ role: 'user', content: 'PRIVATE_PROMPT' }], reasoning_effort: 'low',
    tools: [{ type: 'function', function: { name: 'actual_content', parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } } }], tool_choice: 'required' };
const frame = value => `data: ${JSON.stringify(value)}\n\n`;
const candidate = (parts, reason, extra = {}) => ({ candidates: [{ index: 0, content: { role: 'model', parts }, ...(reason ? { finishReason: reason } : {}), ...extra }] });
const fc = call => candidate([{ functionCall: call }]);
const done = text => candidate([{ text }], 'STOP');
const upstream = events => new Response(Readable.from(events.map(frame)), { headers: { 'content-type': 'text/event-stream' } });
function request(overrides = {}) { return Object.assign(new EventEmitter(), { body: structuredClone({ ...base, ...overrides }), user: { directories: { root: '/unused/vertex-test' } } }); }
function response() {
    const res = new EventEmitter();
    Object.assign(res, { writes: [], headers: {}, statusCode: 200, destroyed: false, writableEnded: false, writableFinished: false, writableNeedDrain: false });
    res.status = code => { res.statusCode = code; return res; };
    res.set = headers => { Object.assign(res.headers, headers); return res; };
    res.setHeader = (key, value) => { res.headers[key] = value; };
    res.flushHeaders = () => { res.headersSent = true; };
    res.write = data => { res.writes.push(String(data)); return true; };
    res.end = data => { if (data) res.write(data); res.writableEnded = res.writableFinished = true; res.emit('finish'); };
    res.json = data => res.end(JSON.stringify(data));
    return res;
}
async function run(fetchImpl, overrides = {}, extra = {}) {
    const req = request(overrides), res = response();
    await createVertexHandler({ fetchImpl, heartbeatMs: 5, debug: null,
        resolveConnection: async () => ({ url: 'https://aiplatform.googleapis.com/mock', headers: {}, secrets: ['PRIVATE_KEY'] }), ...extra })(req, res);
    const wire = res.writes.join('');
    const events = [];
    if (req.body.stream) for await (const value of readVertexSse(Readable.from([wire]))) events.push(value);
    return { req, res, wire, events };
}

test('Argon request policy preserves caller messages and maps modern thinking and function streaming', () => {
    const req = request({ include_reasoning: true, temperature: 0.7, top_p: 0.8, top_k: 10 });
    const original = structuredClone(req.body);
    const options = vertexOptions(req.body), body = buildVertexRequest(req, options);
    assert.equal(options.apiVersion, 'v1beta1');
    assert.deepEqual(body.generationConfig, { maxOutputTokens: 500000, thinkingConfig: { includeThoughts: true, thinkingLevel: 'LOW' } });
    assert.equal(body.toolConfig.functionCallingConfig.streamFunctionCallArguments, true);
    assert.equal(body.toolConfig.functionCallingConfig.mode, 'ANY');
    assert.deepEqual(req.body, original);
    assert.equal(buildVertexRequest(request({ reasoning_effort: 'min' })).generationConfig.thinkingConfig.thinkingLevel, 'LOW');
    assert.throws(() => vertexOptions({ ...base, vertexai_service_tier: 'flex' }), /Flex/);
    assert.throws(() => vertexOptions({ ...base, vertexai_api_version: 'v1' }), /v1beta1/);
    assert.throws(() => vertexOptions({ ...base, vertexai_request_type: 'dedicated', vertexai_service_tier: 'priority' }), /专用/);
    assert.equal(vertexOptions({ ...base, model: 'gemini-3.1-flash-lite' }).streamArguments, false);
});

test('regional hosts and paid-tier headers are explicit and API versions do not duplicate', async () => {
    assert.equal(vertexHost('global'), 'https://aiplatform.googleapis.com');
    assert.equal(vertexHost('eu'), 'https://aiplatform.eu.rep.googleapis.com');
    assert.equal(vertexHost('us'), 'https://aiplatform.us.rep.googleapis.com');
    assert.equal(vertexHost('asia-northeast1'), 'https://asia-northeast1-aiplatform.googleapis.com');
    const req = request({ reverse_proxy: 'https://example.invalid/v1/', proxy_password: 'PRIVATE_KEY' });
    const standard = await resolveVertexConnection(req, vertexOptions(req.body));
    assert.equal(standard.headers['X-Vertex-AI-LLM-Shared-Request-Type'], undefined);
    assert.equal(new URL(standard.url).pathname, '/v1beta1/publishers/google/models/gemini-4-argon:streamGenerateContent');
    req.body.vertexai_service_tier = 'priority'; req.body.vertexai_request_type = 'shared';
    const priority = await resolveVertexConnection(req, vertexOptions(req.body));
    assert.equal(priority.headers['X-Vertex-AI-LLM-Shared-Request-Type'], 'priority');
    assert.equal(priority.headers['X-Vertex-AI-LLM-Request-Type'], 'shared');
});

test('UTF-8 byte boundaries, Google empty closing fragments, nested parameters, IDs and signatures', async () => {
    const events = [fc({ name: 'actual_content', id: 'call_1', willContinue: true }),
        fc({ partialArgs: [{ jsonPath: '$.content', stringValue: '中文🙂', willContinue: true }], willContinue: true }),
        fc({ partialArgs: [{ jsonPath: '$.content', stringValue: '正文', willContinue: true }], willContinue: true }),
        fc({ partialArgs: [{ jsonPath: '$.content' }], willContinue: true }), fc({}), candidate([], 'STOP')];
    const bytes = Buffer.from(': keepalive\r\n\r\n' + events.map(frame).join(''));
    const converter = new VertexFunctionStream({ unwrapContent: true });
    let text = '';
    for await (const raw of readVertexSse(Readable.from([...bytes].map(b => Buffer.from([b]))))) {
        text += converter.transform(raw).candidates[0].content.parts.map(p => p.text || '').join('');
    }
    assert.equal(text, '中文🙂正文'); assert.equal(converter.active.size, 0);
    const tools = new VertexFunctionStream();
    tools.transform(candidate([{ functionCall: { name: 'lookup', id: 'provider-id', partialArgs: [{ jsonPath: '$.places[0].name', stringValue: 'Tokyo' }], willContinue: true }, thoughtSignature: 'signature' }]));
    const result = tools.transform(fc({})).candidates[0].content.parts[0];
    assert.deepEqual(result, { functionCall: { name: 'lookup', id: 'provider-id', args: { places: [{ name: 'Tokyo' }] } }, thoughtSignature: 'signature' });
    assert.throws(() => tools.transform(fc({ name: 'bad', partialArgs: [{ jsonPath: '$.__proto__.polluted', boolValue: true }] })), /禁止/);
    assert.equal({}.polluted, undefined);
});

test('headers and same-response heartbeats arrive during upstream TTFT; completion is clean', async () => {
    let target;
    const result = await run(async () => { assert.equal(target.headersSent, true); await sleep(24); return upstream([done('正常')]); }, {}, {
        resolveConnection: async (req, options) => { await sleep(15); return { url: 'https://example.invalid', headers: {} }; },
        debug: { begin(req, res) { target = res; return null; } },
    });
    assert.equal(result.res.headers['X-Accel-Buffering'], 'no');
    assert.ok((result.wire.match(/vertex-native waiting/g) || []).length >= 2);
    assert.equal(result.events.at(-1).vertexMeta.phase, 'completed');
    assert.ok(result.wire.endsWith('data: [DONE]\n\n'));
    assert.equal(result.req.listenerCount('aborted'), 0);
});

test('official continuation resends identical prompt, hides tokens, preserves an in-progress function and sums final usage', async () => {
    const requests = [];
    const result = await run(async (url, init) => {
        requests.push(JSON.parse(init.body));
        if (requests.length === 1) return upstream([
            fc({ name: 'actual_content', willContinue: true, partialArgs: [{ jsonPath: '$.content', stringValue: '前半', willContinue: true }] }),
            { ...candidate([], 'CONTINUATION', { continuationToken: 'PRIVATE_TOKEN' }), usageMetadata: { totalTokenCount: 11, promptTokenCount: 5 } },
        ]);
        return upstream([
            fc({ partialArgs: [{ jsonPath: '$.content', stringValue: '后半' }] }),
            { ...candidate([], 'STOP'), usageMetadata: { totalTokenCount: 13, promptTokenCount: 7, trafficType: 'ON_DEMAND_PRIORITY' } },
        ]);
    });
    assert.equal(requests.length, 2);
    assert.equal(requests[1].continuationToken, 'PRIVATE_TOKEN');
    delete requests[1].continuationToken; assert.deepEqual(requests[1], requests[0]);
    assert.ok(!result.wire.includes('PRIVATE_TOKEN')); assert.ok(!result.wire.includes('CONTINUATION'));
    assert.equal(result.events.flatMap(e => e.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''), '前半后半');
    assert.equal(result.events.at(-1).usageMetadata.totalTokenCount, 24);
    assert.equal(result.events.at(-1).vertexMeta.segments, 2);
});

test('network reset, truncated streams, empty output and HTTP failures become explicit terminal SSE errors, with no retry', async () => {
    const scenarios = [
        { fetch: async () => { throw Object.assign(new Error('PRIVATE_KEY'), { code: 'ECONNRESET' }); }, code: 'ECONNRESET' },
        { fetch: async () => upstream([candidate([{ text: 'partial' }])]), code: 'VERTEX_INCOMPLETE_STREAM' },
        { fetch: async () => upstream([candidate([], 'STOP')]), code: 'VERTEX_EMPTY' },
        { fetch: async () => new Response(JSON.stringify({ error: { message: 'PRIVATE_KEY https://secret.invalid/', status: 'UNAVAILABLE' } }), { status: 503 }), code: 'VERTEX_HTTP' },
        { fetch: async () => new Response(Readable.from((async function* () { yield frame(candidate([{ text: 'part' }])); throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }); })())), code: 'ECONNRESET' },
    ];
    for (const scenario of scenarios) {
        let count = 0;
        const result = await run(async (...args) => { count++; return scenario.fetch(...args); });
        assert.equal(count, 1); assert.equal(result.events.at(-1).error.code, scenario.code);
        assert.ok(!result.wire.includes('PRIVATE_KEY')); assert.ok(!result.wire.includes('secret.invalid'));
        assert.ok(result.wire.endsWith('data: [DONE]\n\n'));
    }
});

test('non-streaming requests retain valid JSON despite waiting heartbeats and unwrap actual_content', async () => {
    const result = await run(async () => { await sleep(18); return new Response(JSON.stringify(candidate([{ functionCall: { name: 'actual_content', args: { content: '正文' } } }], 'STOP'))); }, { stream: false });
    const data = JSON.parse(result.wire);
    assert.equal(data.choices[0].message.content, '正文');
    assert.equal(data.responseContent.parts[0].text, '正文');
    assert.equal(data.vertexMeta.phase, 'completed');
});

test('client disconnect aborts exactly one upstream and debug export records cause without content', async () => {
    const debug = new StreamDebugStore({ persist: false });
    try {
        const req = request(), res = response(); debug.control(req, 'start');
        let aborted = 0;
        const handler = createVertexHandler({ debug, heartbeatMs: 5,
            resolveConnection: async () => ({ url: 'https://aiplatform.us.rep.googleapis.com/mock', headers: {} }),
            fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => { aborted++; reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
                setTimeout(() => { res.destroyed = true; res.emit('close'); }, 12);
            }),
        });
        await handler(req, res);
        assert.equal(aborted, 1);
        const report = debug.report(req), row = report.traces.at(-1);
        assert.equal(row.abortSource, 'downstream_closed'); assert.equal(row.state, 'downstream_closed_early');
        assert.equal(row.effectiveRequest.endpoint, 'google_vertex');
        assert.ok(!JSON.stringify(report).includes('PRIVATE_PROMPT'));
    } finally { debug.close(); }
});

test('backpressure waits for drain instead of dropping text', async () => {
    const req = request(), res = response();
    const original = res.write; let drains = 0;
    res.write = value => { original(value); res.writableNeedDrain = true; setTimeout(() => { drains++; res.writableNeedDrain = false; res.emit('drain'); }, 2); return false; };
    await createVertexHandler({ debug: null, heartbeatMs: 5, resolveConnection: async () => ({ url: 'https://example.invalid', headers: {} }), fetchImpl: async () => upstream([done('正文')]) })(req, res);
    assert.ok(drains >= 3); assert.ok(res.writes.join('').includes('正文')); assert.equal(res.listenerCount('drain'), 0);
});
