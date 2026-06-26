import storage from 'node-persist';
import express from 'express';

import { toKey } from '../users.js';
import { uuidv4 } from '../util.js';

export const router = express.Router();

const LEDGER_KEY_PREFIX = 'wallet:ledger:v1:';
const WALLET_BUCKETS = Object.freeze(['paid', 'bonus', 'earnings']);
const PURCHASE_SPEND_BUCKETS = Object.freeze(['bonus', 'paid']);
const DEFAULT_GRANT_BUCKET = 'bonus';

/**
 * @typedef {Object} WalletLedgerEntry
 * @property {string} id Ledger entry ID
 * @property {string} type Ledger entry type
 * @property {string} userHandle User whose wallet changed
 * @property {string} actorHandle User who created the change
 * @property {string} bucket Balance bucket
 * @property {number} amount Signed integer amount
 * @property {string} reason Human-readable reason
 * @property {number} createdAt Unix timestamp in milliseconds
 * @property {Record<string, unknown>} metadata Additional audit metadata
 */

/**
 * Gets the authenticated user's handle from a request.
 * @param {import('express').Request} request Express request
 * @returns {string | undefined}
 */
function getCurrentHandle(request) {
    return request.user?.profile?.handle;
}

/**
 * Checks whether the authenticated user is an administrator.
 * @param {import('express').Request} request Express request
 * @returns {boolean}
 */
function isAdmin(request) {
    return !!request.user?.profile?.admin;
}

/**
 * Parses a positive integer amount from a request body value.
 * @param {unknown} value Raw amount
 * @returns {number | null}
 */
function parsePositiveInteger(value) {
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        value = Number(value);
    }

    if (!Number.isSafeInteger(value) || value <= 0) {
        return null;
    }

    return value;
}

/**
 * Gets a supported wallet bucket from a request body value.
 * @param {unknown} value Raw bucket
 * @returns {string | null}
 */
function parseBucket(value) {
    const bucket = String(value || DEFAULT_GRANT_BUCKET);
    return WALLET_BUCKETS.includes(bucket) ? bucket : null;
}

/**
 * Creates an empty wallet balance object.
 * @returns {Record<string, number>}
 */
function createEmptyBalance() {
    return Object.fromEntries(WALLET_BUCKETS.map(bucket => [bucket, 0]));
}

/**
 * Gets all immutable ledger entries.
 * @returns {Promise<WalletLedgerEntry[]>}
 */
async function getLedgerEntries() {
    /** @type {WalletLedgerEntry[]} */
    const entries = await storage.values(x => x.key.startsWith(LEDGER_KEY_PREFIX));
    return entries
        .filter(entry => entry && WALLET_BUCKETS.includes(entry.bucket) && Number.isSafeInteger(entry.amount))
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/**
 * Gets immutable ledger entries for a user.
 * @param {string} handle User handle
 * @returns {Promise<WalletLedgerEntry[]>}
 */
async function getUserLedgerEntries(handle) {
    const entries = await getLedgerEntries();
    return entries.filter(entry => entry.userHandle === handle);
}

/**
 * Calculates balances from ledger entries.
 * @param {WalletLedgerEntry[]} entries Ledger entries
 * @returns {{ buckets: Record<string, number>, total: number }}
 */
export function calculateBalance(entries) {
    const buckets = createEmptyBalance();

    for (const entry of entries) {
        buckets[entry.bucket] += entry.amount;
    }

    return {
        buckets,
        total: Object.values(buckets).reduce((sum, amount) => sum + amount, 0),
    };
}

function createLedgerEntry({ type, userHandle, actorHandle, bucket, amount, reason, metadata = {} }) {
    return {
        id: uuidv4(),
        type,
        userHandle,
        actorHandle,
        bucket,
        amount,
        reason: String(reason || type).slice(0, 200),
        createdAt: Date.now(),
        metadata,
    };
}

async function persistLedgerEntries(entries) {
    for (const entry of entries) {
        await storage.setItem(`${LEDGER_KEY_PREFIX}${entry.id}`, entry);
    }
}

export async function getWalletBalance(handle) {
    const entries = await getUserLedgerEntries(handle);
    return calculateBalance(entries);
}

export async function getWalletLedger(handle) {
    return getUserLedgerEntries(handle);
}

export function planWalletDebit(balance, amount, order = PURCHASE_SPEND_BUCKETS) {
    const price = parsePositiveInteger(amount);
    if (price === null) {
        return { ok: false, error: 'Amount must be a positive safe integer' };
    }

    const debits = [];
    let remaining = price;
    for (const bucket of order) {
        const available = Math.max(0, balance.buckets?.[bucket] || 0);
        const debit = Math.min(available, remaining);
        if (debit > 0) {
            debits.push({ bucket, amount: debit });
            remaining -= debit;
        }
    }

    return {
        ok: remaining === 0,
        debits,
        amount: price,
        remaining,
    };
}

export async function grantWalletAmount({ targetHandle, actorHandle, amount, bucket = DEFAULT_GRANT_BUCKET, reason = 'Admin grant', metadata = {}, type = 'admin_grant' }) {
    const entry = createLedgerEntry({
        type,
        userHandle: targetHandle,
        actorHandle,
        bucket,
        amount,
        reason,
        metadata,
    });

    await persistLedgerEntries([entry]);

    return {
        entry,
        balance: await getWalletBalance(targetHandle),
    };
}

export async function purchaseWithWallet({ buyerHandle, creatorHandle, actorHandle = buyerHandle, amount, purchaseId = uuidv4(), reason = 'Market purchase', metadata = {} }) {
    const price = parsePositiveInteger(amount);
    if (price === null) {
        return { ok: false, status: 400, error: 'Amount must be a positive safe integer' };
    }

    const existingEntries = (await getLedgerEntries()).filter(entry => entry.metadata?.purchase_id === purchaseId);
    if (existingEntries.length > 0) {
        return {
            ok: true,
            purchase_id: purchaseId,
            ledger_entries: existingEntries,
            buyer_balance: await getWalletBalance(buyerHandle),
            creator_balance: creatorHandle ? await getWalletBalance(creatorHandle) : null,
            already_settled: true,
        };
    }

    const buyerEntries = await getUserLedgerEntries(buyerHandle);
    const buyerBalance = calculateBalance(buyerEntries);
    const debitPlan = planWalletDebit(buyerBalance, price);
    if (!debitPlan.ok) {
        return {
            ok: false,
            status: 402,
            error: 'Insufficient wallet balance',
            balance: buyerBalance,
        };
    }

    const purchaseMetadata = {
        ...metadata,
        purchase_id: purchaseId,
        buyer_handle: buyerHandle,
        creator_handle: creatorHandle,
        price_coins: price,
        debit_breakdown: Object.fromEntries(debitPlan.debits.map(debit => [debit.bucket, debit.amount])),
    };

    const entries = [];
    for (const { bucket, amount: debit } of debitPlan.debits) {
        entries.push(createLedgerEntry({
            type: 'market_purchase_debit',
            userHandle: buyerHandle,
            actorHandle,
            bucket,
            amount: -debit,
            reason,
            metadata: purchaseMetadata,
        }));
    }

    if (creatorHandle) {
        entries.push(createLedgerEntry({
            type: 'market_creator_earning',
            userHandle: creatorHandle,
            actorHandle,
            bucket: 'earnings',
            amount: price,
            reason: 'Market creator earning',
            metadata: purchaseMetadata,
        }));
    }

    await persistLedgerEntries(entries);

    return {
        ok: true,
        purchase_id: purchaseId,
        ledger_entries: entries,
        buyer_balance: await getWalletBalance(buyerHandle),
        creator_balance: creatorHandle ? await getWalletBalance(creatorHandle) : null,
    };
}

/**
 * Resolves a wallet handle that the current user may access.
 * @param {import('express').Request} request Express request
 * @returns {{ handle?: string, error?: { status: number, message: string } }}
 */
function resolveReadableHandle(request) {
    const currentHandle = getCurrentHandle(request);
    const requestedHandle = typeof request.query.handle === 'string' && request.query.handle.trim()
        ? request.query.handle.trim()
        : currentHandle;

    if (!requestedHandle) {
        return { error: { status: 403, message: 'Unauthorized' } };
    }

    if (requestedHandle !== currentHandle && !isAdmin(request)) {
        return { error: { status: 403, message: 'Unauthorized' } };
    }

    return { handle: requestedHandle };
}

/**
 * Checks whether a user exists in account storage.
 * @param {string} handle User handle
 * @param {import('express').Request} request Express request
 * @returns {Promise<boolean>}
 */
async function userExists(handle, request) {
    if (handle === getCurrentHandle(request)) {
        return true;
    }

    const user = await storage.getItem(toKey(handle));
    return !!user;
}

router.get('/', async (request, response) => {
    try {
        const { handle, error } = resolveReadableHandle(request);
        if (error) {
            return response.status(error.status).json({ error: error.message });
        }

        const entries = await getUserLedgerEntries(handle);
        return response.json({
            handle,
            balance: calculateBalance(entries),
        });
    } catch (error) {
        console.error('Wallet get failed:', error);
        return response.sendStatus(500);
    }
});

router.get('/ledger', async (request, response) => {
    try {
        const { handle, error } = resolveReadableHandle(request);
        if (error) {
            return response.status(error.status).json({ error: error.message });
        }

        const entries = await getUserLedgerEntries(handle);
        return response.json({
            handle,
            ledger: entries,
            balance: calculateBalance(entries),
        });
    } catch (error) {
        console.error('Wallet ledger failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/grants/admin', async (request, response) => {
    try {
        const currentHandle = getCurrentHandle(request);
        if (!currentHandle) {
            return response.status(403).json({ error: 'Unauthorized' });
        }
        if (!isAdmin(request)) {
            return response.status(403).json({ error: 'Only admins can grant coins' });
        }

        const body = request.body ?? {};
        const targetHandle = String(body.handle || body.userHandle || body.targetHandle || currentHandle).trim();
        if (!targetHandle) {
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const amount = parsePositiveInteger(body.amount);
        if (amount === null) {
            return response.status(400).json({ error: 'Amount must be a positive safe integer' });
        }

        const bucket = parseBucket(body.bucket);
        if (!bucket) {
            return response.status(400).json({ error: 'Invalid wallet bucket' });
        }

        if (!await userExists(targetHandle, request)) {
            return response.status(404).json({ error: 'User not found' });
        }

        const grant = await grantWalletAmount({
            targetHandle,
            actorHandle: currentHandle,
            bucket,
            amount,
            reason: body.reason || 'Admin grant',
            metadata: {
                source: 'wallet.grants.admin',
            },
        });

        return response.status(201).json({
            entry: grant.entry,
            handle: targetHandle,
            balance: grant.balance,
        });
    } catch (error) {
        console.error('Wallet admin grant failed:', error);
        return response.sendStatus(500);
    }
});
