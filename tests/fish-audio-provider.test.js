import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const eventListeners = new Map();
const eventSourceMock = {
    on: jest.fn((event, fn) => {
        if (!eventListeners.has(event)) eventListeners.set(event, new Set());
        eventListeners.get(event).add(fn);
    }),
    removeListener: jest.fn((event, fn) => {
        eventListeners.get(event)?.delete(fn);
    }),
};
const saveSettingsDebouncedMock = jest.fn();
const initVoiceMapMock = jest.fn(async () => {});
const saveTtsProviderSettingsMock = jest.fn();
const secretStateMock = {};

jest.unstable_mockModule('../public/script.js', () => ({
    event_types: {
        SECRET_WRITTEN: 'secret_written',
        SECRET_DELETED: 'secret_deleted',
        SECRET_ROTATED: 'secret_rotated',
    },
    eventSource: eventSourceMock,
    getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'test-token' }),
    saveSettingsDebounced: saveSettingsDebouncedMock,
}));

jest.unstable_mockModule('../public/scripts/secrets.js', () => ({
    SECRET_KEYS: { FISH_AUDIO: 'api_key_fish_audio' },
    secret_state: secretStateMock,
}));

jest.unstable_mockModule('../public/scripts/extensions/tts/index.js', () => ({
    getPreviewString: () => 'Preview line',
    initVoiceMap: initVoiceMapMock,
    saveTtsProviderSettings: saveTtsProviderSettingsMock,
}));

function makeJqueryElement(overrides = {}) {
    const el = {
        value: '',
        textValue: '',
        classes: new Set(),
        children: [],
        handlers: {},
        val(v) {
            if (v === undefined) return el.value;
            el.value = v;
            return el;
        },
        text(t) {
            if (t === undefined) return el.textValue;
            el.textValue = t;
            return el;
        },
        toggleClass(name, flag) {
            if (flag) el.classes.add(name);
            else el.classes.delete(name);
            return el;
        },
        addClass(name) {
            el.classes.add(name);
            return el;
        },
        attr() { return el; },
        empty() {
            el.children = [];
            return el;
        },
        append(child) {
            el.children.push(child);
            return el;
        },
        on(events, fn) {
            for (const ev of String(events).split(' ')) el.handlers[ev] = fn;
            return el;
        },
        trigger(ev) {
            el.handlers[ev]?.({ type: ev });
            return el;
        },
        each(fn) {
            for (let i = 0; i < el.children.length; i++) fn(i, el.children[i]);
            return el;
        },
        ...overrides,
    };
    return el;
}

describe('FishAudioTtsProvider', () => {
    /** @type {typeof import('../public/scripts/extensions/tts/fish-audio.js').FishAudioTtsProvider} */
    let FishAudioTtsProvider;
    let elements;
    let fetchMock;
    let originalFetch;
    let originalAudio;
    let originalDollar;
    let originalToastr;

    beforeAll(async () => {
        originalFetch = globalThis.fetch;
        originalAudio = globalThis.Audio;
        originalDollar = globalThis.$;
        originalToastr = globalThis.toastr;

        globalThis.Audio = class MockAudio {
            pause() {}
            removeAttribute() {}
            play() { return Promise.resolve(); }
        };
        globalThis.toastr = { warning: jest.fn(), error: jest.fn() };

        ({ FishAudioTtsProvider } = await import('../public/scripts/extensions/tts/fish-audio.js'));
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
        globalThis.Audio = originalAudio;
        globalThis.$ = originalDollar;
        globalThis.toastr = originalToastr;
    });

    beforeEach(() => {
        eventListeners.clear();
        eventSourceMock.on.mockClear();
        eventSourceMock.removeListener.mockClear();
        saveSettingsDebouncedMock.mockClear();
        initVoiceMapMock.mockClear();
        saveTtsProviderSettingsMock.mockClear();
        globalThis.toastr.warning.mockClear();
        globalThis.toastr.error.mockClear();

        for (const key of Object.keys(secretStateMock)) delete secretStateMock[key];
        secretStateMock.api_key_fish_audio = [{ id: 'key-1', active: true }];

        elements = new Map();
        globalThis.$ = (selector) => {
            if (typeof selector === 'object' && selector !== null) return selector;
            if (String(selector).startsWith('<')) return makeJqueryElement();
            if (!elements.has(selector)) elements.set(selector, makeJqueryElement());
            return elements.get(selector);
        };

        fetchMock = jest.fn();
        globalThis.fetch = fetchMock;
    });

    test('sanitizes voice names, preserves assigned labels, and deduplicates owned/manual voices', () => {
        const provider = new FishAudioTtsProvider();
        provider.settings = {
            manualVoices: [
                { id: 'v1', name: 'Manual <script>Name' },
                { id: 'v2', name: 'Public Voice' },
            ],
            voiceMap: {
                Alice: 'Original Title [v1]',
            },
        };

        const voices = provider.voiceObjects([
            { id: 'v1', name: 'Owned New Title' },
            { id: 'v3', name: 'Owned <b>Voice</b>' },
        ]);

        expect(voices).toEqual([
            { name: 'Original Title [v1]', voice_id: 'v1', lang: 'en-US', preview_url: false },
            { name: 'Owned bVoice/b [v3]', voice_id: 'v3', lang: 'en-US', preview_url: false },
            { name: 'Public Voice [v2]', voice_id: 'v2', lang: 'en-US', preview_url: false },
        ]);
    });

    test('passes synthesis settings and only forwards AbortSignal as the third argument', async () => {
        fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob() });
        const provider = new FishAudioTtsProvider();
        provider.settings = {
            model: 's3-pro',
            latency: 'low',
            speed: 1.1,
            temperature: 0.6,
            top_p: 0.8,
            voiceMap: {},
            manualVoices: [],
        };

        await provider.generateTts('Hello [laughing]', 'voice-123', 'Alice');
        expect(fetchMock).toHaveBeenLastCalledWith('/api/speech/fish-audio/synthesize', expect.objectContaining({
            method: 'POST',
            signal: undefined,
            body: JSON.stringify({
                text: 'Hello [laughing]',
                reference_id: 'voice-123',
                model: 's3-pro',
                latency: 'low',
                speed: 1.1,
                temperature: 0.6,
                top_p: 0.8,
            }),
        }));

        const controller = new AbortController();
        await provider.generateTts('Preview', 'voice-123', controller.signal);
        expect(fetchMock).toHaveBeenLastCalledWith('/api/speech/fish-audio/synthesize', expect.objectContaining({
            signal: controller.signal,
        }));
    });

    test('disables removed manual voice assignments while preserving owned voice assignments', async () => {
        const provider = new FishAudioTtsProvider();
        provider.settings = {
            manualVoices: [
                { id: 'pub-1', name: 'Public One' },
                { id: 'owned-1', name: 'Owned Alias' },
            ],
            voiceMap: {
                Alice: 'Public One [pub-1]',
                Bob: 'Owned Alias [owned-1]',
            },
        };
        provider.discovery = { key: 'key-1', controller: new AbortController(), voices: [{ id: 'owned-1', name: 'Owned' }] };

        const aliceSelect = makeJqueryElement({ value: 'Public One [pub-1]' });
        const bobSelect = makeJqueryElement({ value: 'Owned Alias [owned-1]' });
        elements.set('#tts_voicemap_block select', makeJqueryElement({ children: [aliceSelect, bobSelect] }));

        await provider.saveManualVoices([]);

        expect(aliceSelect.val()).toBe('disabled');
        expect(bobSelect.val()).toBe('Owned Alias [owned-1]');
        expect(provider.settings.voiceMap).toEqual({
            Alice: 'disabled',
            Bob: 'Owned Alias [owned-1]',
        });
        expect(provider.settings.manualVoices).toEqual([]);
        expect(saveSettingsDebouncedMock).toHaveBeenCalledTimes(1);
        expect(initVoiceMapMock).toHaveBeenCalledTimes(1);
    });

    test('discards stale voice discovery responses when the active key changes mid-flight', async () => {
        let resolveFirst;
        fetchMock
            .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ voices: [{ id: 'new-voice', name: 'Key2 Voice' }], complete: true }),
            });

        const provider = new FishAudioTtsProvider();
        provider.settings = { voiceMap: {}, manualVoices: [] };

        const firstPromise = provider.fetchTtsVoiceObjects();
        secretStateMock.api_key_fish_audio = [{ id: 'key-2', active: true }];
        resolveFirst({
            ok: true,
            json: async () => ({ voices: [{ id: 'old-voice', name: 'Key1 Voice' }], complete: true }),
        });

        const voices = await firstPromise;
        expect(voices).toEqual([
            { name: 'Key2 Voice [new-voice]', voice_id: 'new-voice', lang: 'en-US', preview_url: false },
        ]);
    });

    test('removes secret listeners and aborts pending discovery on dispose()', async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ voices: [], complete: true }) });
        const provider = new FishAudioTtsProvider();
        const settings = {};
        await provider.loadSettings(settings);

        expect(settings.model).toBe('drama-3');
        expect(eventSourceMock.on).toHaveBeenCalledTimes(3);
        const abortSpy = jest.spyOn(provider.discovery.controller, 'abort');

        provider.dispose();

        expect(provider.disposed).toBe(true);
        expect(abortSpy).toHaveBeenCalled();
        expect(eventSourceMock.removeListener).toHaveBeenCalledTimes(3);
    });
});
