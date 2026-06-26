import storage from 'node-persist';
import express from 'express';

import { toKey } from '../users.js';
import { uuidv4 } from '../util.js';

export const router = express.Router();

const LEDGER_KEY_PREFIX = 'wallet:ledger:v1:';
const WALLET_BUCKETS = Object.freeze(['paid', 'bonus', 'earnings']);
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
function calculateBalance(entries) {
    const buckets = createEmptyBalance();

    for (const entry of entries) {
        buckets[entry.bucket] += entry.amount;
    }

    return {
        buckets,
        total: Object.values(buckets).reduce((sum, amount) => sum + amount, 0),
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

        const entry = {
            id: uuidv4(),
            type: 'admin_grant',
            userHandle: targetHandle,
            actorHandle: currentHandle,
            bucket,
            amount,
            reason: String(body.reason || 'Admin grant').slice(0, 200),
            createdAt: Date.now(),
            metadata: {
                source: 'wallet.grants.admin',
            },
        };

        await storage.setItem(`${LEDGER_KEY_PREFIX}${entry.id}`, entry);

        const entries = await getUserLedgerEntries(targetHandle);
        return response.status(201).json({
            entry,
            handle: targetHandle,
            balance: calculateBalance(entries),
        });
    } catch (error) {
        console.error('Wallet admin grant failed:', error);
        return response.sendStatus(500);
    }
});
