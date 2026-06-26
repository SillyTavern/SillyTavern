import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import storage from 'node-persist';

const MARKET_STORE_FILE = 'market-assets.json';
const STORAGE_DIRECTORY = '_storage';
const LEDGER_KEY_PREFIX = 'wallet:ledger:v1:';
const WALLET_BUCKETS = new Set(['paid', 'bonus', 'earnings']);
const LEDGER_METADATA_KEYS = new Set([
    'purchase_id',
    'asset_id',
    'asset_version_id',
    'source',
    'price_coins',
    'debit_breakdown',
]);

function printUsage(stream = process.stdout) {
    stream.write(`Usage: npm run marketplace:export:snapshot -- --dataRoot <path> [--out <file>]

Exports a read-only JSON snapshot of the local marketplace store and wallet ledger.
The command never mutates the data root. If --out is provided, it must be outside
the data root.
`);
}

function parseArgs(argv) {
    const options = {
        dataRoot: process.env.MARKETPLACE_SNAPSHOT_DATA_ROOT || '',
        out: process.env.MARKETPLACE_SNAPSHOT_OUT || '',
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg === '--dataRoot') {
            options.dataRoot = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg.startsWith('--dataRoot=')) {
            options.dataRoot = arg.slice('--dataRoot='.length);
            continue;
        }

        if (arg === '--out') {
            options.out = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg.startsWith('--out=')) {
            options.out = arg.slice('--out='.length);
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    options.dataRoot = String(options.dataRoot || '').trim();
    options.out = String(options.out || '').trim();
    return options;
}

function createEmptyStore() {
    return {
        version: 1,
        assets: [],
        entitlements: [],
        installs: [],
        reports: [],
    };
}

function readMarketStore(dataRoot) {
    const storePath = path.join(dataRoot, MARKET_STORE_FILE);
    if (!fs.existsSync(storePath)) {
        return createEmptyStore();
    }

    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return {
        version: Number.isSafeInteger(parsed.version) ? parsed.version : 1,
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
        entitlements: Array.isArray(parsed.entitlements) ? parsed.entitlements : [],
        installs: Array.isArray(parsed.installs) ? parsed.installs : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    };
}

function summarizeMarketStore(store) {
    const assetsByStatus = {};
    const assetsByType = {};
    const reportsByStatus = {};

    for (const asset of store.assets) {
        const status = String(asset.status || 'unknown');
        const type = String(asset.type || 'unknown');
        assetsByStatus[status] = (assetsByStatus[status] || 0) + 1;
        assetsByType[type] = (assetsByType[type] || 0) + 1;
    }

    for (const report of store.reports) {
        const status = String(report.status || 'unknown');
        reportsByStatus[status] = (reportsByStatus[status] || 0) + 1;
    }

    return {
        asset_count: store.assets.length,
        entitlement_count: store.entitlements.length,
        install_count: store.installs.length,
        report_count: store.reports.length,
        assets_by_status: assetsByStatus,
        assets_by_type: assetsByType,
        reports_by_status: reportsByStatus,
    };
}

function compactObject(source, allowedKeys) {
    const output = {};

    for (const key of allowedKeys) {
        if (source[key] !== undefined) {
            output[key] = source[key];
        }
    }

    return output;
}

function compactMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }

    const output = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (LEDGER_METADATA_KEYS.has(key)) {
            output[key] = value;
        }
    }

    return output;
}

function createMarketSnapshot(store) {
    return {
        summary: summarizeMarketStore(store),
        assets: store.assets.map(asset => compactObject(asset, [
            'id',
            'creator_id',
            'type',
            'status',
            'price_type',
            'price_coins',
            'sales_count',
            'install_count',
            'created_at',
            'updated_at',
            'listed_at',
        ])),
        entitlements: store.entitlements.map(entitlement => compactObject(entitlement, [
            'id',
            'user_id',
            'asset_id',
            'source',
            'purchase_id',
            'ledger_entry_ids',
            'created_at',
            'revoked_at',
        ])),
        installs: store.installs.map(install => compactObject(install, [
            'id',
            'user_id',
            'asset_id',
            'installed_type',
            'created_at',
        ])),
        reports: store.reports.map(report => compactObject(report, [
            'id',
            'asset_id',
            'reporter_id',
            'status',
            'created_at',
            'resolved_at',
        ])),
    };
}

async function readWalletLedger(dataRoot) {
    const storageDir = path.join(dataRoot, STORAGE_DIRECTORY);
    if (!fs.existsSync(storageDir)) {
        return [];
    }

    await storage.init({
        dir: storageDir,
        ttl: false,
        expiredInterval: 0,
    });

    const entries = await storage.values(record => record.key.startsWith(LEDGER_KEY_PREFIX));
    return entries
        .filter(entry => entry
            && typeof entry.id === 'string'
            && typeof entry.userHandle === 'string'
            && WALLET_BUCKETS.has(entry.bucket)
            && Number.isSafeInteger(entry.amount))
        .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0) || String(a.id).localeCompare(String(b.id)));
}

function summarizeWalletLedger(ledger) {
    const balancesByHandle = {};
    const entriesByType = {};

    for (const entry of ledger) {
        const handle = String(entry.userHandle || 'unknown');
        const bucket = String(entry.bucket || 'unknown');
        const type = String(entry.type || 'unknown');
        const amount = Number.isSafeInteger(entry.amount) ? entry.amount : 0;

        balancesByHandle[handle] ??= {};
        balancesByHandle[handle][bucket] = (balancesByHandle[handle][bucket] || 0) + amount;
        entriesByType[type] = (entriesByType[type] || 0) + 1;
    }

    return {
        ledger_entry_count: ledger.length,
        balances_by_handle: balancesByHandle,
        entries_by_type: entriesByType,
    };
}

function createWalletSnapshot(ledger) {
    return {
        summary: summarizeWalletLedger(ledger),
        ledger: ledger.map(entry => {
            const output = compactObject(entry, [
                'id',
                'type',
                'userHandle',
                'actorHandle',
                'bucket',
                'amount',
                'createdAt',
            ]);
            const metadata = compactMetadata(entry.metadata);
            if (Object.keys(metadata).length > 0) {
                output.metadata = metadata;
            }
            return output;
        }),
    };
}

async function createSnapshot(options) {
    if (!options.dataRoot) {
        throw new Error('Missing required --dataRoot <path>');
    }

    const dataRoot = path.resolve(options.dataRoot);
    const market = readMarketStore(dataRoot);
    const walletLedger = await readWalletLedger(dataRoot);

    return {
        version: 1,
        exported_at: new Date().toISOString(),
        market: createMarketSnapshot(market),
        wallet: createWalletSnapshot(walletLedger),
    };
}

function isInsideDirectory(filePath, directoryPath) {
    const relativePath = path.relative(directoryPath, filePath);
    return relativePath === '' || (!!relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

async function run(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);

    if (options.help) {
        printUsage();
        return;
    }

    const snapshot = await createSnapshot(options);
    const output = `${JSON.stringify(snapshot, null, 4)}\n`;

    if (options.out) {
        const outPath = path.resolve(options.out);
        const dataRoot = path.resolve(options.dataRoot);
        if (isInsideDirectory(outPath, dataRoot)) {
            throw new Error('--out must point outside the data root to keep the export command read-only for user data');
        }
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, output, 'utf8');
        process.stdout.write(`Marketplace snapshot exported to ${outPath}\n`);
        return;
    }

    process.stdout.write(output);
}

run().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
