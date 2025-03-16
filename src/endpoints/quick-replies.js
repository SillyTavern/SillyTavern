import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

export const router = express.Router();

router.post('/save', (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(request.user.directories.quickreplies, sanitize(request.body.name) + '.json');
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});

router.post('/delete', (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(request.user.directories.quickreplies, sanitize(request.body.name) + '.json');
    if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
    }

    return response.sendStatus(200);
});
