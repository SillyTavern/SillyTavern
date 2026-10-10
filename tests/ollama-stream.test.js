import { afterAll, expect, jest, test } from '@jest/globals';
import { EventEmitter, once } from 'node:events';
import { PassThrough, Readable } from 'node:stream';

jest.unstable_mockModule('../src/util.js', () => ({ forwardFetchResponse: jest.fn(), trimV1: jest.fn(), getConfigValue: jest.fn() }));
jest.unstable_mockModule('../src/additional-headers.js', () => ({ setAdditionalHeaders: jest.fn() }));
const { parseOllamaStream } = await import('../src/endpoints/backends/text-completions.js');
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
afterAll(() => jest.restoreAllMocks());

async function parse(chunks) {
    const body = Readable.from(chunks, { objectMode: false });
    const request = { socket: new EventEmitter() };
    const response = new PassThrough();
    const output = [];
    response.on('data', chunk => { response.headersSent = true; output.push(chunk.toString()); });
    response.status = code => { response.statusCode = code; return response; };
    response.send = data => response.end(JSON.stringify(data));
    const finished = once(response, 'finish');
    await parseOllamaStream({ body }, request, response);
    await finished;
    return { output: output.join(''), status: response.statusCode, listeners: request.socket.listenerCount('close') };
}

const records = [{ response: '你好 🌍', done: false }, { thinking: 'reasoning', done: false }, { response: '!', done: true }];
const input = Buffer.from(records.map(record => JSON.stringify(record)).join('\n') + '\n');
const expected = records.map(record => `data: ${JSON.stringify({ choices: [{ text: record.response || '', thinking: record.thinking || '' }] })}\n\n`).join('') + 'data: [DONE]\n\n';

test('parses coalesced NDJSON records and split UTF-8 at every byte boundary', async () => {
    expect((await parse([input])).output).toBe(expected);
    for (let i = 1; i < input.length; i++) {
        expect((await parse([input.subarray(0, i), input.subarray(i)])).output).toBe(expected);
    }
    expect((await parse(Array.from(input, byte => Buffer.from([byte])))).output).toBe(expected);
});

test('accepts CRLF, blank lines, and a complete final record without a newline', async () => {
    const result = await parse([Buffer.from('\r\n' + records.map(record => JSON.stringify(record)).join('\r\n\r\n'))]);
    expect(result).toEqual({ output: expected, status: undefined, listeners: 0 });
});

test.each(['{"error":"model failed"}\n', '{invalid}\n', '{"response":'])('reports malformed or error records instead of successful EOF: %s', async (record) => {
    const result = await parse([Buffer.from(JSON.stringify(records[0]) + '\n' + record)]);
    const events = result.output.trim().split('\n\n').map(event => JSON.parse(event.slice(6)));
    expect(events).toHaveLength(2);
    expect(events[0].choices[0].text).toBe(records[0].response);
    expect(events[1].error).toEqual(expect.any(String));
    expect(result.listeners).toBe(0);
});

test('returns an HTTP error if the first record is an error', async () => {
    const result = await parse([Buffer.from('{"error":"model not found"}\n')]);
    expect(result).toEqual({ output: '{"error":"model not found"}', status: 500, listeners: 0 });
});

test('settles and releases its close listener when the input fails', async () => {
    async function* source() {
        yield Buffer.from('{"response":"partial"}\n');
        throw new Error('upstream disconnected');
    }
    const result = await parse(source());
    expect(result.output).toContain('data: {"error":"upstream disconnected"}\n\n');
    expect(result.output).not.toContain('[DONE]');
    expect(result.listeners).toBe(0);
});

test('does not report success or an error after client cancellation', async () => {
    const body = new PassThrough();
    const request = { socket: new EventEmitter() };
    const response = new PassThrough();
    const output = [];
    response.on('data', chunk => output.push(chunk.toString()));
    const pending = parseOllamaStream({ body }, request, response);
    request.socket.emit('close');
    await pending;
    expect(body.destroyed).toBe(true);
    expect(response.writableEnded).toBe(true);
    expect(output).toEqual([]);
    expect(request.socket.listenerCount('close')).toBe(0);
});

test.each(['{"response":"buffered"}', '{"response":"buffered'])('discards a buffered record when cancellation races EOF: %s', async (record) => {
    const body = Readable.from([Buffer.from(record)], { objectMode: false });
    const request = { socket: new EventEmitter() };
    const response = new PassThrough({ autoDestroy: false });
    const output = [];
    const errors = [];
    response.on('data', chunk => output.push(chunk.toString()));
    response.on('error', error => errors.push(error));
    body.once('end', () => request.socket.emit('close'));
    await parseOllamaStream({ body }, request, response);
    await new Promise(setImmediate);
    expect(output).toEqual([]);
    expect(errors).toEqual([]);
    expect(request.socket.listenerCount('close')).toBe(0);
});

test.each(['end', 'destroy'])('stops immediately when the downstream is already closed with %s', async (method) => {
    const body = new PassThrough();
    const request = { socket: new EventEmitter() };
    const response = new PassThrough();
    response[method]();
    const pending = parseOllamaStream({ body }, request, response);
    try {
        const result = await Promise.race([pending.then(() => 'settled'), new Promise(resolve => setImmediate(() => resolve('pending')))]);
        expect(result).toBe('settled');
        expect(body.destroyed).toBe(true);
        expect(request.socket.listenerCount('close')).toBe(0);
    } finally {
        body.destroy();
        await pending;
    }
});
