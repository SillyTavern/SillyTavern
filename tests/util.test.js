import { afterEach, describe, test, expect, jest } from '@jest/globals';
import { once, EventEmitter } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import { Response } from 'node-fetch';
import { CHAT_COMPLETION_SOURCES } from '../src/constants';
import { flattenSchema, forwardFetchResponse } from '../src/util';

function createMockExpressResponse() {
    const response = new PassThrough();
    const headers = new Map();

    response.socket = new EventEmitter();
    response.statusCode = 200;
    response.statusMessage = '';
    response.setHeader = (name, value) => headers.set(String(name).toLowerCase(), value);
    response.hasHeader = (name) => headers.has(String(name).toLowerCase());
    response.getHeader = (name) => headers.get(String(name).toLowerCase());
    response.removeHeader = (name) => headers.delete(String(name).toLowerCase());

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

function createReadableStream(chunks) {
    return Readable.from(chunks.map(chunk => Buffer.from(chunk)));
}

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
    test('should log JSON error details for non-2xx streaming responses', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
        const body = JSON.stringify({ error: { message: 'Forbidden by upstream policy' }, detail: 'policy_denied' });
        const response = createMockExpressResponse();
        const bodyPromise = collectResponseBody(response);

        forwardFetchResponse(new Response(body, {
            status: 403,
            statusText: 'Forbidden',
            headers: { 'content-type': 'application/json' },
        }), response);

        expect(await bodyPromise).toBe(body);
        expect(response.statusCode).toBe(403);
        expect(response.getHeader('content-type')).toBe('application/json');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Streaming request failed with status 403 Forbidden: Forbidden by upstream policy'));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Streaming error body:'));
        expect(infoSpy).toHaveBeenCalledWith('Streaming request ended after error response');
        expect(infoSpy).not.toHaveBeenCalledWith('Streaming request finished');
    });

    test('should log plain text error bodies for non-2xx streaming responses', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
        const body = 'Plain text upstream failure';
        const response = createMockExpressResponse();
        const bodyPromise = collectResponseBody(response);

        forwardFetchResponse(new Response(body, {
            status: 502,
            statusText: 'Bad Gateway',
            headers: { 'content-type': 'text/plain' },
        }), response);

        expect(await bodyPromise).toBe(body);
        expect(warnSpy).toHaveBeenCalledWith('Streaming request failed with status 502 Bad Gateway: Plain text upstream failure');
        expect(infoSpy).toHaveBeenCalledWith('Streaming request ended after error response');
    });

    test('should stream successful responses and log start and finish', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
        const response = createMockExpressResponse();
        const bodyPromise = collectResponseBody(response);

        forwardFetchResponse(new Response(createReadableStream(['data: one\n\n', 'data: two\n\n']), {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
        }), response);

        expect(await bodyPromise).toBe('data: one\n\ndata: two\n\n');
        expect(response.getHeader('content-type')).toBe('text/event-stream');
        expect(infoSpy).toHaveBeenCalledWith('Streaming request started');
        expect(infoSpy).toHaveBeenCalledWith('Streaming request finished');
        expect(warnSpy).not.toHaveBeenCalled();
    });

    test('should log stream body errors without reporting a successful finish', async () => {
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const source = new PassThrough();
        const response = createMockExpressResponse();
        const bodyPromise = collectResponseBody(response);
        const streamError = new Error('stream exploded');

        forwardFetchResponse(new Response(source, {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
        }), response);

        source.write('partial chunk');
        source.destroy(streamError);

        expect(await bodyPromise).toBe('partial chunk');
        expect(errorSpy).toHaveBeenCalledWith('Streaming response body error:', streamError);
        expect(infoSpy).toHaveBeenCalledWith('Streaming request started');
        expect(infoSpy).not.toHaveBeenCalledWith('Streaming request finished');
    });
});
