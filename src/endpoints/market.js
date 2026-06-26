import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { DEFAULT_AVATAR_PATH } from '../constants.js';
import { write as writeCharacterCard } from '../character-card-parser.js';
import { serverDirectory } from '../server-directory.js';
import { getUniqueName, sanitizeSafeCharacterReplacements } from '../util.js';
import { TavernCardValidator } from '../validator/TavernCardValidator.js';
import { requireAdminMiddleware } from '../users.js';
import { purchaseWithWallet } from './wallet.js';

const MARKET_STORE_FILE = 'market-assets.json';
const DEFAULT_MARKET_AVATAR_PATH = path.resolve(serverDirectory, DEFAULT_AVATAR_PATH);
const SUPPORTED_TYPES = new Set(['character_card', 'world_book']);
const SUPPORTED_PRICE_TYPES = new Set(['free', 'fixed_price']);
const SAFE_ID_PATTERN = /^[a-z0-9_-]{8,64}$/;
const MAX_TITLE_LENGTH = 120;
const MAX_SUMMARY_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 10000;
const MAX_LANGUAGE_LENGTH = 16;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const MAX_PRICE_COINS = 1000000;

export const router = express.Router();
const marketPurchaseLocks = new Map();

function createId(prefix) {
    return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

function nowIso() {
    return new Date().toISOString();
}

function getStorePath(request) {
    const dataRoot = globalThis.DATA_ROOT || path.dirname(request.user.directories.root);
    return path.join(dataRoot, MARKET_STORE_FILE);
}

function emptyStore() {
    return {
        version: 1,
        assets: [],
        entitlements: [],
        installs: [],
    };
}

function readStore(request) {
    const storePath = getStorePath(request);
    if (!fs.existsSync(storePath)) {
        return emptyStore();
    }

    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return {
        version: 1,
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
        entitlements: Array.isArray(parsed.entitlements) ? parsed.entitlements : [],
        installs: Array.isArray(parsed.installs) ? parsed.installs : [],
    };
}

function writeStore(request, store) {
    const storePath = getStorePath(request);
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    writeFileAtomicSync(storePath, JSON.stringify(store, null, 4), 'utf8');
}

async function withMarketPurchaseLock(key, action) {
    const previous = marketPurchaseLocks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => {
        release = resolve;
    });
    const tail = previous.then(() => gate, () => gate);
    marketPurchaseLocks.set(key, tail);
    await previous.catch(() => {});

    try {
        return await action();
    } finally {
        release();
        if (marketPurchaseLocks.get(key) === tail) {
            marketPurchaseLocks.delete(key);
        }
    }
}

function getUserId(request) {
    return request.user.profile.handle;
}

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value, maxLength, fieldName, errors, { required = false } = {}) {
    if (value === undefined || value === null) {
        if (required) {
            errors.push(`${fieldName} is required`);
        }
        return '';
    }

    if (typeof value !== 'string') {
        errors.push(`${fieldName} must be a string`);
        return '';
    }

    const normalized = value.trim();
    if (required && !normalized) {
        errors.push(`${fieldName} is required`);
    }
    if (normalized.length > maxLength) {
        errors.push(`${fieldName} must be ${maxLength} characters or less`);
    }
    return normalized;
}

function normalizeTags(value, errors) {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        errors.push('tags must be an array');
        return [];
    }
    if (value.length > MAX_TAGS) {
        errors.push(`tags must contain ${MAX_TAGS} items or less`);
    }

    const tags = [];
    for (const tag of value.slice(0, MAX_TAGS)) {
        if (typeof tag !== 'string') {
            errors.push('tags must contain only strings');
            continue;
        }
        const normalized = tag.trim();
        if (!normalized) {
            continue;
        }
        if (normalized.length > MAX_TAG_LENGTH) {
            errors.push(`tags must be ${MAX_TAG_LENGTH} characters or less`);
            continue;
        }
        if (!tags.includes(normalized)) {
            tags.push(normalized);
        }
    }
    return tags;
}

function normalizePriceCoins(value, priceType, errors) {
    if (priceType === 'free') {
        if (value !== undefined && value !== null && Number(value) !== 0) {
            errors.push('price_coins must be 0 for free assets');
        }
        return 0;
    }

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        value = Number(value);
    }

    if (!Number.isSafeInteger(value) || value <= 0) {
        errors.push('price_coins must be a positive safe integer for fixed_price assets');
        return 0;
    }
    if (value > MAX_PRICE_COINS) {
        errors.push(`price_coins must be ${MAX_PRICE_COINS} or less`);
        return 0;
    }

    return value;
}

function normalizeCreateBody(body) {
    const errors = [];
    if (!isPlainObject(body)) {
        return { errors: ['JSON body is required'] };
    }

    const type = normalizeString(body.type, 64, 'type', errors, { required: true });
    if (type && !SUPPORTED_TYPES.has(type)) {
        errors.push(`type must be one of: ${Array.from(SUPPORTED_TYPES).join(', ')}`);
    }

    const title = normalizeString(body.title, MAX_TITLE_LENGTH, 'title', errors, { required: true });
    const summary = normalizeString(body.summary, MAX_SUMMARY_LENGTH, 'summary', errors);
    const description = normalizeString(body.description, MAX_DESCRIPTION_LENGTH, 'description', errors);
    const language = normalizeString(body.language ?? 'en', MAX_LANGUAGE_LENGTH, 'language', errors) || 'en';
    const contentRating = normalizeString(body.content_rating ?? 'general', 40, 'content_rating', errors) || 'general';
    const priceType = normalizeString(body.price_type ?? 'free', 24, 'price_type', errors) || 'free';
    if (priceType && !SUPPORTED_PRICE_TYPES.has(priceType)) {
        errors.push(`price_type must be one of: ${Array.from(SUPPORTED_PRICE_TYPES).join(', ')}`);
    }
    const priceCoins = normalizePriceCoins(body.price_coins, priceType, errors);

    const metadata = body.metadata === undefined ? {} : body.metadata;
    if (!isPlainObject(metadata)) {
        errors.push('metadata must be an object');
    }

    const normalizedPayload = body.normalized_payload;
    if (!isPlainObject(normalizedPayload)) {
        errors.push('normalized_payload must be an object');
    }

    return {
        errors,
        value: {
            type,
            title,
            summary,
            description,
            language,
            content_rating: contentRating,
            price_type: priceType,
            price_coins: priceCoins,
            tags: normalizeTags(body.tags, errors),
            metadata: isPlainObject(metadata) ? metadata : {},
            normalized_payload: isPlainObject(normalizedPayload) ? normalizedPayload : {},
        },
    };
}

function validateAssetForSubmit(asset) {
    const errors = [];
    if (asset.status !== 'draft') {
        errors.push('asset must be in draft status');
    }
    if (!asset.title) {
        errors.push('title is required');
    }
    if (!SUPPORTED_TYPES.has(asset.type)) {
        errors.push(`type must be one of: ${Array.from(SUPPORTED_TYPES).join(', ')}`);
    }
    if (!SUPPORTED_PRICE_TYPES.has(asset.price_type)) {
        errors.push(`price_type must be one of: ${Array.from(SUPPORTED_PRICE_TYPES).join(', ')}`);
    } else {
        normalizePriceCoins(asset.price_coins, asset.price_type, errors);
    }
    if (!isPlainObject(asset.metadata)) {
        errors.push('metadata must be an object');
    }
    if (!isPlainObject(asset.normalized_payload)) {
        errors.push('normalized_payload must be an object');
    } else {
        errors.push(...validateNormalizedPayload(asset));
    }
    return errors;
}

function validateNormalizedPayload(asset) {
    const errors = [];
    switch (asset.type) {
        case 'character_card': {
            const validator = new TavernCardValidator(asset.normalized_payload);
            if (!validator.validate()) {
                errors.push(`normalized_payload is not a valid character card: ${validator.lastValidationError || 'unknown format'}`);
            }
            break;
        }
        case 'world_book':
            if (!isPlainObject(asset.normalized_payload.entries)) {
                errors.push('normalized_payload.entries must be an object for world books');
            }
            break;
        default:
            errors.push(`Unsupported asset type: ${asset.type}`);
    }
    return errors;
}

function findAsset(store, id) {
    if (typeof id !== 'string' || !SAFE_ID_PATTERN.test(id)) {
        return null;
    }
    return store.assets.find(asset => asset.id === id) ?? null;
}

function toAssetListItem(asset, currentUserId) {
    return {
        id: asset.id,
        creator_id: asset.creator_id,
        type: asset.type,
        title: asset.title,
        summary: asset.summary,
        language: asset.language,
        tags: asset.tags,
        status: asset.status,
        price_type: asset.price_type,
        price_coins: asset.price_coins,
        sales_count: asset.sales_count,
        rating_avg: asset.rating_avg,
        rating_count: asset.rating_count,
        created_at: asset.created_at,
        updated_at: asset.updated_at,
        listed_at: asset.listed_at,
        owned: asset.creator_id === currentUserId,
    };
}

function canReadAsset(asset, currentUserId, isAdmin = false) {
    return isAdmin || asset.creator_id === currentUserId || ['approved', 'listed'].includes(asset.status);
}

function canPurchaseAsset(asset, currentUserId) {
    return asset.creator_id !== currentUserId && asset.status === 'listed';
}

function hasActiveEntitlement(store, asset, currentUserId) {
    return store.entitlements.some(item => item.asset_id === asset.id && item.user_id === currentUserId && !item.revoked_at);
}

function canInstallAsset(store, asset, currentUserId) {
    return asset.creator_id === currentUserId || hasActiveEntitlement(store, asset, currentUserId);
}

function canReadPayload(store, asset, currentUserId, isAdmin = false) {
    return isAdmin || asset.creator_id === currentUserId || hasActiveEntitlement(store, asset, currentUserId);
}

function toAssetDetail(asset, store, currentUserId, isAdmin = false) {
    const detail = structuredClone(asset);
    const payloadAvailable = canReadPayload(store, asset, currentUserId, isAdmin);
    detail.payload_available = payloadAvailable;

    if (!payloadAvailable) {
        delete detail.normalized_payload;
    }

    return detail;
}

function getInstallName(value, fallback) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback || 'Market Asset';
}

function getUniqueFileName(directory, rawName, extension) {
    const sanitized = sanitize(rawName, { replacement: sanitizeSafeCharacterReplacements }) || 'Market Asset';
    return getUniqueName(
        sanitized,
        name => fs.existsSync(path.join(directory, `${name}${extension}`)),
        { nameBuilder: (base, i) => i === 0 ? base : `${base}${i}`, startIndex: 0, maxTries: 10000 },
    );
}

function normalizeCharacterPayload(asset) {
    const card = structuredClone(asset.normalized_payload);
    const cardName = getInstallName(card?.data?.name || card?.name, asset.title);

    if (!card.spec) {
        Object.assign(card, {
            name: cardName,
            description: card.description || '',
            personality: card.personality || '',
            scenario: card.scenario || '',
            first_mes: card.first_mes || '',
            mes_example: card.mes_example || '',
        });
    } else {
        card.name = card.name || cardName;
        card.data ??= {};
        card.data.name = card.data.name || card.name || cardName;
    }

    const validator = new TavernCardValidator(card);
    if (!validator.validate()) {
        throw new Error(`Invalid character card payload: ${validator.lastValidationError || 'unknown format'}`);
    }

    return {
        card,
        name: card.data?.name || card.name || cardName,
    };
}

function installCharacterAsset(request, asset) {
    const { card, name } = normalizeCharacterPayload(asset);
    const fileName = getUniqueFileName(request.user.directories.characters, name, '.png');
    if (!fileName) {
        throw new Error('Could not create a unique character file name');
    }

    const avatar = fs.readFileSync(DEFAULT_MARKET_AVATAR_PATH);
    const outputImage = writeCharacterCard(avatar, JSON.stringify(card));
    const outputPath = path.join(request.user.directories.characters, `${fileName}.png`);
    fs.mkdirSync(request.user.directories.characters, { recursive: true });
    writeFileAtomicSync(outputPath, outputImage);

    return {
        type: 'character_card',
        name,
        file_name: fileName,
        path: `characters/${fileName}.png`,
        absolute_path: outputPath,
    };
}

function installWorldBookAsset(request, asset) {
    const world = structuredClone(asset.normalized_payload);
    if (!isPlainObject(world) || !isPlainObject(world.entries)) {
        throw new Error('World book payload must contain an entries object');
    }

    const name = getInstallName(world.name, asset.title);
    const fileName = getUniqueFileName(request.user.directories.worlds, name, '.json');
    if (!fileName) {
        throw new Error('Could not create a unique world book file name');
    }

    const outputPath = path.join(request.user.directories.worlds, `${fileName}.json`);
    fs.mkdirSync(request.user.directories.worlds, { recursive: true });
    writeFileAtomicSync(outputPath, JSON.stringify(world, null, 4), 'utf8');

    return {
        type: 'world_book',
        name: fileName,
        path: `worlds/${fileName}.json`,
        absolute_path: outputPath,
    };
}

function stripInstallInternals(installed) {
    const { absolute_path, ...publicInstalled } = installed;
    return publicInstalled;
}

function installAsset(request, asset) {
    switch (asset.type) {
        case 'character_card':
            return installCharacterAsset(request, asset);
        case 'world_book':
            return installWorldBookAsset(request, asset);
        default:
            throw new Error(`Unsupported asset type: ${asset.type}`);
    }
}

router.get('/assets', (request, response) => {
    const currentUserId = getUserId(request);
    const store = readStore(request);
    const assets = store.assets
        .filter(asset => canReadAsset(asset, currentUserId, !!request.user.profile.admin))
        .map(asset => toAssetListItem(asset, currentUserId));

    return response.json({ assets });
});

router.get('/assets/:id', (request, response) => {
    const currentUserId = getUserId(request);
    const store = readStore(request);
    const asset = findAsset(store, request.params.id);
    if (!asset || !canReadAsset(asset, currentUserId, !!request.user.profile.admin)) {
        return response.sendStatus(404);
    }

    const entitlement = store.entitlements.find(item => item.asset_id === asset.id && item.user_id === currentUserId && !item.revoked_at);
    return response.json({
        asset: toAssetDetail(asset, store, currentUserId, !!request.user.profile.admin),
        entitlement: entitlement ?? null,
    });
});

router.post('/assets', (request, response) => {
    const normalized = normalizeCreateBody(request.body);
    if (normalized.errors.length > 0) {
        return response.status(400).json({ error: 'Invalid market asset', details: normalized.errors });
    }

    const currentUserId = getUserId(request);
    const timestamp = nowIso();
    const asset = {
        id: createId('asset'),
        creator_id: currentUserId,
        ...normalized.value,
        visibility: 'private',
        status: 'draft',
        sales_count: 0,
        rating_avg: 0,
        rating_count: 0,
        created_at: timestamp,
        updated_at: timestamp,
        submitted_at: null,
        listed_at: null,
    };

    const store = readStore(request);
    store.assets.push(asset);
    writeStore(request, store);

    return response.status(201).json({ asset });
});

router.post('/assets/:id/submit', (request, response) => {
    const currentUserId = getUserId(request);
    const store = readStore(request);
    const asset = findAsset(store, request.params.id);
    if (!asset || asset.creator_id !== currentUserId) {
        return response.sendStatus(404);
    }

    const errors = validateAssetForSubmit(asset);
    if (errors.length > 0) {
        return response.status(400).json({ error: 'Invalid status transition', details: errors });
    }

    const timestamp = nowIso();
    asset.status = 'submitted';
    asset.visibility = 'review';
    asset.submitted_at = timestamp;
    asset.updated_at = timestamp;
    writeStore(request, store);

    return response.json({ asset });
});

router.post('/assets/:id/approve', requireAdminMiddleware, (request, response) => {
    const store = readStore(request);
    const asset = findAsset(store, request.params.id);
    if (!asset) {
        return response.sendStatus(404);
    }
    if (asset.status !== 'submitted' && asset.status !== 'approved') {
        return response.status(400).json({ error: 'asset must be submitted before approval' });
    }

    const errors = validateNormalizedPayload(asset);
    if (errors.length > 0) {
        return response.status(400).json({ error: 'Invalid market asset', details: errors });
    }

    const timestamp = nowIso();
    asset.status = 'listed';
    asset.visibility = 'public';
    asset.reviewed_by = getUserId(request);
    asset.approved_at = timestamp;
    asset.listed_at = timestamp;
    asset.updated_at = timestamp;
    writeStore(request, store);

    return response.json({ asset });
});

router.post('/assets/:id/reject', requireAdminMiddleware, (request, response) => {
    const store = readStore(request);
    const asset = findAsset(store, request.params.id);
    if (!asset) {
        return response.sendStatus(404);
    }
    if (asset.status !== 'submitted') {
        return response.status(400).json({ error: 'asset must be submitted before rejection' });
    }

    const timestamp = nowIso();
    asset.status = 'rejected';
    asset.visibility = 'private';
    asset.reviewed_by = getUserId(request);
    asset.review_notes = typeof request.body?.reason === 'string' ? request.body.reason.slice(0, 1000) : '';
    asset.updated_at = timestamp;
    writeStore(request, store);

    return response.json({ asset });
});

router.post('/assets/:id/purchase', async (request, response) => {
    const currentUserId = getUserId(request);
    const lockKey = `${request.params.id}:${currentUserId}`;

    return withMarketPurchaseLock(lockKey, async () => {
        const store = readStore(request);
        const asset = findAsset(store, request.params.id);
        if (!asset || !canPurchaseAsset(asset, currentUserId)) {
            return response.sendStatus(404);
        }
        if (!SUPPORTED_PRICE_TYPES.has(asset.price_type)) {
            return response.status(400).json({ error: 'Unsupported market asset price type' });
        }

        const existing = store.entitlements.find(item => item.asset_id === asset.id && item.user_id === currentUserId && !item.revoked_at);
        if (existing) {
            return response.json({ entitlement: existing, already_owned: true });
        }

        let purchase = null;
        if (asset.price_type === 'fixed_price') {
            purchase = await purchaseWithWallet({
                buyerHandle: currentUserId,
                creatorHandle: asset.creator_id,
                purchaseId: `market:${asset.id}:${currentUserId}:v1`,
                amount: Number(asset.price_coins),
                reason: `Market purchase: ${asset.title}`,
                metadata: {
                    source: 'market.assets.purchase',
                    asset_id: asset.id,
                    asset_version_id: null,
                    asset_title: asset.title,
                    creator_id: asset.creator_id,
                },
            });
            if (!purchase.ok) {
                return response.status(purchase.status).json({
                    error: purchase.error,
                    balance: purchase.balance,
                });
            }
        }

        const timestamp = nowIso();
        const entitlement = {
            id: createId('ent'),
            user_id: currentUserId,
            asset_id: asset.id,
            asset_version_id: null,
            source: asset.price_type === 'free' ? 'free' : 'purchase',
            purchase_id: purchase?.purchase_id ?? null,
            ledger_entry_ids: purchase?.ledger_entries?.map(entry => entry.id) ?? [],
            created_at: timestamp,
            revoked_at: null,
        };
        store.entitlements.push(entitlement);
        asset.sales_count = Number(asset.sales_count || 0) + 1;
        asset.updated_at = timestamp;
        writeStore(request, store);

        return response.status(201).json({
            entitlement,
            already_owned: false,
            purchase: purchase
                ? {
                    id: purchase.purchase_id,
                    ledger_entries: purchase.ledger_entries,
                    buyer_balance: purchase.buyer_balance,
                    creator_balance: purchase.creator_balance,
                }
                : null,
        });
    });
});

router.post('/assets/:id/install', (request, response) => {
    let installed = null;
    try {
        const currentUserId = getUserId(request);
        const store = readStore(request);
        const asset = findAsset(store, request.params.id);
        if (!asset || !canReadAsset(asset, currentUserId, !!request.user.profile.admin)) {
            return response.sendStatus(404);
        }
        if (!canInstallAsset(store, asset, currentUserId)) {
            return response.status(403).json({ error: 'Purchase or entitlement required before installation' });
        }

        installed = installAsset(request, asset);
        const timestamp = nowIso();
        asset.updated_at = timestamp;
        asset.install_count = Number(asset.install_count || 0) + 1;
        store.installs = Array.isArray(store.installs) ? store.installs : [];
        const installRecord = {
            id: createId('install'),
            user_id: currentUserId,
            asset_id: asset.id,
            asset_version_id: null,
            installed_type: installed.type,
            local_ref: installed.path,
            created_at: timestamp,
        };
        store.installs.push(installRecord);
        writeStore(request, store);

        return response.status(201).json({ installed: stripInstallInternals(installed), install: installRecord });
    } catch (error) {
        if (installed?.absolute_path) {
            try {
                fs.rmSync(installed.absolute_path, { force: true });
            } catch (cleanupError) {
                console.warn('Market asset install cleanup failed:', cleanupError);
            }
        }
        console.error('Market asset install failed:', error);
        return response.status(400).json({ error: error.message || 'Failed to install market asset' });
    }
});
