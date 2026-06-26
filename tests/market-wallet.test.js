import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import storage from 'node-persist';
import { describe, test, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';

import { setConfigFilePath } from '../src/util.js';

try {
    setConfigFilePath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../default/config.yaml'));
} catch {
    // The test process may import this file after another suite has already set the config path.
}

let dataRoot;
let marketRouter;
let walletRouter;
let toKey;

beforeAll(async () => {
    ({ router: marketRouter } = await import('../src/endpoints/market.js'));
    ({ router: walletRouter } = await import('../src/endpoints/wallet.js'));
    ({ toKey } = await import('../src/users.js'));
});

function createUser(handle, admin = false) {
    return {
        handle,
        name: handle,
        admin,
        enabled: true,
        created: Date.now(),
        password: '',
        salt: '',
    };
}

function createApp(user) {
    const app = express();
    app.use(express.json());
    app.use((request, _response, next) => {
        request.user = {
            profile: user,
            directories: {
                root: path.join(dataRoot, user.handle),
                characters: path.join(dataRoot, user.handle, 'characters'),
                worlds: path.join(dataRoot, user.handle, 'worlds'),
            },
        };
        next();
    });
    app.use('/api/market', marketRouter);
    app.use('/api/wallet', walletRouter);
    return app;
}

async function request(app, url, options = {}) {
    const server = app.listen(0);
    try {
        await Promise.race([
            once(server, 'listening'),
            once(server, 'error').then(([error]) => Promise.reject(error)),
        ]);
        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Test server did not bind to a TCP port');
        }
        const port = address.port;
        const response = await fetch(`http://127.0.0.1:${port}${url}`, {
            ...options,
            headers: {
                'content-type': 'application/json',
                ...(options.headers || {}),
            },
            body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
        });
        const text = await response.text();
        let body = null;
        if (text) {
            try {
                body = JSON.parse(text);
            } catch {
                body = text;
            }
        }
        return { status: response.status, body };
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

function createCharacterPayload() {
    return {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
            name: 'Market Alice',
            description: '',
            personality: '',
            scenario: '',
            first_mes: 'Hello',
            mes_example: '',
            creator_notes: '',
            system_prompt: '',
            post_history_instructions: '',
            alternate_greetings: [],
            tags: [],
            creator: 'alice',
            character_version: '1.0',
            extensions: {},
        },
    };
}

async function createSubmittedAsset(app, body) {
    const createResult = await request(app, '/api/market/assets', {
        method: 'POST',
        body,
    });
    expect(createResult.status).toBe(201);

    const assetId = createResult.body.asset.id;
    const submitResult = await request(app, `/api/market/assets/${assetId}/submit`, {
        method: 'POST',
        body: {},
    });
    expect(submitResult.status).toBe(200);
    return assetId;
}

describe('market and wallet MVP endpoints', () => {
    beforeEach(async () => {
        dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'st-market-wallet-'));
        globalThis.DATA_ROOT = dataRoot;
        await storage.init({
            dir: path.join(dataRoot, '_storage'),
            ttl: false,
            expiredInterval: 0,
        });
        await storage.clear();
        await storage.setItem(toKey('alice'), createUser('alice', true));
        await storage.setItem(toKey('bob'), createUser('bob', false));
    });

    afterEach(async () => {
        await storage.clear();
        fs.rmSync(dataRoot, { recursive: true, force: true });
    });

    test('requires review before purchase and installs approved character cards', async () => {
        const aliceApp = createApp(createUser('alice', true));
        const bobApp = createApp(createUser('bob', false));
        const assetId = await createSubmittedAsset(aliceApp, {
            type: 'character_card',
            title: 'Market Alice',
            normalized_payload: createCharacterPayload(),
        });

        const hiddenPurchase = await request(bobApp, `/api/market/assets/${assetId}/purchase`, {
            method: 'POST',
            body: {},
        });
        expect(hiddenPurchase.status).toBe(404);

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const rejectedApproval = await request(bobApp, `/api/market/assets/${assetId}/approve`, {
                method: 'POST',
                body: {},
            });
            expect(rejectedApproval.status).toBe(403);

            const rejectedRejection = await request(bobApp, `/api/market/assets/${assetId}/reject`, {
                method: 'POST',
                body: {},
            });
            expect(rejectedRejection.status).toBe(403);
        } finally {
            warnSpy.mockRestore();
        }

        const approveResult = await request(aliceApp, `/api/market/assets/${assetId}/approve`, {
            method: 'POST',
            body: {},
        });
        expect(approveResult.status).toBe(200);
        expect(approveResult.body.asset.status).toBe('listed');

        const publicDetail = await request(bobApp, `/api/market/assets/${assetId}`, { method: 'GET' });
        expect(publicDetail.status).toBe(200);
        expect(publicDetail.body.asset.payload_available).toBe(false);
        expect(publicDetail.body.asset.normalized_payload).toBeUndefined();

        const purchaseResult = await request(bobApp, `/api/market/assets/${assetId}/purchase`, {
            method: 'POST',
            body: {},
        });
        expect(purchaseResult.status).toBe(201);
        expect(purchaseResult.body.already_owned).toBe(false);
        expect(purchaseResult.body.entitlement.user_id).toBe('bob');
        expect(purchaseResult.body.entitlement.asset_id).toBe(assetId);

        const ownedDetail = await request(bobApp, `/api/market/assets/${assetId}`, { method: 'GET' });
        expect(ownedDetail.status).toBe(200);
        expect(ownedDetail.body.asset.payload_available).toBe(true);
        expect(ownedDetail.body.asset.normalized_payload.data.name).toBe('Market Alice');
        expect(ownedDetail.body.entitlement.user_id).toBe('bob');

        const installResult = await request(bobApp, `/api/market/assets/${assetId}/install`, {
            method: 'POST',
            body: {},
        });
        expect(installResult.status).toBe(201);
        expect(installResult.body.installed.type).toBe('character_card');
        expect(installResult.body.install.user_id).toBe('bob');
        expect(installResult.body.install.asset_id).toBe(assetId);
        expect(fs.existsSync(path.join(dataRoot, 'bob', 'characters', `${installResult.body.installed.file_name}.png`))).toBe(true);

        const store = JSON.parse(fs.readFileSync(path.join(dataRoot, 'market-assets.json'), 'utf8'));
        const storedAsset = store.assets.find(asset => asset.id === assetId);
        expect(storedAsset.sales_count).toBe(1);
        expect(storedAsset.install_count).toBe(1);
        expect(store.entitlements.some(entitlement => entitlement.asset_id === assetId && entitlement.user_id === 'bob')).toBe(true);
        expect(store.installs.some(install => install.asset_id === assetId && install.user_id === 'bob')).toBe(true);
    });

    test('installs approved world books into user worlds directory', async () => {
        const aliceApp = createApp(createUser('alice', true));
        const bobApp = createApp(createUser('bob', false));
        const assetId = await createSubmittedAsset(aliceApp, {
            type: 'world_book',
            title: 'Market World',
            normalized_payload: {
                name: 'Market World',
                entries: {},
            },
        });

        const approveResult = await request(aliceApp, `/api/market/assets/${assetId}/approve`, {
            method: 'POST',
            body: {},
        });
        expect(approveResult.status).toBe(200);

        const purchaseResult = await request(bobApp, `/api/market/assets/${assetId}/purchase`, {
            method: 'POST',
            body: {},
        });
        expect(purchaseResult.status).toBe(201);

        const installResult = await request(bobApp, `/api/market/assets/${assetId}/install`, {
            method: 'POST',
            body: {},
        });
        expect(installResult.status).toBe(201);
        expect(installResult.body.installed.type).toBe('world_book');
        expect(fs.existsSync(path.join(dataRoot, 'bob', 'worlds', `${installResult.body.installed.name}.json`))).toBe(true);
    });

    test('allows only admins to grant wallet balance', async () => {
        const aliceApp = createApp(createUser('alice', true));
        const bobApp = createApp(createUser('bob', false));

        const rejectedGrant = await request(bobApp, '/api/wallet/grants/admin', {
            method: 'POST',
            body: { amount: 10 },
        });
        expect(rejectedGrant.status).toBe(403);

        const grantResult = await request(aliceApp, '/api/wallet/grants/admin', {
            method: 'POST',
            body: {
                targetHandle: 'bob',
                amount: 10,
                bucket: 'bonus',
            },
        });
        expect(grantResult.status).toBe(201);
        expect(grantResult.body.entry.userHandle).toBe('bob');
        expect(grantResult.body.entry.actorHandle).toBe('alice');
        expect(grantResult.body.entry.bucket).toBe('bonus');
        expect(grantResult.body.entry.amount).toBe(10);
        expect(grantResult.body.balance.buckets.bonus).toBe(10);

        const walletResult = await request(bobApp, '/api/wallet', { method: 'GET' });
        expect(walletResult.status).toBe(200);
        expect(walletResult.body.balance.buckets.bonus).toBe(10);

        const ledgerResult = await request(bobApp, '/api/wallet/ledger', { method: 'GET' });
        expect(ledgerResult.status).toBe(200);
        expect(ledgerResult.body.ledger).toHaveLength(1);
        expect(ledgerResult.body.ledger[0]).toMatchObject({
            userHandle: 'bob',
            actorHandle: 'alice',
            bucket: 'bonus',
            amount: 10,
        });
    });
});
