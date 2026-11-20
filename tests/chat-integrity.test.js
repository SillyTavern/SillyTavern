import { beforeAll, beforeEach, afterEach, describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// chats.js reads these config values at module load. Environment variables take
// precedence over config.yaml, so setting them here lets the module import
// without a config file present. The throttle interval is zeroed so lodash
// throttle timers don't keep the Jest process alive.
process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';

/** @type {import('../src/endpoints/chats.js')} */
let chats;

beforeAll(async () => {
    chats = await import('../src/endpoints/chats.js');
});

const BOM = String.fromCharCode(0xFEFF);
const SLUG = '1e6905db-bab6-4901-913b-06d18cab5a8f';
const OTHER_SLUG = 'f1c1d103-464a-418a-a643-f9dab81589b9';

/**
 * Builds a chat array like the client sends it.
 * @param {string|null} slug Integrity slug for the header, or null for none
 * @returns {object[]} Chat array
 */
function makeChat(slug) {
    const metadata = slug ? { integrity: slug } : {};
    return [
        { user_name: 'User', character_name: 'Char', chat_metadata: metadata },
        { name: 'Char', is_user: false, mes: 'Hello' },
    ];
}

/**
 * Serializes a chat array the same way trySaveChat does.
 * @param {object[]} chatData Chat array
 * @returns {string} JSONL string
 */
function toJsonl(chatData) {
    return chatData.map(m => JSON.stringify(m)).join('\n');
}

describe('trySaveChat integrity check', () => {
    let tmpDir;
    let chatFile;
    let backupDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chat-integrity-'));
        chatFile = path.join(tmpDir, 'chat.jsonl');
        backupDir = path.join(tmpDir, 'backups');
        fs.mkdirSync(backupDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function save(chatData, { force = false } = {}) {
        return chats.trySaveChat(chatData, chatFile, force, 'default-user', 'Char', backupDir);
    }

    test('writes a new file when none exists', async () => {
        const chatData = makeChat(SLUG);
        await save(chatData);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(toJsonl(chatData));
    });

    test('overwrites when the integrity slug matches', async () => {
        fs.writeFileSync(chatFile, toJsonl(makeChat(SLUG)));
        const newChat = makeChat(SLUG);
        newChat[1].mes = 'Updated';
        await save(newChat);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(toJsonl(newChat));
    });

    test('refuses to overwrite when the integrity slug mismatches and keeps the original bytes', async () => {
        const originalBytes = toJsonl(makeChat(SLUG));
        fs.writeFileSync(chatFile, originalBytes);
        await expect(save(makeChat(OTHER_SLUG))).rejects.toThrow(/integrity check failed/i);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(originalBytes);
    });

    test('overwrites a legacy chat whose header has no integrity metadata', async () => {
        const legacyHeader = JSON.stringify({ user_name: 'User', character_name: 'Char', create_date: '2023-01-01' });
        fs.writeFileSync(chatFile, legacyHeader + '\n' + JSON.stringify({ name: 'Char', mes: 'Old' }));
        const newChat = makeChat(SLUG);
        await save(newChat);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(toJsonl(newChat));
    });

    test('overwrites an empty file', async () => {
        fs.writeFileSync(chatFile, '');
        const newChat = makeChat(SLUG);
        await save(newChat);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(toJsonl(newChat));
    });

    test('refuses to overwrite a non-empty file with an unparseable first line and keeps the original bytes', async () => {
        const originalBytes = 'this is not json{{{';
        fs.writeFileSync(chatFile, originalBytes);
        await expect(save(makeChat(SLUG))).rejects.toThrow(/integrity check failed/i);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(originalBytes);
    });

    test('refuses to overwrite a truncated header and keeps the original bytes', async () => {
        const originalBytes = toJsonl(makeChat(SLUG)).slice(0, 25);
        fs.writeFileSync(chatFile, originalBytes);
        await expect(save(makeChat(SLUG))).rejects.toThrow(/integrity check failed/i);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(originalBytes);
    });

    test('refuses to overwrite when the first line parses to a non-object', async () => {
        const originalBytes = '42\n' + JSON.stringify({ name: 'Char', mes: 'Orphan' });
        fs.writeFileSync(chatFile, originalBytes);
        await expect(save(makeChat(SLUG))).rejects.toThrow(/integrity check failed/i);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(originalBytes);
    });

    test('refuses to overwrite when the file starts with a blank line but has content below', async () => {
        const originalBytes = '\n' + toJsonl(makeChat(SLUG));
        fs.writeFileSync(chatFile, originalBytes);
        await expect(save(makeChat(SLUG))).rejects.toThrow(/integrity check failed/i);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(originalBytes);
    });

    test('ignores a UTF-8 BOM in front of a valid matching header', async () => {
        fs.writeFileSync(chatFile, BOM + toJsonl(makeChat(SLUG)));
        const newChat = makeChat(SLUG);
        newChat[1].mes = 'Updated';
        await save(newChat);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(toJsonl(newChat));
    });

    test('still checks the integrity slug behind a UTF-8 BOM', async () => {
        const originalBytes = BOM + toJsonl(makeChat(SLUG));
        fs.writeFileSync(chatFile, originalBytes);
        await expect(save(makeChat(OTHER_SLUG))).rejects.toThrow(/integrity check failed/i);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(originalBytes);
    });

    test('force overwrites a corrupted file when the user confirmed', async () => {
        fs.writeFileSync(chatFile, 'this is not json{{{');
        const newChat = makeChat(SLUG);
        await save(newChat, { force: true });
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(toJsonl(newChat));
    });

    test('force overwrites a mismatching file when the user confirmed', async () => {
        fs.writeFileSync(chatFile, toJsonl(makeChat(SLUG)));
        const newChat = makeChat(OTHER_SLUG);
        await save(newChat, { force: true });
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(toJsonl(newChat));
    });

    test('skips the check when the incoming chat has no integrity slug (existing behavior)', async () => {
        fs.writeFileSync(chatFile, toJsonl(makeChat(SLUG)));
        const newChat = makeChat(null);
        await save(newChat);
        expect(fs.readFileSync(chatFile, 'utf8')).toBe(toJsonl(newChat));
    });
});
