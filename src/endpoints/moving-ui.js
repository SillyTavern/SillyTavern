import path from 'node:path';
import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { jsonParser } from '../express-common.js';

export const router = express.Router();

router.post('/save', jsonParser, (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(request.user.directories.movingUI, sanitize(request.body.name) + '.json');
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});
