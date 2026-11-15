import express from 'express';

import {
    MULTI_WINDOW_ENABLED,
    registerSession,
    heartbeat,
    acquireLease,
    releaseLease,
    forceWrite,
} from '../multi-window.js';

export const router = express.Router();

/**
 * Extracts the (windowId, epoch) session identity from a request.
 * @param {import('express').Request} request
 * @returns {{windowId: string, epoch: number} | null}
 */
export function getSessionIdentity(request) {
    const windowId = request.get('X-Window-Id') || request.body?.windowId;
    const epoch = Number(request.get('X-Window-Epoch') ?? request.body?.epoch);
    if (!windowId || !Number.isInteger(epoch) || epoch < 0) {
        return null;
    }
    return { windowId, epoch };
}

router.post('/register', (request, response) => {
    if (!MULTI_WINDOW_ENABLED) {
        return response.status(404).json({ error: 'disabled' });
    }
    const identity = getSessionIdentity(request);
    if (!identity) {
        return response.status(400).json({ error: 'bad_identity' });
    }
    const result = registerSession(request.user.profile.handle, identity.windowId, identity.epoch);
    if (!result.ok) {
        return response.status(410).json({ error: 'poisoned', poisonReason: result.poisonReason });
    }
    return response.json({
        ok: true,
        poisonReason: result.poisonReason,
        ephemeralProfiles: result.ephemeralProfiles,
    });
});

router.post('/heartbeat', (request, response) => {
    if (!MULTI_WINDOW_ENABLED) {
        return response.status(404).json({ error: 'disabled' });
    }
    const identity = getSessionIdentity(request);
    if (!identity) {
        return response.status(400).json({ error: 'bad_identity' });
    }
    const result = heartbeat(request.user.profile.handle, identity.windowId, identity.epoch, request.body?.heldLeases);
    if (result.status === 'poisoned') {
        return response.status(410).json({ error: 'poisoned', poisonReason: result.poisonReason });
    }
    if (result.status === 'unknown') {
        return response.status(440).json({ error: 'unknown_session' });
    }
    return response.json(result);
});

router.post('/lease/acquire', (request, response) => {
    if (!MULTI_WINDOW_ENABLED) {
        return response.status(404).json({ error: 'disabled' });
    }
    const identity = getSessionIdentity(request);
    const key = request.body?.key;
    const mode = request.body?.mode;
    if (!identity || !key || !['read', 'write'].includes(mode)) {
        return response.status(400).json({ error: 'bad_request' });
    }
    const result = acquireLease(request.user.profile.handle, identity.windowId, identity.epoch, key, mode);
    if (!result.ok && result.status === 'poisoned') {
        return response.status(410).json({ error: 'poisoned' });
    }
    if (!result.ok && result.status === 'unknown') {
        return response.status(440).json({ error: 'unknown_session' });
    }
    return response.json(result);
});

router.post('/lease/release', (request, response) => {
    if (!MULTI_WINDOW_ENABLED) {
        return response.status(404).json({ error: 'disabled' });
    }
    const identity = getSessionIdentity(request);
    const key = request.body?.key;
    if (!identity || !key) {
        return response.status(400).json({ error: 'bad_request' });
    }
    releaseLease(request.user.profile.handle, identity.windowId, key);
    return response.json({ ok: true });
});

router.post('/lease/force-write', (request, response) => {
    if (!MULTI_WINDOW_ENABLED) {
        return response.status(404).json({ error: 'disabled' });
    }
    const identity = getSessionIdentity(request);
    const key = request.body?.key;
    if (!identity || !key) {
        return response.status(400).json({ error: 'bad_request' });
    }
    const result = forceWrite(request.user.profile.handle, identity.windowId, identity.epoch, key);
    if (!result.ok && result.status === 'poisoned') {
        return response.status(410).json({ error: 'poisoned' });
    }
    if (!result.ok && result.status === 'unknown') {
        return response.status(440).json({ error: 'unknown_session' });
    }
    return response.json(result);
});
