/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect", "assert.*"] }] */
/* eslint playwright/expect-expect: "off", playwright/no-conditional-in-test: "off" -- VM unit tests use node:assert and conditional fixtures, not Playwright. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from '@jest/globals';
import vm from 'node:vm';

const script = readFileSync(new URL('../public/script.js', import.meta.url), 'utf8');
const extensions = readFileSync(new URL('../public/scripts/extensions.js', import.meta.url), 'utf8');

function functionSource(source, name) {
    const start = source.search(new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, 'm'));
    assert.ok(start >= 0, `${name} exists`);
    const end = source.indexOf('\n}', start);
    assert.ok(end > start, `${name} has a closing brace`);
    return source.slice(start, end + 2).replace(/^export /, '');
}

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

const message = text => ({ name: 'Test', is_user: false, mes: text });
const loadedChat = (integrity = 'loaded', text = 'Existing message') => [
    { chat_metadata: { integrity } }, message(text),
];
const response = data => ({ ok: true, json: async () => data });

function harness() {
    const requests = [], events = [], errors = [], logs = [], timers = new Map();
    let timerId = 0, uuid = 0, renders = 0, tokenSaves = 0;
    const hooks = {};
    const element = { length: 0, is: () => false, trigger() { return this; }, remove() {} };
    const sandbox = vm.createContext({
        console: Object.fromEntries(['debug', 'warn', 'error', 'log', 'trace'].map(level => [level, (...args) => logs.push({ level, args })])),
        characters: [{ name: 'Test', avatar: 'test.png', chat: 'Chat A' }], this_chid: '0', selected_group: null, groups: [],
        chat: [message('Original message')], chat_metadata: { integrity: 'original' }, name2: 'Test', neutralCharacterName: 'Neutral',
        DEFAULT_SAVE_EDIT_TIMEOUT: 10, debounce_timeout: { relaxed: 10, short: 1 },
        setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
        waitUntilCondition: async predicate => {
            if (hooks.wait) return hooks.wait(predicate);
            assert.equal(predicate(), true, 'save lock is available');
        },
        getRequestHeaders: () => ({}),
        compressRequest: async request => hooks.compress ? hooks.compress(request) : request,
        fetch: async (url, options) => {
            const request = { url, body: JSON.parse(options.body) }; requests.push(request);
            if (hooks.fetch) return hooks.fetch(request);
            return url === '/api/chats/get' ? response(loadedChat()) : response({});
        },
        Popup: { show: { input: async () => hooks.popup ? hooks.popup() : '' } },
        window: { location: { reload() { events.push('reload'); } } },
        toastr: { error: (...args) => errors.push(args) }, t: parts => parts.join(''),
        unshallowCharacter: async () => hooks.unshallow?.(), uuidv4: () => `new-integrity-${++uuid}`,
        ensureMessageMediaIsArray() {}, getFirstMessage: () => message('Greeting'),
        loadItemizedPrompts: async () => {}, printMessages: async () => { renders++; await hooks.render?.(); },
        select_selected_character() {}, event_types: { CHAT_CHANGED: 'changed', CHAT_CREATED: 'created', CHAT_LOADED: 'loaded', MESSAGE_RECEIVED: 'received', CHARACTER_MESSAGE_RENDERED: 'rendered' },
        eventSource: { emit: async event => { events.push(event); await hooks.event?.(event); } },
        document: { activeElement: {} }, $: () => element, delay: async () => {},
        closeMessageEditor() {}, extension_prompts: {}, is_delete_mode: false, chatElement: { children: () => element }, itemizedPrompts: [],
        saveTokenCache: () => tokenSaves++, saveItemizedPrompts: async () => {},
        saveGroupChat: async groupId => events.push(`save-group:${groupId}`),
        getContext: () => ({ saveMetadata: () => sandbox.saveChatConditional() }),
    });
    vm.runInContext('let chatLoadGeneration = 0; let currentChatLoad = null; let chatSaveTimeout; let saveMetadataTimeout; let isChatSaving = false;', sandbox);
    const names = ['getCurrentChatId', 'getChatSaveContext', 'isChatSaveContextCurrent', 'warnIfLoadedChatCannotSave', 'cancelDebouncedChatSave', 'saveChatDebounced', 'saveChat', 'saveChatConditional', 'clearChat', 'getChat', 'getChatResult'];
    vm.runInContext(names.map(name => functionSource(script, name)).join('\n') + '\n'
        + ['cancelDebouncedMetadataSave', 'saveMetadataDebounced'].map(name => functionSource(extensions, name)).join('\n'), sandbox);
    return {
        api: sandbox, requests, events, errors, logs, timers, hooks,
        get renders() { return renders; }, get tokenSaves() { return tokenSaves; },
        async timersRun() { const pending = [...timers.values()]; timers.clear(); for (const callback of pending) await callback(); },
        async waitForRequests(count) {
            for (let tick = 0; tick < 20 && requests.length < count; tick++) await Promise.resolve();
            assert.equal(requests.length, count);
        },
        get saving() { return vm.runInContext('isChatSaving', sandbox); },
    };
}

test('missing integrity blocks direct, forced, conditional and debounced saves', async () => {
    const h = harness(); h.api.chat_metadata = {}; h.api.chat.length = 0;
    await h.api.saveChat(); await h.api.saveChat({ force: true }); await h.api.saveChatConditional();
    h.api.saveChatDebounced(); h.api.saveMetadataDebounced(); await h.timersRun();
    assert.equal(h.requests.length, 0); assert.equal(h.timers.size, 0); assert.deepEqual(h.events, []);
    assert.equal(h.saving, false);
});

test('ordinary loaded chat saves messages and metadata', async () => {
    const h = harness(); await h.api.saveChatConditional();
    assert.equal(h.requests.length, 1); assert.equal(h.requests[0].body.file_name, 'Chat A');
    assert.equal(h.requests[0].body.chat[0].chat_metadata.integrity, 'original');
    assert.equal(h.requests[0].body.chat[1].mes, 'Original message');
    assert.equal(h.tokenSaves, 1); assert.equal(h.saving, false);
});

test('metadata overrides cannot remove integrity from a loaded chat save', async () => {
    const h = harness(); await h.api.saveChat({ withMetadata: { integrity: undefined } });
    assert.equal(h.requests.length, 0);
});

test('losing integrity after loading warns once instead of silently dropping edits', async () => {
    const h = harness(); await h.api.getChat(); delete h.api.chat_metadata.integrity;
    const before = h.requests.length; h.api.saveChatDebounced(); await h.api.saveChatConditional(); await h.api.saveChat();
    assert.equal(h.requests.length, before); assert.equal(h.errors.length, 1);
});

for (const method of ['saveChatDebounced', 'saveMetadataDebounced']) {
    for (const change of ['file', 'integrity', 'character', 'group']) {
        test(`${method} cancels a stale ${change} target`, async () => {
            const h = harness(); h.api[method]();
            if (change === 'file') h.api.characters[0].chat = 'Chat B';
            if (change === 'integrity') h.api.chat_metadata.integrity = 'different';
            if (change === 'character') h.api.this_chid = undefined;
            if (change === 'group') { h.api.selected_group = 'group'; h.api.groups.push({ id: 'group', chat_id: 'Group chat' }); }
            await h.timersRun(); assert.equal(h.requests.length, 0); assert.deepEqual(h.events, []);
        });
    }
    test(`${method} still saves edits to the same loaded chat`, async () => {
        const h = harness(); h.api[method](); h.api.chat_metadata.note = 'Updated note';
        await h.timersRun(); assert.equal(h.requests.length, 1);
        assert.equal(h.requests[0].body.chat[0].chat_metadata.note, 'Updated note');
    });
}

test('a queued save does not move to another chat while awaiting the save lock', async () => {
    const h = harness(), wait = deferred(); h.hooks.wait = () => wait.promise;
    const saving = h.api.saveChatConditional();
    h.api.characters[0].chat = 'Chat B'; h.api.chat_metadata = { integrity: 'other' };
    wait.resolve(); await saving;
    assert.equal(h.requests.length, 0); assert.equal(h.tokenSaves, 0); assert.equal(h.saving, false);
});

test('concurrent saves wait for the current save and preserve newer metadata', async () => {
    const h = harness(), firstRequest = deferred(), unlocked = deferred();
    h.hooks.wait = async predicate => { if (!predicate()) await unlocked.promise; };
    h.hooks.fetch = request => h.requests.length === 1 ? firstRequest.promise : response({});
    const first = h.api.saveChatConditional(); await h.waitForRequests(1);
    h.api.chat_metadata.note = 'New edit';
    const second = h.api.saveChatConditional();
    firstRequest.resolve(response({})); await first; unlocked.resolve(); await second;
    assert.equal(h.requests.length, 2);
    assert.equal(h.requests[1].body.chat[0].chat_metadata.note, 'New edit');
    assert.equal(h.saving, false);
});

test('switching during compression prevents dispatching a stale save', async () => {
    const h = harness(), compress = deferred(); h.hooks.compress = () => compress.promise;
    const saving = h.api.saveChat(); h.api.characters[0].chat = 'Chat B';
    compress.resolve({}); await saving;
    assert.equal(h.requests.length, 0);
});

test('branch snapshots keep the explicit target, fresh integrity and selected messages', async () => {
    const h = harness();
    await h.api.saveChat({ chatName: 'Branch', withMetadata: { integrity: 'branch', main_chat: 'Chat A' }, chatData: [message('Chosen swipe')] });
    assert.equal(h.requests[0].body.file_name, 'Branch');
    assert.equal(h.requests[0].body.chat[0].chat_metadata.integrity, 'branch');
    assert.equal(h.requests[0].body.chat[1].mes, 'Chosen swipe');
    assert.equal(h.api.chat_metadata.integrity, 'original');
});

test('clearing data blocks saves before replacement metadata is loaded', async () => {
    const h = harness(); await h.api.clearChat({ clearData: true });
    assert.equal(h.api.chat_metadata.integrity, 'original');
    await h.api.saveChat(); h.api.saveMetadataDebounced(); await h.timersRun();
    assert.equal(h.requests.length, 0);
});

test('loading blocks saves even while old metadata is still present', async () => {
    const h = harness(), load = deferred(); h.hooks.fetch = request => request.url.endsWith('/get') ? load.promise : response({});
    const loading = h.api.getChat(); await h.waitForRequests(1);
    assert.equal(h.api.getChatSaveContext(), null);
    await h.api.saveChatConditional(); await h.api.saveChat();
    h.api.saveChatDebounced(); h.api.saveMetadataDebounced(); await h.timersRun();
    assert.equal(h.requests.filter(request => request.url.endsWith('/save')).length, 0);
    load.resolve(response(loadedChat())); await loading;
    assert.equal(h.api.getChatSaveContext().integrity, 'loaded');
    await h.api.saveChatConditional();
    assert.equal(h.requests.filter(request => request.url.endsWith('/save')).length, 1);
});

for (const failure of ['network', 'status', 'json', 'shape', 'header', 'metadata']) {
    test(`failed ${failure} loading cannot create or save a greeting, and can be retried`, async () => {
        const h = harness(); h.api.chat.length = 0; h.api.chat_metadata = {};
        h.hooks.fetch = async () => {
            if (failure === 'network') throw new Error('Network failed');
            if (failure === 'status') return { ok: false };
            if (failure === 'json') return { ok: true, json: async () => { throw new Error('Invalid JSON'); } };
            if (failure === 'header') return response([null, message('Orphaned message')]);
            if (failure === 'metadata') return response([{ chat_metadata: [] }, message('Invalid metadata')]);
            return response({ error: 'Invalid shape' });
        };
        await h.api.getChat(); await h.api.saveChatConditional();
        assert.equal(h.api.chat.length, 0); assert.equal(h.renders, 0); assert.equal(h.errors.length, 1);
        assert.equal(h.requests.some(request => request.url.endsWith('/save')), false);
        assert.equal(h.events.includes('loaded'), false);
        delete h.hooks.fetch; await h.api.getChat();
        assert.equal(h.api.chat[0].mes, 'Existing message'); assert.ok(h.api.getChatSaveContext());
    });
}

test('new chats and legacy headers receive integrity only after a successful load', async () => {
    for (const data of [[], [{ user_name: 'Legacy' }, message('Legacy message')]]) {
        const h = harness(); h.api.chat.length = 0; h.api.chat_metadata = {};
        h.hooks.fetch = async request => request.url.endsWith('/get') ? response(data) : response({});
        await h.api.getChat();
        assert.match(h.api.chat_metadata.integrity, /^new-integrity-/);
        assert.ok(h.api.chat.length > 0); assert.ok(h.api.getChatSaveContext());
        await h.api.saveChatConditional();
        assert.ok(h.requests.some(request => request.url.endsWith('/save')));
        assert.ok(h.requests.filter(request => request.url.endsWith('/save')).every(request => request.body.chat[0].chat_metadata.integrity));
    }
});

test('unshallowing can update the selected file before the chat request is captured', async () => {
    const h = harness(); h.hooks.unshallow = () => { h.api.characters[0].chat = 'Refreshed chat'; };
    await h.api.getChat(); assert.equal(h.requests[0].body.file_name, 'Refreshed chat');
    assert.equal(h.api.getChatSaveContext().chatId, 'Refreshed chat');
});

test('render errors do not retry loading or make valid loaded messages unsavable', async () => {
    const h = harness(); h.hooks.render = () => { throw new Error('Extension render failed'); };
    await h.api.getChat(); assert.equal(h.renders, 1); assert.equal(h.errors.length, 1);
    assert.equal(h.api.getChatSaveContext().integrity, 'loaded');
    await h.api.saveChatConditional();
    assert.equal(h.requests.filter(request => request.url.endsWith('/save')).length, 1);
});

test('an older load response cannot replace a newly selected chat', async () => {
    const h = harness(), first = deferred();
    h.hooks.fetch = async request => request.body.file_name === 'Chat A' ? first.promise : response(loadedChat('second', 'Chat B message'));
    const loadingA = h.api.getChat(); await h.waitForRequests(1);
    h.api.characters[0].chat = 'Chat B'; await h.api.getChat();
    first.resolve(response(loadedChat('first', 'Stale A message'))); await loadingA;
    assert.equal(h.api.chat_metadata.integrity, 'second'); assert.equal(h.api.chat[0].mes, 'Chat B message');
    assert.equal(h.renders, 1);
});

test('reopening the same file discards the previous response and previous save timers', async () => {
    const h = harness(), first = deferred();
    h.api.saveChatDebounced(); const staleTimer = [...h.timers.values()][0];
    let loads = 0;
    h.hooks.fetch = async () => ++loads === 1 ? first.promise : response(loadedChat('newer', 'Newer load'));
    const oldLoad = h.api.getChat(); await h.waitForRequests(1);
    await h.api.getChat();
    first.resolve(response(loadedChat('older', 'Older load'))); await oldLoad;
    const before = h.requests.length; await staleTimer();
    assert.equal(h.requests.length, before);
    assert.equal(h.api.chat_metadata.integrity, 'newer');
    assert.equal(h.api.chat[0].mes, 'Newer load'); assert.equal(h.renders, 1);
});

test('a late load failure does not block or show an error over a newer loaded chat', async () => {
    const h = harness(), first = deferred(); let loads = 0;
    h.hooks.fetch = async () => ++loads === 1 ? first.promise : response(loadedChat('newer'));
    const oldLoad = h.api.getChat(); await h.waitForRequests(1);
    await h.api.getChat(); first.reject(new Error('Old request failed')); await oldLoad;
    assert.equal(h.errors.length, 0); assert.equal(h.api.getChatSaveContext().integrity, 'newer');
});

test('a real integrity mismatch still prompts and explicit overwrite preserves its snapshot', async () => {
    const h = harness(); let saves = 0;
    h.hooks.fetch = async () => ++saves === 1 ? { ok: false, json: async () => ({ error: 'integrity' }) } : response({});
    h.hooks.popup = () => 'OVERWRITE'; await h.api.saveChat();
    assert.equal(h.requests.length, 2); assert.equal(h.requests[1].body.force, true);
    assert.deepEqual(h.requests[1].body.chat, h.requests[0].body.chat);
});

test('switching while an integrity popup is open cannot overwrite or reload the new chat', async () => {
    const h = harness();
    h.hooks.fetch = async () => ({ ok: false, json: async () => ({ error: 'integrity' }) });
    h.hooks.popup = () => { h.api.characters[0].chat = 'Chat B'; return 'OVERWRITE'; };
    await h.api.saveChat(); assert.equal(h.requests.length, 1); assert.deepEqual(h.events, []);
});

test('loaded group saves continue through their own persistence path', async () => {
    const h = harness(); h.api.selected_group = 'group'; h.api.groups.push({ id: 'group', chat_id: 'Group chat' });
    await h.api.saveChatConditional(); assert.deepEqual(h.events, ['save-group:group']);
    assert.equal(h.requests.length, 0); assert.equal(h.saving, false);
});

