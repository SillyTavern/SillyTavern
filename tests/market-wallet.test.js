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
        await storage.setItem(toKey('charlie'), createUser('charlie', false));
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
        expect(purchaseResult.body.entitlement.source).toBe('free');
        expect(purchaseResult.body.entitlement.purchase_id).toBeNull();
        expect(purchaseResult.body.purchase).toBeNull();

        const freeLedger = await request(bobApp, '/api/wallet/ledger', { method: 'GET' });
        expect(freeLedger.status).toBe(200);
        expect(freeLedger.body.ledger).toHaveLength(0);

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

    test('purchases fixed price assets with wallet ledger and creator earnings', async () => {
        const aliceApp = createApp(createUser('alice', true));
        const bobApp = createApp(createUser('bob', false));
        const charlieApp = createApp(createUser('charlie', false));
        const assetId = await createSubmittedAsset(charlieApp, {
            type: 'character_card',
            title: 'Paid Charlie',
            price_type: 'fixed_price',
            price_coins: 30,
            normalized_payload: createCharacterPayload(),
        });

        const approveResult = await request(aliceApp, `/api/market/assets/${assetId}/approve`, {
            method: 'POST',
            body: {},
        });
        expect(approveResult.status).toBe(200);
        expect(approveResult.body.asset.price_type).toBe('fixed_price');
        expect(approveResult.body.asset.price_coins).toBe(30);

        const insufficientPurchase = await request(bobApp, `/api/market/assets/${assetId}/purchase`, {
            method: 'POST',
            body: {},
        });
        expect(insufficientPurchase.status).toBe(402);
        expect(insufficientPurchase.body.error).toBe('Insufficient wallet balance');

        const failedStore = JSON.parse(fs.readFileSync(path.join(dataRoot, 'market-assets.json'), 'utf8'));
        expect(failedStore.assets.find(asset => asset.id === assetId).sales_count).toBe(0);
        expect(failedStore.entitlements.filter(entitlement => entitlement.asset_id === assetId && entitlement.user_id === 'bob')).toHaveLength(0);

        const failedBobLedger = await request(bobApp, '/api/wallet/ledger', { method: 'GET' });
        expect(failedBobLedger.status).toBe(200);
        expect(failedBobLedger.body.ledger).toHaveLength(0);

        const failedCreatorLedger = await request(charlieApp, '/api/wallet/ledger', { method: 'GET' });
        expect(failedCreatorLedger.status).toBe(200);
        expect(failedCreatorLedger.body.balance.buckets.earnings).toBe(0);

        const blockedInstall = await request(bobApp, `/api/market/assets/${assetId}/install`, {
            method: 'POST',
            body: {},
        });
        expect(blockedInstall.status).toBe(403);
        expect(fs.existsSync(path.join(dataRoot, 'bob', 'characters'))).toBe(false);

        const bonusGrant = await request(aliceApp, '/api/wallet/grants/admin', {
            method: 'POST',
            body: {
                targetHandle: 'bob',
                amount: 10,
                bucket: 'bonus',
            },
        });
        expect(bonusGrant.status).toBe(201);

        const paidGrant = await request(aliceApp, '/api/wallet/grants/admin', {
            method: 'POST',
            body: {
                targetHandle: 'bob',
                amount: 25,
                bucket: 'paid',
            },
        });
        expect(paidGrant.status).toBe(201);

        const purchaseResult = await request(bobApp, `/api/market/assets/${assetId}/purchase`, {
            method: 'POST',
            body: {},
        });
        expect(purchaseResult.status).toBe(201);
        expect(purchaseResult.body.entitlement.source).toBe('purchase');
        expect(purchaseResult.body.entitlement.purchase_id).toBeTruthy();
        expect(purchaseResult.body.purchase.ledger_entries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'market_purchase_debit',
                userHandle: 'bob',
                bucket: 'bonus',
                amount: -10,
            }),
            expect.objectContaining({
                type: 'market_purchase_debit',
                userHandle: 'bob',
                bucket: 'paid',
                amount: -20,
            }),
            expect.objectContaining({
                type: 'market_creator_earning',
                userHandle: 'charlie',
                bucket: 'earnings',
                amount: 30,
                metadata: expect.objectContaining({
                    asset_id: assetId,
                    buyer_handle: 'bob',
                    creator_handle: 'charlie',
                    price_coins: 30,
                    debit_breakdown: {
                        bonus: 10,
                        paid: 20,
                    },
                }),
            }),
        ]));
        expect(purchaseResult.body.purchase.buyer_balance.buckets).toMatchObject({
            bonus: 0,
            paid: 5,
        });
        expect(purchaseResult.body.purchase.creator_balance.buckets.earnings).toBe(30);

        const repeatPurchase = await request(bobApp, `/api/market/assets/${assetId}/purchase`, {
            method: 'POST',
            body: {},
        });
        expect(repeatPurchase.status).toBe(200);
        expect(repeatPurchase.body.already_owned).toBe(true);
        expect(repeatPurchase.body.entitlement.id).toBe(purchaseResult.body.entitlement.id);

        const installResult = await request(bobApp, `/api/market/assets/${assetId}/install`, {
            method: 'POST',
            body: {},
        });
        expect(installResult.status).toBe(201);
        expect(installResult.body.install.asset_id).toBe(assetId);

        const bobLedger = await request(bobApp, '/api/wallet/ledger', { method: 'GET' });
        expect(bobLedger.status).toBe(200);
        expect(bobLedger.body.balance.buckets).toMatchObject({
            bonus: 0,
            paid: 5,
        });
        expect(bobLedger.body.ledger.filter(entry => entry.type === 'market_purchase_debit')).toHaveLength(2);

        const charlieLedger = await request(charlieApp, '/api/wallet/ledger', { method: 'GET' });
        expect(charlieLedger.status).toBe(200);
        expect(charlieLedger.body.balance.buckets.earnings).toBe(30);
        expect(charlieLedger.body.ledger.filter(entry => entry.type === 'market_creator_earning')).toHaveLength(1);

        const store = JSON.parse(fs.readFileSync(path.join(dataRoot, 'market-assets.json'), 'utf8'));
        const storedAsset = store.assets.find(asset => asset.id === assetId);
        expect(storedAsset.sales_count).toBe(1);
        expect(store.entitlements.filter(entitlement => entitlement.asset_id === assetId && entitlement.user_id === 'bob')).toHaveLength(1);
    });

    test('returns creator summary with owned assets and earnings', async () => {
        const aliceApp = createApp(createUser('alice', true));
        const bobApp = createApp(createUser('bob', false));
        const charlieApp = createApp(createUser('charlie', false));
        const draftResult = await request(charlieApp, '/api/market/assets', {
            method: 'POST',
            body: {
                type: 'character_card',
                title: 'Creator Draft',
                normalized_payload: createCharacterPayload(),
            },
        });
        expect(draftResult.status).toBe(201);

        const submittedAssetId = await createSubmittedAsset(charlieApp, {
            type: 'world_book',
            title: 'Creator Submitted World',
            normalized_payload: {
                name: 'Creator Submitted World',
                entries: {},
            },
        });
        expect(submittedAssetId).toBeTruthy();

        const rejectedAssetId = await createSubmittedAsset(charlieApp, {
            type: 'character_card',
            title: 'Creator Rejected Card',
            normalized_payload: createCharacterPayload(),
        });
        const rejectResult = await request(aliceApp, `/api/market/assets/${rejectedAssetId}/reject`, {
            method: 'POST',
            body: { reason: 'Needs a stronger summary' },
        });
        expect(rejectResult.status).toBe(200);

        const assetId = await createSubmittedAsset(charlieApp, {
            type: 'character_card',
            title: 'Creator Summary Card',
            price_type: 'fixed_price',
            price_coins: 20,
            normalized_payload: createCharacterPayload(),
        });

        const approveResult = await request(aliceApp, `/api/market/assets/${assetId}/approve`, {
            method: 'POST',
            body: {},
        });
        expect(approveResult.status).toBe(200);

        const grantResult = await request(aliceApp, '/api/wallet/grants/admin', {
            method: 'POST',
            body: {
                targetHandle: 'bob',
                amount: 20,
                bucket: 'paid',
            },
        });
        expect(grantResult.status).toBe(201);

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

        const creatorSummary = await request(charlieApp, '/api/market/creator/summary', { method: 'GET' });
        expect(creatorSummary.status).toBe(200);
        expect(creatorSummary.body.handle).toBe('charlie');
        expect(creatorSummary.body.stats).toMatchObject({
            total_assets: 4,
            draft_assets: 1,
            submitted_assets: 1,
            listed_assets: 1,
            rejected_assets: 1,
            total_claims: 1,
            paid_sales: 1,
            total_installs: 1,
            gross_revenue_coins: 20,
            earnings_balance: 20,
        });
        expect(creatorSummary.body.wallet).toBeUndefined();
        expect(creatorSummary.body.recent_earnings).toBeUndefined();
        expect(creatorSummary.body.assets).toHaveLength(4);
        const paidAsset = creatorSummary.body.assets.find(asset => asset.id === assetId);
        expect(paidAsset).toMatchObject({
            id: assetId,
            title: 'Creator Summary Card',
            owned: true,
            status: 'listed',
            sales_count: 1,
            install_count: 1,
        });
        expect(paidAsset.normalized_payload).toBeUndefined();

        const rejectedAsset = creatorSummary.body.assets.find(asset => asset.id === rejectedAssetId);
        expect(rejectedAsset).toMatchObject({
            status: 'rejected',
            rejection_reason: 'Needs a stronger summary',
        });

        const buyerSummary = await request(bobApp, '/api/market/creator/summary', { method: 'GET' });
        expect(buyerSummary.status).toBe(200);
        expect(buyerSummary.body.handle).toBe('bob');
        expect(buyerSummary.body.stats.total_assets).toBe(0);
        expect(buyerSummary.body.assets).toHaveLength(0);
        expect(buyerSummary.body.stats.gross_revenue_coins).toBe(0);
        expect(buyerSummary.body.wallet).toBeUndefined();
    });

    test('validates fixed price asset pricing', async () => {
        const aliceApp = createApp(createUser('alice', true));
        const invalidFixedPrice = await request(aliceApp, '/api/market/assets', {
            method: 'POST',
            body: {
                type: 'character_card',
                title: 'Invalid Paid',
                price_type: 'fixed_price',
                price_coins: 0,
                normalized_payload: createCharacterPayload(),
            },
        });
        expect(invalidFixedPrice.status).toBe(400);

        const invalidFreePrice = await request(aliceApp, '/api/market/assets', {
            method: 'POST',
            body: {
                type: 'character_card',
                title: 'Invalid Free',
                price_type: 'free',
                price_coins: 10,
                normalized_payload: createCharacterPayload(),
            },
        });
        expect(invalidFreePrice.status).toBe(400);
    });
});
