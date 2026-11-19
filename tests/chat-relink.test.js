import { beforeAll, beforeEach, afterEach, describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// chats.js reads these config values at module load; environment variables let it import without a config file.
process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';

/** @type {import('../src/endpoints/chats.js')} */
let chats;

beforeAll(async () => {
    chats = await import('../src/endpoints/chats.js');
});

describe('relinkRenamedChat', () => {
    let dir;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chat-relink-'));
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    const write = (name, lines) => fs.writeFileSync(path.join(dir, `${name}.jsonl`), lines.join('\n'));
    const read = (name) => fs.readFileSync(path.join(dir, `${name}.jsonl`), 'utf8');

    test('updates main_chat, bookmark_link and branches, leaving the rest untouched', () => {
        const header = { chat_metadata: { main_chat: 'old', integrity: 'abc' } };
        write('branch', [JSON.stringify(header), JSON.stringify({ mes: 'hi' })]);
        write('parent', [
            JSON.stringify({ chat_metadata: { integrity: 'def' } }),
            JSON.stringify({ mes: 'a', extra: { bookmark_link: 'old', branches: ['x', 'old'] } }),
            'not json old',
        ]);
        write('other', [JSON.stringify({ chat_metadata: {} }), JSON.stringify({ mes: 'old' })]);
        const otherBefore = read('other');

        expect(chats.relinkRenamedChat(dir, 'old', 'new')).toBe(2);

        const [h, m] = read('branch').split('\n').map(x => JSON.parse(x));
        expect(h.chat_metadata).toEqual({ main_chat: 'new', integrity: 'abc' });
        expect(m).toEqual({ mes: 'hi' });
        const parent = read('parent').split('\n');
        expect(JSON.parse(parent[1]).extra).toEqual({ bookmark_link: 'new', branches: ['x', 'new'] });
        expect(parent[2]).toBe('not json old');
        expect(read('other')).toBe(otherBefore);
    });
});
