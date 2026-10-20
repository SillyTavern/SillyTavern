import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import express from 'express';

const PATCH_VERSION = '1.0.0';
const HOUR = 60 * 60 * 1000;
const MAX_RECORDS = 40;
const MAX_ACTIVE = 12;
const MAX_EVENTS = 180;
const MAX_EVENT_CHARS = 256 * 1024;
const packageVersion = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
const enumValue = (value, values) => values.includes(value) ? value : 'other';
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const stringLength = value => typeof value === 'string' ? value.length : 0;
const FINISH_REASONS = ['CONTINUATION', 'STOP', 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'MALFORMED_FUNCTION_CALL', 'UNEXPECTED_TOOL_CALL', 'MODEL_ARMOR', 'FINISH_REASON_UNSPECIFIED'];
const CODES = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_STREAM_DESTROYED', 'ABORT_ERR', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ENOENT', 'EACCES', 'EROFS', 'ENOSPC'];

// Deliberately omit raw error messages/stacks: node-fetch messages can contain API URLs and keys.
export function safeError(error) {
    const message = String(error?.message ?? '');
    const kind = /socket hang up/i.test(message) ? 'socket_hang_up'
        : /premature close/i.test(message) ? 'premature_close'
            : /abort/i.test(message) ? 'aborted'
                : /timeout|timed out|deadline/i.test(message) ? 'timeout' : 'other';
    return { kind, code: enumValue(error?.code, CODES),
        name: enumValue(error?.name, ['Error', 'FetchError', 'AbortError', 'TypeError']),
        causeCode: error?.cause ? enumValue(error.cause.code, CODES) : null };
}

function protocolStats() {
    return { events: 0, comments: 0, bridgeHeartbeats: 0, jsonErrors: 0, oversizedEvents: 0,
        functionCalls: 0, partialArgs: 0, textChars: 0, nonWhitespaceTextChars: 0,
        thoughtChars: 0, argumentContentChars: 0, nonWhitespaceArgumentChars: 0,
        doneMarker: false, finishReasons: [], blockReasons: [], apiErrors: [], usage: {} };
}

/** Bounded, transient parsing. Only counts and allowlisted enums enter the report. */
export class ProtocolCounter {
    constructor(stats = protocolStats(), onSignal = () => {}) {
        this.stats = stats;
        this.onSignal = onSignal;
        this.decoder = new StringDecoder('utf8');
        this.buffer = '';
        this.skipping = false;
    }

    payload(value) {
        if (!value || typeof value !== 'object') return;
        const s = this.stats;
        if (value.error) {
            const error = value.error;
            const item = { status: enumValue(error.status,
                ['CANCELLED', 'UNKNOWN', 'INVALID_ARGUMENT', 'DEADLINE_EXCEEDED', 'NOT_FOUND', 'PERMISSION_DENIED', 'RESOURCE_EXHAUSTED', 'FAILED_PRECONDITION', 'INTERNAL', 'UNAVAILABLE', 'UNAUTHENTICATED']),
            ...safeError(error) };
            // Preserve the numeric API code separately from the transport code.
            item.httpCode = number(error.code);
            if (s.apiErrors.length < 8) s.apiErrors.push(item);
            this.onSignal('api_error', item);
        }
        if (value.promptFeedback?.blockReason) {
            const reason = enumValue(value.promptFeedback.blockReason, FINISH_REASONS);
            if (!s.blockReasons.includes(reason)) s.blockReasons.push(reason);
        }
        for (const candidate of Array.isArray(value.candidates) ? value.candidates : []) {
            if (candidate.finishReason) {
                const reason = enumValue(candidate.finishReason, FINISH_REASONS);
                if (!s.finishReasons.includes(reason)) {
                    s.finishReasons.push(reason);
                    this.onSignal('model_finish', { reason });
                }
            }
            for (const part of Array.isArray(candidate.content?.parts) ? candidate.content.parts : []) {
                if (part.thought) s.thoughtChars += stringLength(part.text);
                else if (typeof part.text === 'string') {
                    s.textChars += part.text.length;
                    s.nonWhitespaceTextChars += part.text.trim().length;
                }
                if (part.functionCall) {
                    s.functionCalls++;
                    const call = part.functionCall;
                    if (typeof call.args?.content === 'string') {
                        s.argumentContentChars += call.args.content.length;
                        s.nonWhitespaceArgumentChars += call.args.content.trim().length;
                    }
                    for (const arg of Array.isArray(call.partialArgs) ? call.partialArgs : []) {
                        s.partialArgs++;
                        if (arg.jsonPath === '$.content' && typeof arg.stringValue === 'string') {
                            s.argumentContentChars += arg.stringValue.length;
                            s.nonWhitespaceArgumentChars += arg.stringValue.trim().length;
                        }
                    }
                }
            }
        }
        const usage = value.usageMetadata;
        if (usage) {
            for (const key of ['promptTokenCount', 'candidatesTokenCount', 'totalTokenCount', 'thoughtsTokenCount', 'cachedContentTokenCount']) {
                if (number(usage[key]) !== null) s.usage[key] = usage[key];
            }
            if (usage.trafficType) s.usage.trafficType = enumValue(usage.trafficType,
                ['ON_DEMAND', 'ON_DEMAND_PRIORITY', 'ON_DEMAND_FLEX', 'PROVISIONED_THROUGHPUT']);
        }
    }

    event(raw) {
        if (!raw.trim()) return;
        const lines = raw.split(/\r\n|\n|\r/);
        this.stats.comments += lines.filter(line => line.startsWith(':')).length;
        this.stats.bridgeHeartbeats += lines.filter(line => /^:\s*(?:turing-bridge|vertex-native) (?:connected|waiting)/.test(line)).length;
        let payload = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!payload && ['[', '{'].includes(raw.trimStart()[0])) payload = raw;
        if (!payload) return;
        this.stats.events++;
        if (payload.trim() === '[DONE]') { this.stats.doneMarker = true; return; }
        try { this.payload(JSON.parse(payload)); } catch { this.stats.jsonErrors++; }
    }

    push(chunk) {
        const text = this.decoder.write(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        // Slice even a single huge network chunk so the diagnostic buffer is bounded.
        for (let start = 0; start < text.length; start += 8192) {
            this.buffer += text.slice(start, start + 8192);
            let boundary;
            while ((boundary = /\r\n\r\n|\n\n|\r\r/.exec(this.buffer))) {
                if (!this.skipping) this.event(this.buffer.slice(0, boundary.index));
                this.buffer = this.buffer.slice(boundary.index + boundary[0].length);
                this.skipping = false;
            }
            if (this.buffer.length > MAX_EVENT_CHARS) {
                if (!this.skipping) this.stats.oversizedEvents++;
                this.skipping = true;
                this.buffer = this.buffer.slice(-3);
            }
        }
    }

    end() {
        this.buffer += this.decoder.end();
        if (!this.skipping && this.buffer.trim()) this.event(this.buffer);
        this.buffer = '';
    }
}

function meter() {
    return { bytes: 0, chunks: 0, firstByteMs: null, lastByteMs: null, maxGapMs: 0,
        endedAtMs: null, closedAtMs: null, errors: [], protocol: protocolStats() };
}

class Trace {
    constructor(owner, request, response, kind) {
        this.owner = owner;
        this.response = response;
        this.start = performance.now();
        this.observing = true;
        this.cleanups = [];
        this.record = { id: randomUUID(), runId: owner.store.runId, kind,
            startedAt: new Date().toISOString(), elapsedMs: 0, state: 'in_progress', events: [],
            request: { source: enumValue(request.body?.chat_completion_source, ['vertexai', 'makersuite']),
                model: /^gemini[-_][a-z0-9._-]{1,80}$/i.test(request.body?.model) ? request.body.model : 'other',
                stream: request.body?.stream === true,
                actualContentTool: Boolean(request.body?.tools?.some(t => t.function?.name === 'actual_content')),
                toolsCount: request.body?.tools?.length ?? 0,
                messagesCount: request.body?.messages?.length ?? 0,
                maxTokens: number(request.body?.max_tokens),
                reasoningEffort: enumValue(request.body?.reasoning_effort, ['auto', 'min', 'minimal', 'low', 'medium', 'high', 'max']),
                partialArgsRequestedByScript: request.body?.stream_function_call_arguments === true,
                reverseProxyConfigured: Boolean(request.body?.reverse_proxy) },
            localTimeouts: { socketMs: number(request.socket?.timeout),
                serverRequestMs: number(request.socket?.server?.requestTimeout),
                serverHeadersMs: number(request.socket?.server?.headersTimeout),
                serverKeepAliveMs: number(request.socket?.server?.keepAliveTimeout) },
            upstream: meter(), downstream: meter() };
        // Same body can occur in retries: this groups equivalent requests, not unique parentage.
        this.record.bodyGroup = createHmac('sha256', owner.store.groupKey).update(owner.root + '\0').update(JSON.stringify(request.body ?? {})).digest('hex').slice(0, 20);
        this.upstreamParser = new ProtocolCounter(this.record.upstream.protocol, (event, detail) => this.event(event, detail));
        this.downstreamParser = new ProtocolCounter(this.record.downstream.protocol);
        response.setHeader('X-ST-Stream-Debug-Id', this.record.id);
        const write = response.write;
        const end = response.end;
        const self = this;
        function observedWrite(chunk, ...args) {
            if (self.observing) self.data('downstream', chunk);
            return write.call(this, chunk, ...args);
        }
        function observedEnd(chunk, ...args) {
            if (self.observing && (typeof chunk === 'string' || Buffer.isBuffer(chunk) || chunk instanceof Uint8Array)) self.data('downstream', chunk);
            return end.call(this, chunk, ...args);
        }
        response.write = observedWrite;
        response.end = observedEnd;
        this.cleanups.push(() => {
            if (response.write === observedWrite) response.write = write;
            if (response.end === observedEnd) response.end = end;
        });
        this.listen(response, 'finish', () => {
            this.record.downstream.endedAtMs = this.ms();
            this.record.downstream.httpStatus = response.statusCode;
            this.downstreamParser.end();
            this.event('downstream_finish', { status: response.statusCode });
        });
        this.listen(response, 'close', () => {
            this.record.downstream.closedAtMs = this.ms();
            this.record.downstream.finished = response.writableFinished;
            this.event('downstream_close', { finished: response.writableFinished });
            // Keep listeners briefly so cancellation from the native handler is captured.
            const timer = setTimeout(() => this.detach('response_closed'), 250);
            timer.unref?.();
            this.cleanups.push(() => clearTimeout(timer));
        });
        this.listen(response, 'error', error => this.failure(error, 'downstream'));
        this.listen(request, 'aborted', () => this.event('incoming_request_aborted'));
        const pulse = setInterval(() => { this.event('sample', this.sample()); }, 10000);
        const lifetime = setTimeout(() => this.detach('capture_window_ended'), HOUR);
        pulse.unref?.(); lifetime.unref?.();
        this.cleanups.push(() => clearInterval(pulse), () => clearTimeout(lifetime));
        this.event('request_start');
    }

    ms() { return Math.round(performance.now() - this.start); }

    listen(emitter, name, fn) {
        emitter.on(name, fn);
        this.cleanups.push(() => emitter.removeListener(name, fn));
    }

    event(type, detail = {}) {
        if (!this.observing) return;
        const events = this.record.events;
        if (events.length >= MAX_EVENTS) events.splice(1, 1);
        events.push({ atMs: this.ms(), type, ...detail });
        this.owner.store.schedule(this.owner);
    }

    sample() {
        const now = this.ms();
        const up = this.record.upstream;
        return { upstreamBytes: up.bytes, downstreamBytes: this.record.downstream.bytes,
            upstreamIdleMs: now - (up.lastByteMs ?? this.record.fetchStartedAtMs ?? 0),
            downstreamOpen: !this.response.destroyed && !this.response.writableEnded };
    }

    data(side, chunk) {
        if (!this.observing || chunk == null || typeof chunk === 'function') return;
        const bytes = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength;
        if (!bytes) return;
        const m = this.record[side];
        const ms = this.ms();
        const previous = m.lastByteMs ?? (side === 'upstream' ? this.record.fetchStartedAtMs ?? 0 : 0);
        m.maxGapMs = Math.max(m.maxGapMs, ms - previous);
        m.bytes += bytes; m.chunks++; m.lastByteMs = ms;
        if (m.firstByteMs === null) { m.firstByteMs = ms; this.event(side + '_first_byte'); }
        try { (side === 'upstream' ? this.upstreamParser : this.downstreamParser).push(chunk); } catch { this.record.observerParseError = true; }
    }

    startUpstream(url, body, headers, signal) {
        if (!this.observing) return;
        const parsed = new URL(url);
        this.record.fetchStartedAtMs = this.ms();
        const names = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
        this.record.effectiveRequest = {
            endpoint: /^(?:(?:[a-z0-9-]+-)?aiplatform\.googleapis\.com|aiplatform\.(?:us|eu)\.rep\.googleapis\.com)$/.test(parsed.hostname) ? 'google_vertex'
                : parsed.hostname === 'generativelanguage.googleapis.com' ? 'google_ai_studio' : 'custom_endpoint',
            tls: parsed.protocol === 'https:',
            streamFunctionCallArguments: body.toolConfig?.functionCallingConfig?.streamFunctionCallArguments === true,
            thinkingConfigPresent: Boolean(body.generationConfig?.thinkingConfig),
            thinkingBudget: number(body.generationConfig?.thinkingConfig?.thinkingBudget),
            thinkingLevel: enumValue(body.generationConfig?.thinkingConfig?.thinkingLevel, ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'minimal', 'low', 'medium', 'high']),
            priorityHeader: enumValue(names['x-vertex-ai-llm-shared-request-type'] ?? 'absent', ['absent', 'standard', 'priority', 'flex']),
            requestTypeHeader: enumValue(names['x-vertex-ai-llm-request-type'] ?? 'absent', ['absent', 'shared', 'dedicated']),
        };
        const aborted = () => {
            this.record.signalAbortedAtMs = this.ms();
            this.event('abort_signal', { downstreamClosed: this.response.destroyed });
        };
        signal?.addEventListener('abort', aborted, { once: true });
        this.cleanups.push(() => signal?.removeEventListener('abort', aborted));
        this.event('upstream_fetch_start');
    }

    responseHeaders(response) {
        if (!this.observing) return;
        this.record.upstream.headersAtMs = this.ms();
        this.record.upstream.httpStatus = response.status;
        const contentType = response.headers.get('content-type') ?? '';
        this.record.upstream.contentType = /event-stream/i.test(contentType) ? 'sse' : /json/i.test(contentType) ? 'json' : /html/i.test(contentType) ? 'html' : 'other';
        this.event('upstream_headers', { status: response.status });
        if (!response.body) return;
        this.listen(response.body, 'data', chunk => this.data('upstream', chunk));
        this.listen(response.body, 'end', () => {
            this.record.upstream.endedAtMs = this.ms();
            this.upstreamParser.end();
            this.event('upstream_end');
        });
        this.listen(response.body, 'close', () => {
            this.record.upstream.closedAtMs = this.ms();
            this.event('upstream_close', { readableEnded: response.body.readableEnded === true });
        });
        this.listen(response.body, 'error', error => this.failure(error, 'upstream'));
    }

    failure(error, side = 'fetch') {
        if (!this.observing) return;
        const item = { atMs: this.ms(), side, ...safeError(error), ...this.sample() };
        const target = side === 'downstream' ? this.record.downstream : this.record.upstream;
        if (target.errors.length < 8) target.errors.push(item);
        this.event('error', item);
    }

    snapshot(withEvents = true) {
        const row = structuredClone(this.record);
        row.elapsedMs = this.observing ? this.ms() : this.record.elapsedMs;
        const up = row.upstream;
        row.upstreamIdleMs = (up.endedAtMs ?? up.closedAtMs ?? row.elapsedMs) - (up.lastByteMs ?? row.fetchStartedAtMs ?? 0);
        row.downstreamOpen = this.observing && !this.response.destroyed && !this.response.writableEnded;
        row.state = row.abortSource === 'local_deadline' ? 'local_deadline'
            : ['downstream_closed', 'incoming_aborted'].includes(row.abortSource) ? 'downstream_closed_early'
                : row.abortSource === 'downstream_error' ? 'downstream_error'
                    : up.errors.length ? 'upstream_error'
                        : row.downstream.errors.length ? 'downstream_error'
                            : up.httpStatus >= 400 ? 'upstream_http_error'
                                : row.downstream.httpStatus >= 400 ? 'local_http_error'
                                    : row.downstream.closedAtMs !== null && !row.downstream.finished ? 'downstream_closed_early'
                                        : row.downstream.endedAtMs !== null ? 'response_finished' : 'in_progress';
        if (!withEvents) delete row.events;
        return row;
    }

    detach(reason) {
        if (!this.observing) return;
        this.event('capture_end', { reason });
        this.record.elapsedMs = this.ms();
        this.observing = false;
        this.upstreamParser.buffer = ''; this.downstreamParser.buffer = '';
        this.cleanups.splice(0).forEach(fn => fn());
        this.owner.store.schedule(this.owner);
    }
}

export class StreamDebugStore {
    constructor({ persist = true } = {}) {
        this.persist = persist;
        this.runId = randomUUID();
        this.groupKey = randomBytes(32);
        this.users = new Map();
        this.router = express.Router();
        this.router.use((req, res, next) => {
            if (!req.user?.directories?.root) return res.sendStatus(401);
            res.set('Cache-Control', 'no-store');
            next();
        });
        this.router.get('/', (_req, res) => res.sendFile(fileURLToPath(new URL('gemini-stream-debug.html', import.meta.url))));
        this.router.get('/status', (req, res) => res.json(this.report(req, false)));
        this.router.get('/export', (req, res) => {
            res.attachment('sillytavern-stream-debug.json').type('json').send(JSON.stringify(this.report(req), null, 2));
        });
        this.router.post('/control', (req, res) => {
            if (!['start', 'stop', 'clear'].includes(req.body?.action)) return res.sendStatus(400);
            this.control(req, req.body.action);
            res.json(this.report(req, false));
        });
    }

    owner(request) {
        const root = request.user?.directories?.root;
        if (!root) return null;
        if (this.users.has(root)) return this.users.get(root);
        const owner = { store: this, root, until: 0, traces: [], restored: [], skipped: 0,
            timer: null, saving: null, dirty: false, diskError: null };
        owner.file = path.join(root, 'stream-debug', 'latest.json');
        if (this.persist) {
            try {
                if (fs.statSync(owner.file).size <= 4 * 1024 * 1024) {
                    const previous = JSON.parse(fs.readFileSync(owner.file, 'utf8'));
                    if (previous.schema === 'sillytavern-stream-debug/1' && Array.isArray(previous.traces)) {
                        owner.restored = previous.traces.slice(-MAX_RECORDS).map(row => ({ ...row, restoredAfterRestart: true, downstreamOpen: false }));
                    }
                }
            } catch { /* A missing previous report is normal. */ }
        }
        this.users.set(root, owner);
        return owner;
    }

    control(request, action) {
        const owner = this.owner(request);
        if (!owner) return;
        if (action === 'start') owner.until = Date.now() + HOUR;
        if (action === 'stop') owner.until = 0;
        if (action === 'clear') {
            owner.traces.forEach(trace => trace.detach('cleared'));
            owner.traces = []; owner.restored = []; owner.skipped = 0;
        }
        this.schedule(owner);
    }

    begin(request, response, kind = 'native-gemini') {
        if (request.body?.stream !== true || !['vertexai', 'makersuite'].includes(request.body?.chat_completion_source)) return null;
        // Do not read diagnostic files or allocate per-user state until the UI was opened.
        const owner = this.users.get(request.user?.directories?.root);
        if (!owner || owner.until <= Date.now()) return null;
        if (owner.traces.filter(t => t.observing).length >= MAX_ACTIVE) { owner.skipped++; return null; }
        if (owner.traces.length >= MAX_RECORDS) {
            const completed = owner.traces.findIndex(t => !t.observing);
            if (completed >= 0) owner.traces.splice(completed, 1);
        }
        const trace = new Trace(owner, request, response, kind);
        owner.traces.push(trace);
        this.schedule(owner);
        return trace;
    }

    bridgeMiddleware = (req, res, next) => {
        if (req.method === 'POST') this.begin(req, res, 'keepalive-plugin');
        next();
    };

    report(request, withEvents = true) {
        const owner = this.owner(request);
        if (!owner) return null;
        return this.ownerReport(owner, withEvents);
    }

    ownerReport(owner, withEvents = true) {
        const restored = owner.restored.map(row => {
            const copy = structuredClone(row);
            if (!withEvents) delete copy.events;
            return copy;
        });
        return { schema: 'sillytavern-stream-debug/1', patchVersion: PATCH_VERSION,
            generatedAt: new Date().toISOString(), runId: this.runId,
            server: { sillyTavern: packageVersion, node: process.version, platform: process.platform },
            recording: owner.until > Date.now(), recordingUntil: owner.until ? new Date(owner.until).toISOString() : null,
            skippedRequests: owner.skipped, persistenceError: owner.diskError,
            semantics: { downstreamBytes: 'bytes offered to Node response; not confirmation of browser receipt',
                bodyGroup: 'ephemeral keyed hash of request body; equal bodies may be separate retries',
                upstreamIdleMs: 'time since last upstream bytes, or fetch start before first byte',
                protocolCounts: 'observed occurrences; complete snapshots and partial args may overlap' },
            traces: [...restored, ...owner.traces.map(t => t.snapshot(withEvents))].slice(-MAX_RECORDS) };
    }

    schedule(owner) {
        if (!this.persist) return;
        owner.dirty = true;
        if (owner.timer || owner.saving) return;
        owner.timer = setTimeout(() => { owner.timer = null; void this.flush(owner); }, 500);
        owner.timer.unref?.();
    }

    async flush(owner) {
        if (!this.persist) return;
        if (owner.saving) { await owner.saving; return this.flush(owner); }
        clearTimeout(owner.timer); owner.timer = null;
        if (!owner.dirty) return;
        owner.dirty = false;
        const snapshot = JSON.stringify(this.ownerReport(owner));
        owner.saving = (async () => {
            try {
                await fs.promises.mkdir(path.dirname(owner.file), { recursive: true });
                const temp = owner.file + '.' + process.pid + '.tmp';
                await fs.promises.writeFile(temp, snapshot, { mode: 0o600 });
                await fs.promises.rename(temp, owner.file);
                owner.diskError = null;
            } catch (error) { owner.diskError = safeError(error).code; }
        })();
        await owner.saving;
        owner.saving = null;
        if (owner.dirty) this.schedule(owner);
    }

    async close() {
        for (const owner of this.users.values()) {
            owner.traces.forEach(t => t.detach('observer_closed'));
            await this.flush(owner);
        }
    }
}

export const streamDebug = new StreamDebugStore();
