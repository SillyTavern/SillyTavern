import { test, expect } from '@playwright/test';

const SHELL_CACHE_NAME = 'sillytavern-shell-v1';

function makeWallet(overrides = {}) {
    return {
        handle: 'default-user',
        balance: {
            total: 175,
            buckets: {
                bonus: 100,
                paid: 50,
                earnings: 25,
            },
        },
        ...overrides,
    };
}

function makeSubmittedAsset(overrides = {}) {
    return {
        id: 'submitted-character',
        type: 'character_card',
        title: 'Submitted Character',
        summary: 'Awaiting review.',
        creator_id: 'creator-handle',
        status: 'submitted',
        owned: false,
        price_type: 'fixed_price',
        price_coins: 25,
        sales_count: 0,
        updated_at: '2026-06-26T10:00:00.000Z',
        ...overrides,
    };
}

function makeListedAsset(overrides = {}) {
    return {
        id: 'listed-world',
        type: 'world_book',
        title: 'Listed World',
        summary: 'Ready to install.',
        creator_id: 'creator-handle',
        status: 'listed',
        owned: false,
        price_type: 'fixed_price',
        price_coins: 125,
        sales_count: 3,
        listed_at: '2026-06-26T11:00:00.000Z',
        updated_at: '2026-06-26T11:00:00.000Z',
        ...overrides,
    };
}

function makeOpenReport(overrides = {}) {
    return {
        id: 'report-listed-world',
        asset_id: 'listed-world',
        reporter_id: 'reporter-handle',
        reason: 'unsafe_prompt',
        body: 'This world needs a moderation pass.',
        status: 'open',
        created_at: '2026-06-26T12:30:00.000Z',
        asset: makeListedAsset(),
        ...overrides,
    };
}

function makeLibraryItem(asset, overrides = {}) {
    return {
        entitlement: {
            id: `ent-${asset.id}`,
            source: asset.price_type === 'free' ? 'free' : 'purchase',
            purchase_id: asset.price_type === 'free' ? null : `market:${asset.id}:default-user:v1`,
            created_at: '2026-06-26T12:45:00.000Z',
        },
        asset: {
            ...asset,
            entitled: true,
        },
        install_count: 0,
        last_install: null,
        ...overrides,
    };
}

function makeCurrentUser(overrides = {}) {
    return {
        handle: 'default-user',
        name: 'User',
        avatar: '/img/default-user.png',
        admin: true,
        password: false,
        enabled: true,
        created: 0,
        ...overrides,
    };
}

async function mockMarketplaceApis(page, { assets = [makeListedAsset(), makeSubmittedAsset()], reports = [], library = [] } = {}) {
    let wallet = makeWallet();
    let ledger = [];
    const apiCalls = {
        approve: [],
        creates: [],
        details: [],
        grants: [],
        installs: [],
        purchases: [],
        revisions: [],
        resolveReports: [],
        submits: [],
    };

    await page.route('**/api/users/me', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(makeCurrentUser()),
        });
    });

    await page.route('**/api/wallet', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(wallet),
        });
    });

    await page.route('**/api/wallet/ledger', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                handle: wallet.handle,
                ledger,
                balance: wallet.balance,
            }),
        });
    });

    await page.route('**/api/market/assets', route => {
        if (route.request().method() !== 'GET') {
            route.fallback();
            return;
        }

        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ assets }),
        });
    });

    await page.route('**/api/market/creator/summary', route => {
        const ownAssets = assets.filter(asset => asset.creator_id === 'default-user');
        const listedAssets = ownAssets.filter(asset => asset.status === 'listed');
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                handle: 'default-user',
                stats: {
                    total_assets: ownAssets.length,
                    listed_assets: listedAssets.length,
                    total_claims: ownAssets.reduce((sum, asset) => sum + Number(asset.sales_count || 0), 0),
                    gross_revenue_coins: 0,
                },
                assets: ownAssets,
            }),
        });
    });

    await page.route('**/api/market/library', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: library }),
        });
    });

    await page.route('**/api/market/assets', async route => {
        if (route.request().method() !== 'POST') {
            route.fallback();
            return;
        }

        const payload = JSON.parse(route.request().postData() || '{}');
        apiCalls.creates.push(payload);
        const createdAsset = {
            id: `created-${apiCalls.creates.length}`,
            creator_id: 'default-user',
            type: payload.type,
            title: payload.title,
            summary: payload.summary,
            language: 'en',
            tags: [],
            status: 'draft',
            owned: true,
            entitled: false,
            price_type: payload.price_type,
            price_coins: payload.price_coins,
            sales_count: 0,
            install_count: 0,
            normalized_payload: payload.normalized_payload,
            created_at: '2026-06-26T13:00:00.000Z',
            updated_at: '2026-06-26T13:00:00.000Z',
        };
        assets = [createdAsset, ...assets];
        route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ asset: createdAsset }),
        });
    });

    await page.route('**/api/market/assets/*', async route => {
        const method = route.request().method();
        if (!['GET', 'PATCH'].includes(method)) {
            route.fallback();
            return;
        }

        const assetId = route.request().url().split('/').at(-1);
        const existingAsset = assets.find(asset => asset.id === assetId);
        if (!existingAsset) {
            route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'not found' }),
            });
            return;
        }

        if (method === 'GET') {
            apiCalls.details.push(assetId);
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    asset: {
                        ...existingAsset,
                        payload_available: true,
                    },
                    entitlement: null,
                }),
            });
            return;
        }

        const payload = JSON.parse(route.request().postData() || '{}');
        apiCalls.revisions.push({ assetId, payload });
        let revisedAsset = null;
        assets = assets.map(asset => {
            if (asset.id !== assetId) {
                return asset;
            }
            revisedAsset = {
                ...asset,
                ...payload,
                status: 'draft',
                owned: true,
                updated_at: '2026-06-26T13:02:00.000Z',
                submitted_at: null,
                normalized_payload: payload.normalized_payload,
            };
            return revisedAsset;
        });
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ asset: revisedAsset }),
        });
    });

    await page.route('**/api/market/assets/*/submit', route => {
        const assetId = route.request().url().split('/').at(-2);
        apiCalls.submits.push(assetId);
        let submittedAsset = null;
        assets = assets.map(asset => {
            if (asset.id !== assetId) {
                return asset;
            }
            submittedAsset = {
                ...asset,
                status: 'submitted',
                updated_at: '2026-06-26T13:01:00.000Z',
                submitted_at: '2026-06-26T13:01:00.000Z',
            };
            return submittedAsset;
        });
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ asset: submittedAsset }),
        });
    });

    await page.route('**/api/market/assets/*/approve', route => {
        const assetId = route.request().url().split('/').at(-2);
        apiCalls.approve.push(assetId);
        assets = assets.map(asset => asset.id === assetId
            ? { ...asset, status: 'listed', listed_at: '2026-06-26T12:00:00.000Z' }
            : asset);
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ asset: assets.find(asset => asset.id === assetId) }),
        });
    });

    await page.route('**/api/market/assets/*/purchase', route => {
        const assetId = route.request().url().split('/').at(-2);
        const asset = assets.find(item => item.id === assetId);
        const purchaseId = asset?.price_type === 'free' ? null : `market:${assetId}:default-user:v1`;
        apiCalls.purchases.push(assetId);
        assets = assets.map(item => item.id === assetId
            ? { ...item, entitled: true, sales_count: Number(item.sales_count || 0) + 1 }
            : item);
        if (asset && !library.some(item => item.asset.id === assetId)) {
            library = [makeLibraryItem({ ...asset, entitled: true }), ...library];
        }
        let purchase = null;
        if (asset?.price_type === 'fixed_price') {
            const price = Number(asset.price_coins || 0);
            const bonusDebit = Math.min(wallet.balance.buckets.bonus, price);
            const paidDebit = price - bonusDebit;
            wallet = makeWallet({
                balance: {
                    buckets: {
                        bonus: wallet.balance.buckets.bonus - bonusDebit,
                        paid: wallet.balance.buckets.paid - paidDebit,
                        earnings: wallet.balance.buckets.earnings,
                    },
                },
            });
            wallet.balance.total = wallet.balance.buckets.bonus + wallet.balance.buckets.paid + wallet.balance.buckets.earnings;
            ledger = [
                ...ledger,
                ...(bonusDebit > 0
                    ? [{
                        id: `ledger-${assetId}-bonus`,
                        type: 'market_purchase_debit',
                        userHandle: 'default-user',
                        actorHandle: 'default-user',
                        bucket: 'bonus',
                        amount: -bonusDebit,
                        reason: `Market purchase: ${asset.title}`,
                        createdAt: Date.now(),
                        metadata: {
                            purchase_id: purchaseId,
                            asset_id: assetId,
                            price_coins: price,
                        },
                    }]
                    : []),
                ...(paidDebit > 0
                    ? [{
                        id: `ledger-${assetId}-paid`,
                        type: 'market_purchase_debit',
                        userHandle: 'default-user',
                        actorHandle: 'default-user',
                        bucket: 'paid',
                        amount: -paidDebit,
                        reason: `Market purchase: ${asset.title}`,
                        createdAt: Date.now() + 1,
                        metadata: {
                            purchase_id: purchaseId,
                            asset_id: assetId,
                            price_coins: price,
                        },
                    }]
                    : []),
            ];
            purchase = {
                id: purchaseId,
                buyer_balance: wallet.balance,
            };
        }
        route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                entitlement: {
                    id: `ent-${assetId}`,
                    user_id: 'default-user',
                    asset_id: assetId,
                    source: asset?.price_type === 'free' ? 'free' : 'purchase',
                    purchase_id: purchaseId,
                    created_at: '2026-06-26T12:45:00.000Z',
                    revoked_at: null,
                },
                already_owned: false,
                purchase,
            }),
        });
    });

    await page.route('**/api/market/assets/*/install', route => {
        const assetId = route.request().url().split('/').at(-2);
        const asset = assets.find(item => item.id === assetId) || library.find(item => item.asset.id === assetId)?.asset;
        apiCalls.installs.push(assetId);
        library = library.map(item => item.asset.id === assetId
            ? {
                ...item,
                install_count: Number(item.install_count || 0) + 1,
                last_install: {
                    type: asset?.type || 'world_book',
                    local_ref: `worlds/${assetId}.json`,
                    created_at: '2026-06-26T12:46:00.000Z',
                },
            }
            : item);
        assets = assets.map(item => item.id === assetId
            ? { ...item, entitled: true, install_count: Number(item.install_count || 0) + 1 }
            : item);
        route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                installed: {
                    type: asset?.type || 'world_book',
                    name: asset?.title || 'Market asset',
                    path: `worlds/${assetId}.json`,
                },
                install: {
                    id: `install-${assetId}`,
                    user_id: 'default-user',
                    asset_id: assetId,
                    installed_type: asset?.type || 'world_book',
                    local_ref: `worlds/${assetId}.json`,
                    created_at: '2026-06-26T12:46:00.000Z',
                },
            }),
        });
    });

    await page.route('**/api/market/reports/admin', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ reports }),
        });
    });

    await page.route('**/api/market/reports/*/resolve', route => {
        const reportId = route.request().url().split('/').at(-2);
        apiCalls.resolveReports.push(reportId);
        reports = reports.filter(report => report.id !== reportId);
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ report: { id: reportId, status: 'resolved' } }),
        });
    });

    await page.route('**/api/wallet/grants/admin', async route => {
        const payload = JSON.parse(route.request().postData() || '{}');
        apiCalls.grants.push(payload);
        if (payload.targetHandle === wallet.handle) {
            wallet = makeWallet({
                balance: {
                    buckets: {
                        ...wallet.balance.buckets,
                        [payload.bucket]: Number(wallet.balance.buckets[payload.bucket] || 0) + Number(payload.amount || 0),
                    },
                },
            });
            wallet.balance.total = wallet.balance.buckets.bonus + wallet.balance.buckets.paid + wallet.balance.buckets.earnings;
            ledger = [
                ...ledger,
                {
                    id: `ledger-grant-${ledger.length + 1}`,
                    type: 'admin_grant',
                    userHandle: wallet.handle,
                    actorHandle: wallet.handle,
                    bucket: payload.bucket,
                    amount: Number(payload.amount || 0),
                    reason: payload.reason || 'Admin grant',
                    createdAt: Date.now(),
                    metadata: {
                        source: 'wallet.grants.admin',
                    },
                },
            ];
        }
        route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                handle: payload.targetHandle,
                balance: wallet.balance,
            }),
        });
    });

    return apiCalls;
}

async function loadSillyTavern(page) {
    await page.goto('/');
    await page.waitForFunction('document.getElementById("preloader") === null', { timeout: 0 });

    const onboardingDialog = page.getByRole('dialog').filter({ hasText: 'Welcome to SillyTavern!' });
    const hasOnboarding = await onboardingDialog.waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
    if (hasOnboarding) {
        await onboardingDialog.locator('.popup-button-ok').click();
        await expect(onboardingDialog).toBeHidden();
    }

    const extensionsDrawer = page.locator('#extensions-settings-button');
    const extensionsContent = extensionsDrawer.locator('#rm_extensions_block');
    if (!(await extensionsContent.evaluate(element => element.classList.contains('openDrawer')))) {
        await extensionsDrawer.locator('.drawer-toggle').click();
    }
    await expect(extensionsContent).toHaveClass(/openDrawer/);

    const walletUi = page.locator('#marketplace_wallet_ui');
    await expect(walletUi).toBeAttached({ timeout: 30_000 });

    const drawerContent = walletUi.locator('.inline-drawer-content');
    if (!(await drawerContent.isVisible())) {
        await walletUi.locator('.inline-drawer-toggle').click();
    }
    await expect(drawerContent).toBeVisible();
    await expect(walletUi.locator('#marketplace_wallet_total')).toHaveText('175');
}

async function resetPwaState(page) {
    await page.evaluate(async () => {
        await Promise.all((await caches.keys()).map(cacheName => caches.delete(cacheName)));

        if ('serviceWorker' in navigator) {
            await Promise.all((await navigator.serviceWorker.getRegistrations()).map(registration => registration.unregister()));
        }
    });
}

test.describe('hosted tavern PWA browser shell', () => {
    test.describe.configure({ mode: 'serial' });

    test.afterEach(async ({ page }) => {
        await resetPwaState(page).catch(() => {});
    });

    test('registers the service worker shell cache and leaves API responses uncached', async ({ page }) => {
        await page.goto('/login.html', { waitUntil: 'load' });
        await resetPwaState(page);
        await page.reload({ waitUntil: 'load' });

        await expect.poll(() => page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) {
                return '';
            }

            const readyRegistration = await navigator.serviceWorker.ready;
            return readyRegistration.active?.state || '';
        })).toBe('activated');

        const registration = await page.evaluate(async () => {
            const readyRegistration = await navigator.serviceWorker.ready;
            return {
                origin: location.origin,
                scope: readyRegistration.scope,
                activeScript: readyRegistration.active?.scriptURL || '',
                state: readyRegistration.active?.state || '',
            };
        });
        expect(registration).toMatchObject({
            scope: `${registration.origin}/`,
            state: 'activated',
        });
        expect(registration.activeScript).toContain('/service-worker.js');

        await page.reload({ waitUntil: 'load' });
        await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller?.scriptURL.includes('/service-worker.js')))).toBe(true);

        const shellCache = await page.evaluate(async cacheName => {
            const cacheNames = await caches.keys();
            const cache = await caches.open(cacheName);
            const shellPaths = ['/', '/login.html', '/manifest.json', '/style.css', '/scripts/pwa.js'];
            const cachedShell = Object.fromEntries(await Promise.all(shellPaths.map(async shellPath => [
                shellPath,
                Boolean(await cache.match(shellPath)),
            ])));
            return { cacheNames, cachedShell };
        }, SHELL_CACHE_NAME);
        expect(shellCache.cacheNames).toContain(SHELL_CACHE_NAME);
        expect(shellCache.cachedShell).toEqual({
            '/': true,
            '/login.html': true,
            '/manifest.json': true,
            '/style.css': true,
            '/scripts/pwa.js': true,
        });

        const health = await page.evaluate(async () => {
            const response = await fetch('/api/health', { cache: 'no-store' });
            return {
                status: response.status,
                body: await response.json(),
            };
        });
        expect(health).toMatchObject({
            status: 200,
            body: {
                ok: true,
                status: 'ok',
            },
        });

        const apiCached = await page.evaluate(async () => Boolean(await caches.match('/api/health')));
        expect(apiCached).toBe(false);
    });
});

test.describe('marketplace wallet extension', () => {
    test('renders admin review queue and posts approve/grant actions', async ({ page }) => {
        const apiCalls = await mockMarketplaceApis(page);

        await loadSillyTavern(page);

        const admin = page.locator('#marketplace_wallet_admin');
        await expect(admin).toBeVisible();
        await expect(page.locator('#marketplace_wallet_total')).toHaveText('175');
        await expect(page.locator('[data-marketplace-wallet-bucket="bonus"]')).toHaveText('100');
        await expect(page.locator('[data-marketplace-wallet-bucket="paid"]')).toHaveText('50');
        await expect(page.locator('[data-marketplace-wallet-bucket="earnings"]')).toHaveText('25');

        await expect(page.locator('#marketplace_wallet_review_queue')).toContainText('Submitted Character');
        await expect(page.locator('#marketplace_wallet_review_queue [data-marketplace-wallet-action="approve"]')).toHaveCount(1);
        await expect(page.locator('#marketplace_wallet_assets [data-marketplace-wallet-action="approve"]')).toHaveCount(0);

        await page.locator('#marketplace_wallet_review_queue [data-marketplace-wallet-action="approve"]').click();
        await expect.poll(() => apiCalls.approve).toEqual(['submitted-character']);
        await expect(page.locator('#marketplace_wallet_review_queue')).toContainText('No assets awaiting review.');

        await page.locator('#marketplace_wallet_grant_handle').fill('target-user');
        await page.locator('#marketplace_wallet_grant_amount').fill('42');
        await page.locator('#marketplace_wallet_grant_bucket').selectOption('paid');
        await page.locator('#marketplace_wallet_grant_reason').fill('');
        await page.locator('#marketplace_wallet_grant_submit').click();

        await expect.poll(() => apiCalls.grants).toEqual([{
            targetHandle: 'target-user',
            amount: 42,
            bucket: 'paid',
            reason: 'Admin grant',
        }]);
    });

    test('resolves reports from the admin report queue', async ({ page }) => {
        const apiCalls = await mockMarketplaceApis(page, {
            assets: [makeListedAsset()],
            reports: [makeOpenReport()],
        });

        await loadSillyTavern(page);

        const reportQueue = page.locator('#marketplace_wallet_report_queue');
        await expect(reportQueue).toContainText('Listed World');
        await expect(reportQueue).toContainText('unsafe_prompt');

        await reportQueue.locator('[data-marketplace-wallet-report-action="resolve"]').click();

        await expect.poll(() => apiCalls.resolveReports).toEqual(['report-listed-world']);
        await expect(reportQueue).toContainText('No reports queued.');
    });

    test('claims and installs a free asset into the library', async ({ page }) => {
        const freeAsset = makeListedAsset({
            id: 'free-world',
            title: 'Free World',
            price_type: 'free',
            price_coins: 0,
            sales_count: 0,
        });
        const apiCalls = await mockMarketplaceApis(page, {
            assets: [freeAsset],
        });

        await loadSillyTavern(page);

        const assetRow = page.locator('#marketplace_wallet_assets article', { hasText: 'Free World' });
        await expect(assetRow).toContainText('Free');
        await assetRow.locator('[data-marketplace-wallet-action="purchase"]').click();

        await expect.poll(() => apiCalls.purchases).toEqual(['free-world']);
        await expect.poll(() => apiCalls.installs).toEqual(['free-world']);

        const library = page.locator('#marketplace_wallet_library_items');
        await expect(library).toContainText('Free World');
        await expect(library).toContainText('Claimed');
        await expect(library).toContainText('1 installs');
    });

    test('buys a fixed-price asset, refreshes wallet activity, and installs it', async ({ page }) => {
        const paidAsset = makeListedAsset({
            id: 'paid-world',
            title: 'Paid World',
            price_type: 'fixed_price',
            price_coins: 125,
            sales_count: 0,
        });
        const apiCalls = await mockMarketplaceApis(page, {
            assets: [paidAsset],
        });

        await loadSillyTavern(page);

        const assetRow = page.locator('#marketplace_wallet_assets article', { hasText: 'Paid World' });
        await expect(assetRow).toContainText('125 coins');
        await assetRow.locator('[data-marketplace-wallet-action="purchase"]').click();

        await expect.poll(() => apiCalls.purchases).toEqual(['paid-world']);
        await expect.poll(() => apiCalls.installs).toEqual(['paid-world']);

        await expect(page.locator('#marketplace_wallet_total')).toHaveText('50');
        await expect(page.locator('[data-marketplace-wallet-bucket="bonus"]')).toHaveText('0');
        await expect(page.locator('[data-marketplace-wallet-bucket="paid"]')).toHaveText('25');
        await expect(page.locator('[data-marketplace-wallet-bucket="earnings"]')).toHaveText('25');

        const walletActivity = page.locator('#marketplace_wallet_ledger_items');
        await expect(walletActivity).toContainText('Purchase');
        await expect(walletActivity).toContainText('-100');
        await expect(walletActivity).toContainText('-25');

        const library = page.locator('#marketplace_wallet_library_items');
        await expect(library).toContainText('Paid World');
        await expect(library).toContainText('Purchased');
        await expect(library).toContainText('1 installs');
    });

    test('submits a world book upload into the review queue and creator center', async ({ page }) => {
        const apiCalls = await mockMarketplaceApis(page, {
            assets: [],
        });

        await loadSillyTavern(page);

        await page.locator('#marketplace_wallet_upload_type').selectOption('world_book');
        await page.locator('#marketplace_wallet_upload_title').fill('Creator Browser World');
        await page.locator('#marketplace_wallet_upload_summary').fill('Submitted from the browser E2E flow.');
        await page.locator('#marketplace_wallet_upload_price_type').selectOption('free');
        await page.locator('#marketplace_wallet_upload_payload').fill(JSON.stringify({
            name: 'Creator Browser World',
            entries: {
                '0': {
                    uid: 0,
                    key: ['browser-e2e'],
                    content: 'This lore entry came from the browser upload flow.',
                },
            },
        }, null, 2));
        await page.locator('[data-marketplace-wallet-upload="review"]').click();

        await expect.poll(() => apiCalls.creates).toHaveLength(1);
        expect(apiCalls.creates[0]).toMatchObject({
            type: 'world_book',
            title: 'Creator Browser World',
            summary: 'Submitted from the browser E2E flow.',
            price_type: 'free',
            price_coins: 0,
            normalized_payload: {
                name: 'Creator Browser World',
            },
        });
        await expect.poll(() => apiCalls.submits).toEqual(['created-1']);

        const reviewQueue = page.locator('#marketplace_wallet_review_queue');
        await expect(reviewQueue).toContainText('Creator Browser World');
        await expect(reviewQueue.locator('[data-marketplace-wallet-action="approve"]')).toHaveCount(1);

        await expect(page.locator('#marketplace_wallet_creator_assets')).toHaveText('1');
        await expect(page.locator('#marketplace_wallet_creator_assets_list')).toContainText('Creator Browser World');
        await expect(page.locator('#marketplace_wallet_creator_assets_list')).toContainText('submitted');
        await expect(page.locator('#marketplace_wallet_upload_title')).toHaveValue('');
        await expect(page.locator('#marketplace_wallet_upload_payload')).toHaveValue('');
    });

    test('revises a rejected creator asset and resubmits it for review', async ({ page }) => {
        const rejectedAsset = makeSubmittedAsset({
            id: 'rejected-world',
            type: 'world_book',
            title: 'Rejected Browser World',
            summary: 'Needs a cleaner lore entry.',
            creator_id: 'default-user',
            status: 'rejected',
            owned: true,
            price_type: 'free',
            price_coins: 0,
            normalized_payload: {
                name: 'Rejected Browser World',
                entries: {
                    old: {
                        key: ['old'],
                        content: 'Old rejected lore entry.',
                    },
                },
            },
        });
        const apiCalls = await mockMarketplaceApis(page, {
            assets: [rejectedAsset],
        });

        await loadSillyTavern(page);

        const assetRow = page.locator('#marketplace_wallet_assets article', { hasText: 'Rejected Browser World' });
        await expect(assetRow).toContainText('rejected');
        await assetRow.locator('[data-marketplace-wallet-action="revise"]').click();

        await expect.poll(() => apiCalls.details).toEqual(['rejected-world']);
        await expect(page.locator('#marketplace_wallet_upload_status')).toBeVisible();
        await expect(page.locator('#marketplace_wallet_upload_mode')).toHaveText('Editing Rejected Browser World');
        await expect(page.locator('#marketplace_wallet_upload_title')).toHaveValue('Rejected Browser World');
        await expect(page.locator('#marketplace_wallet_upload_summary')).toHaveValue('Needs a cleaner lore entry.');
        await expect(page.locator('#marketplace_wallet_upload_payload')).toHaveValue(/Old rejected lore entry\./);

        await page.locator('#marketplace_wallet_upload_title').fill('Revised Browser World');
        await page.locator('#marketplace_wallet_upload_summary').fill('Ready for a second review.');
        await page.locator('#marketplace_wallet_upload_payload').fill(JSON.stringify({
            name: 'Revised Browser World',
            entries: {
                revised: {
                    key: ['revised'],
                    content: 'This lore entry was revised in the browser E2E flow.',
                },
            },
        }, null, 2));
        await page.locator('[data-marketplace-wallet-upload="review"]').click();

        await expect.poll(() => apiCalls.revisions).toHaveLength(1);
        expect(apiCalls.revisions[0]).toMatchObject({
            assetId: 'rejected-world',
            payload: {
                type: 'world_book',
                title: 'Revised Browser World',
                summary: 'Ready for a second review.',
                price_type: 'free',
                price_coins: 0,
                normalized_payload: {
                    name: 'Revised Browser World',
                },
            },
        });
        await expect.poll(() => apiCalls.submits).toEqual(['rejected-world']);

        const reviewQueue = page.locator('#marketplace_wallet_review_queue');
        await expect(reviewQueue).toContainText('Revised Browser World');
        await expect(reviewQueue.locator('[data-marketplace-wallet-action="approve"]')).toHaveCount(1);

        await expect(page.locator('#marketplace_wallet_creator_assets')).toHaveText('1');
        await expect(page.locator('#marketplace_wallet_creator_assets_list')).toContainText('Revised Browser World');
        await expect(page.locator('#marketplace_wallet_creator_assets_list')).toContainText('submitted');
        await expect(page.locator('#marketplace_wallet_upload_mode')).toHaveText('');
        await expect(page.locator('#marketplace_wallet_upload_title')).toHaveValue('');
        await expect(page.locator('#marketplace_wallet_upload_payload')).toHaveValue('');
    });

    test('keeps review controls compact on mobile width', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await mockMarketplaceApis(page, { assets: [makeSubmittedAsset()] });

        await loadSillyTavern(page);

        const layout = await page.locator('#marketplace_wallet_ui').evaluate(element => {
            const adminGrid = element.querySelector('.marketplace-wallet-admin-grid');
            const grantGrid = element.querySelector('.marketplace-wallet-grant');
            const reviewItem = element.querySelector('.marketplace-wallet-review-item');
            const reviewActions = element.querySelector('.marketplace-wallet-review-actions');
            const viewportWidth = document.documentElement.clientWidth;
            const overflowing = [...element.querySelectorAll('*')]
                .filter(child => {
                    const rect = child.getBoundingClientRect();
                    return rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
                })
                .map(child => ({
                    tag: child.tagName,
                    id: child.id,
                    className: String(child.className),
                }));

            return {
                adminColumns: getComputedStyle(adminGrid).gridTemplateColumns.split(' ').length,
                grantColumns: getComputedStyle(grantGrid).gridTemplateColumns.split(' ').length,
                reviewItemColumns: getComputedStyle(reviewItem).gridTemplateColumns.split(' ').length,
                reviewActionColumns: getComputedStyle(reviewActions).gridTemplateColumns.split(' ').length,
                overflowing,
            };
        });

        expect(layout).toMatchObject({
            adminColumns: 1,
            grantColumns: 1,
            reviewItemColumns: 1,
            reviewActionColumns: 2,
            overflowing: [],
        });
    });
});
