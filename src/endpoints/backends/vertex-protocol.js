// Argon REST contract: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-4-argon
// Partial arguments: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tools/function-calling
import { StringDecoder } from 'node:string_decoder';
import { convertGooglePrompt, getPromptNames, calculateGoogleBudgetTokens } from '../../prompt-converters.js';
import { GEMINI_SAFETY, VERTEX_SAFETY } from '../../constants.js';

export class VertexError extends Error {
    constructor(code, message, status = 502) {
        super(message);
        this.name = 'VertexError';
        this.code = code;
        this.status = status;
    }
}

const fail = message => { throw new VertexError('VERTEX_CONFIG', message, 400); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
export const isArgon = model => /^gemini-4-argon(?:-|$)/i.test(model);
const modern = model => /^gemini-[34](?:[.-]|$)/i.test(model);

function choice(value, allowed, fallback, field) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!allowed.includes(value)) fail(`${field} 的值无效。`);
    return value;
}

export function vertexOptions(input) {
    const model = String(input.model || '');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) fail('Vertex 模型 ID 无效。');
    if (input.tools !== undefined && !Array.isArray(input.tools)) fail('tools 应为数组。');
    const argon = isArgon(model);
    const tier = choice(input.vertexai_service_tier, ['auto', 'standard', 'priority', 'flex'], 'auto', '服务档位');
    const capacity = choice(input.vertexai_request_type, ['auto', 'shared', 'dedicated'], 'auto', '容量类型');
    const version = choice(input.vertexai_api_version, ['auto', 'v1', 'v1beta1'], 'auto', 'API 版本');
    const timeout = Number(input.vertexai_timeout ?? 1200);
    if (!Number.isFinite(timeout) || timeout < 30 || timeout > 7200) fail('总等待上限应为 30～7200 秒。');
    if (tier === 'flex' && (input.vertexai_region || 'global') !== 'global') fail('Flex 需要 global 区域。');
    if (argon && tier === 'flex') fail('当前 Vertex 官方 Flex 支持列表未列出 Argon，请选择默认、Standard 或 Priority。');
    if (capacity === 'dedicated' && tier !== 'auto') fail('仅专用容量与 PayGo 档位不能同时指定。');
    const autoContinue = input.vertexai_auto_continue !== false && argon;
    const max = Number(input.max_tokens ?? 65536);
    if (!Number.isInteger(max) || max < 1 || max > 1048576) fail('输出上限应为 1～1048576 个 token。');
    if (argon && version === 'v1' && autoContinue && max > (input.stream ? 65536 : 32768)) {
        fail('Argon 超长续传需要 v1beta1，请将 API 版本设为自动或 v1beta1。');
    }
    return { model, argon, tier, capacity, max, timeoutMs: timeout * 1000, autoContinue,
        apiVersion: version === 'auto' ? (autoContinue ? 'v1beta1' : 'v1') : version,
        streamArguments: modern(model) && !/^gemini-3\.1-flash-lite/.test(model) && input.stream === true && input.vertexai_argument_streaming !== false,
        unwrapContent: input.vertexai_unwrap_content !== false && input.tools?.some(t => t?.function?.name === 'actual_content') === true };
}

/** Build one immutable request; continuation changes only the top-level token. */
export function buildVertexRequest(request, options = vertexOptions(request.body)) {
    const input = request.body;
    if (!Array.isArray(input.messages) || !input.messages.length) fail('Vertex 请求需要非空消息列表。');
    const prompt = convertGooglePrompt(structuredClone(input.messages), options.model, !!input.use_sysprompt, getPromptNames(request));
    const config = { maxOutputTokens: options.max };
    if (!options.argon) {
        for (const [source, target] of [['temperature', 'temperature'], ['top_p', 'topP'], ['top_k', 'topK'], ['seed', 'seed']]) {
            if (typeof input[source] === 'number' && Number.isFinite(input[source]) && !(source === 'seed' && input[source] < 0)) config[target] = input[source];
        }
    }
    if (Array.isArray(input.stop) && input.stop.length) config.stopSequences = input.stop;
    if (input.responseMimeType) config.responseMimeType = input.responseMimeType;
    const schema = input.responseSchema ?? input.json_schema?.value;
    if (schema) { config.responseSchema = schema; config.responseMimeType ||= 'application/json'; }
    if (modern(options.model)) {
        config.thinkingConfig = { includeThoughts: !!input.include_reasoning };
        const effort = input.reasoning_effort;
        if (effort && effort !== 'auto') {
            const levels = { min: options.argon ? 'LOW' : (/pro/.test(options.model) ? 'LOW' : 'MINIMAL'), minimal: options.argon ? 'LOW' : 'MINIMAL', low: 'LOW', medium: 'MEDIUM', high: 'HIGH', max: 'HIGH' };
            if (!levels[effort]) fail('此模型需要 auto、low、medium 或 high 思考档位。');
            config.thinkingConfig.thinkingLevel = levels[effort];
        }
    } else if (/^gemini-2\.5-(?:flash|pro)/.test(options.model) && !/-image/.test(options.model)) {
        const budget = calculateGoogleBudgetTokens(options.max, input.reasoning_effort || 'auto', options.model);
        config.thinkingConfig = { includeThoughts: budget === 0 ? false : !!input.include_reasoning };
        if (Number.isInteger(budget)) config.thinkingConfig.thinkingBudget = budget;
    }
    if (input.request_images) {
        if (options.argon) fail('Argon 返回文本，图像生成需要选择图像模型。');
        config.responseModalities = ['TEXT', 'IMAGE'];
        config.imageConfig = {};
        if (input.request_image_resolution) config.imageConfig.imageSize = input.request_image_resolution;
        if (input.request_image_aspect_ratio) config.imageConfig.aspectRatio = input.request_image_aspect_ratio;
    }
    const body = { contents: prompt.contents, generationConfig: config, safetySettings: [...GEMINI_SAFETY, ...VERTEX_SAFETY] };
    if (prompt.system_instruction.parts.length) body.systemInstruction = prompt.system_instruction;
    const declarations = [], tools = [];
    for (const tool of input.tools || []) {
        if (!object(tool)) fail('工具定义应为对象。');
        if (tool.type === 'function') {
            if (!object(tool.function) || typeof tool.function.name !== 'string') fail('函数定义缺少名称。');
            const fn = structuredClone(tool.function);
            delete fn.strict;
            if (fn.parameters) delete fn.parameters.$schema;
            if (fn.parameters?.properties && !Object.keys(fn.parameters.properties).length) delete fn.parameters;
            declarations.push(fn);
        } else if (['google_search', 'googleSearch', 'url_context', 'urlContext', 'code_execution', 'codeExecution', 'retrieval', 'googleMaps'].includes(tool.type) && tool[tool.type]) {
            tools.push({ [tool.type]: tool[tool.type] });
        }
    }
    if (declarations.length) tools.unshift({ functionDeclarations: declarations });
    if (input.enable_web_search) tools.push({ googleSearch: {} });
    if (tools.length) body.tools = tools;
    if (declarations.length) {
        const selected = input.tool_choice;
        const mode = { auto: 'AUTO', none: 'NONE', required: 'ANY', validated: 'VALIDATED' }[selected] || 'AUTO';
        body.toolConfig = { functionCallingConfig: { mode } };
        if (selected?.function?.name) body.toolConfig.functionCallingConfig = { mode: 'ANY', allowedFunctionNames: [selected.function.name] };
    }
    if (options.argon) {
        const thinking = body.generationConfig.thinkingConfig;
        if (thinking?.thinkingBudget !== undefined) fail('Argon 使用 thinkingLevel，不支持 thinkingBudget。');
        if (thinking?.thinkingLevel && !['LOW', 'MEDIUM', 'HIGH'].includes(thinking.thinkingLevel)) fail('Argon thinkingLevel 只支持 LOW、MEDIUM、HIGH。');
        for (const key of ['temperature', 'topP', 'topK', 'candidateCount', 'frequencyPenalty', 'presencePenalty']) delete body.generationConfig[key];
    }
    if (body.tools && !Array.isArray(body.tools)) fail('tools 应为数组。');
    const hasFunctions = body.tools?.some(t => t.functionDeclarations?.length || t.function_declarations?.length);
    if (hasFunctions && options.streamArguments) {
        body.toolConfig ||= {};
        body.toolConfig.functionCallingConfig ||= { mode: 'AUTO' };
        body.toolConfig.functionCallingConfig.streamFunctionCallArguments = true;
    }
    if (!modern(options.model) && hasFunctions && body.tools.some(t => !t.functionDeclarations && !t.function_declarations)) {
        fail('此旧模型的函数调用与内置工具组合不受支持，请关闭搜索、URL 读取或代码执行。');
    }
    if (body.generationConfig.candidateCount && body.generationConfig.candidateCount !== 1) fail('当前聊天通道每次接收一个候选回复。');
    return body;
}

/** Parse complete SSE frames before forwarding so heartbeat comments cannot split JSON. */
export async function* readVertexSse(readable) {
    const decoder = new StringDecoder('utf8');
    let pending = '';
    const parse = event => {
        if (event.length > 32 * 1024 * 1024) throw new VertexError('VERTEX_EVENT_LIMIT', 'Vertex 单个流事件超过 32 MiB。');
        const data = event.split(/\r\n|\n|\r/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data || data === '[DONE]') return null;
        try { return JSON.parse(data); } catch { throw new VertexError('VERTEX_INVALID_STREAM', 'Vertex 返回了无法解析的流式 JSON。'); }
    };
    for await (const chunk of readable) {
        pending += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        let boundary;
        while ((boundary = /\r\n\r\n|\n\n|\r\r/.exec(pending))) {
            const value = parse(pending.slice(0, boundary.index));
            pending = pending.slice(boundary.index + boundary[0].length);
            if (value !== null) yield value;
        }
        if (pending.length > 32 * 1024 * 1024) throw new VertexError('VERTEX_EVENT_LIMIT', 'Vertex 单个流事件超过 32 MiB。');
    }
    pending += decoder.end();
    if (pending.trim()) {
        const value = parse(pending);
        if (value !== null) yield value;
    }
}

function pathTokens(jsonPath) {
    if (typeof jsonPath !== 'string' || jsonPath[0] !== '$') fail('函数参数片段缺少有效 JSONPath。');
    const keys = [];
    const pattern = /\.([\w$-]+)|\[(\d+)|\["((?:\\.|[^"\\])*)"\]|\['((?:\\.|[^'\\])*)'\]/gy;
    let at = 1;
    while (at < jsonPath.length) {
        pattern.lastIndex = at;
        const match = pattern.exec(jsonPath);
        if (!match) fail('函数参数包含无法解析的 JSONPath。');
        let key;
        if (match[2] !== undefined) {
            if (jsonPath[pattern.lastIndex] !== ']') fail('函数数组索引格式错误。');
            at = pattern.lastIndex + 1;
            key = Number(match[2]);
            if (key > 100000) fail('函数数组索引过大。');
        } else {
            at = pattern.lastIndex;
            key = match[1] ?? (match[3] !== undefined ? JSON.parse('"' + match[3] + '"') : match[4].replace(/\\'/g, '\''));
        }
        if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('函数参数包含禁止的对象键。');
        keys.push(key);
        if (keys.length > 64) fail('函数参数嵌套超过限制。');
    }
    if (!keys.length) fail('函数参数片段必须指向一个属性。');
    return keys;
}

export class VertexFunctionStream {
    constructor({ unwrapContent = false } = {}) {
        this.unwrapContent = unwrapContent;
        this.active = new Map();
        this.completed = 0;
        this.visibleChars = 0;
        this.signature = '';
    }

    transform(frame) {
        for (const candidate of frame.candidates || []) {
            const index = candidate.index ?? 0;
            const output = [];
            for (const part of candidate.content?.parts || []) {
                const call = part.functionCall;
                if (!call) {
                    if (!part.thought && typeof part.text === 'string') this.visibleChars += part.text.trim().length;
                    if (part.inlineData && !part.thought) this.visibleChars++;
                    output.push(part);
                    continue;
                }
                let state = this.active.get(index);
                if (!state) {
                    state = { name: call.name, id: call.id, args: {}, openStrings: new Set(), emitted: '', signature: '' };
                    this.active.set(index, state);
                }
                if (call.name) {
                    if (state.name && state.name !== call.name) throw new VertexError('VERTEX_INVALID_STREAM', '函数参数流发生交错，无法安全拼接。');
                    state.name = call.name;
                }
                if (call.id) {
                    if (state.id && state.id !== call.id) throw new VertexError('VERTEX_INVALID_STREAM', '函数调用 ID 在参数传输中发生变化。');
                    state.id = call.id;
                }
                if (part.thoughtSignature) state.signature = part.thoughtSignature;
                for (const fragment of call.partialArgs || []) {
                    const keys = pathTokens(fragment.jsonPath);
                    let target = state.args;
                    for (let i = 0; i < keys.length - 1; i++) {
                        target = target[keys[i]] ??= typeof keys[i + 1] === 'number' ? [] : {};
                        if (!target || typeof target !== 'object') throw new VertexError('VERTEX_INVALID_STREAM', '函数参数路径与已接收的值冲突。');
                    }
                    const key = keys.at(-1);
                    const valueKey = ['stringValue', 'numberValue', 'boolValue', 'nullValue'].find(k => Object.hasOwn(fragment, k));
                    // Google may omit an empty string value on the closing fragment.
                    if (!valueKey) {
                        if (!state.openStrings.has(fragment.jsonPath) || fragment.willContinue) throw new VertexError('VERTEX_INVALID_STREAM', '函数参数片段缺少值。');
                        state.openStrings.delete(fragment.jsonPath);
                        continue;
                    }
                    const value = valueKey === 'nullValue' ? null : fragment[valueKey];
                    target[key] = state.openStrings.has(fragment.jsonPath) ? String(target[key] ?? '') + value : value;
                    if (fragment.willContinue && valueKey === 'stringValue') state.openStrings.add(fragment.jsonPath);
                    else state.openStrings.delete(fragment.jsonPath);
                }
                if (call.args !== undefined) {
                    if (!object(call.args)) throw new VertexError('VERTEX_INVALID_STREAM', 'Vertex 函数参数应为 JSON 对象。');
                    state.args = structuredClone(call.args);
                }
                if (this.unwrapContent && state.name === 'actual_content') {
                    const content = state.args.content;
                    if (typeof content === 'string') {
                        if (!content.startsWith(state.emitted)) throw new VertexError('VERTEX_INVALID_STREAM', '正文参数流与已输出内容不一致。');
                        const text = content.slice(state.emitted.length);
                        state.emitted = content;
                        this.visibleChars += text.trim().length;
                        if (text || state.signature) output.push({ text, ...(state.signature ? { thoughtSignature: state.signature } : {}) });
                    }
                }
                if (call.willContinue !== true) {
                    if (state.openStrings.size) throw new VertexError('VERTEX_INCOMPLETE_FUNCTION', '函数调用结束时字符串参数尚未传完。');
                    if (!state.name) throw new VertexError('VERTEX_INVALID_STREAM', '完整函数调用缺少名称。');
                    if (!(this.unwrapContent && state.name === 'actual_content')) {
                        output.push({ functionCall: { name: state.name, args: state.args, ...(state.id ? { id: state.id } : {}) },
                            ...(state.signature ? { thoughtSignature: state.signature } : {}) });
                        this.completed++;
                    }
                    this.active.delete(index);
                }
            }
            if (candidate.content) candidate.content.parts = output;
        }
        return frame;
    }
}
