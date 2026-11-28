/* eslint-disable playwright/expect-expect, playwright/no-conditional-in-test -- Node unit harness with injected asynchronous collaborators. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { parse } from 'acorn';

import { ChatStore } from '../public/scripts/chat-store.js';

// Run the actual legacy UI functions with small injected collaborators. This
// exercises plugin-event awaits and shared chat state without a browser bundle.
const source = fs.readFileSync(new URL('../public/scripts/group-chats.js', import.meta.url), 'utf8');
const syntax = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });

function bindSourceFunction(name, context) {
    const declaration = syntax.body.map(node => node.declaration ?? node)
        .find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
    assert.ok(declaration, `The real ${name} function must exist`);
    return new Function('context', `with (context) { return (${source.slice(declaration.start, declaration.end)}); }`)(context);
}

for (const pauseAt of ['first_selected', 'message_received', 'message_rendered']) {
    test(`switching chats during group ${pauseAt} leaves the new chat untouched`, async () => {
        let release;
        let enter;
        const paused = new Promise(resolve => { enter = resolve; });
        const gate = new Promise(resolve => { release = resolve; });
        let held = false;
        let switched = false;
        const afterSwitch = [];
        const chat = [];
        const context = {};
        const activeChatStore = new ChatStore({ fetch: async (url, options) => {
            const scope = JSON.parse(options.body);
            const messages = scope.is_group ? [] : [{ id: 'other-message', revision: 1, seq: 0, message: { mes: 'Other chat message' } }];
            return { ok: true, json: async () => ({
                header: { chat_metadata: { integrity: 'synthetic-test' } },
                revision: scope.is_group ? 'group-revision' : 'other-revision',
                total: messages.length, start: 0, messages, before: null, after: null,
                window: { start: 0, ids: messages.map(message => message.id) },
            }) };
        } });
        const eventSource = { emit: async event => {
            if (switched) afterSwitch.push(event);
            if (event === pauseAt && !held) {
                held = true;
                enter();
                await gate;
            }
        } };
        Object.assign(context, {
            groups: [{ id: 'group', chat_id: 'group-chat', members: ['first.png', 'second.png'] }],
            selected_group: 'group', activeChatStore, chat, chat_metadata: {},
            characters: [
                { avatar: 'first.png', name: 'First', first_mes: 'First group greeting' },
                { avatar: 'second.png', name: 'Second', first_mes: 'Second group greeting' },
            ],
            power_user: { chat_full_history: false, chat_truncation: 100 },
            validateGroup: async () => {}, unshallowGroupMembers: async () => {},
            getRequestHeaders: () => ({}), uuidv4: () => 'synthetic-test',
            updateChatMetadata: () => { if (switched) afterSwitch.push('metadata'); },
            loadItemizedPrompts: async () => {},
            getCurrentChatId: () => context.selected_group ? 'group-chat' : 'other-chat',
            chatElement: { find: () => ({ remove() {} }) },
            eventSource, event_types: {
                CHARACTER_FIRST_MESSAGE_SELECTED: 'first_selected',
                MESSAGE_RECEIVED: 'message_received',
                CHARACTER_MESSAGE_RENDERED: 'message_rendered',
                CHAT_CHANGED: 'chat_changed', GROUP_CHAT_CREATED: 'group_created',
            },
            getMessageTimeStamp: () => '', substituteParams: text => text,
            getThumbnailUrl: () => '', default_avatar: '',
            addOneMessage: () => { if (switched) afterSwitch.push('render'); },
            ensureMessageMediaIsArray: () => {}, console,
        });
        context.getFirstCharacterMessage = bindSourceFunction('getFirstCharacterMessage', context);
        context.saveGroupChat = bindSourceFunction('saveGroupChat', context);
        const loading = bindSourceFunction('getGroupChat', context)('group');
        await paused;
        context.selected_group = null;
        await activeChatStore.open({ avatar_url: 'other.png', file_name: 'other' }, chat, 100);
        switched = true;
        release();
        await loading;
        assert.deepEqual(chat.map(message => message.mes), ['Other chat message']);
        assert.deepEqual(activeChatStore.scope, { avatar_url: 'other.png', file_name: 'other' });
        assert.deepEqual(afterSwitch, []);
    });
}
