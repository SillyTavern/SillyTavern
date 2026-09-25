import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { MULTI_WINDOW_ENABLED, leaseWriteGuard, bumpLeaseOnSuccess } from '../multi-window.js';

export const router = express.Router();

const qrKey = (r) => `qr/${String(r.body?.name)}`;

/**
 * Overwriting an existing Quick Reply set requires the write lease on it;
 * creating a new one does not (the interceptor in the multi-window client
 * acquires and releases the lease transiently around the save).
 */
router.post('/save', (request, response, next) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }
    const filename = path.join(request.user.directories.quickreplies, sanitize(`${request.body.name}.json`));
    if (MULTI_WINDOW_ENABLED && fs.existsSync(filename)) {
        return leaseWriteGuard(qrKey)(request, response, next);
    }
    return next();
}, bumpLeaseOnSuccess, (request, response) => {
    const filename = path.join(request.user.directories.quickreplies, sanitize(`${request.body.name}.json`));
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});

router.post('/delete', (request, response, next) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }
    if (MULTI_WINDOW_ENABLED) {
        return leaseWriteGuard(qrKey)(request, response, next);
    }
    return next();
}, bumpLeaseOnSuccess, (request, response) => {
    const filename = path.join(request.user.directories.quickreplies, sanitize(`${request.body.name}.json`));
    if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
    }

    return response.sendStatus(200);
});
