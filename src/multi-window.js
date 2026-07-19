import crypto from 'node:crypto';

import { getConfigValue } from './util.js';

export const MULTI_WINDOW_ENABLED = !!getConfigValue('multiWindow.enabled', false, 'boolean');

/**
 * Session considered dead if no heartbeat within this window. Generous on
 * purpose: browsers throttle timers in background tabs to as little as one
 * tick per minute, and a backgrounded window must not lose its session.
 */
const SESSION_TTL_MS = 3 * 60 * 1000;
/** Poison records are kept this long so a reloading window can fetch the reason. */
const POISON_TTL_MS = 10 * 60 * 1000;
/** Registry sweep cadence. */
const SWEEP_INTERVAL_MS = 30 * 1000;

/**
 * @typedef {'read'|'write'} LeaseMode
 *
 * @typedef {object} Session
 * @property {number} epoch
 * @property {number} lastSeen
 * @property {?{reason: string, byWindow: string, entity: string, at: number}} poisoned
 * @property {Map<string, object>} ephemeralProfiles
 *
 * @typedef {object} Lease
 * @property {Map<string, number>} readers - windowId -> lastRenewed
 * @property {?string} writer - windowId holding write-intent
 * @property {?string} writePending - windowId waiting for drain
 * @property {number} writePendingSince
 * @property {number} revision
 */

/**
 * Per-user in-memory multi-window state. Deliberately not persisted:
 * leases, revisions and ephemeral profiles die with the server process.
 */
class UserState {
    /** @type {Map<string, Session>} */
    sessions = new Map();
    /** @type {Map<string, Lease>} */
    leases = new Map();
}

/** @type {Map<string, UserState>} */
const users = new Map();

/**
 * @param {string} handle User account handle
 * @returns {UserState}
 */
function getUserState(handle) {
    let state = users.get(handle);
    if (!state) {
        state = new UserState();
        users.set(handle, state);
    }
    return state;
}

/**
 * @param {UserState} state
 * @param {string} entityKey
 * @returns {Lease}
 */
function getLease(state, entityKey) {
    let lease = state.leases.get(entityKey);
    if (!lease) {
        lease = { readers: new Map(), writer: null, writePending: null, writePendingSince: 0, revision: 1 };
        state.leases.set(entityKey, lease);
    }
    return lease;
}

/**
 * A session is live if it exists, is not poisoned, and has heartbeated recently.
 * @param {UserState} state
 * @param {string} windowId
 * @param {number} epoch
 * @returns {'live'|'poisoned'|'unknown'}
 */
function sessionStatus(state, windowId, epoch) {
    const session = state.sessions.get(windowId);
    if (!session || session.epoch !== epoch) {
        return 'unknown';
    }
    if (session.poisoned) {
        return 'poisoned';
    }
    if (Date.now() - session.lastSeen > SESSION_TTL_MS) {
        return 'unknown';
    }
    return 'live';
}

/**
 * Releases every lease held by a window.
 * @param {UserState} state
 * @param {string} windowId
 */
function releaseAllLeases(state, windowId) {
    for (const [key, lease] of state.leases) {
        lease.readers.delete(windowId);
        if (lease.writer === windowId) lease.writer = null;
        if (lease.writePending === windowId) lease.writePending = null;
        if (!lease.readers.size && !lease.writer && !lease.writePending) {
            state.leases.delete(key);
        }
    }
}

/**
 * Poisons a session: it becomes dead to the server until re-registration.
 * @param {UserState} state
 * @param {string} windowId
 * @param {{reason: string, byWindow: string, entity: string}} info
 */
function poisonSession(state, windowId, info) {
    const session = state.sessions.get(windowId);
    if (!session || session.poisoned) {
        return;
    }
    session.poisoned = { ...info, at: Date.now() };
    releaseAllLeases(state, windowId);
}

/**
 * Registers (or resurrects) a window session.
 * @param {string} handle
 * @param {string} windowId
 * @param {number} epoch
 * @returns {{ok: boolean, poisonReason: ?object, ephemeralProfiles: object[]}}
 */
export function registerSession(handle, windowId, epoch) {
    const state = getUserState(handle);
    const existing = state.sessions.get(windowId);

    // A fresh epoch clears poison and resurrects the session; the same epoch
    // re-registering is allowed only if it was never poisoned.
    if (existing && existing.poisoned && epoch <= existing.epoch) {
        return { ok: false, poisonReason: existing.poisoned, ephemeralProfiles: [] };
    }

    const poisonReason = existing?.poisoned ?? null;
    const ephemeralProfiles = existing ? [...existing.ephemeralProfiles.values()] : [];

    state.sessions.set(windowId, {
        epoch,
        lastSeen: Date.now(),
        poisoned: null,
        ephemeralProfiles: existing?.ephemeralProfiles ?? new Map(),
    });

    return { ok: true, poisonReason, ephemeralProfiles };
}

/**
 * Heartbeat: renews the session and its leases; reports revision bumps and
 * drain requests.
 * @param {string} handle
 * @param {string} windowId
 * @param {number} epoch
 * @param {{key: string, revision: number}[]} heldLeases - leases the client believes it holds
 * @returns {{status: 'live', revisionBumps: object[], drainRequests: string[]} | {status: 'poisoned', poisonReason: object} | {status: 'unknown'}}
 */
export function heartbeat(handle, windowId, epoch, heldLeases) {
    const state = getUserState(handle);
    const session = state.sessions.get(windowId);

    if (session && session.epoch === epoch && session.poisoned) {
        return { status: 'poisoned', poisonReason: session.poisoned };
    }
    if (sessionStatus(state, windowId, epoch) !== 'live') {
        return { status: 'unknown' };
    }

    session.lastSeen = Date.now();

    const revisionBumps = [];
    const drainRequests = [];

    for (const held of Array.isArray(heldLeases) ? heldLeases : []) {
        const lease = state.leases.get(held.key);
        if (!lease) {
            continue;
        }
        if (lease.readers.has(windowId)) {
            lease.readers.set(windowId, Date.now());
        }
        if (lease.revision !== held.revision) {
            revisionBumps.push({ key: held.key, revision: lease.revision });
        }
        // A pending writer drains passive readers; write-intent holders are
        // never drained automatically - they block until released or forced.
        if (lease.writePending && lease.writePending !== windowId && lease.readers.has(windowId)) {
            drainRequests.push(held.key);
        }
    }

    return { status: 'live', revisionBumps, drainRequests };
}

/**
 * Acquires a lease.
 * @param {string} handle
 * @param {string} windowId
 * @param {number} epoch
 * @param {string} entityKey
 * @param {LeaseMode} mode
 * @returns {{ok: true, revision: number} | {ok: false, status: string, holders?: number, writer?: boolean}}
 */
export function acquireLease(handle, windowId, epoch, entityKey, mode) {
    const state = getUserState(handle);
    const status = sessionStatus(state, windowId, epoch);
    if (status !== 'live') {
        return { ok: false, status };
    }

    const lease = getLease(state, entityKey);

    if (mode === 'read') {
        lease.readers.set(windowId, Date.now());
        return { ok: true, revision: lease.revision };
    }

    // Write-intent: exclusive against other writers; readers must drain.
    if (lease.writer && lease.writer !== windowId) {
        return { ok: false, status: 'conflict', writer: true, holders: 1 };
    }
    const otherReaders = [...lease.readers.keys()].filter(id => id !== windowId);
    if (otherReaders.length) {
        lease.writePending = windowId;
        lease.writePendingSince = lease.writePendingSince || Date.now();
        return { ok: false, status: 'draining', holders: otherReaders.length };
    }

    lease.writer = windowId;
    lease.writePending = null;
    lease.writePendingSince = 0;
    lease.readers.delete(windowId);
    return { ok: true, revision: lease.revision };
}

/**
 * Releases a lease held by a window.
 * @param {string} handle
 * @param {string} windowId
 * @param {string} entityKey
 */
export function releaseLease(handle, windowId, entityKey) {
    const state = getUserState(handle);
    const lease = state.leases.get(entityKey);
    if (!lease) {
        return;
    }
    lease.readers.delete(windowId);
    if (lease.writer === windowId) lease.writer = null;
    if (lease.writePending === windowId) lease.writePending = null;
    if (!lease.readers.size && !lease.writer && !lease.writePending) {
        state.leases.delete(entityKey);
    }
}

/**
 * Force-write: poisons every other holder of the entity's lease and grants
 * write-intent to the caller.
 * @param {string} handle
 * @param {string} windowId
 * @param {number} epoch
 * @param {string} entityKey
 * @returns {{ok: true, revision: number, poisonedCount: number} | {ok: false, status: string}}
 */
export function forceWrite(handle, windowId, epoch, entityKey) {
    const state = getUserState(handle);
    const status = sessionStatus(state, windowId, epoch);
    if (status !== 'live') {
        return { ok: false, status };
    }

    const lease = getLease(state, entityKey);
    const victims = new Set([...lease.readers.keys(), lease.writer, lease.writePending]
        .filter(id => id && id !== windowId));

    for (const victim of victims) {
        poisonSession(state, victim, {
            reason: 'force-write',
            byWindow: windowId,
            entity: entityKey,
        });
    }

    lease.readers.clear();
    lease.writer = windowId;
    lease.writePending = null;
    lease.writePendingSince = 0;
    return { ok: true, revision: lease.revision, poisonedCount: victims.size };
}

/**
 * Validates that a window may write an entity right now. Used by save
 * endpoints via middleware.
 * @param {string} handle
 * @param {string} windowId
 * @param {number} epoch
 * @param {string} entityKey
 * @returns {{ok: true} | {ok: false, status: 'poisoned'|'unknown'|'no_lease', poisonReason?: object}}
 */
export function validateWrite(handle, windowId, epoch, entityKey) {
    const state = getUserState(handle);
    const session = state.sessions.get(windowId);
    if (session && session.epoch === epoch && session.poisoned) {
        return { ok: false, status: 'poisoned', poisonReason: session.poisoned };
    }
    if (sessionStatus(state, windowId, epoch) !== 'live') {
        return { ok: false, status: 'unknown' };
    }
    const lease = state.leases.get(entityKey);
    if (!lease || lease.writer !== windowId) {
        return { ok: false, status: 'no_lease' };
    }
    return { ok: true };
}

/**
 * Bumps an entity's revision after a successful write.
 * @param {string} handle
 * @param {string} entityKey
 * @returns {number} the new revision
 */
export function bumpRevision(handle, entityKey) {
    const lease = getLease(getUserState(handle), entityKey);
    lease.revision += 1;
    return lease.revision;
}

/**
 * Poisons every live session of a user (global settings save; includes the
 * saver - the caller poisons itself last so its triggering request finishes).
 * @param {string} handle
 * @param {string} byWindow
 * @param {string} reason
 * @returns {number} number of sessions poisoned
 */
export function poisonAllSessions(handle, byWindow, reason) {
    const state = getUserState(handle);
    let count = 0;
    for (const windowId of state.sessions.keys()) {
        const session = state.sessions.get(windowId);
        if (session && !session.poisoned) {
            poisonSession(state, windowId, { reason, byWindow, entity: 'settings' });
            count++;
        }
    }
    return count;
}

/**
 * Upserts an ephemeral profile into a window's session. Ephemerals live in
 * server memory only: they survive tab reloads (same windowId) but die with
 * the server - by design, hence the client-side "save to keep" warning.
 * @param {string} handle
 * @param {string} windowId
 * @param {number} epoch
 * @param {object} profile Must have a string `id`
 * @returns {{ok: true} | {ok: false, status: string}}
 */
export function upsertEphemeralProfile(handle, windowId, epoch, profile) {
    const state = getUserState(handle);
    if (sessionStatus(state, windowId, epoch) !== 'live') {
        return { ok: false, status: sessionStatus(state, windowId, epoch) };
    }
    state.sessions.get(windowId).ephemeralProfiles.set(String(profile.id), profile);
    return { ok: true };
}

/**
 * Removes an ephemeral profile from a window's session (after it was saved
 * persistently or explicitly discarded).
 * @param {string} handle
 * @param {string} windowId
 * @param {number} epoch
 * @param {string} profileId
 * @returns {{ok: boolean}}
 */
export function deleteEphemeralProfile(handle, windowId, epoch, profileId) {
    const state = getUserState(handle);
    if (sessionStatus(state, windowId, epoch) !== 'live') {
        return { ok: false };
    }
    state.sessions.get(windowId).ephemeralProfiles.delete(String(profileId));
    return { ok: true };
}

/**
 * Current revision of an entity (1 if never written this server lifetime).
 * @param {string} handle
 * @param {string} entityKey
 * @returns {number}
 */
export function getRevision(handle, entityKey) {
    return users.get(handle)?.leases.get(entityKey)?.revision ?? 1;
}

/**
 * Generates an entity key for a connection profile.
 * @param {string} profileId
 * @returns {string}
 */
export function profileKey(profileId) {
    return `profile/${profileId}`;
}

/**
 * Generates an entity key for a character chat file.
 * @param {string} avatarUrl Character avatar file name (unique character id)
 * @param {string} fileName Chat file name without extension
 * @returns {string}
 */
export function chatKey(avatarUrl, fileName) {
    return `chat/${avatarUrl}/${fileName}`;
}

/**
 * Generates an entity key for a group chat file.
 * @param {string} chatId Group chat id
 * @returns {string}
 */
export function groupChatKey(chatId) {
    return `groupchat/${chatId}`;
}

/** Periodic sweep: expire dead sessions and stale poison records. */
function sweep() {
    const now = Date.now();
    for (const [handle, state] of users) {
        for (const [windowId, session] of state.sessions) {
            if (session.poisoned) {
                if (now - session.poisoned.at > POISON_TTL_MS) {
                    state.sessions.delete(windowId);
                }
            } else if (now - session.lastSeen > SESSION_TTL_MS) {
                releaseAllLeases(state, windowId);
                state.sessions.delete(windowId);
            }
        }
        if (!state.sessions.size && !state.leases.size) {
            users.delete(handle);
        }
    }
}

if (MULTI_WINDOW_ENABLED) {
    setInterval(sweep, SWEEP_INTERVAL_MS).unref();
}

/**
 * App-level middleware: a poisoned session is dead to the server. Every
 * request bearing a poisoned (windowId, epoch) is rejected with 410, except
 * re-registration. Requests without session headers pass through (static
 * assets, pre-registration boot calls).
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @param {import('express').NextFunction} next
 */
export function poisonGate(request, response, next) {
    if (!MULTI_WINDOW_ENABLED) {
        return next();
    }
    const windowId = request.get('X-Window-Id');
    if (!windowId || !request.user?.profile?.handle) {
        return next();
    }
    if (request.path === '/api/sessions/register') {
        return next();
    }
    const epoch = Number(request.get('X-Window-Epoch'));
    const session = getUserState(request.user.profile.handle).sessions.get(windowId);
    if (session && session.epoch === epoch && session.poisoned) {
        return response.status(410).json({ error: 'poisoned', poisonReason: session.poisoned });
    }
    return next();
}

/**
 * Middleware factory: gates a save endpoint behind a write-intent lease.
 * The entity key is derived from the request; on success it is stored on
 * `request.leaseKey` so the handler can bump the revision after writing.
 * @param {(request: import('express').Request) => string} keyFromRequest
 * @returns {import('express').RequestHandler}
 */
export function leaseWriteGuard(keyFromRequest) {
    return function (request, response, next) {
        if (!MULTI_WINDOW_ENABLED) {
            return next();
        }
        const windowId = request.get('X-Window-Id');
        const epoch = Number(request.get('X-Window-Epoch'));
        if (!windowId || !Number.isInteger(epoch)) {
            return response.status(440).json({ error: 'unknown_session' });
        }
        const key = keyFromRequest(request);
        const result = validateWrite(request.user.profile.handle, windowId, epoch, key);
        if (!result.ok) {
            if (result.status === 'poisoned') {
                return response.status(410).json({ error: 'poisoned', poisonReason: result.poisonReason });
            }
            if (result.status === 'unknown') {
                return response.status(440).json({ error: 'unknown_session' });
            }
            return response.status(409).json({ error: 'no_lease', key });
        }
        request.leaseKey = key;
        return next();
    };
}

/** Exposed for tests. */
export const _internal = { users, sweep, SESSION_TTL_MS };

/**
 * Creates a random window id (used by tests; real clients generate their own).
 * @returns {string}
 */
export function randomWindowId() {
    return crypto.randomUUID();
}
