import { afterEach, describe, test, expect, jest } from '@jest/globals';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { Response } from 'node-fetch';
import { CHAT_COMPLETION_SOURCES } from '../src/constants';
import { flattenSchema, forwardFetchResponse } from '../src/util';

function createMockExpressResponse() {
    const response = new PassThrough();
    response.statusCode = 200;
    response.statusMessage = '';

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

    test('should log plain text error bodies and return the original body for non-2xx streaming responses', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const body = 'Plain text upstream failure';
        const response = createMockExpressResponse();
        const bodyPromise = collectResponseBody(response);

        await forwardFetchResponse(new Response(body, {
            status: 502,
            statusText: 'Bad Gateway',
        }), response);

        expect(await bodyPromise).toBe(body);
        expect(response.statusCode).toBe(502);
        expect(warnSpy).toHaveBeenCalledWith(`Streaming request failed with status 502 Bad Gateway: ${body}`);
    });
});
