import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, test, expect } from '@jest/globals';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const extensionDir = path.join(rootDir, 'public/scripts/extensions/marketplace-wallet');

function readExtensionFile(fileName) {
    return fs.readFileSync(path.join(extensionDir, fileName), 'utf8');
}

describe('marketplace wallet extension UI contract', () => {
    test('uses versioned manifest assets to avoid stale extension modules', () => {
        const manifest = JSON.parse(readExtensionFile('manifest.json'));

        expect(manifest.version).toBe('0.2.0');
        expect(manifest.js).toBe(`index.js?v=${manifest.version}`);
        expect(manifest.css).toBe(`style.css?v=${manifest.version}`);
        expect(manifest.hooks.activate).toBe('init');
    });

    test('defines the admin grant form and review queue surface', () => {
        const html = readExtensionFile('window.html');

        expect(html).toContain('id="marketplace_wallet_creator_assets"');
        expect(html).toContain('id="marketplace_wallet_creator_listed"');
        expect(html).toContain('id="marketplace_wallet_creator_sales"');
        expect(html).toContain('id="marketplace_wallet_creator_earnings"');
        expect(html).toContain('id="marketplace_wallet_creator_assets_list"');
        expect(html).toContain('claims</span>');
        expect(html).toContain('earned</span>');
        expect(html).toContain('id="marketplace_wallet_admin"');
        expect(html).toContain('hidden>');
        expect(html).toContain('id="marketplace_wallet_grant_handle"');
        expect(html).toContain('id="marketplace_wallet_grant_amount"');
        expect(html).toContain('id="marketplace_wallet_grant_bucket"');
        expect(html).toContain('<option value="bonus">bonus</option>');
        expect(html).toContain('<option value="paid">paid</option>');
        expect(html).toContain('<option value="earnings">earnings</option>');
        expect(html).toContain('id="marketplace_wallet_grant_reason"');
        expect(html).toContain('id="marketplace_wallet_review_queue"');
        expect(html).toContain('id="marketplace_wallet_report_queue"');
        expect(html).toContain('Report Queue');
    });

    test('gates admin visibility with isAdmin and explicit hidden attribute handling', () => {
        const script = readExtensionFile('index.js');

        expect(script).toContain('function canUseAdminTools()');
        expect(script).toContain('return isAdmin();');
        expect(script).not.toContain("state.wallet?.handle === 'default-user'");
        expect(script).toContain("$admin.removeAttr('hidden')");
        expect(script).toContain("$admin.attr('hidden', '')");
    });

    test('posts approve/reject actions from the review queue and validates admin grants', () => {
        const script = readExtensionFile('index.js');

        expect(script).toContain("fetchJson('/api/market/creator/summary')");
        expect(script).toContain('async function loadCreatorSummary()');
        expect(script).toContain("console.warn('Creator summary could not be loaded'");
        expect(script).toContain('function renderCreatorSummary()');
        expect(script).toContain('stats.total_claims');
        expect(script).toContain('stats.gross_revenue_coins');
        expect(script).toContain("$('#marketplace_wallet_creator_earnings')");
        expect(script).toContain("`${formatCoins(asset.sales_count)} claims`");
        expect(script).toContain("`${formatCoins(asset.install_count)} installs`");
        expect(script).toContain("action: 'approve'");
        expect(script).toContain("action: 'reject'");
        expect(script).toContain("action: 'inspect'");
        expect(script).toContain('async function inspectAsset(assetId)');
        expect(script).toContain('function createAssetPreview(asset)');
        expect(script).toContain("fetchJson(`/api/market/assets/${encodeURIComponent(assetId)}`");
        expect(script).toContain('asset.normalized_payload');
        expect(script).toContain('POPUP_TYPE.TEXT');
        expect(script).toContain("JSON.stringify(payload, null, 2)");
        expect(script).toContain("okButton: 'Close'");
        expect(script).toContain('allowVerticalScrolling: true');
        expect(script).toContain("action: 'delist'");
        expect(script).toContain("action: 'report'");
        expect(script).toContain("fetchJson(`/api/market/assets/${encodeURIComponent(assetId)}/delist`");
        expect(script).toContain("fetchJson(`/api/market/assets/${encodeURIComponent(assetId)}/report`");
        expect(script).toContain("reason: String(reason || '').slice(0, 120)");
        expect(script).toContain("fetchJson('/api/market/reports/admin')");
        expect(script).toContain("fetchJson(`/api/market/reports/${encodeURIComponent(reportId)}/resolve`");
        expect(script).toContain('function renderReportQueue()');
        expect(script).toContain('async function loadReportQueue()');
        expect(script).toContain('async function resolveReport(reportId)');
        expect(script).toContain('busyReportIds: new Set()');
        expect(script).toContain('data-marketplace-wallet-report-action');
        expect(script).toContain('data-report-id');
        expect(script).toContain('No reports queued.');
        expect(script).toContain('POPUP_TYPE.CONFIRM');
        expect(script).toContain('POPUP_TYPE.INPUT');
        expect(script).toContain('asset.owned || asset.entitled');
        expect(script).toContain("$root.find('#marketplace_wallet_review_queue').on('click', onAssetAction)");
        expect(script).toContain("$root.find('#marketplace_wallet_report_queue').on('click', onReportAction)");
        expect(script).toContain("await fetchJson('/api/wallet/grants/admin'");
        expect(script).toContain("['bonus', 'paid', 'earnings'].includes(bucket)");
        expect(script).toContain("|| 'Admin grant'");
    });

    test('keeps mobile review controls compact with a two-column action grid', () => {
        const css = readExtensionFile('style.css');

        expect(css).toContain('@media screen and (max-width: 700px)');
        expect(css).toContain('.marketplace-wallet-creator-stats');
        expect(css).toContain('data-marketplace-wallet-status="delisted"');
        expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));');
        expect(css).toContain('.marketplace-wallet-review-actions');
        expect(css).toContain('grid-template-columns: 1fr 1fr;');
        expect(css).toContain('.marketplace-wallet-admin-grid');
        expect(css).toContain('.marketplace-wallet-creator-asset');
        expect(css).toContain('.marketplace-wallet-grant');
        expect(css).toContain('.marketplace-wallet-review-item');
        expect(css).toContain('.marketplace-wallet-report-title');
        expect(css).toContain('.marketplace-wallet-asset-preview h3');
        expect(css).toContain('.marketplace-wallet-preview-payload');
    });
});
