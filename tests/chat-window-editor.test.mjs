/* eslint-disable playwright/expect-expect, playwright/no-conditional-in-test -- Node integration harness with injected UI collaborators. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parse } from 'acorn';

import { ChatStore as BackendChatStore } from '../src/chat-store.js';
import { ChatStore as FrontendChatStore } from '../public/scripts/chat-store.js';

const source = fs.readFileSync(new URL('../public/script.js', import.meta.url), 'utf8');
const syntax = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });

function bindSourceFunction(name, context) {
    const declaration = syntax.body.map(node => node.declaration ?? node)
        .find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
    assert.ok(declaration, `The real ${name} function must exist`);
    return new Function('context', `with (context) { return (${source.slice(declaration.start, declaration.end)}); }`)(context);
}

async function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chat-editor-'));
    const file = path.join(directory, 'synthetic.jsonl');
    const header = { chat_metadata: { integrity: 'synthetic' }, user_name: 'unused', character_name: 'unused' };
    fs.writeFileSync(file, [header, ...Array.from({ length: 20 }, (_, index) => ({ mes: `Synthetic ${index}` }))].map(JSON.stringify).join('\n'));
    const backend = new BackendChatStore(file);
    t.after(() => {
        backend.close();
        fs.rmSync(directory, { recursive: true, force: true });
    });
    let pause;
    const requests = [];
    const activeChatStore = new FrontendChatStore({ fetch: async (url, options) => {
        const body = JSON.parse(options.body);
        requests.push(url);
        const result = url.endsWith('/page') ? await backend.page(body) : await backend.replaceWindow(body);
        if (pause && url.endsWith('/page')) {
            const waiting = pause;
            pause = null;
            waiting.enter();
            await waiting.gate;
        }
        return { ok: true, json: async () => structuredClone(result) };
    } });
    const chat = [];
    await activeChatStore.open({ avatar_url: 'synthetic.png', file_name: 'synthetic' }, chat, 5);
    const context = {
        activeChatStore, chat, chat_metadata: header.chat_metadata,
        this_edit_mes_id: undefined, draft: null, reasoningDraft: null,
        chatWindowChangeDepth: 0, this_chid: 0, generation_started: null,
        power_user: { chat_truncation: 5, auto_save_msg_edits: false },
        removed: 0, unblockCalls: 0, notices: [],
        t: strings => strings[0], console,
        unshallowCharacter: async () => {}, setGenerationProgress: () => {},
        unblockGeneration: () => { context.unblockCalls++; },
        chatElement: {
            find: () => ({ length: Number(!!context.draft || !!context.reasoningDraft) }),
            children: () => ({ length: 0, remove() {
                context.draft = null;
                context.reasoningDraft = null;
                context.removed++;
            } }),
        },
        toastr: { info: message => { context.notices.push(message); } },
        ensureMessageMediaIsArray: () => {}, printMessages: async () => {},
    };
    for (const name of ['isChatWindowChanging', 'assertChatWindowEditorClosed', 'withChatWindowChange', 'getChatWindowHeader', 'loadChatWindowAround', 'ensureLatestChatWindow', 'messageEdit', 'Generate']) {
        context[name] = bindSourceFunction(name, context);
    }
    return {
        context, requests, backend,
        holdNextPage() {
            let enter;
            let release;
            const entered = new Promise(resolve => { enter = resolve; });
            const gate = new Promise(resolve => { release = resolve; });
            pause = { enter, gate };
            return { entered, release };
        },
    };
}

for (const editor of ['message', 'reasoning']) {
    test(`global chat jumps preserve an unsaved ${editor} draft`, async t => {
        const { context, requests } = await fixture(t);
        if (editor === 'message') {
            context.this_edit_mes_id = 0;
            context.draft = 'Unsaved message edit';
        } else {
            context.reasoningDraft = 'Unsaved reasoning edit';
        }
        const snapshot = context.activeChatStore.snapshot();
        await assert.rejects(context.loadChatWindowAround(3), /Finish or cancel your message edit/);
        assert.deepEqual(context.activeChatStore.snapshot(), snapshot);
        assert.equal(context.draft || context.reasoningDraft, editor === 'message' ? 'Unsaved message edit' : 'Unsaved reasoning edit');
        assert.equal(context.removed, 0);
        assert.equal(context.chatWindowChangeDepth, 0);
        assert.equal(requests.length, 1);
    });
}

test('returning to the tail preserves an unsaved draft on an older page', async t => {
    const { context } = await fixture(t);
    await context.activeChatStore.navigate(context.chat, context.getChatWindowHeader(), { direction: 'older', limit: 5 });
    context.this_edit_mes_id = 0;
    context.draft = 'Unsaved older-page edit';
    const snapshot = context.activeChatStore.snapshot();
    await assert.rejects(context.ensureLatestChatWindow(), /Finish or cancel your message edit/);
    assert.deepEqual(context.activeChatStore.snapshot(), snapshot);
    assert.equal(context.draft, 'Unsaved older-page edit');
    assert.equal(context.removed, 0);
});

test('generation rejects an active editor before changing context and unblocks its UI', async t => {
    const { context } = await fixture(t);
    context.this_edit_mes_id = 0;
    context.draft = 'Unsaved before generation';
    const snapshot = context.activeChatStore.snapshot();
    await assert.rejects(context.Generate('normal'), /Finish or cancel your message edit/);
    assert.deepEqual(context.activeChatStore.snapshot(), snapshot);
    assert.equal(context.draft, 'Unsaved before generation');
    assert.equal(context.removed, 0);
    assert.equal(context.unblockCalls, 1);
    assert.equal(context.chatWindowChangeDepth, 0);
});

test('a pending page change blocks new editors and rechecks plugin-created drafts before adoption', async t => {
    const { context, holdNextPage } = await fixture(t);
    const snapshot = context.activeChatStore.snapshot();
    const pending = holdNextPage();
    const navigation = context.loadChatWindowAround(3);
    const rejected = assert.rejects(navigation, /Finish or cancel your message edit/);
    await pending.entered;
    assert.equal(context.isChatWindowChanging(), true);
    await context.messageEdit(0);
    assert.equal(context.this_edit_mes_id, undefined);
    assert.equal(context.notices.length, 1);
    context.reasoningDraft = 'A plugin opened this draft while the request was pending';
    pending.release();
    await rejected;
    assert.deepEqual(context.activeChatStore.snapshot(), snapshot);
    assert.equal(context.reasoningDraft, 'A plugin opened this draft while the request was pending');
    assert.equal(context.removed, 0);
    assert.equal(context.isChatWindowChanging(), false);
});
