import path from 'node:path';
import fs from 'node:fs';

import express from 'express';
import sanitize from 'sanitize-filename';

export const router = express.Router();

router.post('/append', (request, response) => {
    try {
        if (!request.body) return response.sendStatus(400);

        const requestedName = String(request.body.filename ?? '').trim();
        const lines = Array.isArray(request.body.lines) ? request.body.lines : [];
        if (!requestedName || lines.length === 0) return response.sendStatus(400);

        const filename = sanitize(requestedName);
        if (!filename || !filename.endsWith('.log')) return response.status(400).json({ error: 'filename must end with .log' });

        const dir = request.user.directories.debugLogs;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, filename);
        const payload = lines.map(line => String(line)).join('\n') + '\n';
        fs.appendFileSync(filePath, payload, 'utf8');

        return response.json({ ok: true, path: path.relative(request.user.directories.root, filePath) });
    } catch (error) {
        console.error('[debug-logs] append failed', error);
        return response.status(500).json({ error: String(error?.message ?? error) });
    }
});
