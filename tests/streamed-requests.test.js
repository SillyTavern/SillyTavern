import { describe, expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';

async function loadModule(path, overrides = {}, globals = {}) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const context = vm.createContext({ AbortController, AbortSignal, console, ...globals });
    const module = new vm.SourceTextModule(source, { context });
    await module.link(async (specifier) => {
        const declaration = source.match(new RegExp(`import ([^;]+) from ['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`));
        const names = declaration[1].includes('{')
            ? declaration[1].match(/\{([^}]+)\}/)[1].split(',').map(name => name.trim().split(/\s+as\s+/)[0])
            : ['default'];
        const values = overrides[specifier] ?? {};
        return new vm.SyntheticModule(names, function () {
            for (const name of names) this.setExport(name, values[name]);
        }, { context });
    });
    await module.evaluate();
    return module.namespace;
}

describe('streamed requests', () => {
    test('holds the extension generation lock until its processor is cleared', async () => {
        const source = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');
        const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
        const declaration = name => tree.body.find(node => node.type === 'ExportNamedDeclaration' && node.declaration?.id?.name === name).declaration;
        const setter = declaration('setStreamingProcessor');
        const processorClass = declaration('StreamingProcessor');
        const stopMethod = processorClass.body.body.find(node => node.key.name === 'markUIGenStopped');
        const context = vm.createContext({
            is_send_press: false, is_group_generating: false, streamingProcessor: null, extensionStreamingProcessor: null,
            deactivateSendButtons: jest.fn(),
            unblockGeneration: jest.fn(() => { context.is_send_press = false; }),
        });
        vm.runInContext(`${source.slice(setter.start, setter.end)}; class Processor { ${source.slice(stopMethod.start, stopMethod.end)} }; this.Processor = Processor;`, context);
        const processor = new context.Processor();
        context.setStreamingProcessor(processor);
        expect(context.is_send_press).toBe(true);
        expect(() => context.setStreamingProcessor(new context.Processor())).toThrow('already active');
        processor.markUIGenStopped();
        expect(context.is_send_press).toBe(true);
        context.setStreamingProcessor(null);
        expect(context.is_send_press).toBe(false);
        expect(context.streamingProcessor).toBeNull();
        context.is_group_generating = true;
        expect(() => context.setStreamingProcessor(processor)).toThrow('already active');
    });

    for (const [serviceName, api, options] of [
        ['TextCompletionService', 'textgenerationwebui', { api_type: 'test' }],
        ['ChatCompletionService', 'openai', { chat_completion_source: 'test' }],
    ]) test(`${serviceName} extracts a JSON response to a streaming request without retrying`, async () => {
        const fetch = jest.fn(async () => new Response(JSON.stringify({ answer: 'reply' }), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }));
        const module = await loadModule('../public/scripts/custom-request.js', {
            '../script.js': {
                getRequestHeaders: () => ({}),
                extractMessageFromData: (data, type) => `${type}:${data.answer}`,
            },
            './reasoning.js': { extractReasoningFromData: () => 'thinking' },
        }, { fetch });

        const result = await module[serviceName].sendRequest({ stream: true, ...options });
        expect(result.content).toBe(`${api}:reply`);
        expect(result.reasoning).toBe('thinking');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    for (const [serviceName, options] of [
        ['TextCompletionService', { api_type: 'test' }],
        ['ChatCompletionService', { chat_completion_source: 'test' }],
    ]) test(`${serviceName} still consumes SSE responses`, async () => {
        const sse = await loadModule('../public/scripts/sse-stream.js', {}, { TextDecoderStream, TransformStream, MessageEvent });
        const fetch = jest.fn(async () => new Response('data: {"choices":[{"text":"hello"}]}\n\ndata: [DONE]\n\n', {
            headers: { 'Content-Type': 'text/event-stream' },
        }));
        const module = await loadModule('../public/scripts/custom-request.js', {
            '../script.js': { getRequestHeaders: () => ({}) },
            './sse-stream.js': { default: sse.default },
            './openai.js': { getStreamingReply: data => data.choices[0].text, tryParseStreamingError: () => {} },
        }, { fetch });
        const generate = await module[serviceName].sendRequest({ stream: true, ...options });
        const chunks = [];
        for await (const chunk of generate()) chunks.push(chunk.text);
        expect(chunks).toEqual(['hello']);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('does not retry when the progress callback throws', async () => {
        const module = await loadModule('../public/scripts/extensions/shared.js', {
            '../i18n.js': { t: strings => strings[0] },
        });
        const service = module.ConnectionManagerRequestService;
        const error = new Error('callback failed');
        service.sendRequest = jest.fn(async () => async function* () {
            yield { text: 'hello', state: {} };
        });
        await expect(service.sendStreamedRequest({}, 'prompt', 10, {}, {}, {
            onProgress: () => { throw error; },
        })).rejects.toBe(error);
        expect(service.sendRequest).toHaveBeenCalledTimes(1);
    });

    test('retries a failed streaming request without streaming', async () => {
        const module = await loadModule('../public/scripts/extensions/shared.js', {
            '../i18n.js': { t: strings => strings[0] },
        }, { console: { warn: () => {} } });
        const service = module.ConnectionManagerRequestService;
        service.sendRequest = jest.fn()
            .mockRejectedValueOnce(new Error('stream unavailable'))
            .mockResolvedValueOnce({ content: 'fallback', reasoning: '' });
        const result = await service.sendStreamedRequest({}, 'prompt', 10);
        expect(result.content).toBe('fallback');
        expect(service.sendRequest).toHaveBeenCalledTimes(2);
        expect(service.sendRequest.mock.calls[1][3].stream).toBe(false);
    });
});
