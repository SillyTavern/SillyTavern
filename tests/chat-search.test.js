import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const mockTryParse = jest.fn((str) => {
    try {
        return JSON.parse(str);
    } catch {
        return undefined;
    }
});

jest.unstable_mockModule('../src/util.js', () => ({
    formatBytes: bytes => `${bytes} B`,
    tryParse: mockTryParse,
}));

/** @type {typeof import('../src/chat-search.js')} */
let chatSearch;
/** @type {string[]} */
const tempDirs = [];
let warnSpy;

beforeAll(async () => {
    chatSearch = await import('../src/chat-search.js');
});

beforeEach(() => {
    mockTryParse.mockClear();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
    warnSpy?.mockRestore();

    const dirs = tempDirs.splice(0);
    await Promise.all(dirs.map(dir => fs.rm(dir, { recursive: true, force: true })));
});

async function createTempDir() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'st-chat-search-'));
    tempDirs.push(tempDir);
    return tempDir;
}

/**
 * @param {string} filePath File path
 * @param {(object|string)[]} entries JSONL entries
 * @returns {Promise<number>} Written byte length
 */
async function writeJsonl(filePath, entries) {
    const contents = entries
        .map(entry => typeof entry === 'string' ? entry : JSON.stringify(entry))
        .join('\n');
    await fs.writeFile(filePath, contents);
    return Buffer.byteLength(contents);
}

describe('chat search metadata', () => {
    test('empty query returns summary fields and only parses the last line', async () => {
        const tempDir = await createTempDir();
        const lastMessage = {
            name: 'Seraphina',
            mes: 'second hello',
            send_date: '2026-01-02T03:04:05.000Z',
        };
        const filePath = path.join(tempDir, 'Morning Chat.jsonl');
        const size = await writeJsonl(filePath, [
            { user_name: 'User', character_name: 'Seraphina', chat_metadata: {} },
            { name: 'User', mes: 'first hello', send_date: '2026-01-01T03:04:05.000Z' },
            lastMessage,
        ]);

        const result = await chatSearch.getChatSearchResult(filePath);

        expect(result).toMatchObject({
            file_name: 'Morning Chat',
            file_size: `${size} B`,
            message_count: 2,
            last_mes: lastMessage.send_date,
            preview_message: lastMessage.mes,
            valid: true,
        });
        expect(mockTryParse).toHaveBeenCalledTimes(1);
        expect(mockTryParse).toHaveBeenCalledWith(JSON.stringify(lastMessage));
    });

    test('group chat ids are returned without the .jsonl extension', async () => {
        const tempDir = await createTempDir();
        const filePath = path.join(tempDir, 'group-session-123.jsonl');
        await writeJsonl(filePath, [
            { user_name: 'User', character_name: 'Group', chat_metadata: {} },
            { name: 'Group', mes: 'hello group', send_date: '2026-02-03T04:05:06.000Z' },
        ]);

        const result = await chatSearch.getChatSearchResult(filePath);

        expect(result.file_name).toBe('group-session-123');
        expect(result.message_count).toBe(1);
        expect(result.preview_message).toBe('hello group');
    });

    test('corrupted middle JSON lines do not fail empty search metadata', async () => {
        const tempDir = await createTempDir();
        const filePath = path.join(tempDir, 'Corrupted Lines.jsonl');
        await writeJsonl(filePath, [
            { user_name: 'User', character_name: 'Character', chat_metadata: {} },
            '{not valid json',
            { name: 'Character', mes: 'survivor line', send_date: '2026-05-06T07:08:09.000Z' },
        ]);

        const result = await chatSearch.getChatSearchResult(filePath);

        expect(result).toMatchObject({
            file_name: 'Corrupted Lines',
            message_count: 2,
            last_mes: '2026-05-06T07:08:09.000Z',
            preview_message: 'survivor line',
            valid: true,
        });
        expect(mockTryParse).toHaveBeenCalledTimes(1);
    });

    test('empty and invalid chats do not throw', async () => {
        const tempDir = await createTempDir();
        const emptyPath = path.join(tempDir, 'Empty.jsonl');
        const invalidPath = path.join(tempDir, 'Invalid.jsonl');
        await fs.writeFile(emptyPath, '');
        await fs.writeFile(invalidPath, '{not valid json');

        await expect(chatSearch.getChatSearchResult(emptyPath)).resolves.toMatchObject({
            file_name: 'Empty',
            message_count: 0,
            preview_message: '[The chat is empty]',
            valid: true,
        });
        await expect(chatSearch.getChatSearchResult(invalidPath)).resolves.toMatchObject({
            file_name: 'Invalid',
            valid: false,
        });
    });

    test('normalizes search query fragments', () => {
        expect(chatSearch.getChatSearchFragments('  Alpha   Beta  ')).toEqual(['alpha', 'beta']);
    });
});
