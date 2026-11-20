import { beforeAll, beforeEach, afterEach, describe, test, expect, jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// chats.js reads these config values at module load. Environment variables take
// precedence over config.yaml, so the module imports without a config file.
process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';

/** @type {import('../src/endpoints/chats.js')} */
let chats;

beforeAll(async () => {
    chats = await import('../src/endpoints/chats.js');
});

function makeChatJsonl() {
    return [
        JSON.stringify({ user_name: 'User', character_name: 'Char', chat_metadata: { note: 'meta' } }),
        JSON.stringify({ name: 'Char', is_user: false, mes: 'First message', send_date: '2026-01-01T00:00:00.000Z' }),
        JSON.stringify({ name: 'User', is_user: true, mes: 'Second message', send_date: '2026-01-02T00:00:00.000Z' }),
    ].join('\n');
}

describe('getChatInfo', () => {
    let tmpDir;
    let chatFile;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chat-info-'));
        chatFile = path.join(tmpDir, 'chat.jsonl');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('reads info from a normal chat file', async () => {
        fs.writeFileSync(chatFile, makeChatJsonl());
        const info = await chats.getChatInfo(chatFile, {}, true);
        expect(info.file_id).toBe('chat');
        expect(info.file_name).toBe('chat.jsonl');
        expect(info.chat_items).toBe(2);
        expect(info.mes).toBe('Second message');
        expect(info.last_mes).toBe('2026-01-02T00:00:00.000Z');
        expect(info.match).toBe(true);
        expect(info.chat_metadata).toEqual({ note: 'meta' });
    });

    test('returns defaults for an empty chat file', async () => {
        fs.writeFileSync(chatFile, '');
        const info = await chats.getChatInfo(chatFile);
        expect(info.file_name).toBe('chat.jsonl');
        expect(info.chat_items).toBe(0);
        expect(info.mes).toBe('[The chat is empty]');
        expect(info.match).toBe(false);
    });

    test('applies the matcher against message content', async () => {
        fs.writeFileSync(chatFile, makeChatJsonl());
        const matching = await chats.getChatInfo(chatFile, {}, false, lines => lines.some(l => l.includes('Second')));
        expect(matching.match).toBe(true);
        const nonMatching = await chats.getChatInfo(chatFile, {}, false, lines => lines.some(l => l.includes('nope')));
        expect(nonMatching.match).toBe(false);
    });

    test('resolves without match when the file was already deleted', async () => {
        const info = await chats.getChatInfo(path.join(tmpDir, 'gone.jsonl'));
        expect(info).toEqual({ match: false });
    });

    test('resolves without match when the file is deleted between stat and read', async () => {
        // Simulate the race: stat succeeds, but the file is gone when the stream opens
        jest.spyOn(fs.promises, 'stat').mockResolvedValue(/** @type {any} */({ size: 100, mtimeMs: 1_000_000 }));
        const info = await chats.getChatInfo(path.join(tmpDir, 'ghost.jsonl'));
        expect(info).toEqual({ match: false });
    });

    test('resolves instead of hanging when the file is truncated between stat and read', async () => {
        // Simulate the race: stat reports content, but the file is empty when read
        fs.writeFileSync(chatFile, '');
        jest.spyOn(fs.promises, 'stat').mockResolvedValue(/** @type {any} */({ size: 100, mtimeMs: 1_000_000 }));
        const info = await chats.getChatInfo(chatFile);
        expect(info.file_name).toBe('chat.jsonl');
        expect(info.chat_items).toBe(0);
        expect(info.mes).toBe('[The chat is empty]');
        expect(info.match).toBe(false);
    });

    test('rejects with the original error for non-ENOENT stat failures', async () => {
        const eacces = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
        jest.spyOn(fs.promises, 'stat').mockRejectedValue(eacces);
        await expect(chats.getChatInfo(chatFile)).rejects.toThrow('EACCES');
    });

    test('resolves a degraded preview for a fully corrupted chat file', async () => {
        fs.writeFileSync(chatFile, 'not json at all\nstill not json');
        const info = await chats.getChatInfo(chatFile);
        expect(info.file_id).toBe('chat');
        expect(info.file_name).toBe('chat.jsonl');
        expect(info.chat_items).toBe(0);
        expect(info.mes).toBe('[The message is empty]');
        expect(info.match).toBe(true);
    });

    test('resolves a degraded preview when only the last line is unparseable', async () => {
        // e.g. a partially flushed write or an external edit truncated the final line
        fs.writeFileSync(chatFile, makeChatJsonl() + '\n' + '{"name": "User", "is_user": true, "mes": "Trunc');
        const info = await chats.getChatInfo(chatFile);
        expect(info.file_id).toBe('chat');
        expect(info.file_name).toBe('chat.jsonl');
        expect(info.chat_items).toBe(2);
        expect(info.mes).toBe('[The message is empty]');
        expect(info.match).toBe(true);
    });

    test('matcher still applies to intact messages when the last line is unparseable', async () => {
        fs.writeFileSync(chatFile, makeChatJsonl() + '\n' + '{"broken');
        const matching = await chats.getChatInfo(chatFile, {}, false, lines => lines.some(l => l.includes('Second')));
        expect(matching.match).toBe(true);
        expect(matching.file_name).toBe('chat.jsonl');
        const nonMatching = await chats.getChatInfo(chatFile, {}, false, lines => lines.some(l => l.includes('nope')));
        expect(nonMatching.match).toBe(false);
        expect(nonMatching.file_name).toBe('chat.jsonl');
    });
});
