import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const { values } = parseArgs({ options: {
    url: { type: 'string', default: 'http://127.0.0.1:18767' },
    'data-root': { type: 'string' }, executable: { type: 'string' }, output: { type: 'string' },
} });
if (!values['data-root'] || !values.output) throw new Error('--data-root (isolated test data) and --output are required');
const user = path.join(values['data-root'], 'default-user');
const name = `on-demand-functional-${Date.now()}`;
const single = path.join(user, 'chats', 'default_Seraphina', `${name}.jsonl`);
const group = path.join(user, 'group chats', `${name}.jsonl`);
const source = path.join(user, 'chats', 'default_Seraphina', 'bench-heavy-100rounds.jsonl');
await fs.copyFile(source, single);
await fs.mkdir(path.dirname(group), { recursive: true });
await fs.copyFile(source, group);
const original = (await fs.readFile(source, 'utf8')).trim().split('\n').map(JSON.parse);
assert.equal(original.length, 201);
const result = { fixture: name, messages: 200, checks: [], pageErrors: [], requests: [] };
const browser = await chromium.launch({ headless: true, executablePath: values.executable });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => result.pageErrors.push(error.message));
    page.on('request', request => {
        if (/\/api\/chats\//.test(request.url())) result.requests.push(new URL(request.url()).pathname);
    });
    await page.goto(values.url, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 60000 });
    await page.evaluate(async () => {
        const st = await import('/script.js');
        await new Promise(resolve => st.eventSource.on(st.event_types.APP_READY, resolve));
        for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    });
    const checks = await page.evaluate(async name => {
        const st = await import('/script.js');
        const { activeChatStore: store } = await import('/scripts/chat-store.js');
        const { power_user } = await import('/scripts/power-user.js');
        const prompts = await import('/scripts/itemized-prompts.js');
        window.chatTestState = () => ({ scope: store.scope, total: store.total, start: store.start, length: st.chat.length });
        const checks = [];
        const check = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
        await st.clearChat({ clearData: true });
        const id = st.characters.findIndex(x => x.avatar === 'default_Seraphina.png');
        st.setCharacterId(id);
        st.characters[id].chat = name;
        power_user.chat_full_history = false;
        power_user.chat_truncation = 100;
        await st.getChat();
        check(store.start === 100 && store.total === 200 && st.chat.length === 100, 'Single chat opens only the latest 100 bodies');
        check(document.querySelector('#chat .mes .mesIDDisplay').textContent === '#100', 'Visible message numbers remain global');

        power_user.auto_save_msg_edits = false;
        await st.messageEdit(0);
        const draft = document.querySelector('#chat .edit_textarea');
        draft.value = 'unsaved-editor-draft';
        let refused = false;
        try { await st.loadChatWindowAround(0); } catch { refused = true; }
        check(refused && store.start === 100 && draft.isConnected && draft.value === 'unsaved-editor-draft', 'Jumping to another page preserves an unsubmitted editor draft');
        st.closeMessageEditor();

        prompts.itemizedPrompts.push({ mesId: 0, rawPrompt: 'first' }, { mesId: 100, rawPrompt: 'visible' });
        await prompts.replaceItemizedPromptText(0, 'edited prompt');
        check(prompts.itemizedPrompts.find(x => x.mesId === 0).rawPrompt === 'first' &&
            prompts.itemizedPrompts.find(x => x.mesId === 100).rawPrompt === 'edited prompt', 'Prompt edits use the global message ID');

        st.chat[0].mes = 'edited-global-100';
        st.chat[1].swipes = [st.chat[1].mes, 'selected-swipe-101'];
        st.chat[1].swipe_id = 1;
        st.chat[1].mes = 'selected-swipe-101';
        await st.saveChatConditional({ throwOnError: true });
        check(store.total === 200, 'Saving a tail edit and swipe preserves total history');
        await st.showMoreMessages();
        check(store.start === 0 && store.after && st.chat.length === 100, 'Show more loads the preceding bounded page');
        await st.deleteMessage(2, undefined, false, false);
        st.cancelDebouncedChatSave();
        await st.saveChatConditional({ throwOnError: true });
        check(store.total === 199 && store.after, 'Deleting an older message preserves the unloaded continuation');
        await st.ensureLatestChatWindow();
        check(store.start === 99 && st.chat[0].mes === 'edited-global-100', 'Returning to the latest page preserves the edited stable message');
        await st.sendMessageAsUser('appended-from-browser');
        await st.saveChatConditional({ throwOnError: true });
        check(store.total === 200 && st.chat.at(-1).mes === 'appended-from-browser', 'Appending uses the actual chat tail');

        const local = await st.loadChatWindowAround(49);
        await st.saveChat({ chatName: `${name}-branch`, mesId: local });
        check(local === 49 && store.total === 200, 'Branching uses a stable cutoff without changing the source');
        await st.ensureLatestChatWindow();
        const start = store.start;
        let reference;
        for await (const envelope of store.messagesAfter(-1)) {
            reference = envelope;
            if (envelope.seq === 3) break;
        }
        await store.saveSummary(st.chat, { chat_metadata: st.chat_metadata, user_name: 'unused', character_name: 'unused' }, reference, 'summary-through-three');
        check(store.start === start && store.latestSummary.seq === 3, 'A summary saves to an unloaded stable ID without moving the UI');
        st.chat.at(-1).mes = 'appended-after-summary';
        await st.saveChatConditional({ throwOnError: true });
        check(store.latestSummary.memory === 'summary-through-three', 'A subsequent tail save preserves the earlier summary');
        return checks;
    }, name);
    result.checks.push(...checks);

    // Exercise the actual preference change handler, including its save/reload.
    await page.evaluate(() => {
        const input = document.querySelector('#chat_full_history');
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => {
        const state = window.chatTestState();
        return !document.querySelector('#chat_full_history').disabled && !state.scope && state.length === 200;
    });
    result.checks.push('Explicit compatibility checkbox loads the complete chat');
    await page.evaluate(async () => {
        const st = await import('/script.js');
        st.chat[0].mes = 'compatibility-first-message';
        await st.saveChatConditional({ throwOnError: true });
        const input = document.querySelector('#chat_full_history');
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => {
        const state = window.chatTestState();
        return !document.querySelector('#chat_full_history').disabled && state.scope && state.total === 200 && state.start === 100;
    });
    result.checks.push('Compatibility saves persist and disabling it restores bounded paging');

    result.checks.push(...await page.evaluate(async name => {
        const st = await import('/script.js');
        const groups = await import('/scripts/group-chats.js');
        const { activeChatStore: store } = await import('/scripts/chat-store.js');
        groups.groups.push({ id: name, name: 'Synthetic functional group', members: ['default_Seraphina.png'], disabled_members: [],
            chat_id: name, chats: [name], chat_metadata: {}, past_metadata: {}, activation_strategy: 0, generation_mode: 0 });
        await groups.openGroupById(name);
        if (!store.scope?.is_group || store.start !== 100 || store.total !== 200) throw new Error('Group did not use paging');
        st.chat[0].mes = 'group-edited-global-100';
        await st.saveChatConditional({ throwOnError: true });
        await st.showMoreMessages();
        if (store.start !== 0 || !store.after) throw new Error('Group paging failed');
        await st.ensureLatestChatWindow();
        if (st.chat[0].mes !== 'group-edited-global-100') throw new Error('Group edit was lost');
        return ['Group open, edit, older page and latest page preserve all 200 messages'];
    }, name));
    await page.screenshot({ path: values.output.replace(/\.json$/, '.png') });
    const read = async file => (await fs.readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
    const saved = await read(single);
    assert.equal(saved.length, 201);
    assert.equal(saved[0].chat_metadata.__chatStoreWindow, undefined);
    assert.equal(saved[1].mes, 'compatibility-first-message');
    assert.equal(saved[3].mes, original[4].mes);
    assert.equal(saved[4].extra.memory, 'summary-through-three');
    assert.equal(saved[100].mes, 'edited-global-100');
    assert.equal(saved[101].mes, 'selected-swipe-101');
    assert.equal(saved[101].swipe_id, 1);
    assert.equal(saved[200].mes, 'appended-after-summary');
    const fork = await read(path.join(path.dirname(single), `${name}-branch.jsonl`));
    assert.equal(fork.length, 51);
    assert.equal(fork[50].mes, original[51].mes);
    const savedGroup = await read(group);
    assert.equal(savedGroup.length, 201);
    assert.equal(savedGroup[1].mes, original[1].mes);
    assert.equal(savedGroup[101].mes, 'group-edited-global-100');
    assert.equal(savedGroup[200].mes, original[200].mes);
    result.checks.push('JSONL files independently confirm unloaded prefix/suffix, branch cutoff, swipe, summary and group integrity');
    assert.deepEqual(result.pageErrors, []);
    result.success = true;
} catch (error) {
    result.error = String(error.stack || error);
    throw error;
} finally {
    await browser.close();
    await fs.mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
    await fs.writeFile(values.output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
}
