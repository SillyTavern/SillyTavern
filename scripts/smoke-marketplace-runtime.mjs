import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const startupTimeoutMs = Number(process.env.MARKETPLACE_SMOKE_TIMEOUT_MS ?? 90_000);
const requestTimeoutMs = Number(process.env.MARKETPLACE_SMOKE_REQUEST_TIMEOUT_MS ?? 5_000);

function appendLog(buffer, chunk) {
    const maxLength = 20_000;
    const next = buffer + chunk.toString();
    return next.length > maxLength ? next.slice(next.length - maxLength) : next;
}

async function findFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : null;

            server.close(() => {
                if (!port) {
                    reject(new Error('Could not allocate a marketplace smoke test port'));
                    return;
                }

                resolve(port);
            });
        });
    });
}

function waitForExit(child, timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return Promise.resolve(true);
    }

    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeoutMs);

        const onExit = () => {
            cleanup();
            resolve(true);
        };

        function cleanup() {
            clearTimeout(timeout);
            child.off('exit', onExit);
        }

        child.once('exit', onExit);
    });
}

async function stopServer(child) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    child.kill('SIGTERM');

    if (!(await waitForExit(child, 5_000))) {
        child.kill('SIGKILL');
        await waitForExit(child, 5_000);
    }
}

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                ...(options.body ? { 'content-type': 'application/json' } : {}),
                ...(options.headers ?? {}),
            },
        });
        const body = await response.text();
        return { response, body };
    } finally {
        clearTimeout(timeout);
    }
}

async function waitForHealth(baseUrl, child, getLogs) {
    const deadline = Date.now() + startupTimeoutMs;
    let lastError;

    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(`SillyTavern exited before health check passed.\n${getLogs()}`);
        }

        try {
            const { response, body } = await fetchWithTimeout(`${baseUrl}/api/health`);
            if (response.ok) {
                return JSON.parse(body);
            }

            lastError = new Error(`GET /api/health returned ${response.status}: ${body.slice(0, 500)}`);
        } catch (error) {
            lastError = error;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for /api/health. Last error: ${lastError?.message ?? 'unknown'}\n${getLogs()}`);
}

async function assertJsonEndpoint(url, label, assertPayload, options = {}) {
    const { response, body } = await fetchWithTimeout(url, options);
    if (!response.ok) {
        throw new Error(`${label} returned ${response.status}: ${body.slice(0, 500)}`);
    }

    let payload;
    try {
        payload = JSON.parse(body);
    } catch (error) {
        throw new Error(`${label} did not return valid JSON: ${error.message}`);
    }

    assertPayload(payload);
}

async function assertTextEndpoint(url, label, expectedText) {
    const { response, body } = await fetchWithTimeout(url);
    if (!response.ok) {
        throw new Error(`${label} returned ${response.status}: ${body.slice(0, 500)}`);
    }

    if (!body.includes(expectedText)) {
        throw new Error(`${label} did not contain expected text: ${expectedText}`);
    }
}

async function assertPathExists(filePath, label) {
    try {
        await access(filePath);
    } catch {
        throw new Error(`${label} did not create expected file: ${filePath}`);
    }
}

async function writeDemoMarketStore(dataRoot) {
    const timestamp = new Date().toISOString();
    const store = {
        version: 1,
        assets: [
            {
                id: 'smoke_asset_demo',
                creator_id: 'smoke-creator',
                type: 'world_book',
                title: 'Smoke Demo World',
                summary: 'Runtime smoke marketplace asset.',
                description: '',
                language: 'en',
                content_rating: 'general',
                price_type: 'free',
                price_coins: 0,
                tags: ['smoke'],
                metadata: {},
                normalized_payload: {
                    name: 'Smoke Demo World',
                    entries: {},
                },
                visibility: 'public',
                status: 'listed',
                sales_count: 0,
                install_count: 0,
                rating_avg: 0,
                rating_count: 0,
                created_at: timestamp,
                updated_at: timestamp,
                submitted_at: timestamp,
                approved_at: timestamp,
                listed_at: timestamp,
            },
            {
                id: 'smoke_asset_paid_world',
                creator_id: 'smoke-creator',
                type: 'world_book',
                title: 'Smoke Paid World',
                summary: 'Runtime smoke fixed-price marketplace asset.',
                description: '',
                language: 'en',
                content_rating: 'general',
                price_type: 'fixed_price',
                price_coins: 7,
                tags: ['smoke', 'paid'],
                metadata: {},
                normalized_payload: {
                    name: 'Smoke Paid World',
                    entries: {},
                },
                visibility: 'public',
                status: 'listed',
                sales_count: 0,
                install_count: 0,
                rating_avg: 0,
                rating_count: 0,
                created_at: timestamp,
                updated_at: timestamp,
                submitted_at: timestamp,
                approved_at: timestamp,
                listed_at: timestamp,
            },
        ],
        entitlements: [],
        installs: [],
        reports: [],
    };

    await mkdir(dataRoot, { recursive: true });
    await writeFile(path.join(dataRoot, 'market-assets.json'), JSON.stringify(store, null, 4), 'utf8');
}

async function run() {
    const port = await findFreePort();
    const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'sillytavern-marketplace-smoke-'));
    const configPath = path.join(tmpRoot, 'config.yaml');
    const dataRoot = path.join(tmpRoot, 'data');
    const baseUrl = `http://127.0.0.1:${port}`;

    let stdout = '';
    let stderr = '';
    let child;

    const getLogs = () => [
        '--- stdout ---',
        stdout.trim(),
        '--- stderr ---',
        stderr.trim(),
    ].join('\n');

    try {
        await writeDemoMarketStore(dataRoot);

        child = spawn(process.execPath, [
            'server.js',
            `--port=${port}`,
            '--listen=false',
            '--enableIPv4=true',
            '--enableIPv6=false',
            '--browserLaunchEnabled=false',
            '--ssl=false',
            '--heartbeatInterval=0',
            '--whitelist=false',
            '--basicAuthMode=false',
            '--disableCsrf',
            `--configPath=${configPath}`,
            `--dataRoot=${dataRoot}`,
        ], {
            cwd: rootDirectory,
            env: {
                ...process.env,
                NODE_ENV: process.env.NODE_ENV ?? 'test',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        child.stdout.on('data', chunk => {
            stdout = appendLog(stdout, chunk);
        });
        child.stderr.on('data', chunk => {
            stderr = appendLog(stderr, chunk);
        });

        const health = await waitForHealth(baseUrl, child, getLogs);
        if (health.ok !== true || health.status !== 'ok' || health.service !== 'sillytavern') {
            throw new Error(`Unexpected /api/health payload: ${JSON.stringify(health)}`);
        }
        console.log('runtime ok: /api/health');

        await assertJsonEndpoint(`${baseUrl}/manifest.json`, '/manifest.json', manifest => {
            if (manifest.display !== 'standalone' || manifest.start_url !== '/') {
                throw new Error(`Unexpected manifest payload: ${JSON.stringify(manifest)}`);
            }
        });
        console.log('runtime ok: /manifest.json');

        await assertTextEndpoint(`${baseUrl}/service-worker.js`, '/service-worker.js', 'sillytavern-shell');
        console.log('runtime ok: /service-worker.js');

        await assertJsonEndpoint(`${baseUrl}/api/wallet`, '/api/wallet', payload => {
            if (payload.handle !== 'default-user' || !payload.balance || typeof payload.balance.total !== 'number') {
                throw new Error(`Unexpected wallet payload: ${JSON.stringify(payload)}`);
            }
            for (const bucket of ['bonus', 'paid', 'earnings']) {
                if (typeof payload.balance.buckets?.[bucket] !== 'number') {
                    throw new Error(`Wallet payload missing ${bucket} bucket: ${JSON.stringify(payload)}`);
                }
            }
        });
        console.log('runtime ok: /api/wallet');

        await assertJsonEndpoint(`${baseUrl}/api/market/assets`, '/api/market/assets', payload => {
            if (!Array.isArray(payload.assets)) {
                throw new Error(`Unexpected market assets payload: ${JSON.stringify(payload)}`);
            }
            const demoAsset = payload.assets.find(asset => asset.id === 'smoke_asset_demo');
            if (!demoAsset || demoAsset.status !== 'listed' || demoAsset.price_type !== 'free') {
                throw new Error(`Seeded smoke asset missing from marketplace payload: ${JSON.stringify(payload)}`);
            }
            const paidAsset = payload.assets.find(asset => asset.id === 'smoke_asset_paid_world');
            if (!paidAsset || paidAsset.status !== 'listed' || paidAsset.price_type !== 'fixed_price' || paidAsset.price_coins !== 7) {
                throw new Error(`Seeded paid smoke asset missing from marketplace payload: ${JSON.stringify(payload)}`);
            }
        });
        console.log('runtime ok: /api/market/assets');

        await assertJsonEndpoint(`${baseUrl}/api/market/assets/smoke_asset_demo/purchase`, 'POST /api/market/assets/:id/purchase', payload => {
            if (payload.already_owned !== false || payload.entitlement?.source !== 'free' || payload.entitlement?.asset_id !== 'smoke_asset_demo') {
                throw new Error(`Unexpected marketplace purchase payload: ${JSON.stringify(payload)}`);
            }
        }, {
            method: 'POST',
            body: '{}',
        });
        console.log('runtime ok: POST /api/market/assets/:id/purchase');

        await assertJsonEndpoint(`${baseUrl}/api/wallet/grants/admin`, 'POST /api/wallet/grants/admin', payload => {
            if (payload.entry?.userHandle !== 'default-user' || payload.entry?.bucket !== 'paid' || payload.entry?.amount !== 7) {
                throw new Error(`Unexpected admin grant payload: ${JSON.stringify(payload)}`);
            }
            if (payload.balance?.buckets?.paid !== 7) {
                throw new Error(`Admin grant did not update paid balance: ${JSON.stringify(payload)}`);
            }
        }, {
            method: 'POST',
            body: JSON.stringify({
                targetHandle: 'default-user',
                amount: 7,
                bucket: 'paid',
                reason: 'Runtime smoke fixed-price purchase',
            }),
        });
        console.log('runtime ok: POST /api/wallet/grants/admin');

        await assertJsonEndpoint(`${baseUrl}/api/market/assets/smoke_asset_paid_world/purchase`, 'POST /api/market/assets/:id/purchase fixed_price', payload => {
            if (payload.already_owned !== false || payload.entitlement?.source !== 'purchase' || payload.entitlement?.asset_id !== 'smoke_asset_paid_world') {
                throw new Error(`Unexpected fixed-price purchase payload: ${JSON.stringify(payload)}`);
            }
            if (!payload.entitlement?.purchase_id || payload.purchase?.id !== payload.entitlement.purchase_id) {
                throw new Error(`Fixed-price purchase missing purchase id: ${JSON.stringify(payload)}`);
            }
            if (payload.purchase?.buyer_balance?.buckets?.paid !== 0) {
                throw new Error(`Fixed-price purchase did not debit buyer paid balance: ${JSON.stringify(payload)}`);
            }
            if (payload.purchase?.ledger_entries !== undefined || payload.purchase?.creator_balance !== undefined) {
                throw new Error(`Fixed-price purchase leaked internal ledger or creator balance: ${JSON.stringify(payload)}`);
            }
        }, {
            method: 'POST',
            body: '{}',
        });
        console.log('runtime ok: POST /api/market/assets/:id/purchase fixed_price');

        await assertJsonEndpoint(`${baseUrl}/api/wallet/ledger`, '/api/wallet/ledger buyer debits', payload => {
            if (payload.balance?.buckets?.paid !== 0) {
                throw new Error(`Buyer wallet paid balance was not debited: ${JSON.stringify(payload)}`);
            }
            const paidDebit = payload.ledger?.find(entry => entry.type === 'market_purchase_debit' && entry.metadata?.asset_id === 'smoke_asset_paid_world');
            if (!paidDebit || paidDebit.bucket !== 'paid' || paidDebit.amount !== -7) {
                throw new Error(`Buyer ledger missing fixed-price debit: ${JSON.stringify(payload)}`);
            }
        });
        console.log('runtime ok: /api/wallet/ledger buyer debits');

        await assertJsonEndpoint(`${baseUrl}/api/wallet/ledger?handle=smoke-creator`, '/api/wallet/ledger creator earnings', payload => {
            if (payload.handle !== 'smoke-creator' || payload.balance?.buckets?.earnings !== 7) {
                throw new Error(`Creator earnings balance missing: ${JSON.stringify(payload)}`);
            }
            const creatorEarning = payload.ledger?.find(entry => entry.type === 'market_creator_earning' && entry.metadata?.asset_id === 'smoke_asset_paid_world');
            if (!creatorEarning || creatorEarning.bucket !== 'earnings' || creatorEarning.amount !== 7) {
                throw new Error(`Creator ledger missing fixed-price earning: ${JSON.stringify(payload)}`);
            }
        });
        console.log('runtime ok: /api/wallet/ledger creator earnings');

        let installedPath = '';
        await assertJsonEndpoint(`${baseUrl}/api/market/assets/smoke_asset_demo/install`, 'POST /api/market/assets/:id/install', payload => {
            if (payload.installed?.type !== 'world_book' || payload.install?.asset_id !== 'smoke_asset_demo') {
                throw new Error(`Unexpected marketplace install payload: ${JSON.stringify(payload)}`);
            }
            if (!payload.installed?.path) {
                throw new Error(`Install payload missing local path: ${JSON.stringify(payload)}`);
            }
            installedPath = payload.installed.path;
        }, {
            method: 'POST',
            body: '{}',
        });
        await assertPathExists(path.join(dataRoot, 'default-user', installedPath), 'marketplace install');
        console.log('runtime ok: POST /api/market/assets/:id/install');

        let paidInstalledPath = '';
        await assertJsonEndpoint(`${baseUrl}/api/market/assets/smoke_asset_paid_world/install`, 'POST /api/market/assets/:id/install fixed_price', payload => {
            if (payload.installed?.type !== 'world_book' || payload.install?.asset_id !== 'smoke_asset_paid_world') {
                throw new Error(`Unexpected fixed-price install payload: ${JSON.stringify(payload)}`);
            }
            if (!payload.installed?.path) {
                throw new Error(`Fixed-price install payload missing local path: ${JSON.stringify(payload)}`);
            }
            paidInstalledPath = payload.installed.path;
        }, {
            method: 'POST',
            body: '{}',
        });
        await assertPathExists(path.join(dataRoot, 'default-user', paidInstalledPath), 'fixed-price marketplace install');
        console.log('runtime ok: POST /api/market/assets/:id/install fixed_price');

        await assertJsonEndpoint(`${baseUrl}/api/market/library`, '/api/market/library', payload => {
            if (!Array.isArray(payload.items)) {
                throw new Error(`Unexpected library payload: ${JSON.stringify(payload)}`);
            }
            const demoItem = payload.items.find(item => item.asset?.id === 'smoke_asset_demo');
            if (!demoItem || demoItem.entitlement?.source !== 'free' || demoItem.install_count !== 1) {
                throw new Error(`Installed smoke asset missing from library payload: ${JSON.stringify(payload)}`);
            }
            const paidItem = payload.items.find(item => item.asset?.id === 'smoke_asset_paid_world');
            if (!paidItem || paidItem.entitlement?.source !== 'purchase' || paidItem.install_count !== 1 || paidItem.asset?.price_type !== 'fixed_price') {
                throw new Error(`Installed paid smoke asset missing from library payload: ${JSON.stringify(payload)}`);
            }
        });
        console.log('runtime ok: /api/market/library');
    } finally {
        if (child) {
            await stopServer(child);
        }
        await rm(tmpRoot, { recursive: true, force: true });
    }
}

run().catch(error => {
    console.error(error);
    process.exit(1);
});
