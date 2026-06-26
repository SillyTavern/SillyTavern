import { getRequestHeaders } from '../../../script.js';
import { renderExtensionTemplateAsync } from '../../extensions.js';
import { POPUP_TYPE, callGenericPopup } from '../../popup.js';
import { getCurrentUserHandle, isAdmin } from '../../user.js';
import { getFileText } from '../../utils.js';

const MODULE_NAME = 'marketplace-wallet';
const MARKET_TYPES = {
    character_card: 'Character card',
    world_book: 'World book',
};

const state = {
    assets: [],
    creator: null,
    wallet: null,
    loaded: false,
    loading: false,
    creatorLoading: false,
    granting: false,
    busyAssetIds: new Set(),
};

function formatCoins(value) {
    return Number(value || 0).toLocaleString();
}

function getSpendableBalance() {
    const buckets = state.wallet?.balance?.buckets ?? {};
    return Number(buckets.bonus || 0) + Number(buckets.paid || 0);
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...getRequestHeaders(),
            ...(options.headers ?? {}),
        },
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
        const details = Array.isArray(data?.details) ? `: ${data.details.join('; ')}` : '';
        const message = data?.error ? `${data.error}${details}` : `${response.status} ${response.statusText}`;
        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

function setLoading(isLoading) {
    state.loading = isLoading;
    $('#marketplace_wallet_refresh').prop('disabled', isLoading);
    $('#marketplace_wallet_refresh i').toggleClass('fa-spin', isLoading);
}

function renderWallet() {
    const balance = state.wallet?.balance ?? { buckets: {}, total: 0 };
    $('#marketplace_wallet_total').text(formatCoins(balance.total));
    $('[data-marketplace-wallet-bucket="bonus"]').text(formatCoins(balance.buckets?.bonus));
    $('[data-marketplace-wallet-bucket="paid"]').text(formatCoins(balance.buckets?.paid));
    $('[data-marketplace-wallet-bucket="earnings"]').text(formatCoins(balance.buckets?.earnings));
}

function renderCreatorSummary() {
    const stats = state.creator?.stats ?? {};
    $('#marketplace_wallet_creator_assets').text(formatCoins(stats.total_assets));
    $('#marketplace_wallet_creator_listed').text(formatCoins(stats.listed_assets));
    $('#marketplace_wallet_creator_sales').text(formatCoins(stats.total_claims));
    $('#marketplace_wallet_creator_earnings').text(formatCoins(stats.gross_revenue_coins));

    const $list = $('#marketplace_wallet_creator_assets_list');
    if (!$list.length) {
        return;
    }

    $list.empty();
    if (state.creatorLoading) {
        $list.append($('<div class="marketplace-wallet-empty"></div>').text('Loading creator assets...'));
        return;
    }

    const assets = Array.isArray(state.creator?.assets) ? state.creator.assets.slice(0, 5) : [];
    if (assets.length === 0) {
        $list.append($('<div class="marketplace-wallet-empty"></div>').text('No creator assets yet.'));
        return;
    }

    for (const asset of assets) {
        const $item = $('<div class="marketplace-wallet-creator-asset"></div>');
        const $main = $('<div class="marketplace-wallet-creator-asset-main"></div>');
        const $title = $('<span></span>').text(asset.title || 'Untitled asset');
        const $meta = $('<small></small>').text(`${asset.status || 'draft'} · ${formatCoins(asset.sales_count)} claims · ${formatCoins(asset.install_count)} installs`);
        const $price = $('<b></b>').text(getPriceLabel(asset));

        $main.append($title, $meta);
        $item.append($main, $price);
        $list.append($item);
    }
}

function canUseAdminTools() {
    return isAdmin();
}

function renderAdminVisibility() {
    const $admin = $('#marketplace_wallet_admin');
    if (canUseAdminTools()) {
        $admin.removeAttr('hidden');
    } else {
        $admin.attr('hidden', '');
    }
}

function getFilteredAssets() {
    const search = String($('#marketplace_wallet_search').val() || '').trim().toLowerCase();
    const type = String($('#marketplace_wallet_type_filter').val() || '');
    return state.assets
        .filter(asset => !type || asset.type === type)
        .filter(asset => {
            if (!search) {
                return true;
            }
            return [
                asset.title,
                asset.summary,
                asset.creator_id,
                ...(Array.isArray(asset.tags) ? asset.tags : []),
            ].filter(Boolean).join(' ').toLowerCase().includes(search);
        })
        .sort((a, b) => String(b.listed_at || b.updated_at || '').localeCompare(String(a.listed_at || a.updated_at || '')));
}

function getPriceLabel(asset) {
    if (asset.price_type === 'fixed_price') {
        return `${formatCoins(asset.price_coins)} coins`;
    }
    return 'Free';
}

function createStatusBadge(asset) {
    const $badge = $('<span class="marketplace-wallet-badge"></span>');
    $badge.text(asset.status || 'draft');
    $badge.attr('data-marketplace-wallet-status', asset.status || 'draft');
    return $badge;
}

function createAssetButton({ asset, action, icon, label, disabled = false, title = '' }) {
    const $button = $('<button class="menu_button menu_button_icon" type="button"></button>');
    $button.attr('data-marketplace-wallet-action', action);
    $button.attr('data-asset-id', asset.id);
    $button.prop('disabled', disabled);
    if (title) {
        $button.attr('title', title);
    }
    $button.append(`<i class="fa-solid ${icon}" aria-hidden="true"></i>`);
    $button.append($('<span></span>').text(label));
    return $button;
}

function createAssetAction(asset) {
    const isBusy = state.busyAssetIds.has(asset.id);
    const $actions = $('<div class="marketplace-wallet-asset-actions"></div>');

    if (asset.owned && asset.status === 'draft') {
        $actions.append(createAssetButton({
            asset,
            action: 'submit',
            icon: 'fa-paper-plane',
            label: isBusy ? 'Submitting' : 'Submit',
            disabled: isBusy,
        }));
    }

    if (asset.owned) {
        $actions.append(createAssetButton({
            asset,
            action: 'install',
            icon: 'fa-box-open',
            label: isBusy ? 'Installing' : 'Install',
            disabled: isBusy,
        }));
        return $actions;
    }

    if (asset.status === 'listed') {
        const priceCoins = Number(asset.price_coins || 0);
        const canAfford = asset.price_type !== 'fixed_price' || getSpendableBalance() >= priceCoins;
        $actions.append(createAssetButton({
            asset,
            action: 'purchase',
            icon: 'fa-cart-shopping',
            label: isBusy ? 'Working' : asset.price_type === 'free' ? 'Get & Install' : 'Buy & Install',
            disabled: isBusy || !canAfford,
            title: canAfford ? '' : 'Not enough bonus or paid balance',
        }));
    }

    return $actions;
}

function renderReviewQueue() {
    const $queue = $('#marketplace_wallet_review_queue');
    if (!canUseAdminTools() || !$queue.length) {
        return;
    }

    $queue.empty();
    const submitted = state.assets
        .filter(asset => asset.status === 'submitted')
        .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')));

    if (submitted.length === 0) {
        $queue.append($('<div class="marketplace-wallet-empty"></div>').text('No assets awaiting review.'));
        return;
    }

    for (const asset of submitted) {
        const $item = $('<div class="marketplace-wallet-review-item"></div>');
        const isBusy = state.busyAssetIds.has(asset.id);
        const $meta = $('<div class="marketplace-wallet-review-meta"></div>');
        const $title = $('<span></span>').text(asset.title || 'Untitled asset');
        const $type = $('<small></small>').text(MARKET_TYPES[asset.type] || asset.type || 'Asset');
        const $actions = $('<div class="marketplace-wallet-review-actions"></div>');

        $meta.append($title, $type);
        $actions.append(createAssetButton({
            asset,
            action: 'approve',
            icon: 'fa-circle-check',
            label: isBusy ? 'Approving' : 'Approve',
            disabled: isBusy,
        }));
        $actions.append(createAssetButton({
            asset,
            action: 'reject',
            icon: 'fa-circle-xmark',
            label: isBusy ? 'Rejecting' : 'Reject',
            disabled: isBusy,
        }));
        $item.append($meta, $actions);
        $queue.append($item);
    }
}

function renderAssets() {
    const $list = $('#marketplace_wallet_assets');
    $list.empty();
    renderReviewQueue();

    if (state.loading && !state.loaded) {
        $list.append($('<div class="marketplace-wallet-empty"></div>').text('Loading marketplace...'));
        return;
    }

    const assets = getFilteredAssets();
    if (assets.length === 0) {
        $list.append($('<div class="marketplace-wallet-empty"></div>').text('No marketplace assets found.'));
        return;
    }

    for (const asset of assets) {
        const $asset = $('<article class="marketplace-wallet-asset"></article>');
        const $main = $('<div class="marketplace-wallet-asset-main"></div>');
        const $titleRow = $('<div class="marketplace-wallet-asset-title-row"></div>');
        const $type = $('<span class="marketplace-wallet-type"></span>').text(MARKET_TYPES[asset.type] || asset.type || 'Asset');
        const $title = $('<h4></h4>').text(asset.title || 'Untitled asset');
        const $meta = $('<div class="marketplace-wallet-asset-meta"></div>');
        const $summary = $('<p></p>').text(asset.summary || '');

        $titleRow.append($type, $title, createStatusBadge(asset));
        $meta.append($('<span></span>').text(getPriceLabel(asset)));
        $meta.append($('<span></span>').text(`${formatCoins(asset.sales_count)} claims`));
        $meta.append($('<span></span>').text(`${formatCoins(asset.install_count)} installs`));
        if (asset.creator_id) {
            $meta.append($('<span></span>').text(`by ${asset.creator_id}`));
        }
        $main.append($titleRow, $summary, $meta);
        $asset.append($main, createAssetAction(asset));
        $list.append($asset);
    }
}

async function loadCreatorSummary() {
    state.creatorLoading = true;
    renderCreatorSummary();
    try {
        state.creator = await fetchJson('/api/market/creator/summary');
    } catch (error) {
        state.creator = null;
        console.warn('Creator summary could not be loaded', error);
    } finally {
        state.creatorLoading = false;
        renderCreatorSummary();
    }
}

async function loadMarketplace({ silent = false } = {}) {
    if (state.loading) {
        return;
    }

    setLoading(true);
    renderAssets();
    try {
        const [wallet, market] = await Promise.all([
            fetchJson('/api/wallet'),
            fetchJson('/api/market/assets'),
        ]);
        state.wallet = wallet;
        state.assets = Array.isArray(market.assets) ? market.assets : [];
        state.loaded = true;
        renderAdminVisibility();
        renderWallet();
        renderAssets();
        void loadCreatorSummary();
        if (!silent) {
            toastr.success('Marketplace refreshed');
        }
    } catch (error) {
        console.error('Failed to load marketplace', error);
        toastr.error(error.message || 'Marketplace could not be loaded');
    } finally {
        renderAdminVisibility();
        setLoading(false);
    }
}

async function withBusyAsset(assetId, callback) {
    state.busyAssetIds.add(assetId);
    renderAssets();
    try {
        await callback();
    } finally {
        state.busyAssetIds.delete(assetId);
        renderAssets();
    }
}

async function requestInstall(assetId) {
    const result = await fetchJson(`/api/market/assets/${encodeURIComponent(assetId)}/install`, {
        method: 'POST',
    });
    const name = result.installed?.name || 'Market asset';
    toastr.success(`${name} installed`);
}

async function installAsset(assetId) {
    await withBusyAsset(assetId, async () => {
        await requestInstall(assetId);
    });
}

async function purchaseAsset(assetId) {
    await withBusyAsset(assetId, async () => {
        const result = await fetchJson(`/api/market/assets/${encodeURIComponent(assetId)}/purchase`, {
            method: 'POST',
        });
        toastr.success(result.already_owned ? 'Already in your library' : 'Added to your library');
        await requestInstall(assetId);
        await loadMarketplace({ silent: true });
    });
}

async function submitAsset(assetId) {
    await withBusyAsset(assetId, async () => {
        await fetchJson(`/api/market/assets/${encodeURIComponent(assetId)}/submit`, {
            method: 'POST',
        });
        toastr.success('Asset submitted for review');
        await loadMarketplace({ silent: true });
    });
}

async function approveAsset(assetId) {
    await withBusyAsset(assetId, async () => {
        await fetchJson(`/api/market/assets/${encodeURIComponent(assetId)}/approve`, {
            method: 'POST',
        });
        toastr.success('Asset approved and listed');
        await loadMarketplace({ silent: true });
    });
}

async function rejectAsset(assetId) {
    const reason = await callGenericPopup('Reason for rejection:', POPUP_TYPE.INPUT, '', {
        okButton: 'Reject',
        cancelButton: 'Cancel',
        rows: 4,
    });

    if (reason === null || reason === false) {
        return;
    }

    await withBusyAsset(assetId, async () => {
        await fetchJson(`/api/market/assets/${encodeURIComponent(assetId)}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: String(reason || '').slice(0, 1000) }),
        });
        toastr.success('Asset rejected');
        await loadMarketplace({ silent: true });
    });
}

function parsePayloadJson() {
    const text = String($('#marketplace_wallet_upload_payload').val() || '').trim();
    if (!text) {
        throw new Error('Payload JSON is required');
    }
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Payload JSON must be an object');
    }
    return payload;
}

function looksLikeCharacterCard(payload) {
    if (payload?.spec === 'chara_card_v2') {
        const data = payload.data;
        return Boolean(data?.name)
            && Array.isArray(data.alternate_greetings)
            && Array.isArray(data.tags)
            && typeof data.extensions === 'object';
    }

    if (payload?.spec === 'chara_card_v3') {
        return Boolean(payload.data && typeof payload.data === 'object');
    }

    return ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example']
        .every(field => Object.hasOwn(payload, field));
}

function validatePayloadShape(type, payload) {
    if (type === 'world_book' && (!payload.entries || typeof payload.entries !== 'object' || Array.isArray(payload.entries))) {
        throw new Error('World book payload must contain an entries object');
    }

    if (type === 'character_card' && !looksLikeCharacterCard(payload)) {
        throw new Error('Character payload must be a Tavern Card v1, v2, or v3 object');
    }
}

async function createAsset(submitForReview) {
    const type = String($('#marketplace_wallet_upload_type').val() || '');
    const title = String($('#marketplace_wallet_upload_title').val() || '').trim();
    const summary = String($('#marketplace_wallet_upload_summary').val() || '').trim();
    const priceType = String($('#marketplace_wallet_upload_price_type').val() || 'free');
    const priceCoins = priceType === 'fixed_price' ? Number($('#marketplace_wallet_upload_price').val() || 0) : 0;

    if (!title) {
        toastr.warning('Title is required');
        return;
    }

    let payload;
    try {
        payload = parsePayloadJson();
        validatePayloadShape(type, payload);
    } catch (error) {
        toastr.error(error.message || 'Invalid payload JSON');
        return;
    }

    if (priceType === 'fixed_price' && (!Number.isSafeInteger(priceCoins) || priceCoins <= 0)) {
        toastr.warning('Fixed price must be a positive whole number');
        return;
    }

    const $buttons = $('[data-marketplace-wallet-upload]');
    $buttons.prop('disabled', true);
    try {
        const result = await fetchJson('/api/market/assets', {
            method: 'POST',
            body: JSON.stringify({
                type,
                title,
                summary,
                price_type: priceType,
                price_coins: priceCoins,
                normalized_payload: payload,
            }),
        });
        if (submitForReview) {
            await fetchJson(`/api/market/assets/${encodeURIComponent(result.asset.id)}/submit`, {
                method: 'POST',
            });
            toastr.success('Asset saved and submitted for review');
        } else {
            toastr.success('Draft saved');
        }
        $('#marketplace_wallet_upload_title').val('');
        $('#marketplace_wallet_upload_summary').val('');
        $('#marketplace_wallet_upload_payload').val('');
        await loadMarketplace({ silent: true });
    } catch (error) {
        console.error('Failed to create market asset', error);
        toastr.error(error.message || 'Asset could not be saved');
    } finally {
        $buttons.prop('disabled', false);
    }
}

async function grantCoins() {
    if (state.granting) {
        return;
    }

    const targetHandle = String($('#marketplace_wallet_grant_handle').val() || '').trim();
    const amount = Number($('#marketplace_wallet_grant_amount').val() || 0);
    const bucket = String($('#marketplace_wallet_grant_bucket').val() || 'bonus');
    const reason = String($('#marketplace_wallet_grant_reason').val() || '').trim() || 'Admin grant';

    if (!targetHandle) {
        toastr.warning('User handle is required');
        return;
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        toastr.warning('Grant amount must be a positive whole number');
        return;
    }
    if (!['bonus', 'paid', 'earnings'].includes(bucket)) {
        toastr.warning('Grant bucket is invalid');
        return;
    }

    state.granting = true;
    $('#marketplace_wallet_grant_submit').prop('disabled', true);
    try {
        const result = await fetchJson('/api/wallet/grants/admin', {
            method: 'POST',
            body: JSON.stringify({
                targetHandle,
                amount,
                bucket,
                reason,
            }),
        });
        toastr.success(`${formatCoins(amount)} ${bucket} coins granted to ${result.handle}`);
        if (state.wallet?.handle === result.handle) {
            state.wallet.balance = result.balance;
            renderWallet();
        }
    } catch (error) {
        console.error('Failed to grant coins', error);
        toastr.error(error.message || 'Coins could not be granted');
    } finally {
        state.granting = false;
        $('#marketplace_wallet_grant_submit').prop('disabled', false);
    }
}

function onAssetAction(event) {
    const button = event.target.closest('[data-marketplace-wallet-action]');
    if (!button) {
        return;
    }

    const assetId = button.getAttribute('data-asset-id');
    const action = button.getAttribute('data-marketplace-wallet-action');
    if (!assetId || state.busyAssetIds.has(assetId)) {
        return;
    }

    const actions = {
        purchase: purchaseAsset,
        install: installAsset,
        submit: submitAsset,
        approve: approveAsset,
        reject: rejectAsset,
    };
    actions[action]?.(assetId).catch(error => {
        console.error(`Marketplace action failed: ${action}`, error);
        toastr.error(error.message || 'Marketplace action failed');
    });
}

function bindEvents($root) {
    $root.find('#marketplace_wallet_refresh').on('click', () => loadMarketplace());
    $root.find('#marketplace_wallet_search, #marketplace_wallet_type_filter').on('input change', renderAssets);
    $root.find('#marketplace_wallet_assets').on('click', onAssetAction);
    $root.find('#marketplace_wallet_review_queue').on('click', onAssetAction);
    $root.find('#marketplace_wallet_grant_submit').on('click', grantCoins);
    $root.find('#marketplace_wallet_upload_price_type').on('change', function () {
        const isFixedPrice = String($(this).val()) === 'fixed_price';
        $('#marketplace_wallet_upload_price').prop('disabled', !isFixedPrice).val(isFixedPrice ? $('#marketplace_wallet_upload_price').val() || 1 : 0);
    }).trigger('change');
    $root.find('#marketplace_wallet_upload_file').on('change', async function () {
        const file = this.files?.[0];
        if (!file) {
            return;
        }
        try {
            const text = await getFileText(file);
            JSON.parse(text);
            $('#marketplace_wallet_upload_payload').val(text);
            if (!$('#marketplace_wallet_upload_title').val()) {
                $('#marketplace_wallet_upload_title').val(file.name.replace(/\.[^.]+$/, ''));
            }
        } catch (error) {
            toastr.error(error.message || 'File is not valid JSON');
        } finally {
            this.value = '';
        }
    });
    $root.find('[data-marketplace-wallet-upload]').on('click', function () {
        createAsset($(this).attr('data-marketplace-wallet-upload') === 'review');
    });
}

export async function init() {
    if ($('#marketplace_wallet_ui').length) {
        return;
    }

    const template = await renderExtensionTemplateAsync(MODULE_NAME, 'window', {});
    const $html = $(template);
    $html.find('#marketplace_wallet_grant_handle').val(getCurrentUserHandle());
    bindEvents($html);
    $('#marketplace_wallet_container').append($html);
    renderAdminVisibility();
    await loadMarketplace({ silent: true });
}
