import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ChatStore, findChatSummary, toGlobalMessageId, createContextTokenCounter } from '../public/scripts/chat-store.js';

const header = { chat_metadata: { integrity: 'test' }, user_name: 'unused', character_name: 'unused' };
const scope = { avatar_url: 'test.png', file_name: 'large' };

function fixture(count = 1000) {
    let version = 1;
    let serial = count;
    let rows = Array.from({ length: count }, (_, index) => ({
        id: `m${index}`, revision: 1, message: { mes: `message ${index}`, is_user: index % 2 === 0, extra: {} },
    }));
    const calls = [];
    let hold;
    function page(start, end) {
        const messages = rows.slice(start, end).map((row, index) => ({ ...structuredClone(row), seq: start + index }));
        return { header: structuredClone(header), revision: `r${version}`, total: rows.length, start, messages,
            window: { start, ids: messages.map(x => x.id) }, before: start ? String(start) : null,
            after: end < rows.length ? `next:${end}` : null,
            latestSummary: (() => { const index = rows.findLastIndex((row, index) => index < rows.length - 1 && row.message.extra?.memory); return index < 0 ? null : { id: rows[index].id, seq: index, memory: rows[index].message.extra.memory }; })() };
    }
    const fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        calls.push({ url, body });
        let result;
        if (url.endsWith('/page')) {
            let end = body.before ?? rows.length;
            if (body.cursor?.startsWith('next:')) {
                const start = Number(body.cursor.slice(5));
                result = page(start, Math.min(start + body.limit, rows.length));
            } else {
                if (body.cursor) end = Number(body.cursor);
                result = page(Math.max(0, end - body.limit), end);
            }
        } else if (url.endsWith('/window')) {
            if (body.expectedRevision !== `r${version}`) return { ok: false, status: 409, json: async () => ({ message: 'conflict' }) };
            const base = rows.slice(body.window.start, body.window.start + body.window.ids.length);
            assert.deepEqual(base.map(x => x.id), body.window.ids);
            const existing = new Map(base.map(x => [x.id, x]));
            const replacements = body.messages.map(envelope => {
                if (envelope.id) assert.equal(existing.get(envelope.id)?.revision, envelope.revision);
                return { id: envelope.id || `m${serial++}`, revision: (envelope.revision || 0) + 1, message: envelope.message };
            });
            rows.splice(body.window.start, base.length, ...replacements);
            version++;
            result = page(body.window.start, body.window.start + replacements.length);
        } else if (url.endsWith('/messages')) {
            result = { revision: `r${version}`, messages: body.ids.map(id => {
                const index = rows.findIndex(row => row.id === id);
                return index < 0 ? null : { ...structuredClone(rows[index]), seq: index };
            }).filter(Boolean) };
        } else if (url.endsWith('/fork')) {
            assert.equal(body.expectedRevision, `r${version}`);
            result = { ok: true, throughId: body.throughId };
        } else throw new Error(`Unexpected request: ${url}`);
        if (hold) { const waiting = hold; hold = null; await waiting; }
        return { ok: true, json: async () => structuredClone(result) };
    };
    return { store: new ChatStore({ fetch }), calls, rows: () => rows, hold: promise => { hold = promise; } };
}

test('tail paging, edits/swipes/deletes/appends preserve every unloaded body', async () => {
    const { store, calls, rows } = fixture();
    const messages = [];
    await store.open(scope, messages, 100);
    assert.equal(messages.length, 100);
    assert.equal(store.start, 900);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/page$/);
    const prefix = structuredClone(rows().slice(0, 900));
    messages[3].mes = 'edited';
    messages[4].swipes = ['old', 'new'];
    messages[4].swipe_id = 1;
    messages.splice(8, 1);
    messages.push({ mes: 'new user', is_user: true });
    await store.save(messages, header);
    assert.deepEqual(rows().slice(0, 900), prefix);
    assert.equal(rows()[903].message.mes, 'edited');
    assert.equal(rows()[904].message.swipe_id, 1);
    assert.equal(rows().at(-1).message.mes, 'new user');
    assert.equal(calls.at(-1).body.messages.length, 100);
    assert.equal(store.messageRef(messages.at(-1)).id, rows().at(-1).id);
    await store.navigate(messages, header, { direction: 'older', limit: 100 });
    assert.equal(messages.length, 100);
    assert.equal(store.start, 800);
    assert.equal(store.total, 1000);
    messages[0].mes = 'old-page edit';
    await store.save(messages, header);
    assert.equal(rows()[800].message.mes, 'old-page edit');
    assert.equal(rows().at(-1).message.mes, 'new user');
    assert.ok(calls.every(x => !x.url.endsWith('/get') && !x.url.endsWith('/save')));
});

test('mutation during a pending save is persisted by the next save without body rollback', async () => {
    const fixtureData = fixture(20);
    const { store, rows } = fixtureData;
    const messages = [];
    await store.open(scope, messages, 10);
    let release;
    fixtureData.hold(new Promise(resolve => { release = resolve; }));
    messages[0].mes = 'first edit';
    const saving = store.save(messages, header);
    await new Promise(resolve => setImmediate(resolve));
    messages[0].mes = 'second edit';
    messages.push({ mes: 'append during save', is_user: true });
    release();
    await saving;
    assert.equal(messages[0].mes, 'second edit');
    await store.save(messages, header);
    assert.equal(rows()[10].message.mes, 'second edit');
    assert.equal(rows().at(-1).message.mes, 'append during save');
});

test('out-of-order chat responses are discarded even when fetch ignores abort', async () => {
    const fixtureData = fixture(30);
    const { store } = fixtureData;
    let release;
    fixtureData.hold(new Promise(resolve => { release = resolve; }));
    const first = [];
    const opening = store.open(scope, first, 10);
    const rejected = assert.rejects(opening, { name: 'AbortError' });
    const next = [];
    await store.open({ ...scope, file_name: 'other' }, next, 5);
    release();
    await rejected;
    assert.equal(first.length, 0);
    assert.equal(next.length, 5);
    assert.equal(store.scope.file_name, 'other');
});

test('stale writes fail instead of retrying through the legacy full-save API', async () => {
    const { store, calls } = fixture(20);
    const messages = [];
    await store.open(scope, messages, 10);
    messages[0].mes = 'edit';
    store.revision = 'stale';
    await assert.rejects(store.save(messages, header), /conflict/);
    assert.deepEqual(calls.map(x => x.url), ['/api/chats/page', '/api/chats/window']);
});

test('generation fetches only the recent token budget, returns from old pages, and evicts saved excess', async () => {
    const { store, calls, rows } = fixture(1000);
    const messages = [];
    await store.open(scope, messages, 10);
    await store.navigate(messages, header, { direction: 'older', limit: 10 });
    messages[0].mes = 'old page edited';
    await store.ensureContext(messages, header, 25, async () => 1, 10);
    assert.equal(rows()[980].message.mes, 'old page edited');
    assert.equal(store.start, 970);
    assert.equal(messages.length, 30);
    assert.equal(messages.at(-1).mes, 'message 999');
    assert.ok(calls.filter(x => x.url.endsWith('/page')).length <= 7);
    await store.ensureContext(messages, header, 5, async () => 1, 10);
    assert.equal(messages.length, 10);
    assert.equal(store.start, 990);
    messages.at(-1).mes = 'tail edit after eviction';
    await store.save(messages, header);
    assert.equal(rows().length, 1000);
    assert.equal(rows()[970].message.mes, 'message 970');
});

test('branching sends a stable throughId and selected swipe override without downloading prefix', async () => {
    const { store, calls } = fixture(1000);
    const messages = [];
    await store.open(scope, messages, 10);
    await store.fork(messages, header, { ...scope, file_name: 'branch' }, header, 3, { ...messages[3], mes: 'selected swipe' });
    const call = calls.at(-1);
    assert.match(call.url, /\/fork$/);
    assert.equal(call.body.throughId, 'm993');
    assert.equal(call.body.lastMessage.mes, 'selected swipe');
    assert.equal(calls.length, 2);
});


test('summaries exclude the final message and preserve the local start after an unloaded summary', () => {
    const messages = [{ mes: 'a', extra: {} }, { mes: 'b', extra: { memory: 'last must be skipped' } }];
    const state = { start: 500, latestSummary: { seq: 400, memory: 'prior summary' } };
    assert.deepEqual(findChatSummary(messages, state), { memory: 'prior summary', index: -1 });
    messages[0].extra.memory = 'loaded summary';
    assert.deepEqual(findChatSummary(messages, state), { memory: 'loaded summary', index: 0 });
    messages[0].extra = {};
    state.latestSummary.seq = 501;
    assert.deepEqual(findChatSummary(messages, state), { memory: '', index: -1 });
});

test('group windows use the same safe edit, insertion, deletion and stable-reference contract', async () => {
    const { store, calls, rows } = fixture(40);
    const messages = [];
    await store.open({ is_group: true, id: 'group-chat' }, messages, 10);
    const prefix = structuredClone(rows().slice(0, 30));
    messages[0].mes = 'group edit';
    messages.splice(2, 1);
    messages.push({ mes: 'group reply', name: 'member' });
    await store.save(messages, header);
    assert.deepEqual(rows().slice(0, 30), prefix);
    assert.equal(rows().at(-1).message.mes, 'group reply');
    assert.equal(calls.at(-1).body.is_group, true);
    assert.equal(calls.at(-1).body.id, 'group-chat');
});

test('explicit ranges read global sequences without replacing the active bounded window', async () => {
    const { store, calls } = fixture(1200);
    const messages = [];
    await store.open(scope, messages, 100);
    const snapshot = store.snapshot();
    const result = await store.readRange(12, 25);
    assert.equal(result.length, 14);
    assert.equal(result[0].seq, 12);
    assert.equal(result.at(-1).message.mes, 'message 25');
    assert.deepEqual(store.snapshot(), snapshot);
    assert.equal(messages.length, 100);
    assert.equal(calls.at(-1).body.limit, 14);
});

test('only successful explicit deletes notify vector cleanup; navigating never infers deletes', async () => {
    const { store } = fixture(40);
    const messages = [];
    const changes = [];
    const stop = store.subscribeChanges(change => changes.push(change));
    await store.open(scope, messages, 10);
    await store.navigate(messages, header, { direction: 'older', limit: 10 });
    assert.equal(changes.length, 0);
    const deleted = store.messageRef(messages[3]).id;
    messages.splice(3, 1);
    await store.save(messages, header);
    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0].deletedIds, [deleted]);
    assert.deepEqual(changes[0].scope, scope);
    stop();
});

test('a queued old save cannot serialize the newly opened chat array', async () => {
    const fixtureData = fixture(40);
    const { store, calls } = fixtureData;
    const messages = [];
    await store.open(scope, messages, 10);
    let release;
    fixtureData.hold(new Promise(resolve => { release = resolve; }));
    messages[0].mes = 'pending old edit';
    const saving = store.save(messages, header);
    const rejected = assert.rejects(saving, { name: 'AbortError' });
    await new Promise(resolve => setImmediate(resolve));
    const queued = store.save(messages, header);
    const queuedRejected = assert.rejects(queued, { name: 'AbortError' });
    await store.open({ is_group: true, id: 'new-scope' }, messages, 5);
    release();
    await Promise.all([rejected, queuedRejected]);
    assert.equal(calls.filter(call => call.url.endsWith('/window')).length, 1);
    assert.deepEqual(store.scope, { is_group: true, id: 'new-scope' });
});

test('a navigation response never overwrites an edit made during its request', async () => {
    const fixtureData = fixture(40);
    const { store } = fixtureData;
    const messages = [];
    await store.open(scope, messages, 10);
    let release;
    fixtureData.hold(new Promise(resolve => { release = resolve; }));
    const navigation = store.navigate(messages, header, { direction: 'older', limit: 10 });
    const rejected = assert.rejects(navigation, /edited while loading/);
    await new Promise(resolve => setImmediate(resolve));
    messages[0].mes = 'keep this edit';
    release();
    await rejected;
    assert.equal(messages[0].mes, 'keep this edit');
    assert.equal(store.start, 30);
    await store.save(messages, header);
});

test('context keeps a tool-result group immediately before its assistant boundary', async () => {
    const { store, rows } = fixture(20);
    rows()[9].message = { mes: 'tool result', is_system: true, extra: { tool_invocations: [{ id: 'tool', result: 'done' }] } };
    rows()[10].message.is_user = false;
    const messages = [];
    await store.open(scope, messages, 10);
    await store.ensureContext(messages, header, 1, async () => 10, 10);
    assert.equal(store.start, 9);
    assert.equal(messages[0].mes, 'tool result');
    assert.equal(store.messageRef(messages[0]).id, 'm9');
    messages.at(-1).mes = 'updated assistant';
    await store.save(messages, header);
    assert.equal(rows().length, 20);
    assert.equal(rows()[9].message.mes, 'tool result');
});


test('summary reads begin just after an old summary rather than silently skipping to the tail window', async () => {
    const { store, rows, calls } = fixture(1000);
    rows()[12].message.extra.memory = 'already summarized through twelve';
    const messages = [];
    await store.open(scope, messages, 10);
    assert.equal(store.start, 990);
    assert.equal(store.latestSummary.seq, 12);
    const snapshot = store.snapshot();
    const seen = [];
    for await (const envelope of store.messagesAfter(store.latestSummary.seq)) {
        seen.push(envelope);
        if (seen.length === 8) break;
    }
    assert.deepEqual(seen.map(envelope => envelope.seq), [13, 14, 15, 16, 17, 18, 19, 20]);
    assert.deepEqual(store.snapshot(), snapshot);
    assert.equal(messages.length, 10);
    assert.ok(calls.filter(call => call.url.endsWith('/page')).length <= 3);
    const changes = [];
    store.subscribeChanges(change => changes.push(change));
    await store.saveSummary(messages, header, seen.at(-1), 'now summarized through twenty');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(changes.at(-1), { scope, revision: store.revision, changedIds: ['m20'], deletedIds: [] });
    assert.equal(rows()[20].message.extra.memory, 'now summarized through twenty');
    assert.equal(rows()[12].message.extra.memory, 'already summarized through twelve');
    assert.equal(store.start, 990);
    assert.equal(store.latestSummary.seq, 20);
    messages.at(-1).mes = 'tail edited after external summary write';
    await store.save(messages, header);
    assert.equal(rows().at(-1).message.mes, 'tail edited after external summary write');
});

test('incremental summary never includes the final message', async () => {
    const { store } = fixture(5);
    const messages = [];
    await store.open(scope, messages, 2);
    const seen = [];
    for await (const envelope of store.messagesAfter(-1)) seen.push(envelope.seq);
    assert.deepEqual(seen, [0, 1, 2, 3]);
});

test('prompt-cache global indices retain their meaning across tail and older windows', () => {
    assert.equal(toGlobalMessageId(0, { start: 17900 }), 17900);
    assert.equal(toGlobalMessageId(99, { start: 17900 }), 17999);
    assert.equal(toGlobalMessageId(0, { start: 17800 }), 17800);
    assert.equal(toGlobalMessageId(99, null), 99);
});


// Isolate the real formatter class from its browser/UI imports; these tests run
// the same addToMessage policy used by prompt construction, not a copied policy.
const reasoningSource = readFileSync(new URL('../public/scripts/reasoning.js', import.meta.url), 'utf8');
const reasoningClass = reasoningSource.slice(reasoningSource.indexOf('export class PromptReasoning'), reasoningSource.indexOf('\nfunction loadReasoningSettings()')).replace('export class', 'class');
function reasoningCounter(settings = {}, options = {}) {
    const config = { add_to_prompts: false, max_additions: 1, prefix: '<think>', suffix: '</think>', separator: '\n', ...settings };
    const Formatter = runInNewContext(`${reasoningClass}; PromptReasoning`, { power_user: { reasoning: config }, substituteParams: text => text });
    const seen = [];
    const counter = createContextTokenCounter({
        reasoning: new Formatter(),
        countTokens: async text => { seen.push(text); return text.length; },
        formatMessage: async message => message.mes || '',
        formatReasoning: message => message.extra?.reasoning || '',
        canUseTools: true,
        ...options,
    });
    return { counter, seen };
}

test('disabled reasoning does not consume history budget or prematurely stop paging', async () => {
    const { store, rows } = fixture(100);
    for (const row of rows()) { row.message.mes = 'x'; row.message.extra.reasoning = 'r'.repeat(10000); }
    const messages = [];
    await store.open(scope, messages, 5);
    const { counter, seen } = reasoningCounter({ add_to_prompts: false });
    await store.ensureContext(messages, header, 100, counter, 5);
    assert.equal(messages.length, 15);
    assert.ok(seen.every(text => text === 'x'));
});

test('reasoning budget honors max additions in newest-first order across page boundaries', async () => {
    const { store, rows } = fixture(30);
    for (const [index, row] of rows().entries()) { row.message.mes = 'x'; row.message.extra.reasoning = `reason-${index}`; }
    const messages = [];
    await store.open(scope, messages, 3);
    const { counter, seen } = reasoningCounter({ add_to_prompts: true, max_additions: 2 });
    await store.ensureContext(messages, header, 160, counter, 3);
    assert.ok(seen[0].includes('reason-29'));
    assert.ok(seen[1].includes('reason-28'));
    assert.ok(seen.slice(2).every(text => text === 'x'));
    assert.ok(messages.length > 3);
});

test('continuation reasoning prefixes and group member filtering match prompt formatting', async () => {
    const continuing = reasoningCounter({ add_to_prompts: false }, { type: 'continue' });
    await continuing.counter({ mes: '', name: 'A', extra: { reasoning: 'incomplete' } });
    await continuing.counter({ mes: 'older', name: 'A', extra: { reasoning: 'hidden older' } });
    assert.deepEqual(continuing.seen, ['<think>incomplete', 'older']);
    const group = reasoningCounter({ add_to_prompts: true, max_additions: 1 }, { groupCharacter: 'A' });
    await group.counter({ mes: 'other', name: 'B', extra: { reasoning: 'excluded' } });
    await group.counter({ mes: 'own', name: 'A', extra: { reasoning: 'included' } });
    assert.equal(group.seen[0], 'other');
    assert.ok(group.seen[1].includes('included'));
});

test('an edit during context tokenization stays dirty and persists on the next save', async () => {
    const { store, rows } = fixture(20);
    const messages = [];
    await store.open(scope, messages, 5);
    let release;
    let entered;
    const gate = new Promise(resolve => { release = resolve; });
    const waiting = new Promise(resolve => { entered = resolve; });
    const preparing = store.ensureContext(messages, header, 2, async () => { entered(); await gate; return 1; }, 5);
    const rejected = assert.rejects(preparing, /edited while preparing context/);
    await waiting;
    messages.at(-1).mes = 'edit during token count';
    release();
    await rejected;
    await store.save(messages, header);
    assert.equal(rows().at(-1).message.mes, 'edit during token count');
});

function bookmarkCommands(store, messages) {
    const commands = new Map();
    const branches = [];
    const checkpoints = [];
    const opened = [];
    const warnings = [];
    const bindings = {
        activeChatStore: store, chat: messages,
        SlashCommandParser: { addCommandObject: command => commands.set(command.name, command) },
        SlashCommand: { fromProps: props => props },
        SlashCommandArgument: { fromProps: props => props },
        SlashCommandNamedArgument: { fromProps: props => props },
        ARGUMENT_TYPE: {},
        commonEnumProviders: { messages: () => () => [], boolean: () => () => [] },
        toastr: { warning: (...args) => warnings.push(args) },
        getLastMessageId: () => messages.length - 1,
        saveChatConditional: () => store.save(messages, header),
        loadChatWindowAround: async sequence => {
            await store.navigate(messages, header, { direction: 'older', before: sequence + 1, limit: 10 });
            return sequence - store.start;
        },
        selected_group: null,
        openCharacterChat: async name => { opened.push(name); },
        isTrueBoolean: value => value === 'true',
        branches, checkpoints,
    };
    // Keep the actual slash registration/callback code while replacing browser
    // imports and branch UI work. All index resolution and paging remain real.
    const source = readFileSync(new URL('../public/scripts/bookmarks.js', import.meta.url), 'utf8')
        .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\n/gm, '')
        .replace(/^export /gm, '');
    const register = new Function(...Object.keys(bindings), `${source}\n
        branchChat = async local => { branches.push(activeChatStore.messageRef(chat[local])); return 'branch'; };
        createNewBookmark = async local => { checkpoints.push(activeChatStore.messageRef(chat[local])); return 'checkpoint'; };
        return registerBookmarksSlashCommands;`)(...Object.values(bindings));
    register();
    return { commands, branches, checkpoints, opened, warnings };
}

test('branch/checkpoint slash inputs address global IDs while public UI functions retain local IDs', async () => {
    const { store, rows } = fixture(1000);
    rows()[3].message.extra.bookmark_link = 'early checkpoint';
    const messages = [];
    await store.open(scope, messages, 10);
    const { commands, branches, checkpoints, opened, warnings } = bookmarkCommands(store, messages);
    assert.equal(await commands.get('branch-create').callback({}, '3'), 'branch');
    assert.equal(branches[0].id, 'm3');
    assert.equal(await commands.get('checkpoint-create').callback({ mesId: '903' }, 'named'), 'checkpoint');
    assert.equal(checkpoints[0].id, 'm903');
    assert.equal(await commands.get('checkpoint-get').callback({}, '3'), 'early checkpoint');
    assert.equal(await commands.get('checkpoint-go').callback({}, '3'), 'early checkpoint');
    assert.deepEqual(opened, ['early checkpoint']);
    assert.equal(await commands.get('branch-create').callback({}, ''), 'branch');
    assert.equal(branches.at(-1).id, 'm999');
    assert.equal(warnings.length, 0);
});

test('checkpoint-list explicitly streams every page and reports global IDs including the last message', async () => {
    const { store, rows, calls } = fixture(250);
    rows()[3].message.extra.bookmark_link = 'early';
    rows()[150].message.extra.bookmark_link = 'middle';
    rows()[249].message.extra.bookmark_link = 'last';
    const messages = [];
    await store.open(scope, messages, 10);
    const snapshot = store.snapshot();
    const { commands } = bookmarkCommands(store, messages);
    assert.deepEqual(JSON.parse(await commands.get('checkpoint-list').callback({}, '')), [3, 150, 249]);
    assert.deepEqual(JSON.parse(await commands.get('checkpoint-list').callback({ links: 'true' }, '')), ['early', 'middle', 'last']);
    assert.deepEqual(store.snapshot(), snapshot);
    assert.equal(messages.length, 10);
    assert.ok(calls.every(call => !call.url.endsWith('/get')));
});
