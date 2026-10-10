import { describe, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../public/scripts/power-user.js', () => ({ power_user: {} }));
jest.unstable_mockModule('../public/scripts/utils.js', () => ({ delay: jest.fn() }));
const { default: EventSourceStream, SmoothEventSourceStream } = await import('../public/scripts/sse-stream.js');

async function parse(chunks, Stream = EventSourceStream) {
    const source = new ReadableStream({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
            }
            controller.close();
        },
    });
    const events = [];
    for await (const event of source.pipeThrough(new Stream())) {
        events.push({ type: event.type, data: event.data, id: event.lastEventId });
    }
    return events;
}

describe('EventSourceStream framing', () => {
    test('ignores colon comments without interpreting embedded field names', async () => {
        expect(await parse([':data: heartbeat\n:event: ignored\n:id: ignored\n\ndata: {}\n\n']))
            .toEqual([{ type: 'message', data: '{}', id: '' }]);
    });

    for (const eol of ['\n', '\r', '\r\n']) {
        test(`supports ${JSON.stringify(eol)} line endings and multiple data fields`, async () => {
            expect(await parse([`event: update${eol}data: first${eol}data: second${eol}${eol}data: next${eol}${eol}`]))
                .toEqual([{ type: 'update', data: 'first\nsecond', id: '' }, { type: 'message', data: 'next', id: '' }]);
        });
    }

    test('handles mixed endings, split CRLF, UTF-8 and a leading BOM at every byte boundary', async () => {
        const input = new TextEncoder().encode('\uFEFFdata: 你好 🌍\r\n\ndata: next\n\r\n');
        const expected = [{ type: 'message', data: '你好 🌍', id: '' }, { type: 'message', data: 'next', id: '' }];
        for (let i = 1; i < input.length; i++) {
            expect(await parse([input.subarray(0, i), input.subarray(i)])).toEqual(expected);
        }
        expect(await parse(Array.from(input, byte => Uint8Array.of(byte)))).toEqual(expected);
    });

    test('dispatches mixed blank-line delimiters, including a final CR', async () => {
        for (const delimiter of ['\n\n', '\r\r', '\r\n\r\n', '\n\r', '\r\n\n', '\n\r\n', '\r\r\n', '\r\n\r']) {
            const input = new TextEncoder().encode(`data: value${delimiter}`);
            expect(await parse(Array.from(input, byte => Uint8Array.of(byte))))
                .toEqual([{ type: 'message', data: 'value', id: '' }]);
        }
    });

    test('preserves field values, IDs, empty data, and event type reset semantics', async () => {
        const input = 'id: first\n\nevent: ignored\n\nevent: update\ndata:  leading:colon\ndata\n\n'
            + 'id: bad\0id\ndata: line\u2028separator\n\nid\ndata:\n\n';
        expect(await parse([input])).toEqual([
            { type: 'update', data: ' leading:colon\n', id: 'first' },
            { type: 'message', data: 'line\u2028separator', id: 'first' },
            { type: 'message', data: '', id: '' },
        ]);
    });

    test('does not dispatch an unterminated final event', async () => {
        expect(await parse(['data: complete\n\ndata: incomplete\n']))
            .toEqual([{ type: 'message', data: 'complete', id: '' }]);
    });

    test('propagates input errors', async () => {
        const error = new Error('upstream disconnected');
        const source = new ReadableStream({ start(controller) { controller.error(error); } });
        await expect(source.pipeThrough(new EventSourceStream()).getReader().read()).rejects.toBe(error);
    });

    test('keeps smooth streaming output and the completion marker after a comment', async () => {
        global.document = { hasFocus: () => false };
        try {
            const events = await parse([':data: heartbeat\r\n\r\ndata: {"choices":[{"text":"Hi"}]}\r\n\r\ndata: [DONE]\r\n\r\n'], SmoothEventSourceStream);
            expect(events.map(event => event.data)).toEqual([
                '{"choices":[{"text":"H"}]}', '{"choices":[{"text":"i"}]}', '[DONE]',
            ]);
        } finally {
            delete global.document;
        }
    });
});
