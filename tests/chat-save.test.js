import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';

const root = process.env.CHAT_SAVE_SOURCE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(resolve(root, file), 'utf8').replaceAll('\r\n', '\n');
const source = read('public/script.js');
const groups = read('public/scripts/group-chats.js');
const utilities = read('public/scripts/utils.js');

// Execute the real persistence functions without booting the browser or contacting a server.
function extract(text, name) {
    const start = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, 'm').exec(text);
    if (!start) return '';
    return text.slice(start.index, text.indexOf('\n}', start.index) + 2).replace(/^export /, '');
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function fixture() {
    const requests = [];
    const responses = [];
    const context = vm.createContext({
        console: { debug() {}, warn() {}, error() {}, trace() {} },
        setTimeout, clearTimeout, setInterval, clearInterval,
        DEFAULT_SAVE_EDIT_TIMEOUT: 1000, selected_group: null, this_chid: '0',
        characters: [{ name: 'A', avatar: 'a.png', chat: 'same-name' }, { name: 'B', avatar: 'b.png', chat: 'same-name' }],
        groups: [{ id: 'group', chat_id: 'group-chat', chats: [] }],
        chat_metadata: { integrity: 'original', nested: { value: 1 } },
        name2: 'A', neutralCharacterName: 'Assistant',
        chat: [{ mes: 'original', extra: { value: 1 } }],
        compressRequest: jest.fn(async request => request), getRequestHeaders: () => ({}),
        fetch: jest.fn(async (url, request) => {
            requests.push({ url, body: JSON.parse(request.body) });
            return await (responses.shift() ?? { ok: true });
        }),
        saveTokenCache: jest.fn(), saveItemizedPrompts: jest.fn(), editGroup: jest.fn(),
        toastr: { error: jest.fn() }, Popup: { show: { input: jest.fn() } },
        window: { location: { reload: jest.fn() } },
        t: (parts, ...values) => String.raw({ raw: parts }, ...values),
    });
    const declarations = source.slice(source.indexOf('let chatSaveTimeout;'), source.indexOf('let firstRun ='));
    vm.runInContext(declarations.replaceAll('export ', ''), context);
    Object.defineProperty(context, 'isChatSaving', { get: () => vm.runInContext('isChatSaving', context) });
    for (const name of ['getCurrentChatId', 'cancelDebouncedChatSave', 'saveChatDebounced', 'saveChatRequest', 'saveChat', 'saveChatConditional']) {
        vm.runInContext(extract(source, name), context);
    }
    vm.runInContext(extract(groups, 'saveGroupChat'), context);
    vm.runInContext(extract(groups, 'saveGroupBookmarkChat'), context);
    vm.runInContext(extract(utilities, 'waitUntilCondition'), context);
    return { context, requests, responses };
}

beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }));
afterEach(() => jest.useRealTimers());

describe('chat persistence', () => {
    test('retains a save waiting longer than one second and awaits its own write', async () => {
        const { context: c, requests, responses } = fixture();
        const firstResponse = deferred();
        const secondResponse = deferred();
        responses.push(firstResponse.promise, secondResponse.promise);
        const first = c.saveChatConditional();
        await jest.advanceTimersByTimeAsync(100);
        expect(requests[0].body.chat[1].mes).toBe('original');
        c.chat[0].mes = 'latest edit';
        let settled = false;
        const second = c.saveChatConditional().then(value => { settled = true; return value; });
        await jest.advanceTimersByTimeAsync(1100);
        expect(settled).toBe(false);
        expect(requests).toHaveLength(1);
        firstResponse.resolve({ ok: true });
        await first;
        await setImmediate();
        expect(requests[1].body.chat[1].mes).toBe('latest edit');
        expect(c.isChatSaving).toBe(true);
        expect(settled).toBe(false);
        secondResponse.resolve({ ok: true });
        await expect(second).resolves.toBe(true);
        expect(c.isChatSaving).toBe(false);
    });

    test('captures nested data and chat identity before queued single and group writes', async () => {
        const { context: c, requests, responses } = fixture();
        const gate = deferred();
        responses.push(gate.promise);
        const first = c.saveChat();
        await setImmediate();
        c.chat[0].mes = 'A edit';
        const second = c.saveChatConditional();
        c.this_chid = '1';
        c.chat[0].mes = 'B edit';
        const third = c.saveChat();
        c.selected_group = 'group';
        c.chat[0].mes = 'group edit';
        const fourth = c.saveChatConditional();
        c.groups[0].chat_id = 'other-group-chat';
        c.chat[0].extra.value = 2;
        c.chat_metadata.nested.value = 2;
        await setImmediate();
        expect(requests).toHaveLength(1);
        gate.resolve({ ok: true });
        await Promise.all([first, second, third, fourth]);
        expect(requests.map(x => x.body.chat[1].mes)).toEqual(['original', 'A edit', 'B edit', 'group edit']);
        expect(requests.map(x => x.body.avatar_url || x.body.id)).toEqual(['a.png', 'a.png', 'b.png', 'group-chat']);
        expect(requests[3].body.chat[1].extra.value).toBe(1);
        expect(requests[3].body.chat[0].chat_metadata.nested.value).toBe(1);
        expect(c.saveItemizedPrompts).not.toHaveBeenCalled();
        expect(c.isChatSaving).toBe(false);
    });

    for (const { failure, prepare, fail } of [
        { failure: 'network', prepare: (_c, responses, gate) => responses.push(gate.promise), fail: gate => gate.reject(new Error('failed')) },
        { failure: 'http', prepare: (_c, responses, gate) => responses.push(gate.promise), fail: gate => gate.resolve({ ok: false, statusText: 'failed', json: async () => ({ error: true }) }) },
        { failure: 'compression', prepare: (c, _responses, gate) => c.compressRequest.mockImplementationOnce(() => gate.promise), fail: gate => gate.reject(new Error('failed')) },
    ]) {
        test(`recovers after ${failure} failure without dropping the next save`, async () => {
            const { context: c, requests, responses } = fixture();
            const gate = deferred();
            prepare(c, responses, gate);
            const first = c.saveChat().catch(error => error);
            await setImmediate();
            c.chat[0].mes = 'recovery edit';
            const second = c.saveChatConditional();
            fail(gate);
            await expect(first).resolves.toMatchObject({ message: 'failed' });
            await expect(second).resolves.toBe(true);
            expect(requests.at(-1).body.chat[1].mes).toBe('recovery edit');
            expect(c.toastr.error).toHaveBeenCalledTimes(1);
            expect(c.isChatSaving).toBe(false);
        });
    }

    for (const { name, groupId, save, groupEdits } of [
        { name: 'single', groupId: null, save: c => c.saveChat({ chatName: 'branch', chatData: [{ mes: 'chosen swipe' }] }), groupEdits: 0 },
        { name: 'group', groupId: 'group', save: c => c.saveGroupChat('group', true), groupEdits: 1 },
    ]) {
        test(`integrity overwrite keeps its original ${name} snapshot`, async () => {
            const { context: c, requests, responses } = fixture();
            c.selected_group = groupId;
            const confirmation = deferred();
            responses.push({ ok: false, json: async () => ({ error: 'integrity' }) });
            c.Popup.show.input.mockReturnValue(confirmation.promise);
            const saving = save(c);
            await setImmediate();
            c.chat[0].mes = 'unrelated edit';
            c.this_chid = '1';
            c.groups[0].chat_id = 'different-chat';
            confirmation.resolve('OVERWRITE');
            await saving;
            expect(requests).toHaveLength(2);
            expect(requests[1]).toEqual({ url: requests[0].url, body: { ...requests[0].body, force: true } });
            expect(c.Popup.show.input).toHaveBeenCalledTimes(1);
            expect(c.editGroup).toHaveBeenCalledTimes(groupEdits);
            expect(c.isChatSaving).toBe(false);
        });
    }

    test('a refused integrity overwrite does not retry or report success', async () => {
        const { context: c, requests, responses } = fixture();
        responses.push({ ok: false, json: async () => ({ error: 'integrity' }) });
        c.Popup.show.input.mockResolvedValue('');
        const saving = c.saveChatConditional();
        await jest.advanceTimersByTimeAsync(100);
        await expect(saving).resolves.toBe(false);
        expect(requests).toHaveLength(1);
        expect(c.window.location.reload).toHaveBeenCalledTimes(1);
        expect(c.saveItemizedPrompts).not.toHaveBeenCalled();
        expect(c.isChatSaving).toBe(false);
    });

    test('group bookmarks capture content before awaiting group persistence and do not register failed files', async () => {
        const { context: c, requests, responses } = fixture();
        const editing = deferred();
        c.editGroup.mockReturnValueOnce(editing.promise);
        const saving = c.saveGroupBookmarkChat('group', 'checkpoint', { integrity: 'checkpoint' }, 0);
        await setImmediate();
        c.chat[0].mes = 'later edit';
        c.chat[0].extra.value = 2;
        c.chat_metadata.nested.value = 2;
        editing.resolve();
        await saving;
        expect(requests[0].body.chat[1]).toMatchObject({ mes: 'original', extra: { value: 1 } });
        expect(requests[0].body.chat[0].chat_metadata).toEqual({ integrity: 'checkpoint', nested: { value: 1 } });
        responses.push({ ok: false, statusText: 'failed', json: async () => ({ error: true }) });
        await expect(c.saveGroupBookmarkChat('group', 'failed-checkpoint', {}, 0)).rejects.toThrow('failed');
        expect(c.groups[0].chats).toEqual(['checkpoint']);
        expect(c.editGroup).toHaveBeenCalledTimes(1);
        expect(c.isChatSaving).toBe(false);
    });

    test('does not prompt or retry again when a confirmed overwrite also fails', async () => {
        const { context: c, requests, responses } = fixture();
        responses.push(...Array(2).fill({ ok: false, statusText: 'failed', json: async () => ({ error: 'integrity' }) }));
        c.Popup.show.input.mockResolvedValue('OVERWRITE');
        const saving = c.saveChatConditional();
        await jest.advanceTimersByTimeAsync(100);
        await expect(saving).resolves.toBe(false);
        expect(requests).toHaveLength(2);
        expect(requests[1].body.force).toBe(true);
        expect(c.Popup.show.input).toHaveBeenCalledTimes(1);
        expect(c.isChatSaving).toBe(false);
    });

    test('keeps a newer debounced edit protected after an earlier write finishes', async () => {
        const { context: c, requests, responses } = fixture();
        const gate = deferred();
        responses.push(gate.promise);
        const first = c.saveChatConditional();
        await jest.advanceTimersByTimeAsync(100);
        c.chat[0].mes = 'debounced edit';
        c.saveChatDebounced();
        gate.resolve({ ok: true });
        await first;
        expect(c.isChatSaving).toBe(true);
        await jest.advanceTimersByTimeAsync(1000);
        expect(requests[1].body.chat[1].mes).toBe('debounced edit');
        expect(c.isChatSaving).toBe(false);
        c.saveChatDebounced();
        c.cancelDebouncedChatSave();
        await jest.advanceTimersByTimeAsync(1000);
        expect(requests).toHaveLength(2);
        expect(c.isChatSaving).toBe(false);
    });

    test('does not apply an old debounce to a different chat of the same character', async () => {
        const { context: c, requests } = fixture();
        c.saveChatDebounced();
        c.characters[0].chat = 'different-chat';
        await jest.advanceTimersByTimeAsync(1100);
        expect(requests).toHaveLength(0);
        expect(c.isChatSaving).toBe(false);
    });
});
