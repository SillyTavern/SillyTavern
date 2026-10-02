/* eslint-disable playwright/no-standalone-expect -- Jest test.each is not recognized by the shared Playwright rule. */
import { afterEach, describe, expect, test } from '@jest/globals';
import { applyCustomSnapshot, captureCustomConnection, captureCustomFields, getCustomAuth, getCustomProvider, getProfileCustomConnection, listCustomProviders, normalizeCustomEndpoint, registerCustomProvider, resolveLegacyCustomConnection, resumeCustomProviderOwner, settingsForCustomRequest, suspendCustomProviderOwner, switchCustomProvider, validateCustomSnapshot } from '../public/scripts/custom-providers.js';

const owner = 'third-party/test-providers';
const definition = (url = 'https://example.test/v1') => ({ label: 'Test', defaults: { custom_url: url }, models: { mode: 'discover' }, auth: { mode: 'bearer', required: true } });
const manual = () => captureCustomFields({ custom_url: 'http://localhost:1234/v1', custom_model: 'manual', custom_include_headers: 'X-Manual: yes' });
afterEach(() => { suspendCustomProviderOwner(owner); resumeCustomProviderOwner(owner); });

describe('Custom provider registration', () => {
    test('normalizes neutral defaults and isolates returned definitions', () => {
        const handle = registerCustomProvider(owner, 'a', definition());
        expect(getCustomProvider(handle.id).defaults.custom_include_headers).toBe('');
        const exposed = getCustomProvider(handle.id);
        exposed.defaults.custom_url = 'https://changed.test';
        listCustomProviders()[0].definition.label = 'Changed';
        expect(getCustomProvider(handle.id).label).toBe('Test');
        expect(getCustomProvider(handle.id).defaults.custom_url).toBe('https://example.test/v1');
    });
    test('rejects collisions, invalid updates, and stale takeover handles', () => {
        const handle = registerCustomProvider(owner, 'a', definition());
        expect(() => registerCustomProvider(owner, 'a', definition())).toThrow('already registered');
        expect(() => handle.update({ ...definition(), auth: { mode: 'oauth' } })).toThrow();
        expect(getCustomProvider(handle.id).auth.mode).toBe('bearer');
        handle.unregister();
        handle.unregister();
        const replacement = registerCustomProvider(owner, 'a', definition());
        expect(() => handle.update(definition())).toThrow('no longer current');
        handle.unregister();
        expect(getCustomProvider(replacement.id)).toBeDefined();
    });
    test('suspension rejects late activation while a new lifetime can register once', () => {
        registerCustomProvider(owner, 'a', definition());
        suspendCustomProviderOwner(owner);
        expect(() => registerCustomProvider(owner, 'late', definition())).toThrow('suspended');
        expect(listCustomProviders()).toEqual([]);
        resumeCustomProviderOwner(owner);
        expect(registerCustomProvider(owner, 'a', definition()).id).toBe(`${owner}:a`);
    });
    test.each(['https://u:p@example.test/v1', 'https://example.test/v1?key=x', 'https://example.test/v1#x', 'https://example.test/v1/chat/completions', 'file:///tmp/api'])('rejects an unsafe or completion URL %s', url => {
        expect(() => registerCustomProvider(owner, 'a', definition(url))).toThrow();
    });
    test('keeps the root path and HTTP support', () => {
        expect(normalizeCustomEndpoint('HTTP://LOCALHOST:1234/tenant/v1/')).toBe('http://localhost:1234/tenant/v1');
    });
});

describe('resolved connection state', () => {
    test('Manual → A → B → Manual retains exact values and captured key ID', () => {
        const settings = manual();
        const a = registerCustomProvider(owner, 'a', definition());
        const b = registerCustomProvider(owner, 'b', { ...definition('https://other.test/v1'), auth: { mode: 'none' } });
        switchCustomProvider(settings, a.id, 'original-id');
        expect(settings.custom_include_headers).toBe('');
        expect(() => getCustomAuth(settings)).toThrow('Choose a stored key');
        settings.custom_model = 'edited';
        switchCustomProvider(settings, b.id);
        expect(settings.custom_model).toBe('');
        expect(getCustomAuth(settings).credential.mode).toBe('none');
        switchCustomProvider(settings, null);
        expect(captureCustomFields(settings)).toEqual(manual());
        expect(getCustomAuth(settings).credential).toEqual({ mode: 'legacy-custom', id: 'original-id' });
        switchCustomProvider(settings, a.id);
        expect(settings.custom_model).toBe('edited');
        expect(settings.custom_provider_state.drafts[a.id]).toBeUndefined();
    });
    test('updates, reload, missing extensions and profile copies cannot reset edits', () => {
        const settings = manual();
        const a = registerCustomProvider(owner, 'a', definition());
        switchCustomProvider(settings, a.id);
        settings.custom_model = 'chosen';
        settings.custom_include_body = '';
        const profile = captureCustomConnection(settings);
        a.update(definition('https://updated.test/v1'));
        a.unregister();
        const reloaded = JSON.parse(JSON.stringify(settings));
        switchCustomProvider(reloaded, null);
        switchCustomProvider(reloaded, a.id);
        expect(reloaded.custom_url).toBe('https://example.test/v1');
        expect(reloaded.custom_model).toBe('chosen');
        reloaded.custom_model = 'different';
        expect(profile.settings.custom_model).toBe('chosen');
    });
    test('unknown selections and future versions preserve the existing state', () => {
        const settings = manual();
        expect(() => switchCustomProvider(settings, 'absent:id')).toThrow();
        expect(settings).toEqual(manual());
        settings.custom_provider_state = { version: 2, opaque: 'keep' };
        expect(() => captureCustomConnection(settings)).toThrow('Unsupported');
        expect(settings.custom_provider_state.opaque).toBe('keep');
    });
    test('requires complete snapshots and disallows named legacy bindings', () => {
        const snapshot = captureCustomConnection(manual());
        expect(() => validateCustomSnapshot({ ...snapshot, settings: {} })).toThrow('six explicit');
        expect(() => validateCustomSnapshot({ ...snapshot, provider: { id: 'test:a', label: 'A' } })).toThrow('Legacy');
    });
    test('two same-provider profiles restore independent tuples', () => {
        const settings = manual();
        const a = registerCustomProvider(owner, 'a', { ...definition(), auth: { mode: 'none' } });
        switchCustomProvider(settings, a.id);
        const one = captureCustomConnection(settings);
        settings.custom_model = 'two';
        settings.custom_url = 'https://two.test/v1';
        const two = captureCustomConnection(settings);
        applyCustomSnapshot(settings, one);
        expect(settings.custom_model).toBe('');
        applyCustomSnapshot(settings, two);
        expect(settings.custom_model).toBe('two');
        expect(one.settings.custom_url).toBe('https://example.test/v1');
    });
    test('profile exclusion and contradictory/future records stay distinct from legacy', () => {
        expect(getProfileCustomConnection({})).toBeUndefined();
        expect(getProfileCustomConnection({ 'custom-connection': { version: 1, excluded: true } })).toBeNull();
        expect(() => getProfileCustomConnection({ api: 'openai', 'custom-connection': captureCustomConnection(manual()) })).toThrow('profile.api');
        expect(() => getProfileCustomConnection({ 'custom-connection': { version: 2 } })).toThrow('Unsupported');
    });
    test('legacy profiles use Manual and their own preset, not the active provider', () => {
        const settings = manual();
        const a = registerCustomProvider(owner, 'a', definition());
        switchCustomProvider(settings, a.id);
        settings.custom_include_body = 'private: A';
        const legacy = resolveLegacyCustomConnection(settings, { api: 'custom', 'api-url': 'https://legacy.test/v1', 'secret-id': 'legacy-id' }, { custom_model: 'preset-model' });
        expect(legacy.settings.custom_include_body).toBe('');
        expect(legacy.settings.custom_include_headers).toBe('X-Manual: yes');
        expect(legacy.settings.custom_model).toBe('preset-model');
        expect(legacy.credential).toEqual({ mode: 'legacy-custom', id: 'legacy-id' });
        expect(legacy.provider).toBeNull();
    });
    test('isolated request overlays preserve empties and reject unapproved rerouting', () => {
        const snapshot = captureCustomConnection(manual());
        snapshot.credential = { mode: 'none' };
        const active = { ...manual(), custom_include_body: 'private: active' };
        const isolated = settingsForCustomRequest(active, snapshot, { model: 'override' });
        expect(isolated.custom_include_body).toBe('');
        expect(isolated.custom_model).toBe('override');
        expect(active.custom_include_body).toBe('private: active');
        expect(() => settingsForCustomRequest(active, snapshot, { custom_url: 'https://different.test/v1' })).toThrow('explicit credential');
        expect(() => settingsForCustomRequest(active, snapshot, { chat_completion_source: 'openai' })).toThrow('source');
    });
});
