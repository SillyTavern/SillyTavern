import { afterEach, describe, test, expect, jest } from '@jest/globals';
import { EventEmitter, once } from 'node:events';
import { PassThrough, Readable, Writable } from 'node:stream';
import { Response } from 'node-fetch';
import { CHAT_COMPLETION_SOURCES } from '../src/constants';
import { flattenSchema, forwardFetchResponse } from '../src/util';

function createMockExpressResponse(options) {
    const response = new PassThrough(options);
    response.statusCode = 200;
    response.statusMessage = '';
    response.socket = new EventEmitter();

    return response;
}

async function collectResponseBody(response) {
    const chunks = [];

    response.on('data', chunk => chunks.push(Buffer.from(chunk)));

    await once(response, 'finish');

    return Buffer.concat(chunks).toString('utf8');
}

afterEach(() => {
    jest.restoreAllMocks();
});

describe('flattenSchema', () => {
    test('should return the schema if it is not an object', () => {
        const schema = 'it is not an object';
        expect(flattenSchema(schema, CHAT_COMPLETION_SOURCES.MAKERSUITE)).toBe(schema);
    });

    test('should handle schema with $defs and $ref', () => {
        const schema = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $defs: {
                a: { type: 'string' },
                b: {
                    type: 'object',
                    properties: {
                        c: { $ref: '#/$defs/a' },
                    },
                },
            },
            properties: {
                d: { $ref: '#/$defs/b' },
            },
        };
        const expected = {
            properties: {
                d: {
                    type: 'object',
                    properties: {
                        c: { type: 'string' },
                    },
                },
            },
        };
        expect(flattenSchema(schema, CHAT_COMPLETION_SOURCES.MAKERSUITE)).toEqual(expected);
    });

    test('should filter unsupported properties for Google API schema', () => {
        const schema = {
            $defs: {
                a: {
                    type: 'string',
                    default: 'test',
                },
            },
            type: 'object',
            properties: {
                b: { $ref: '#/$defs/a' },
                c: { type: 'number' },
            },
            additionalProperties: false,
            exclusiveMinimum: 0,
            propertyNames: {
                pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
            },
        };
        const expected = {
            type: 'object',
            properties: {
                b: {
                    type: 'string',
                },
                c: { type: 'number' },
            },
        };
        expect(flattenSchema(schema, CHAT_COMPLETION_SOURCES.MAKERSUITE)).toEqual(expected);
    });

    test('should not filter properties for non-Google API schema', () => {
        const schema = {
            $defs: {
                a: {
                    type: 'string',
                    default: 'test',
                },
            },
            type: 'object',
            properties: {
                b: { $ref: '#/$defs/a' },
                c: { type: 'number' },
            },
            additionalProperties: false,
            exclusiveMinimum: 0,
            propertyNames: {
                pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
            },
        };
        const expected = {
            type: 'object',
            properties: {
                b: {
                    type: 'string',
                    default: 'test',
                },
                c: { type: 'number' },
            },
            additionalProperties: false,
            exclusiveMinimum: 0,
            propertyNames: {
                pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
            },
        };
        expect(flattenSchema(schema, 'some-other-api')).toEqual(expected);
    });
});

describe('forwardFetchResponse', () => {
    test('should log JSON error bodies and return the original body for non-2xx streaming responses', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const body = JSON.stringify({ error: { message: 'Forbidden by upstream policy' }, detail: 'policy_denied' });
        const response = createMockExpressResponse();
        const bodyPromise = collectResponseBody(response);

        await forwardFetchResponse(new Response(body, {
            status: 403,
            statusText: 'Forbidden',
        }), response);

        expect(await bodyPromise).toBe(body);
        expect(response.statusCode).toBe(403);
        expect(warnSpy).toHaveBeenCalledWith(`Streaming request failed with status 403 Forbidden: ${body}`);
    });

    for (const [status, statusText, expectedStatus] of [[502, 'Bad Gateway', 502], [401, 'Unauthorized', 400]]) {
        test(`preserves error body and status mapping for HTTP ${status}`, async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const body = 'Plain text upstream failure';
            const response = createMockExpressResponse();
            const bodyPromise = collectResponseBody(response);

            await forwardFetchResponse(new Response(body, { status, statusText }), response);

            expect(await bodyPromise).toBe(body);
            expect(response.statusCode).toBe(expectedStatus);
            expect(response.statusMessage).toBe(statusText);
            expect(warnSpy).toHaveBeenCalledWith(`Streaming request failed with status ${status} ${statusText}: ${body}`);
        });
    }

    test('preserves binary data and backpressure, waits for the destination, and cleans up listeners', async () => {
        const chunks = [];
        const callbacks = [];
        const response = new Writable({
            highWaterMark: 1,
            write(chunk, encoding, callback) { chunks.push(chunk); callbacks.push(callback); },
        });
        response.socket = new EventEmitter();
        const socketClose = () => {};
        response.socket.on('close', socketClose);
        const body = Readable.from([Buffer.from([0, 128]), Buffer.from([254, 255])]);
        const from = new Response(body);
        const sourceErrors = body.listeners('error');
        let completed = false;
        const forwarding = forwardFetchResponse(from, response).then(() => { completed = true; });
        await new Promise(setImmediate);
        expect(completed).toBe(false);
        expect(chunks).toHaveLength(1);
        callbacks.shift()();
        await new Promise(setImmediate);
        expect(completed).toBe(false);
        callbacks.shift()();
        await forwarding;
        expect(response.writableFinished).toBe(true);
        expect(Buffer.concat(chunks)).toEqual(Buffer.from([0, 128, 254, 255]));
        expect(response.socket.listeners('close')).toEqual([socketClose]);
        expect(body.listeners('error')).toEqual(sourceErrors);
        for (const event of ['end', 'finish', 'close', 'error']) {
            expect(response.listenerCount(event)).toBe(0);
        }
    });

    for (const failure of ['error', 'premature close']) {
        test(`closes a partial response on upstream ${failure}`, async () => {
            jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const body = new PassThrough();
            const response = createMockExpressResponse();
            response.resume();
            const forwarding = forwardFetchResponse(new Response(body), response);
            body.write('partial');
            body.destroy(failure === 'error' ? new Error('upstream reset') : undefined);
            await forwarding;
            expect(response.destroyed).toBe(true);
            expect(response.writableFinished).toBe(false);
            expect(response.socket.listenerCount('close')).toBe(0);
        });
    }

    for (const [when, status, error] of [
        ['while streaming', 200, undefined],
        ['while reading an HTTP error', 502, undefined],
        ['after a write error', 200, new Error('write failed')],
    ]) {
        test(`cancels upstream when the client closes ${when}`, async () => {
            jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const body = new PassThrough();
            const response = createMockExpressResponse();
            const forwarding = forwardFetchResponse(new Response(body, { status }), response);
            response.destroy(error);
            await forwarding;
            expect(body.destroyed).toBe(true);
            expect(response.socket.listenerCount('close')).toBe(0);
            expect(response.listenerCount('close')).toBe(0);
        });
    }

    test('cancels upstream if the response was already closed', async () => {
        const body = new PassThrough();
        const response = createMockExpressResponse();
        response.destroy();
        await once(response, 'close');
        await forwardFetchResponse(new Response(body), response);
        expect(body.destroyed).toBe(true);
        expect(response.socket.listenerCount('close')).toBe(0);
    });

    test('handles socket closure even if the response does not emit close', async () => {
        const body = new PassThrough();
        // Existing routes remove Node's socket close handler which emits response.close.
        const response = createMockExpressResponse({ emitClose: false });
        const forwarding = forwardFetchResponse(new Response(body), response);
        response.socket.emit('close');
        await forwarding;
        expect(body.destroyed).toBe(true);
        expect(response.socket.listenerCount('close')).toBe(0);
        expect(response.listenerCount('close')).toBe(0);
    });

    test('ends an empty response and releases an unread body when there is no socket', async () => {
        const emptyResponse = createMockExpressResponse();
        await forwardFetchResponse(new Response(null, { status: 204 }), emptyResponse);
        expect(emptyResponse.statusCode).toBe(204);
        expect(emptyResponse.writableFinished).toBe(true);
        const body = new PassThrough();
        const detachedResponse = createMockExpressResponse();
        detachedResponse.socket = null;
        await forwardFetchResponse(new Response(body), detachedResponse);
        expect(detachedResponse.writableFinished).toBe(true);
        expect(body.destroyed).toBe(true);
    });

    test('finishes if the source has already emitted end', async () => {
        const body = new PassThrough();
        const ended = once(body, 'end');
        body.resume();
        body.end();
        await ended;
        const response = createMockExpressResponse();
        await forwardFetchResponse(new Response(body), response);
        expect(response.writableFinished).toBe(true);
    });
});
