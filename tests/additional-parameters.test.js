import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setConfigFilePath } from '../src/util.js';

setConfigFilePath(new URL('../default/config.yaml', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'));
const upstream = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: upstream }));
jest.unstable_mockModule('../src/users.js', () => ({ getCookieSecret: () => 'synthetic-cookie' }));
const { SecretManager, SECRET_KEYS } = await import('../src/endpoints/secrets.js');
const { applyAdditionalBodyParameters, getAdditionalHeaders, getAdditionalParameters } = await import('../src/additional-parameters.js');

describe('applyAdditionalBodyParameters', () => {
    test('merges objects deeply and replaces everything else', () => {
        const body = { model: 'm', temperature: 1, generationConfig: { temperature: 0.7, thinkingConfig: { thinkingLevel: 'low' } }, stop: ['a'] };
        applyAdditionalBodyParameters(body, { include_body: 'generationConfig:\n  thinkingConfig:\n    thinkingLevel: high\nstop:\n  - b\ntop_k: 20' });
        expect(body).toEqual({ model: 'm', temperature: 1, generationConfig: { temperature: 0.7, thinkingConfig: { thinkingLevel: 'high' } }, stop: ['b'], top_k: 20 });
    });

    test('the user value wins over what was built, whatever its type', () => {
        const body = { reasoning_effort: 'high', thinking: { type: 'adaptive' } };
        applyAdditionalBodyParameters(body, { include_body: 'reasoning_effort: xhigh\nthinking: null' });
        expect(body).toEqual({ reasoning_effort: 'xhigh', thinking: null });
    });

    test('removes fields by name and by dotted path, after the additions', () => {
        const body = { temperature: 1, top_p: 1, generationConfig: { thinkingConfig: { a: 1 }, topK: 5 }, 'dotted.key': 1 };
        applyAdditionalBodyParameters(body, { include_body: 'presence_penalty: 0', exclude_body: '- temperature\n- generationConfig.thinkingConfig\n- dotted.key\n- presence_penalty\n- missing.path.here' });
        expect(body).toEqual({ top_p: 1, generationConfig: { topK: 5 } });
    });

    test('accepts a list of mappings and the mapping form of the removal list', () => {
        const body = { a: 1, b: 2 };
        applyAdditionalBodyParameters(body, { include_body: '- c: 3\n- d: 4', exclude_body: 'a:\nb:' });
        expect(body).toEqual({ c: 3, d: 4 });
    });

    test('invalid YAML and empty input leave the body alone', () => {
        const body = { a: 1 };
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            applyAdditionalBodyParameters(body, { include_body: 'a: [1, 2', exclude_body: '   ' });
            applyAdditionalBodyParameters(body, {});
            applyAdditionalBodyParameters(body, undefined);
        } finally {
            warn.mockRestore();
        }
        expect(body).toEqual({ a: 1 });
    });

    test('cannot reach the prototype', () => {
        const body = { a: { b: 1 } };
        applyAdditionalBodyParameters(body, { include_body: '__proto__:\n  polluted: true\na:\n  constructor: 1', exclude_body: '- __proto__.toString\n- a.__proto__' });
        expect({}.polluted).toBeUndefined();
        expect(Object.hasOwn(body.a, 'constructor')).toBe(false);
        expect(typeof {}.toString).toBe('function');
    });
});

describe('getAdditionalHeaders', () => {
    test('passes ordinary headers and drops the ones a source sets itself', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            expect(getAdditionalHeaders({ include_headers: 'anthropic-beta: feature-2026\nAuthorization: Bearer nope\nX-API-Key: nope\nx-goog-api-key: nope\nCookie: a=b\nX-Count: 3\nX-Object:\n  a: 1' }))
                .toEqual({ 'anthropic-beta': 'feature-2026', 'X-Count': '3' });
        } finally {
            warn.mockRestore();
        }
        expect(getAdditionalHeaders({})).toEqual({});
        expect(getAdditionalHeaders(undefined)).toEqual({});
    });
});

describe('getAdditionalParameters', () => {
    test('Custom reads its own three settings, every other source reads additional_parameters', () => {
        expect(getAdditionalParameters({ chat_completion_source: 'custom', custom_include_body: 'a: 1', custom_exclude_body: '- b', custom_include_headers: 'X: y', additional_parameters: { include_body: 'ignored: 1' } }))
            .toEqual({ include_body: 'a: 1', exclude_body: '- b', include_headers: 'X: y' });
        expect(getAdditionalParameters({ chat_completion_source: 'claude', additional_parameters: { include_body: 'a: 1' }, custom_include_body: 'ignored: 1' })).toEqual({ include_body: 'a: 1' });
        expect(getAdditionalParameters({ chat_completion_source: 'claude' })).toEqual({});
    });
});

describe('through the generate endpoint', () => {
    let directory;
    let server;
    let base;
    const post = async body => fetch(`${base}/chat/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    beforeAll(async () => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'st-additional-parameters-'));
        const manager = new SecretManager({ root: directory });
        manager.writeSecret(SECRET_KEYS.OPENAI, 'synthetic-openai', 'OpenAI');
        manager.writeSecret(SECRET_KEYS.CLAUDE, 'synthetic-claude', 'Claude');
        manager.writeSecret(SECRET_KEYS.CUSTOM, 'synthetic-custom', 'Custom');
        const { default: express } = await import('express');
        const { router: chat } = await import('../src/endpoints/backends/chat-completions.js');
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => { req.user = { directories: { root: directory }, profile: { name: 'Synthetic' } }; next(); });
        app.use('/chat', chat);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
    });
    afterAll(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        if (directory) fs.rmSync(directory, { recursive: true });
    });
    beforeEach(() => {
        upstream.mockReset();
        upstream.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }], content: [{ type: 'text', text: 'ok' }] }) });
    });

    const sent = () => ({ body: JSON.parse(upstream.mock.calls[0][1].body), headers: upstream.mock.calls[0][1].headers });
    const messages = [{ role: 'user', content: 'Hi' }];

    test('a source on the shared path gets its additional parameters and headers', async () => {
        const response = await post({ chat_completion_source: 'openai', model: 'gpt-6.1-terra', messages, temperature: 0.5, max_tokens: 10,
            additional_parameters: { include_body: 'reasoning_effort: xhigh\nservice_tier: flex', exclude_body: '- temperature', include_headers: 'X-Test: yes\nAuthorization: Bearer hijack' } });
        expect(response.status).toBe(200);
        const { body, headers } = sent();
        expect(body.reasoning_effort).toBe('xhigh');
        expect(body.service_tier).toBe('flex');
        expect(body).not.toHaveProperty('temperature');
        expect(headers['X-Test']).toBe('yes');
        expect(headers.Authorization).toBe('Bearer synthetic-openai');
    });

    test('a source with its own request builder gets them too', async () => {
        const response = await post({ chat_completion_source: 'claude', model: 'claude-sonnet-5-5', messages, max_tokens: 10,
            additional_parameters: { include_body: 'output_config:\n  effort: xhigh', exclude_body: '- stop_sequences', include_headers: 'anthropic-beta: synthetic-beta\nx-api-key: hijack' } });
        expect(response.status).toBe(200);
        const { body, headers } = sent();
        expect(body.output_config.effort).toBe('xhigh');
        expect(body).not.toHaveProperty('stop_sequences');
        expect(headers['anthropic-beta']).toBe('synthetic-beta');
        expect(headers['x-api-key']).toBe('synthetic-claude');
    });

    test('Custom merges deeply and keeps its own header handling', async () => {
        const response = await post({ chat_completion_source: 'custom', custom_url: 'https://provider.test/v1', model: 'm', messages, max_tokens: 10,
            custom_include_body: 'extra:\n  nested: 1\nmax_completion_tokens: 10', custom_exclude_body: '- max_tokens', custom_include_headers: 'X-Custom: yes',
            additional_parameters: { include_body: 'ignored: true' } });
        expect(response.status).toBe(200);
        const { body, headers } = sent();
        expect(body.extra).toEqual({ nested: 1 });
        expect(body.max_completion_tokens).toBe(10);
        expect(body).not.toHaveProperty('max_tokens');
        expect(body).not.toHaveProperty('ignored');
        expect(headers['X-Custom']).toBe('yes');
    });

    test('nothing changes without additional parameters', async () => {
        await post({ chat_completion_source: 'openai', model: 'gpt-6.1-terra', messages, temperature: 0.5, max_tokens: 10 });
        expect(sent().body.temperature).toBe(0.5);
    });
});
