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

const personaKey = (avatarId) => `persona/${String(avatarId)}`;

/**
 * Resolves (and creates on demand) the user's persona directory. Personas
 * migrate here out of the settings blob (power_user.personas +
 * persona_descriptions): one JSON file per persona, keyed by the avatar id.
 * The avatar images themselves stay in User Avatars/ untouched.
 * @param {import('express').Request} request
 * @returns {string}
 */
function getPersonasDir(request) {
    const dir = path.join(request.user.directories.root, 'personas');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * @param {import('express').Request} request
 * @param {string} avatarId
 * @returns {?string} Absolute persona file path, or null if the id is invalid
 */
function getPersonaPath(request, avatarId) {
    const fileName = sanitize(String(avatarId));
    if (!fileName) {
        return null;
    }
    return path.join(getPersonasDir(request), `${fileName}.json`);
}

router.post('/list', (request, response) => {
    const dir = getPersonasDir(request);
    const personas = [];
    for (const entry of fs.readdirSync(dir)) {
        if (!entry.endsWith('.json')) {
            continue;
        }
        try {
            const persona = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
            persona.revision = getRevision(request.user.profile.handle, personaKey(persona.avatarId));
            personas.push(persona);
        } catch (error) {
            console.warn(`Skipping unreadable persona "${entry}"`, error);
        }
    }
    return response.json({ personas });
});

/**
 * Saving a persona that already exists requires the write lease on it;
 * creating a new one does not (nobody can hold a lease on an id that does
 * not exist yet).
 */
router.post('/save', (request, response, next) => {
    const avatarId = request.body?.persona?.avatarId;
    const personaPath = avatarId ? getPersonaPath(request, avatarId) : null;
    if (!personaPath || typeof request.body?.persona?.name !== 'string') {
        return response.status(400).json({ error: 'bad_request' });
    }
    if (MULTI_WINDOW_ENABLED && fs.existsSync(personaPath)) {
        return leaseWriteGuard(() => personaKey(String(avatarId)))(request, response, next);
    }
    return next();
}, (request, response) => {
    const persona = request.body.persona;
    delete persona.revision; // server-owned, never persisted
    const personaPath = getPersonaPath(request, persona.avatarId);
    writeFileAtomicSync(personaPath, JSON.stringify(persona, null, 4), 'utf8');
    const revision = bumpRevision(request.user.profile.handle, personaKey(String(persona.avatarId)));
    return response.json({ ok: true, revision });
});

router.post('/delete', (request, response, next) => {
    const avatarId = request.body?.avatarId;
    if (!avatarId || !getPersonaPath(request, avatarId)) {
        return response.status(400).json({ error: 'bad_request' });
    }
    if (MULTI_WINDOW_ENABLED) {
        return leaseWriteGuard(() => personaKey(String(avatarId)))(request, response, next);
    }
    return next();
}, (request, response) => {
    const avatarId = String(request.body.avatarId);
    const personaPath = getPersonaPath(request, avatarId);
    if (fs.existsSync(personaPath)) {
        fs.rmSync(personaPath);
    }
    bumpRevision(request.user.profile.handle, personaKey(avatarId));
    return response.json({ ok: true });
});
