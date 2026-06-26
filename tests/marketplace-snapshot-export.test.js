import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import storage from 'node-persist';
import { describe, test, expect, afterEach } from '@jest/globals';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportScript = path.join(rootDirectory, 'scripts', 'export-marketplace-snapshot.mjs');
const tempRoots = [];

function makeTempRoot() {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'st-market-snapshot-'));
    tempRoots.push(dataRoot);
    return dataRoot;
}

function runExport(dataRoot, args = []) {
    return execFileSync(process.execPath, [exportScript, '--dataRoot', dataRoot, ...args], {
        cwd: rootDirectory,
        encoding: 'utf8',
        stdio: 'pipe',
    });
}

function writeMarketStore(dataRoot) {
    const timestamp = '2026-01-01T00:00:00.000Z';
    const store = {
        version: 1,
        assets: [
            {
                id: 'asset_demo',
                creator_id: 'alice',
                type: 'character_card',
                title: 'Snapshot Demo',
                description: 'Sensitive long prompt should not be exported',
                status: 'listed',
                price_type: 'free',
                price_coins: 0,
                sales_count: 1,
                install_count: 1,
                metadata: {
                    private_note: 'hidden',
                },
                normalized_payload: {
                    spec: 'chara_card_v2',
                    data: {
                        name: 'Snapshot Demo',
                    },
                },
                created_at: timestamp,
                updated_at: timestamp,
                submitted_at: '2026-01-01T00:10:00.000Z',
                approved_at: '2026-01-01T00:20:00.000Z',
                listed_at: '2026-01-01T00:30:00.000Z',
                delisted_at: null,
            },
        ],
        entitlements: [
            {
                id: 'ent_demo',
                user_id: 'bob',
                asset_id: 'asset_demo',
                source: 'free',
                purchase_id: 'purchase_demo',
                ledger_entry_ids: ['debit_demo'],
                created_at: timestamp,
                revoked_at: null,
            },
        ],
        installs: [
            {
                id: 'install_demo',
                user_id: 'bob',
                asset_id: 'asset_demo',
                installed_type: 'character_card',
                local_ref: 'characters/Snapshot Demo.png',
                created_at: timestamp,
            },
        ],
        reports: [
            {
                id: 'report_demo',
                asset_id: 'asset_demo',
                reporter_id: 'bob',
                status: 'open',
                reason: 'test',
                body: 'private report body',
                created_at: timestamp,
            },
        ],
    };

    fs.writeFileSync(path.join(dataRoot, 'market-assets.json'), JSON.stringify(store, null, 4), 'utf8');
}

async function writeWalletLedger(dataRoot) {
    await storage.init({
        dir: path.join(dataRoot, '_storage'),
        ttl: false,
        expiredInterval: 0,
    });
    await storage.clear();
    await storage.setItem('wallet:ledger:v1:grant_demo', {
        id: 'grant_demo',
        type: 'admin_grant',
        userHandle: 'bob',
        actorHandle: 'alice',
        bucket: 'bonus',
        amount: 20,
        reason: 'Admin grant',
        createdAt: 1,
        metadata: {
            source: 'test',
            private_note: 'do not export',
        },
    });
    await storage.setItem('wallet:ledger:v1:debit_demo', {
        id: 'debit_demo',
        type: 'market_purchase_debit',
        userHandle: 'bob',
        actorHandle: 'bob',
        bucket: 'bonus',
        amount: -5,
        reason: 'Market purchase',
        createdAt: 2,
        metadata: {
            purchase_id: 'purchase_demo',
            asset_id: 'asset_demo',
            price_coins: 5,
            debit_breakdown: {
                bonus: 5,
            },
            reason_detail: 'hidden',
        },
    });
    await storage.setItem('wallet:ledger:v1:bad_bucket', {
        id: 'bad_bucket',
        type: 'admin_grant',
        userHandle: 'bob',
        actorHandle: 'alice',
        bucket: 'coupons',
        amount: 99,
        createdAt: 3,
    });
    await storage.setItem('wallet:ledger:v1:bad_amount', {
        id: 'bad_amount',
        type: 'admin_grant',
        userHandle: 'bob',
        actorHandle: 'alice',
        bucket: 'bonus',
        amount: 1.5,
        createdAt: 4,
    });
    await storage.setItem('not-wallet-ledger', {
        id: 'other_record',
        bucket: 'bonus',
        amount: 50,
    });
}

describe('marketplace snapshot export script', () => {
    afterEach(async () => {
        if (typeof storage.clear === 'function') {
            await storage.clear().catch(() => {});
        }
        for (const dataRoot of tempRoots.splice(0)) {
            fs.rmSync(dataRoot, { recursive: true, force: true });
        }
    });

    test('requires an explicit data root', () => {
        expect(() => execFileSync(process.execPath, [exportScript], {
            cwd: rootDirectory,
            encoding: 'utf8',
            stdio: 'pipe',
        })).toThrow();
    });

    test('exports redacted market and wallet summaries to stdout', async () => {
        const dataRoot = makeTempRoot();
        writeMarketStore(dataRoot);
        await writeWalletLedger(dataRoot);

        const output = runExport(dataRoot);
        const snapshot = JSON.parse(output);

        expect(snapshot).toMatchObject({
            version: 1,
            market: {
                summary: {
                    asset_count: 1,
                    entitlement_count: 1,
                    install_count: 1,
                    report_count: 1,
                    assets_by_status: {
                        listed: 1,
                    },
                    assets_by_type: {
                        character_card: 1,
                    },
                    reports_by_status: {
                        open: 1,
                    },
                },
            },
            wallet: {
                summary: {
                    ledger_entry_count: 2,
                    balances_by_handle: {
                        bob: {
                            bonus: 15,
                        },
                    },
                    entries_by_type: {
                        admin_grant: 1,
                        market_purchase_debit: 1,
                    },
                },
            },
        });
        expect(snapshot).not.toHaveProperty('data_root');
        expect(snapshot.market.assets).toEqual([
            {
                id: 'asset_demo',
                creator_id: 'alice',
                type: 'character_card',
                status: 'listed',
                price_type: 'free',
                price_coins: 0,
                sales_count: 1,
                install_count: 1,
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
                submitted_at: '2026-01-01T00:10:00.000Z',
                approved_at: '2026-01-01T00:20:00.000Z',
                listed_at: '2026-01-01T00:30:00.000Z',
                delisted_at: null,
            },
        ]);
        expect(snapshot.market.entitlements).toEqual([
            {
                id: 'ent_demo',
                user_id: 'bob',
                asset_id: 'asset_demo',
                source: 'free',
                purchase_id: 'purchase_demo',
                ledger_entry_ids: ['debit_demo'],
                created_at: '2026-01-01T00:00:00.000Z',
                revoked_at: null,
            },
        ]);
        expect(snapshot.market.installs).toEqual([
            {
                id: 'install_demo',
                user_id: 'bob',
                asset_id: 'asset_demo',
                installed_type: 'character_card',
                created_at: '2026-01-01T00:00:00.000Z',
            },
        ]);
        expect(snapshot.market.reports).toEqual([
            {
                id: 'report_demo',
                asset_id: 'asset_demo',
                reporter_id: 'bob',
                status: 'open',
                created_at: '2026-01-01T00:00:00.000Z',
            },
        ]);
        expect(snapshot.wallet.ledger.map(entry => entry.id)).toEqual(['grant_demo', 'debit_demo']);
        expect(snapshot.wallet.ledger[0]).toEqual({
            id: 'grant_demo',
            type: 'admin_grant',
            userHandle: 'bob',
            actorHandle: 'alice',
            bucket: 'bonus',
            amount: 20,
            createdAt: 1,
            metadata: {
                source: 'test',
            },
        });
        expect(snapshot.wallet.ledger[1]).toEqual({
            id: 'debit_demo',
            type: 'market_purchase_debit',
            userHandle: 'bob',
            actorHandle: 'bob',
            bucket: 'bonus',
            amount: -5,
            createdAt: 2,
            metadata: {
                purchase_id: 'purchase_demo',
                asset_id: 'asset_demo',
                price_coins: 5,
                debit_breakdown: {
                    bonus: 5,
                },
            },
        });
        expect(output).not.toContain(path.resolve(dataRoot));
        expect(output).not.toContain('normalized_payload');
        expect(output).not.toContain('local_ref');
        expect(output).not.toContain('Admin grant');
        expect(output).not.toContain('private_note');
        expect(output).not.toContain('private report body');
    });

    test('writes snapshots to an explicit output file', async () => {
        const dataRoot = makeTempRoot();
        const outputRoot = makeTempRoot();
        writeMarketStore(dataRoot);
        await writeWalletLedger(dataRoot);
        const outPath = path.join(outputRoot, 'marketplace-snapshot.json');

        const output = runExport(dataRoot, ['--out', outPath]);
        const snapshot = JSON.parse(fs.readFileSync(outPath, 'utf8'));

        expect(output).toContain(`Marketplace snapshot exported to ${outPath}`);
        expect(snapshot.market.summary.asset_count).toBe(1);
        expect(snapshot.wallet.summary.ledger_entry_count).toBe(2);
    });

    test('rejects output files inside the data root', () => {
        const dataRoot = makeTempRoot();
        writeMarketStore(dataRoot);
        const outPath = path.join(dataRoot, 'exports', 'marketplace-snapshot.json');

        expect(() => runExport(dataRoot, ['--out', outPath])).toThrow();
        expect(fs.existsSync(outPath)).toBe(false);
    });

    test('does not create wallet storage when exporting a market-only data root', () => {
        const dataRoot = makeTempRoot();
        writeMarketStore(dataRoot);

        const snapshot = JSON.parse(runExport(dataRoot));

        expect(snapshot.market.summary.asset_count).toBe(1);
        expect(snapshot.wallet.summary.ledger_entry_count).toBe(0);
        expect(snapshot.wallet.ledger).toEqual([]);
        expect(fs.existsSync(path.join(dataRoot, '_storage'))).toBe(false);
    });
});
