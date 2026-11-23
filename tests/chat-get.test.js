import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SILLYTAVERN_BACKUPS_CHAT_ENABLED = 'false';
process.env.SILLYTAVERN_BACKUPS_CHAT_MAXTOTALBACKUPS = '-1';
process.env.SILLYTAVERN_BACKUPS_CHAT_THROTTLEINTERVAL = '0';
process.env.SILLYTAVERN_BACKUPS_CHAT_CHECKINTEGRITY = 'true';

/** @type {import('../src/endpoints/chats.js')} */
let chats;
/** @type {import('node:http').Server} */
let server;
let baseUrl;
let tmpDir;
let characterChatsDir;
let groupChatsDir;

beforeAll(async () => {
    const { default: express } = await import('express');
    chats = await import('../src/endpoints/chats.js');

    const app = express();
    app.use(express.json());
    app.use((request, _response, next) => {
        request.user = {
            profile: { handle: 'test-user' },
            directories: {
                chats: characterChatsDir,
                groupChats: groupChatsDir,
            },
        };
        next();
    });
    app.use('/api/chats', chats.router);

    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    if (server?.listening) {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chat-get-'));
    characterChatsDir = path.join(tmpDir, 'chats');
    groupChatsDir = path.join(tmpDir, 'group-chats');
    fs.mkdirSync(characterChatsDir);
    fs.mkdirSync(groupChatsDir);
});

afterEach(() => {
    jest.restoreAllMocks();
    if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

function makeChatJsonl() {
    return [
        JSON.stringify({ chat_metadata: { integrity: 'test-integrity' } }),
        JSON.stringify({ name: 'Character', mes: 'Hello' }),
    ].join('\n');
}

async function post(endpoint, body) {
    return await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('getChatData', () => {
    test('returns an empty array for a missing or empty file', () => {
        const missingFile = path.join(tmpDir, 'missing.jsonl');
        const emptyFile = path.join(tmpDir, 'empty.jsonl');
        fs.writeFileSync(emptyFile, ' \n\t');

        expect(chats.getChatData(missingFile)).toEqual([]);
        expect(chats.getChatData(emptyFile)).toEqual([]);
    });

    test('parses valid records while tolerating a BOM and blank lines', () => {
        const chatFile = path.join(tmpDir, 'valid.jsonl');
        fs.writeFileSync(chatFile, `\uFEFF${makeChatJsonl().replace('\n', '\n\n')}\n`);

        expect(chats.getChatData(chatFile)).toEqual([
            { chat_metadata: { integrity: 'test-integrity' } },
            { name: 'Character', mes: 'Hello' },
        ]);
    });

    test('rejects the entire chat when any non-empty line is malformed', () => {
        const chatFile = path.join(tmpDir, 'corrupted.jsonl');
        fs.writeFileSync(chatFile, `${makeChatJsonl()}\nnot-json`);

        expect(() => chats.getChatData(chatFile)).toThrow(/line 3/);
    });

    test('propagates non-ENOENT read failures with the original cause', () => {
        const chatFile = path.join(tmpDir, 'unreadable.jsonl');
        const readError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
        const realReadFileSync = fs.readFileSync;
        jest.spyOn(fs, 'readFileSync').mockImplementation((filePath, ...args) => {
            if (filePath === chatFile) {
                throw readError;
            }
            return realReadFileSync(filePath, ...args);
        });

        let caughtError;
        try {
            chats.getChatData(chatFile);
        } catch (error) {
            caughtError = error;
        }
        expect(caughtError?.message).toContain(chatFile);
        expect(caughtError?.cause).toBe(readError);
    });
});

describe('chat get endpoints', () => {
    test('returns an array for a character chat and creates a missing character directory', async () => {
        const missingDirectoryResponse = await post('/api/chats/get', {
            avatar_url: 'New Character.png',
            file_name: 'new-chat',
        });
        expect(missingDirectoryResponse.status).toBe(200);
        expect(await missingDirectoryResponse.json()).toEqual([]);
        expect(fs.existsSync(path.join(characterChatsDir, 'New Character'))).toBe(true);

        const characterDir = path.join(characterChatsDir, 'Character');
        fs.mkdirSync(characterDir);
        const missingFileResponse = await post('/api/chats/get', {
            avatar_url: 'Character.png',
            file_name: 'missing-chat',
        });
        expect(missingFileResponse.status).toBe(200);
        expect(await missingFileResponse.json()).toEqual([]);

        fs.writeFileSync(path.join(characterDir, 'chat.jsonl'), makeChatJsonl());
        const response = await post('/api/chats/get', {
            avatar_url: 'Character.png',
            file_name: 'chat',
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toHaveLength(2);
    });

    test('returns JSON 400 errors for invalid character and group requests', async () => {
        const missingFileName = await post('/api/chats/get', { avatar_url: 'Character.png' });
        expect(missingFileName.status).toBe(400);
        expect(await missingFileName.json()).toEqual({ error: 'The request\'s body.file_name is required.' });

        const invalidPath = await post('/api/chats/get', { avatar_url: '..', file_name: 'chat' });
        expect(invalidPath.status).toBe(400);
        expect(await invalidPath.json()).toEqual({ error: 'Invalid chat path.' });

        const missingGroupId = await post('/api/chats/group/get', {});
        expect(missingGroupId.status).toBe(400);
        expect(await missingGroupId.json()).toEqual({ error: 'The request\'s body.id is required.' });
    });

    test('returns the same fixed JSON 500 error for corrupted character and group chats', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        const characterDir = path.join(characterChatsDir, 'Character');
        fs.mkdirSync(characterDir);
        fs.writeFileSync(path.join(characterDir, 'broken.jsonl'), 'not-json');
        fs.writeFileSync(path.join(groupChatsDir, 'broken-group.jsonl'), 'not-json');

        const characterResponse = await post('/api/chats/get', {
            avatar_url: 'Character.png',
            file_name: 'broken',
        });
        const groupResponse = await post('/api/chats/group/get', { id: 'broken-group' });

        expect(characterResponse.status).toBe(500);
        expect(await characterResponse.json()).toEqual({ error: 'Chat could not be loaded.' });
        expect(groupResponse.status).toBe(500);
        expect(await groupResponse.json()).toEqual({ error: 'Chat could not be loaded.' });
        expect(consoleError).toHaveBeenCalledTimes(2);
    });
});
