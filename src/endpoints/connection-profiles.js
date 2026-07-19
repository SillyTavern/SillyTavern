import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import {
    MULTI_WINDOW_ENABLED,
    leaseWriteGuard,
    bumpRevision,
    getRevision,
    profileKey,
    upsertEphemeralProfile,
    deleteEphemeralProfile,
} from '../multi-window.js';
import { getSessionIdentity } from './sessions.js';

export const router = express.Router();

const META_FILE = '_meta.json';

/**
 * Resolves (and creates on demand) the user's connection profile directory.
 * @param {import('express').Request} request
 * @returns {string}
 */
function getProfilesDir(request) {
    const dir = path.join(request.user.directories.root, 'connection-profiles');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * @param {import('express').Request} request
 * @param {string} id
 * @returns {?string} Absolute profile file path, or null if the id is invalid
 */
function getProfilePath(request, id) {
    const fileName = sanitize(String(id));
    if (!fileName || fileName === META_FILE) {
        return null;
    }
    return path.join(getProfilesDir(request), `${fileName}.json`);
}

function readMeta(request) {
    try {
        return JSON.parse(fs.readFileSync(path.join(getProfilesDir(request), META_FILE), 'utf8'));
    } catch {
        return {};
    }
}

function writeMeta(request, meta) {
    writeFileAtomicSync(path.join(getProfilesDir(request), META_FILE), JSON.stringify(meta, null, 4), 'utf8');
}

router.post('/list', (request, response) => {
    const dir = getProfilesDir(request);
    const meta = readMeta(request);
    const profiles = [];
    for (const entry of fs.readdirSync(dir)) {
        if (!entry.endsWith('.json') || entry === META_FILE) {
            continue;
        }
        try {
            const profile = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
            profile.revision = getRevision(request.user.profile.handle, profileKey(profile.id));
            profiles.push(profile);
        } catch (error) {
            console.warn(`Skipping unreadable connection profile "${entry}"`, error);
        }
    }
    return response.json({ profiles, defaultId: meta.defaultId ?? null });
});

/**
 * Saving a profile that already exists requires the write lease on it;
 * creating a new one does not (nobody else can hold a lease on an id that
 * does not exist yet - the client generates a fresh uuid).
 */
router.post('/save', (request, response, next) => {
    const id = request.body?.profile?.id;
    const profilePath = id ? getProfilePath(request, id) : null;
    if (!profilePath || !request.body?.profile?.name) {
        return response.status(400).json({ error: 'bad_request' });
    }
    if (MULTI_WINDOW_ENABLED && fs.existsSync(profilePath)) {
        return leaseWriteGuard(() => profileKey(String(id)))(request, response, next);
    }
    return next();
}, (request, response) => {
    const profile = request.body.profile;
    delete profile.revision; // server-owned, never persisted
    const profilePath = getProfilePath(request, profile.id);
    writeFileAtomicSync(profilePath, JSON.stringify(profile, null, 4), 'utf8');
    const revision = bumpRevision(request.user.profile.handle, profileKey(String(profile.id)));
    // A saved profile supersedes this window's ephemeral copy of it.
    const identity = getSessionIdentity(request);
    if (identity) {
        deleteEphemeralProfile(request.user.profile.handle, identity.windowId, identity.epoch, String(profile.id));
    }
    if (request.body.makeDefault) {
        writeMeta(request, { ...readMeta(request), defaultId: String(profile.id) });
    }
    return response.json({ ok: true, revision });
});

router.post('/delete', (request, response, next) => {
    const id = request.body?.id;
    if (!id || !getProfilePath(request, id)) {
        return response.status(400).json({ error: 'bad_request' });
    }
    if (MULTI_WINDOW_ENABLED) {
        return leaseWriteGuard(() => profileKey(String(id)))(request, response, next);
    }
    return next();
}, (request, response) => {
    const id = String(request.body.id);
    const profilePath = getProfilePath(request, id);
    if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath);
    }
    bumpRevision(request.user.profile.handle, profileKey(id));
    const meta = readMeta(request);
    if (meta.defaultId === id) {
        delete meta.defaultId;
        writeMeta(request, meta);
    }
    return response.json({ ok: true });
});

router.post('/set-default', (request, response) => {
    const id = request.body?.id;
    const profilePath = id ? getProfilePath(request, id) : null;
    if (!profilePath || !fs.existsSync(profilePath)) {
        return response.status(400).json({ error: 'bad_request' });
    }
    writeMeta(request, { ...readMeta(request), defaultId: String(id) });
    return response.json({ ok: true });
});

/** Debounced upsert of a window's ephemeral (unsaved) profile. */
router.post('/ephemeral', (request, response) => {
    if (!MULTI_WINDOW_ENABLED) {
        return response.status(404).json({ error: 'disabled' });
    }
    const identity = getSessionIdentity(request);
    const profile = request.body?.profile;
    if (!identity || !profile?.id) {
        return response.status(400).json({ error: 'bad_request' });
    }
    const result = request.body.remove
        ? deleteEphemeralProfile(request.user.profile.handle, identity.windowId, identity.epoch, String(profile.id))
        : upsertEphemeralProfile(request.user.profile.handle, identity.windowId, identity.epoch, profile);
    if (!result.ok) {
        return response.status(440).json({ error: 'unknown_session' });
    }
    return response.json({ ok: true });
});
