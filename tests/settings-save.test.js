import { afterAll, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-settings-save-'));
let requestRoot = root;
let backupDirectories = { root: path.join(root, 'missing') };
const backupCallbacks = [];
// Exercise both leading and deferred callbacks without waiting ten minutes.
jest.unstable_mockModule('lodash', () => ({ default: {
    throttle: callback => {
        backupCallbacks.push(callback);
        return callback;
    },
} }));
jest.unstable_mockModule('../src/util.js', () => ({
    getConfigValue: (_key, fallback) => fallback,
    generateTimestamp: jest.fn(),
    removeOldBackups: jest.fn(),
}));
jest.unstable_mockModule('../src/users.js', () => ({
    getAllUserHandles: jest.fn(),
    getUserDirectories: () => backupDirectories,
}));

let server;
let url;
beforeAll(async () => {
    const { default: express } = await import('express');
    const { router } = await import('../src/endpoints/settings.js');
    const app = express();
    app.use(express.json());
    app.use((request, _response, next) => {
        request.user = { directories: { root: requestRoot }, profile: { handle: 'fixture' } };
        next();
    });
    app.use('/api/settings', router);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    url = `http://127.0.0.1:${server.address().port}/api/settings/save`;
});

afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(path.join(root, 'settings.json'), { force: true });
    fs.rmdirSync(root);
});

beforeEach(() => {
    requestRoot = root;
    backupDirectories = { root: path.join(root, 'missing') };
});

test('reports a failed settings write and allows a later successful save', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"amount_gen":123}' };
    try {
        requestRoot = path.join(root, 'missing');
        const failed = await fetch(url, options);
        expect(failed.status).toBe(500);
        expect(await failed.text()).toBe('Internal Server Error');
        expect(fs.existsSync(path.join(root, 'settings.json'))).toBe(false);

        requestRoot = root;
        const saved = await fetch(url, options);
        expect(saved.status).toBe(200);
        expect(await saved.json()).toEqual({ result: 'ok' });
        expect(JSON.parse(fs.readFileSync(path.join(root, 'settings.json'), 'utf8'))).toEqual({ amount_gen: 123 });
    } finally {
        errorLog.mockRestore();
    }
});

test('backup failures do not fail a saved response or escape a deferred callback', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    backupDirectories = { root, backups: path.join(root, 'missing-backups') };
    try {
        const saved = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"amount_gen":456}',
        });
        expect(() => backupCallbacks[0]()).not.toThrow();
        expect(saved.status).toBe(200);
        expect(await saved.json()).toEqual({ result: 'ok' });
        expect(JSON.parse(fs.readFileSync(path.join(root, 'settings.json'), 'utf8'))).toEqual({ amount_gen: 456 });
        expect(errorLog).toHaveBeenCalledTimes(2);
    } finally {
        errorLog.mockRestore();
    }
});
