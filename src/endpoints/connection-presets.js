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
} from '../multi-window.js';

export const router = express.Router();

const presetKey = (id) => `preset/${String(id)}`;

const META_FILE = '_meta.json';

/**
 * Resolves (and creates on demand) the user's connection preset directory.
 * @param {import('express').Request} request
 * @returns {string}
 */
function getProfilesDir(request) {
    const dir = path.join(request.user.directories.root, 'connection-presets');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * @param {import('express').Request} request
 * @param {string} id
 * @returns {?string} Absolute preset file path, or null if the id is invalid
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
    const presets = [];
    for (const entry of fs.readdirSync(dir)) {
        if (!entry.endsWith('.json') || entry === META_FILE) {
            continue;
        }
        try {
            const preset = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
            preset.revision = getRevision(request.user.profile.handle, presetKey(preset.id));
            presets.push(preset);
        } catch (error) {
            console.warn(`Skipping unreadable connection preset "${entry}"`, error);
        }
    }
    return response.json({ presets, defaultId: meta.defaultId ?? null });
});

/**
 * Saving a preset that already exists requires the write lease on it;
 * creating a new one does not (nobody else can hold a lease on an id that
 * does not exist yet - the client generates a fresh uuid).
 */
router.post('/save', (request, response, next) => {
    const id = request.body?.preset?.id;
    const presetPath = id ? getProfilePath(request, id) : null;
    if (!presetPath || !request.body?.preset?.name) {
        return response.status(400).json({ error: 'bad_request' });
    }
    if (MULTI_WINDOW_ENABLED && fs.existsSync(presetPath)) {
        return leaseWriteGuard(() => presetKey(String(id)))(request, response, next);
    }
    return next();
}, (request, response) => {
    const preset = request.body.preset;
    delete preset.revision; // server-owned, never persisted
    const presetPath = getProfilePath(request, preset.id);
    writeFileAtomicSync(presetPath, JSON.stringify(preset, null, 4), 'utf8');
    const revision = bumpRevision(request.user.profile.handle, presetKey(String(preset.id)));
    if (request.body.makeDefault) {
        writeMeta(request, { ...readMeta(request), defaultId: String(preset.id) });
    }
    return response.json({ ok: true, revision });
});

router.post('/delete', (request, response, next) => {
    const id = request.body?.id;
    if (!id || !getProfilePath(request, id)) {
        return response.status(400).json({ error: 'bad_request' });
    }
    if (MULTI_WINDOW_ENABLED) {
        return leaseWriteGuard(() => presetKey(String(id)))(request, response, next);
    }
    return next();
}, (request, response) => {
    const id = String(request.body.id);
    const presetPath = getProfilePath(request, id);
    if (fs.existsSync(presetPath)) {
        fs.rmSync(presetPath);
    }
    bumpRevision(request.user.profile.handle, presetKey(id));
    const meta = readMeta(request);
    if (meta.defaultId === id) {
        delete meta.defaultId;
        writeMeta(request, meta);
    }
    return response.json({ ok: true });
});

router.post('/set-default', (request, response) => {
    const id = request.body?.id;
    const presetPath = id ? getProfilePath(request, id) : null;
    if (!presetPath || !fs.existsSync(presetPath)) {
        return response.status(400).json({ error: 'bad_request' });
    }
    writeMeta(request, { ...readMeta(request), defaultId: String(id) });
    return response.json({ ok: true });
});
