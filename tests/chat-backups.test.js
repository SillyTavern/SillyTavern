import { beforeAll, afterAll, describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// chats.js reads these config values at module load. Environment variables take
// precedence over config.yaml, so setting them here lets the module import
// without a config file present. The short throttle interval keeps lodash
// timers from delaying the Jest process while still being long enough that a
// per-user (rather than per-chat) throttle would defer the second chat's backup.
process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'true';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '200';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'false';
process.env.SILLYTAVERN_BACKUPS_COMMON_NUMBEROFBACKUPS = '1';

/** @type {import('../src/endpoints/chats.js')} */
let chats;
let workDir;

beforeAll(async () => {
    chats = await import('../src/endpoints/chats.js');
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-backups-'));
});

afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
});

/**
 * Builds a minimal chat array like the client sends it.
 * @param {string} message Message text
 * @returns {object[]} Chat array
 */
function makeChat(message) {
    return [
        { user_name: 'User', character_name: 'Char', chat_metadata: {} },
        { name: 'Char', is_user: false, mes: message },
    ];
}

describe('getBackupKey', () => {
    test('keeps plain ASCII names unchanged', () => {
        expect(chats.getBackupKey('Seraphina')).toBe('seraphina');
        expect(chats.getBackupKey('Some Test')).toBe('some_test');
    });

    test('produces distinct stable keys for names that sanitize identically', () => {
        const keyA = chats.getBackupKey('雷电将军');
        const keyB = chats.getBackupKey('测试角色');

        expect(keyA).not.toBe(keyB);
        expect(chats.getBackupKey('雷电将军')).toBe(keyA);
    });
});

describe('chat backups', () => {
    test('chats with equal-length CJK names get independent backups and quotas', async () => {
        const backupsDir = path.join(workDir, 'backups');
        const chatsDir = path.join(workDir, 'chats');
        fs.mkdirSync(backupsDir, { recursive: true });
        fs.mkdirSync(chatsDir, { recursive: true });

        // numberOfBackups is 1: with a shared backup key, the second chat's
        // backup would evict the first; with a shared throttle, it would not be
        // written at the leading edge at all
        await chats.trySaveChat(makeChat('first'), path.join(chatsDir, 'a.jsonl'), true, 'test-user', '雷电将军', backupsDir);
        await chats.trySaveChat(makeChat('second'), path.join(chatsDir, 'b.jsonl'), true, 'test-user', '测试角色', backupsDir);

        const backupFiles = fs.readdirSync(backupsDir);
        expect(backupFiles).toHaveLength(2);

        const keyA = chats.getBackupKey('雷电将军');
        const keyB = chats.getBackupKey('测试角色');
        expect(backupFiles.some(f => f.startsWith(`chat_${keyA}_`))).toBe(true);
        expect(backupFiles.some(f => f.startsWith(`chat_${keyB}_`))).toBe(true);
    });
});
