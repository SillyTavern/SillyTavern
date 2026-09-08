import path from 'node:path';
import fs from 'node:fs';

import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { MULTI_WINDOW_ENABLED, leaseWriteGuard, bumpLeaseOnSuccess } from '../multi-window.js';

export const router = express.Router();

const themeKey = (r) => `theme/${String(r.body?.name)}`;

/**
 * Overwriting an existing theme requires the write lease on it; creating a
 * new one does not (the interceptor in the multi-window client acquires and
 * releases the lease transiently around the save).
 */
router.post('/save', (request, response, next) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }
    const filename = path.join(request.user.directories.themes, sanitize(`${request.body.name}.json`));
    if (MULTI_WINDOW_ENABLED && fs.existsSync(filename)) {
        return leaseWriteGuard(themeKey)(request, response, next);
    }
    return next();
}, bumpLeaseOnSuccess, (request, response) => {
    const filename = path.join(request.user.directories.themes, sanitize(`${request.body.name}.json`));
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});

router.post('/delete', (request, response, next) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }
    if (MULTI_WINDOW_ENABLED) {
        return leaseWriteGuard(themeKey)(request, response, next);
    }
    return next();
}, bumpLeaseOnSuccess, (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    try {
        const filename = path.join(request.user.directories.themes, sanitize(`${request.body.name}.json`));
        if (!fs.existsSync(filename)) {
            console.error('Theme file not found:', filename);
            return response.sendStatus(404);
        }
        fs.unlinkSync(filename);
        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});
