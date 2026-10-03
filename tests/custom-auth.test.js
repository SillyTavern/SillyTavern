/* eslint-disable playwright/no-standalone-expect -- Jest test.each is not recognized by the shared Playwright rule. */
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
const { resolveCustomAuth } = await import('../src/custom-auth.js');

const endpoint = 'https://provider.test/tenant/v1';
let directory;
let manager;
let selectedId;
let customId;
let server;
let base;
const envelope = credential => ({ version: 1, auth: { mode: 'bearer', required: true }, credential });
const reference = () => ({ mode: 'reference', key: SECRET_KEYS.OPENAI, id: selectedId, endpoint });
const post = async (route, body) => fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'st-custom-auth-'));
    manager = new SecretManager({ root: directory });
    selectedId = manager.writeSecret(SECRET_KEYS.OPENAI, 'synthetic-selected', 'Selected');
    manager.writeSecret(SECRET_KEYS.OPENAI, 'synthetic-ambient', 'Ambient');
    customId = manager.writeSecret(SECRET_KEYS.CUSTOM, 'synthetic-custom', 'Custom');
    const { default: express } = await import('express');
    const { router: chat } = await import('../src/endpoints/backends/chat-completions.js');
    const { router: caption } = await import('../src/endpoints/openai.js');
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.user = { directories: { root: directory }, profile: { name: 'Synthetic' } }; next(); });
    app.use('/chat', chat);
    app.use('/openai', caption);
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
    upstream.mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'model' }], choices: [{ message: { content: 'Synthetic result' } }] }) });
});

describe('exact per-account Custom credentials', () => {
    test('non-activating writes preserve the category active key', () => {
        const activeBefore = manager.getSecretState()[SECRET_KEYS.CUSTOM].find(item => item.active).id;
        const id = manager.writeSecret(SECRET_KEYS.CUSTOM, 'synthetic-new', 'New', { activate: false });
        expect(manager.getSecretState()[SECRET_KEYS.CUSTOM].find(item => item.active).id).toBe(activeBefore);
        expect(manager.getSecretState()[SECRET_KEYS.CUSTOM].find(item => item.id === id).active).toBe(false);
    });
    test('exact references never use the active native or Custom key', () => {
        const resolved = resolveCustomAuth({ root: directory }, { custom_url: endpoint, custom_auth: envelope(reference()) });
        expect(resolved.headers.Authorization === 'Bearer synthetic-selected').toBe(true);
        expect(resolved.redirect).toBe('error');
    });
    test.each([
        { mode: 'unbound' },
        { mode: 'none' },
        { mode: 'reference', key: 'vertexai_service_account_json', id: 'id', endpoint },
        { mode: 'reference', key: SECRET_KEYS.OPENAI, id: 'deleted', endpoint },
        { mode: 'reference', key: SECRET_KEYS.OPENAI, id: 'id', endpoint: 'https://provider.test/other/v1' },
    ])('invalid binding fails before upstream: $mode $key', async credential => {
        for (const route of ['/chat/status', '/chat/generate', '/openai/caption-image']) {
            const response = await post(route, { api: 'custom', chat_completion_source: 'custom', custom_url: endpoint, server_url: endpoint, custom_auth: envelope(credential), messages: [], model: 'model' });
            expect(response.status).toBe(400);
            expect((await response.json()).error.code).toBe('CUSTOM_AUTH');
        }
        expect(upstream).not.toHaveBeenCalled();
    });
    test.each(['/chat/status', '/chat/generate', '/openai/caption-image'])('actual route %s sends the exact chosen credential and strips local metadata', async route => {
        const response = await post(route, { api: 'custom', chat_completion_source: 'custom', custom_url: endpoint, server_url: endpoint, custom_auth: envelope(reference()), messages: [{ role: 'user', content: 'Synthetic' }], model: 'model', custom_include_headers: 'X-Marker: profile-a', custom_include_body: 'marker: profile-a\ntop_k: 9', custom_exclude_body: '[top_k]' });
        expect(response.status).toBe(200);
        expect(upstream).toHaveBeenCalledTimes(1);
        const [url, options] = upstream.mock.calls[0];
        expect(String(url)).toBe(`${endpoint}${route.endsWith('status') ? '/models' : '/chat/completions'}`);
        expect(options.headers.Authorization === 'Bearer synthetic-selected').toBe(true);
        expect(options.headers['X-Marker']).toBe('profile-a');
        expect(options.redirect).toBe('error');
        const body = options.body ? JSON.parse(options.body) : {};
        expect(body.marker).toBe(route.endsWith('status') ? undefined : 'profile-a');
        expect(body.top_k).toBeUndefined();
        expect(body.custom_auth).toBeUndefined();
        expect(body.secret_id).toBeUndefined();
        const text = await response.text();
        expect(text.includes('synthetic-selected')).toBe(false);
    });
    test('explicit optional no-key omits Authorization', async () => {
        const response = await post('/chat/status', { chat_completion_source: 'custom', custom_url: endpoint, custom_auth: { version: 1, auth: { mode: 'bearer', required: false }, credential: { mode: 'none' } } });
        expect(response.status).toBe(200);
        expect(upstream.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });
    test.each([
        { auth: { mode: 'none' }, credential: { mode: 'legacy-custom', id: null } },
        { auth: { mode: 'none' }, credential: { mode: 'legacy-custom', id: 'captured' } },
        { auth: { mode: 'none' }, credential: { mode: 'reference', key: SECRET_KEYS.OPENAI, id: 'captured', endpoint } },
        { auth: { mode: 'bearer', required: true }, credential: { mode: 'legacy-custom', id: null } },
        { auth: { mode: 'bearer', required: true }, credential: { mode: 'none' } },
    ])('contradictory policy fails at every route: %j', async tuple => {
        for (const route of ['/chat/status', '/chat/generate', '/openai/caption-image']) {
            const response = await post(route, { api: 'custom', chat_completion_source: 'custom', custom_url: endpoint, server_url: endpoint, custom_auth: { version: 1, ...tuple }, messages: [] });
            expect(response.status).toBe(400);
        }
        expect(upstream).not.toHaveBeenCalled();
    });
    test('legacy captured null is keyless and a captured ID remains exact', () => {
        const keyless = resolveCustomAuth({ root: directory }, { custom_url: endpoint, custom_auth: { version: 1, auth: { mode: 'bearer', required: false }, credential: { mode: 'legacy-custom', id: null } } });
        expect(keyless.headers).toEqual({});
        const captured = resolveCustomAuth({ root: directory }, { custom_url: endpoint, custom_auth: { version: 1, auth: { mode: 'bearer', required: false }, credential: { mode: 'legacy-custom', id: customId } } });
        expect(captured.headers.Authorization === 'Bearer synthetic-custom').toBe(true);
        expect(resolveCustomAuth({ root: directory }, { custom_url: endpoint })).toBeUndefined();
    });
    test.each([
        { custom_include_headers: 'Authorization: conflict' },
        { custom_include_headers: '- authorization: conflict' },
        { custom_include_body: 'bad: [syntax' },
        { custom_exclude_body: '[bad' },
        { custom_include_body: 'custom_auth: {}' },
    ])('managed configuration errors fail locally: %j', async fields => {
        const response = await post('/chat/generate', { ...fields, chat_completion_source: 'custom', custom_url: endpoint, custom_auth: envelope(reference()), messages: [] });
        expect(response.status).toBe(400);
        expect(upstream).not.toHaveBeenCalled();
    });
    test('credential-bearing requests refuse redirects', async () => {
        upstream.mockImplementation(async (url, options) => {
            if (options.redirect === 'error') throw new Error('Redirect refused');
            return { ok: true, json: async () => ({}) };
        });
        const response = await post('/chat/generate', { chat_completion_source: 'custom', custom_url: endpoint, custom_auth: envelope(reference()), messages: [] });
        expect(response.status).toBe(502);
        expect(upstream).toHaveBeenCalledTimes(1);
        expect(upstream.mock.calls[0][1].redirect).toBe('error');
    });
});
