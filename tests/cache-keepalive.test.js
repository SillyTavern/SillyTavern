/* eslint-disable playwright/no-standalone-expect -- Jest test.each is not recognized by the Playwright rule. */
import { describe, test, expect, jest } from '@jest/globals';
import { CacheKeeper, buildRefreshRequest, validateInterval, REFRESH_MESSAGE, consumeRefreshResponse } from '../public/scripts/extensions/cache-keepalive/keeper.js';
import { contextFingerprint } from '../public/scripts/extensions/cache-keepalive/index.js';

const request = {
    model: 'test-model',
    messages: [
        { role: 'system', content: 'Character and world instructions' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }] },
    ],
    tools: [{ type: 'function', function: { name: 'example', parameters: { type: 'object' } } }],
    tool_choice: 'auto',
    reasoning_effort: 'high',
    max_tokens: 8192,
    stream: true,
    n: 2,
    reverse_proxy: 'https://example.invalid',
    secret_id: 'test-secret-id',
};

function fixture(send = jest.fn().mockResolvedValue(undefined)) {
    let now = 0;
    const keeper = new CacheKeeper({ send, now: () => now });
    keeper.configure(true, 4);
    keeper.capture(request);
    keeper.settle('whole-context');
    return { keeper, send, advance: (ms = 240000) => { now += ms; } };
}

describe('cache keepalive', () => {
    test('preserves every original message and cache-sensitive parameter without mutation', () => {
        const original = structuredClone(request);
        const copy = buildRefreshRequest(request);
        expect(copy.messages.slice(0, -1)).toEqual(original.messages);
        expect(copy.messages.at(-1)).toEqual({ role: 'user', content: REFRESH_MESSAGE });
        expect(copy.stream).toBe(original.stream);
        expect({ ...copy, messages: original.messages, stream: true, n: 2 }).toEqual(original);
        copy.tools[0].function.name = 'changed';
        copy.messages[1].content[0].text = 'changed';
        expect(request).toEqual(original);
    });

    test.each([0, -1, NaN, Infinity, '', 'bad', 1441])('rejects invalid interval %s', (value) => {
        expect(() => validateInterval(value)).toThrow();
    });

    test('waits four minutes, sends exactly six times, and pauses', async () => {
        const { keeper, send, advance } = fixture();
        await keeper.tick('whole-context');
        expect(send).not.toHaveBeenCalled();
        for (let i = 0; i < 10; i++) {
            advance();
            await keeper.tick('whole-context');
        }
        expect(send).toHaveBeenCalledTimes(6);
        expect(keeper.count).toBe(6);
        expect(keeper.status).toContain('Paused');
    });

    test('uses a custom interval and never sends while disabled or busy', async () => {
        const { keeper, send, advance } = fixture();
        keeper.configure(true, 0.5);
        keeper.capture(request);
        keeper.settle('whole-context');
        advance(29999);
        await keeper.tick('whole-context');
        expect(send).not.toHaveBeenCalled();
        advance(1);
        await keeper.tick('whole-context', true);
        expect(send).not.toHaveBeenCalled();
        await keeper.tick('whole-context');
        expect(send).toHaveBeenCalledTimes(1);
        keeper.configure(false, 0.5);
        advance();
        await keeper.tick('whole-context');
        expect(send).toHaveBeenCalledTimes(1);
    });

    test('invalidates a changed context, even while automatically paused', async () => {
        const { keeper, send, advance } = fixture();
        for (let i = 0; i < 6; i++) {
            advance();
            await keeper.tick('whole-context');
        }
        await keeper.tick('edited earlier message');
        expect(keeper.request).toBeNull();
        expect(send).toHaveBeenCalledTimes(6);
        keeper.capture(request);
        keeper.settle('edited earlier message');
        advance();
        await keeper.tick('edited earlier message');
        expect(send).toHaveBeenCalledTimes(7);
        expect(keeper.count).toBe(1);
    });

    test('cancels in-flight work on context switch and ignores its late completion', async () => {
        let resolve;
        const send = jest.fn(() => new Promise(done => { resolve = done; }));
        const { keeper, advance } = fixture(send);
        advance();
        const pending = keeper.tick('whole-context');
        await keeper.tick('whole-context');
        expect(send).toHaveBeenCalledTimes(1);
        keeper.invalidate();
        expect(send.mock.calls[0][1].aborted).toBe(true);
        resolve();
        await pending;
        expect(keeper.count).toBe(0);
        expect(keeper.request).toBeNull();
    });

    test('pauses on network/API errors without retry storms, then supports manual resume', async () => {
        const send = jest.fn().mockRejectedValueOnce(new Error('HTTP 429')).mockResolvedValue(undefined);
        const { keeper, advance } = fixture(send);
        advance();
        await keeper.tick('whole-context');
        advance();
        await keeper.tick('whole-context');
        expect(send).toHaveBeenCalledTimes(1);
        expect(keeper.status).toContain('HTTP 429');
        expect(keeper.count).toBe(0);
        keeper.resume('whole-context');
        advance();
        await keeper.tick('whole-context');
        expect(send).toHaveBeenCalledTimes(2);
    });

    test('a request must finish before it can be refreshed', async () => {
        const { keeper, send, advance } = fixture();
        keeper.capture(request);
        advance();
        await keeper.tick('whole-context');
        expect(send).not.toHaveBeenCalled();
    });

    test('compares old messages, metadata, tools/settings and identity, excluding its own controls', () => {
        const ctx = {
            chatId: 'one', characterId: 0, characters: [{ name: 'Character' }], groups: [],
            chat: [{ mes: 'old' }, { mes: 'latest' }], chatMetadata: { note: 'note' },
            extensionSettings: { cache_keepalive: { enabled: false }, other: { prompt: 'x' } },
            chatCompletionSettings: { model: 'a', tools: request.tools },
        };
        const before = contextFingerprint(ctx);
        ctx.extensionSettings.cache_keepalive.enabled = true;
        expect(contextFingerprint(ctx)).toBe(before);
        ctx.extensionPrompts = { DEPTH_PROMPT: { value: '', depth: 4 } };
        expect(contextFingerprint(ctx)).toBe(before);
        for (const mutate of [
            value => { value.chat[0].mes = 'edited'; },
            value => { value.chatMetadata.note = 'changed'; },
            value => { value.chatCompletionSettings.model = 'b'; },
            value => { value.chatCompletionSettings.tools[0].function.name = 'new'; },
            value => { value.extensionSettings.other.prompt = 'y'; },
            value => { value.chatId = 'two'; },
            value => { value.extensionPrompts.DEPTH_PROMPT.value = 'A real author note'; },
        ]) {
            const copy = structuredClone(ctx);
            mutate(copy);
            expect(contextFingerprint(copy)).not.toBe(before);
        }
    });
});

describe('background response consumption', () => {
    test.each([
        'data: {"choices":[{"delta":{"content":"OK"}}]}\r\n\r\ndata: [DONE]\r\n\r\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        'data: {"candidates":[{"finishReason":"STOP"}]}\n\n',
    ])('drains a complete SSE response without executing any response actions', async stream => {
        const bytes = new TextEncoder().encode(stream);
        const response = new Response(new ReadableStream({
            start(controller) {
                for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
                controller.close();
            },
        }), { headers: { 'content-type': 'text/event-stream' } });
        await expect(consumeRefreshResponse(response)).resolves.toBeUndefined();
        expect(response.bodyUsed).toBe(true);
    });

    test.each([
        'data: {"error":{"message":"rate limited"}}\n\n',
        'data: {"type":"error","error":{"type":"overloaded_error"}}\n\n',
        'data: {"choices":[{"delta":{"content":"truncated"}}]}\n\n',
        'data: invalid json\n\n',
    ])('rejects API errors and incomplete SSE streams', async body => {
        const response = new Response(body, { headers: { 'content-type': 'text/event-stream' } });
        await expect(consumeRefreshResponse(response)).rejects.toThrow();
    });

    test('rejects HTTP and JSON errors', async () => {
        await expect(consumeRefreshResponse(new Response('', { status: 429 }))).rejects.toThrow('HTTP 429');
        await expect(consumeRefreshResponse(Response.json({ error: true }))).rejects.toThrow('API returned an error');
        await expect(consumeRefreshResponse(Response.json({ choices: [{ message: { content: 'OK' } }] }))).resolves.toBeUndefined();
    });
});
