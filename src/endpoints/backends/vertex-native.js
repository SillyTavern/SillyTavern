import fetch from 'node-fetch';
import { createHash } from 'node:crypto';
import { readSecret, SECRET_KEYS } from '../secrets.js';
import { generateJWTToken, getProjectIdFromServiceAccount } from '../google.js';
import { streamDebug } from '../../diagnostics/gemini-stream-debug.js';
import { VertexError, vertexOptions, buildVertexRequest, readVertexSse, VertexFunctionStream } from './vertex-protocol.js';

const VERSION = '1.0.0';
const tokens = new Map();
const usageKeys = ['promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'cachedContentTokenCount', 'totalTokenCount', 'toolUsePromptTokenCount'];

export function vertexHost(region) {
    if (region === 'global') return 'https://aiplatform.googleapis.com';
    if (region === 'us' || region === 'eu') return `https://aiplatform.${region}.rep.googleapis.com`;
    if (!/^[a-z]+-[a-z]+\d+$/.test(region)) throw new VertexError('VERTEX_CONFIG', 'Vertex 区域格式无效。', 400);
    return `https://${region}-aiplatform.googleapis.com`;
}

function safeMessage(message, secrets = []) {
    let text = String(message || '').slice(0, 4000);
    for (const secret of secrets) if (secret) text = text.split(secret).join('[redacted]');
    return text.replace(/https?:\/\/[^\s"'<>]+/g, '[endpoint]')
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .replace(/AIza[\w-]+/g, '[redacted]').slice(0, 1200);
}

async function limitedText(response, limit = 65536) {
    let text = '';
    if (!response.body) return text;
    for await (const chunk of response.body) {
        text += chunk.toString('utf8');
        if (text.length > limit) { response.body.destroy(); return text.slice(0, limit); }
    }
    return text;
}

async function httpError(response, secrets) {
    const raw = await limitedText(response);
    let message = `Vertex 返回 HTTP ${response.status}。`;
    let apiStatus;
    try {
        const data = JSON.parse(raw);
        if (typeof data.error?.message === 'string') message += ' ' + safeMessage(data.error.message, secrets);
        if (/^[A-Z_]{1,64}$/.test(data.error?.status)) apiStatus = data.error.status;
    } catch { /* HTML and proxy diagnostics may contain credentials; report the HTTP status. */ }
    const error = new VertexError('VERTEX_HTTP', message, response.status);
    error.apiStatus = apiStatus;
    return error;
}

export async function resolveVertexConnection(request, options, signal) {
    const input = request.body;
    const headers = { 'Content-Type': 'application/json', Accept: input.stream ? 'text/event-stream' : 'application/json' };
    const region = input.vertexai_region || 'global';
    const method = input.stream ? 'streamGenerateContent' : 'generateContent';
    let prefix, project, secrets = [];
    if (input.reverse_proxy) {
        const proxy = new URL(input.reverse_proxy);
        if (!['http:', 'https:'].includes(proxy.protocol) || proxy.username || proxy.password || proxy.search || proxy.hash) {
            throw new VertexError('VERTEX_CONFIG', '反向代理应为不含认证信息、查询参数或片段的 HTTP(S) 基址。', 400);
        }
        const base = proxy.toString().replace(/\/$/, '').replace(/\/(v1|v1beta1)$/, '');
        prefix = `${base}/${options.apiVersion}`;
        headers.Authorization = `Bearer ${input.proxy_password || ''}`;
        secrets = [input.proxy_password];
    } else if ((input.vertexai_auth_mode || 'express') === 'express') {
        const key = readSecret(request.user.directories, SECRET_KEYS.VERTEXAI, input.secret_id);
        if (!key) throw new VertexError('VERTEX_AUTH', '请在 Vertex 连接中保存 API 密钥。', 401);
        headers['x-goog-api-key'] = key;
        secrets = [key];
        project = input.vertexai_express_project_id;
        prefix = `${vertexHost(region)}/${options.apiVersion}`;
    } else if (input.vertexai_auth_mode === 'full') {
        const raw = readSecret(request.user.directories, SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT, input.secret_id);
        let account;
        try { account = JSON.parse(raw); project = getProjectIdFromServiceAccount(account); } catch { throw new VertexError('VERTEX_AUTH', '请在 Vertex 连接中保存有效的服务账号 JSON。', 401); }
        const cacheKey = createHash('sha256').update(request.user.directories.root).update('\0').update(raw).digest('hex');
        let cached = tokens.get(cacheKey);
        if (!cached || cached.expires <= Date.now() + 60000) {
            let jwt;
            try { jwt = await generateJWTToken(account); } catch { throw new VertexError('VERTEX_AUTH', '服务账号私钥无法用于签名。', 401); }
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal,
                body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
            });
            if (!response.ok) { await limitedText(response); throw new VertexError('VERTEX_AUTH', `服务账号换取令牌失败：HTTP ${response.status}。`, 401); }
            const data = await response.json();
            if (typeof data.access_token !== 'string') throw new VertexError('VERTEX_AUTH', '认证响应缺少访问令牌。', 401);
            cached = { token: data.access_token, expires: Date.now() + Math.min(Number(data.expires_in) || 3600, 3600) * 1000 };
            if (tokens.size >= 100) tokens.delete(tokens.keys().next().value);
            tokens.set(cacheKey, cached);
        }
        headers.Authorization = `Bearer ${cached.token}`;
        secrets = [cached.token];
        prefix = `${vertexHost(region)}/${options.apiVersion}`;
    } else throw new VertexError('VERTEX_AUTH', '当前认证模式应为 API 密钥或服务账号。', 400);
    if (project && !/^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,127}$/.test(project)) throw new VertexError('VERTEX_CONFIG', 'Google Cloud 项目 ID 格式无效。', 400);
    if (project) prefix += `/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(region)}`;
    if (options.tier !== 'auto') headers['X-Vertex-AI-LLM-Shared-Request-Type'] = options.tier;
    if (options.capacity !== 'auto') headers['X-Vertex-AI-LLM-Request-Type'] = options.capacity;
    if (options.tier === 'flex') headers['X-Server-Timeout'] = String(Math.min(1800, options.timeoutMs / 1000));
    const url = `${prefix}/publishers/google/models/${encodeURIComponent(options.model)}:${method}${input.stream ? '?alt=sse' : ''}`;
    return { url, headers, secrets };
}

function addUsage(total, latest) {
    for (const key of usageKeys) if (Number.isFinite(latest?.[key])) total[key] = (total[key] || 0) + latest[key];
    if (latest?.trafficType) total.trafficType = latest.trafficType;
}

function appendParts(target, parts) {
    for (const part of parts || []) {
        const previous = target.at(-1);
        if (typeof part.text === 'string' && !part.thoughtSignature && previous && typeof previous.text === 'string' && !!previous.thought === !!part.thought && !previous.thoughtSignature) previous.text += part.text;
        else target.push(structuredClone(part));
    }
}

/** A single client response owns auth, model requests and continuation segments. */
export function createVertexHandler({ fetchImpl = fetch, resolveConnection = resolveVertexConnection, heartbeatMs = 10000, debug = streamDebug } = {}) {
    return async function sendVertexRequest(request, response) {
        const diagnostic = debug?.begin(request, response);
        const controller = new AbortController();
        const signal = controller.signal;
        let timer, heartbeat, abortSource = '', secrets = [], remote;
        let phase = 'configuration', options, body;
        const started = Date.now();
        const usage = {};
        let segments = 0;
        const abort = source => {
            if (signal.aborted) return;
            abortSource = source;
            if (diagnostic) diagnostic.record.abortSource = source;
            diagnostic?.event('vertex_abort', { source });
            controller.abort();
        };
        const closed = () => { if (!response.writableFinished) abort('downstream_closed'); };
        const incomingAborted = () => abort('incoming_aborted');
        const responseError = () => abort('downstream_error');
        response.on('close', closed);
        response.on('error', responseError);
        request.on('aborted', incomingAborted);
        const send = async value => {
            if (signal.aborted || response.destroyed || response.writableEnded) return;
            const ok = response.write(value);
            response.flush?.();
            if (!ok) await new Promise((resolve, reject) => {
                const cleanup = () => { response.off('drain', drained); signal.removeEventListener('abort', aborted); };
                const drained = () => { cleanup(); resolve(); };
                const aborted = () => { cleanup(); reject(new VertexError('VERTEX_CANCELLED', '连接已取消。')); };
                response.once('drain', drained);
                signal.addEventListener('abort', aborted, { once: true });
                if (signal.aborted) aborted();
            });
        };
        const event = value => send(`data: ${JSON.stringify(value)}\n\n`);
        const metadata = extra => ({ version: VERSION, phase, segments, elapsedMs: Date.now() - started, serviceTier: options.tier, apiVersion: options.apiVersion, ...extra });
        try {
            options = vertexOptions(request.body);
            body = buildVertexRequest(request, options);
            const stream = request.body.stream === true;
            timer = setTimeout(() => abort('local_deadline'), options.timeoutMs);
            timer.unref?.();
            // Flush before authentication or model TTFT; the same response carries heartbeats.
            response.status(200).set({ 'Content-Type': stream ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8',
                'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no', 'X-ST-Vertex-Native': VERSION });
            response.flushHeaders();
            await send(stream ? ': vertex-native connected\n\n' : '\n');
            heartbeat = setInterval(() => {
                if (!signal.aborted && !response.destroyed && !response.writableEnded && !response.writableNeedDrain) {
                    response.write(stream ? ': vertex-native waiting\n\n' : '\n');
                    response.flush?.();
                }
            }, heartbeatMs);
            heartbeat.unref?.();
            phase = 'authentication';
            if (stream) await event({ vertexMeta: metadata({}) });
            const converter = new VertexFunctionStream({ unwrapContent: options.unwrapContent });
            const seenTokens = new Set();
            const accumulatedParts = [];
            let continuation, finishReason, finalFrame = {}, initialPromptTokenCount;
            do {
                if (signal.aborted) throw new VertexError('VERTEX_CANCELLED', '请求已取消。');
                if (++segments > 32) throw new VertexError('VERTEX_CONTINUATION_LIMIT', '续传已达 32 段上限，已停止继续请求。');
                phase = segments === 1 ? 'authentication' : 'continuation';
                const connection = await resolveConnection(request, options, signal);
                secrets = connection.secrets || [];
                const currentBody = continuation ? { ...body, continuationToken: continuation } : body;
                if (segments === 1) diagnostic?.startUpstream(connection.url, body, connection.headers, signal);
                diagnostic?.event('vertex_segment_start', { segment: segments });
                phase = 'waiting_for_vertex';
                if (stream) await event({ vertexMeta: metadata({}) });
                remote = await fetchImpl(connection.url, { method: 'POST', headers: connection.headers, body: JSON.stringify(currentBody), signal });
                diagnostic?.responseHeaders(remote);
                if (!remote.ok) throw await httpError(remote, secrets);
                phase = 'receiving';
                let latestUsage = {}, candidateToken, candidateReason;
                const handle = async raw => {
                    if (raw?.error) {
                        const error = new VertexError('VERTEX_API', safeMessage(raw.error.message || 'Vertex 返回错误。', secrets), Number(raw.error.code) || 502);
                        if (/^[A-Z_]{1,64}$/.test(raw.error.status)) error.apiStatus = raw.error.status;
                        throw error;
                    }
                    if (raw?.promptFeedback?.blockReason) throw new VertexError('VERTEX_BLOCKED', `Vertex 阻止了此请求：${raw.promptFeedback.blockReason}。`, 400);
                    if (raw.usageMetadata) latestUsage = raw.usageMetadata;
                    initialPromptTokenCount ??= raw.initialPromptTokenCount ?? raw.usageMetadata?.initialPromptTokenCount ?? raw.usageMetadata?.promptTokenCount;
                    for (const candidate of raw.candidates || []) {
                        if (candidate.finishReason) candidateReason = candidate.finishReason;
                        if (candidate.continuationToken) candidateToken = candidate.continuationToken;
                        delete candidate.continuationToken;
                        if (candidate.finishReason === 'CONTINUATION') delete candidate.finishReason;
                    }
                    delete raw.continuationToken;
                    const transformed = converter.transform(raw);
                    if (stream) await event(transformed);
                    else appendParts(accumulatedParts, transformed.candidates?.[0]?.content?.parts);
                    finalFrame = transformed;
                };
                if (stream) {
                    for await (const raw of readVertexSse(remote.body)) await handle(raw);
                } else await handle(await remote.json());
                addUsage(usage, latestUsage);
                finishReason = candidateReason;
                diagnostic?.event('vertex_segment_end', { segment: segments, reason: /^[A-Z_]{1,64}$/.test(finishReason) ? finishReason : 'missing' });
                if (candidateReason === 'CONTINUATION') {
                    if (!candidateToken) throw new VertexError('VERTEX_CONTINUATION_MISSING', 'Vertex 要求续传，但没有返回 continuationToken。');
                    if (!options.autoContinue) throw new VertexError('VERTEX_CONTINUATION_DISABLED', 'Vertex 返回续传点；请启用 Argon 自动续传以完成此回复。');
                    if (seenTokens.has(candidateToken)) throw new VertexError('VERTEX_CONTINUATION_LOOP', 'Vertex 重复返回相同续传令牌，已停止循环。');
                    seenTokens.add(candidateToken);
                    continuation = candidateToken;
                    phase = 'continuation';
                } else continuation = undefined;
            } while (continuation);
            if (converter.active.size) throw new VertexError('VERTEX_INCOMPLETE_FUNCTION', 'Vertex 连接结束时函数参数尚未传完，已保留收到的正文。');
            if (!finishReason) throw new VertexError('VERTEX_INCOMPLETE_STREAM', 'Vertex 数据流结束，但缺少模型结束标记。已收到的正文可能不完整。');
            if (!converter.visibleChars && !converter.completed) {
                throw new VertexError('VERTEX_EMPTY', `Vertex 没有返回可显示正文或完整工具调用（结束原因：${finishReason}）。`);
            }
            phase = 'completed';
            const meta = metadata({ finishReason, initialPromptTokenCount,
                warning: finishReason === 'MAX_TOKENS' ? '已达到输出 token 上限，回复可能被截断。' : undefined });
            if (diagnostic) diagnostic.record.vertexNative = { version: VERSION, segments, finishReason, elapsedMs: meta.elapsedMs };
            if (stream) {
                await event({ vertexMeta: meta, usageMetadata: usage });
                await send('data: [DONE]\n\n');
            } else {
                const responseContent = { role: 'model', parts: accumulatedParts };
                await send(JSON.stringify({ ...finalFrame, candidates: [{ ...finalFrame.candidates?.[0], content: responseContent, finishReason }],
                    choices: [{ message: { content: accumulatedParts.filter(p => !p.thought).map(p => p.text || '').join('') } }],
                    responseContent, usageMetadata: usage, vertexMeta: meta }));
            }
            response.end();
        } catch (error) {
            diagnostic?.failure(error);
            const clientGone = ['downstream_closed', 'incoming_aborted', 'downstream_error'].includes(abortSource);
            if (clientGone || response.destroyed) return;
            const timeout = abortSource === 'local_deadline';
            const code = timeout ? 'VERTEX_DEADLINE' : error instanceof VertexError ? error.code : (error.code || 'VERTEX_NETWORK');
            const message = timeout ? `已达到本地设置的总等待上限（${options.timeoutMs / 1000} 秒）。`
                : error instanceof VertexError ? error.message : `连接 Vertex 失败（${error.code || error.name || 'network'}）。`;
            const report = { error: { message: safeMessage(message, secrets), code, phase,
                status: timeout ? 504 : Number(error.status) || 502, apiStatus: error.apiStatus,
                elapsedMs: Date.now() - started, segments } };
            diagnostic?.event('vertex_failure', { phase, code: error instanceof VertexError || timeout ? code : 'network' });
            console.warn(`[Vertex Native] ${report.error.code} (${phase}, ${report.error.elapsedMs}ms)`);
            if (!response.headersSent) response.status(report.error.status).json(report);
            else {
                // The local deadline aborts upstream I/O; its error still belongs on the open client response.
                const payload = request.body.stream ? `data: ${JSON.stringify(report)}\n\ndata: [DONE]\n\n` : JSON.stringify(report);
                response.end(payload);
            }
        } finally {
            clearInterval(heartbeat);
            clearTimeout(timer);
            remote?.body?.destroy();
            response.off('close', closed);
            response.off('error', responseError);
            request.off('aborted', incomingAborted);
        }
    };
}

export const sendVertexRequest = createVertexHandler();
