import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';
const { createChatSearchMatcher, getChatInfo, router } = await import('../src/endpoints/chats.js');

function jsonl(messages) {
    return [
        JSON.stringify({ chat_metadata: { note: 'metadata is not searchable' } }),
        ...messages.map(mes => JSON.stringify({ name: 'Character', mes, send_date: '2026-01-01' })),
    ].join('\n');
}

async function directory(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-search-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    return root;
}

test('incremental search preserves cumulative AND, case folding and literal matching', () => {
    const queries = [['alpha', 'beta'], ['alpha', 'alpha'], ['魔女', 'beta'], ['a.b'], [], ['missing']];
    const messages = ['ALPHA and aXb', '', '魔女 meets Beta', 'literal a.b'];
    for (const fragments of queries) {
        const matcher = createChatSearchMatcher(fragments);
        const prefix = [];
        for (const text of messages) {
            prefix.push(text);
            const expected = fragments.every(fragment => prefix.some(value => value.toLowerCase().includes(fragment)));
            assert.equal(matcher.test(text), expected);
        }
    }
});

test('a missing word normalizes each new message once', () => {
    let visits = 0;
    const matcher = createChatSearchMatcher(['missing']);
    for (let i = 0; i < 10000; i++) {
        assert.equal(matcher.test({ toString() { visits++; return 'other words'; } }), false);
    }
    assert.equal(visits, 10000);
});

test('chat scanning reads each message once and keeps final preview and counts', async (t) => {
    const root = await directory(t);
    const file = path.join(root, 'chat.jsonl');
    await fs.writeFile(file, jsonl(['ALPHA', 'middle', 'BETA', 'final']));
    const matcher = createChatSearchMatcher(['alpha', 'beta']);
    const visited = [];
    const info = await getChatInfo(file, {}, true, {
        test(text) { visited.push(text); return matcher.test(text); },
    });
    assert.deepEqual(visited, ['ALPHA', 'middle', 'BETA']);
    assert.equal(info.match, true);
    assert.equal(info.chat_items, 4);
    assert.equal(info.mes, 'final');
    assert.equal(info.chat_metadata.note, 'metadata is not searchable');
    assert.equal((await getChatInfo(file, {}, false, createChatSearchMatcher(['metadata']))).match, false);
});

test('legacy cumulative matchers and damaged final lines retain their behavior', async (t) => {
    const root = await directory(t);
    const file = path.join(root, 'chat.jsonl');
    await fs.writeFile(file, jsonl(['alpha', 'beta']) + '\n{"broken');
    const prefixes = [];
    const info = await getChatInfo(file, {}, false, texts => {
        prefixes.push([...texts]);
        return texts.some(text => text === 'alpha') && texts.some(text => text === 'beta');
    });
    assert.deepEqual(prefixes, [['alpha'], ['alpha', 'beta']]);
    assert.equal(info.match, true);
    assert.equal(info.chat_items, 2);
    assert.equal((await getChatInfo(file, {}, false, createChatSearchMatcher(['alpha', 'beta']))).match, true);
    assert.equal((await getChatInfo(file, {}, false, createChatSearchMatcher(['missing']))).match, false);
});

test('search route isolates chat matches and retains independent filename matching', async (t) => {
    const root = await directory(t);
    const character = path.join(root, 'Character');
    await fs.mkdir(character);
    await fs.writeFile(path.join(character, 'only-alpha.jsonl'), jsonl(['ALPHA']));
    await fs.writeFile(path.join(character, 'only-beta.jsonl'), jsonl(['BETA']));
    await fs.writeFile(path.join(character, 'both.jsonl'), jsonl(['alpha', 'beta']));
    await fs.writeFile(path.join(character, 'alpha beta.jsonl'), '');
    // A filename fragment and a message fragment must not be combined.
    await fs.writeFile(path.join(character, 'alpha.jsonl'), jsonl(['beta']));
    const handler = router.stack.find(layer => layer.route?.path === '/search').route.stack.at(-1).handle;
    let result;
    await handler(
        { body: { query: 'ALPHA beta', avatar_url: 'Character.png' }, user: { directories: { chats: root } } },
        { send(value) { result = value; }, status(code) { throw new Error(`Unexpected status ${code}`); } },
    );
    assert.deepEqual(result.map(item => item.file_name).sort(), ['alpha beta', 'both']);
});

test('a disconnected search stops scanning after the current file', async (t) => {
    const root = await directory(t);
    const character = path.join(root, 'Character');
    await fs.mkdir(character);
    for (const name of ['first', 'second', 'third']) {
        await fs.writeFile(path.join(character, `${name}.jsonl`), jsonl(['alpha']));
    }
    const response = {
        destroyed: false,
        send() { assert.fail('A disconnected client must not receive a response'); },
        status(code) { throw new Error(`Unexpected status ${code}`); },
    };
    const stat = fs.stat;
    let inspectedFiles = 0;
    t.mock.method(fs, 'stat', async (...args) => {
        inspectedFiles++;
        const result = await stat(...args);
        response.destroyed = true;
        return result;
    });
    const handler = router.stack.find(layer => layer.route?.path === '/search').route.stack.at(-1).handle;
    await handler({ body: { query: 'alpha', avatar_url: 'Character.png' }, user: { directories: { chats: root } } }, response);
    assert.equal(inspectedFiles, 1);
});
