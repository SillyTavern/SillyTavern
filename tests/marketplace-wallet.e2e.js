import { test, expect } from '@playwright/test';

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

async function mockMarketplaceApis(page, { assets = [makeListedAsset(), makeSubmittedAsset()], reports = [], library = [] } = {}) {
    const apiCalls = {
        approve: [],
        grants: [],
        installs: [],
        purchases: [],
        resolveReports: [],
    };

    await page.route('**/api/wallet', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(makeWallet()),
        });
    });

    await page.route('**/api/market/assets', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ assets }),
        });
    });

    await page.route('**/api/market/creator/summary', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                handle: 'default-user',
                stats: {
                    total_assets: 0,
                    listed_assets: 0,
                    total_claims: 0,
                    gross_revenue_coins: 0,
                },
                assets: [],
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
        apiCalls.purchases.push(assetId);
        assets = assets.map(item => item.id === assetId
            ? { ...item, entitled: true, sales_count: Number(item.sales_count || 0) + 1 }
            : item);
        if (asset && !library.some(item => item.asset.id === assetId)) {
            library = [makeLibraryItem({ ...asset, entitled: true }), ...library];
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
                    purchase_id: asset?.price_type === 'free' ? null : `market:${assetId}:default-user:v1`,
                    created_at: '2026-06-26T12:45:00.000Z',
                    revoked_at: null,
                },
                already_owned: false,
                purchase: null,
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
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                handle: payload.targetHandle,
                balance: makeWallet({
                    handle: payload.targetHandle,
                    balance: {
                        total: payload.amount,
                        buckets: {
                            bonus: payload.bucket === 'bonus' ? payload.amount : 0,
                            paid: payload.bucket === 'paid' ? payload.amount : 0,
                            earnings: payload.bucket === 'earnings' ? payload.amount : 0,
                        },
                    },
                }).balance,
            }),
        });
    });

    return apiCalls;
}

async function loadSillyTavern(page) {
    await page.goto('/');
    await page.waitForFunction('document.getElementById("preloader") === null', { timeout: 0 });
    await expect(page.locator('#marketplace_wallet_ui')).toBeAttached({ timeout: 30_000 });
}

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
