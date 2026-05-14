import path from 'node:path';
import fs from 'node:fs';

import express from 'express';
import sanitize from 'sanitize-filename';

export const router = express.Router();

/**
 * Process-wide capture state. Off by default so production traffic isn't
 * silently mirrored to disk. State is intentionally not persisted across
 * restarts — clients flip it back on through the UI when they want a session.
 */
const state = {
    enabled: false,
    maxFiles: 200,
};

export function isCaptureEnabled() {
    return state.enabled;
}

function dumpsDir(request) {
    const dir = request.user.directories.promptDumps;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Writes a captured prompt to the per-user prompt-dump directory.
 * Filename pattern: <ISO-stamp>__<source>.json (stamp uses dashes so it's
 * safe across filesystems and sorts chronologically).
 *
 * @param {import('express').Request} request the original express request — used for user.directories
 * @param {object} payload arbitrary JSON-safe payload describing the captured prompt
 * @param {string} sourceLabel short label used in the filename (e.g. "chat-claude", "text-kobold")
 */
export function dumpPrompt(request, payload, sourceLabel) {
    if (!state.enabled) return;
    try {
        const dir = dumpsDir(request);
        rotateDumps(dir);

        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeLabel = sanitize(String(sourceLabel || 'unknown')).slice(0, 40) || 'unknown';
        const filename = `${stamp}__${safeLabel}.json`;
        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (error) {
        console.error('[prompt-viewer] dump failed:', error);
    }
}

function rotateDumps(dir) {
    try {
        const entries = fs.readdirSync(dir)
            .filter(f => f.endsWith('.json'))
            .map(f => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
            .sort((a, b) => a.m - b.m);
        const excess = entries.length - state.maxFiles + 1;
        for (let i = 0; i < excess; i++) {
            fs.unlinkSync(path.join(dir, entries[i].f));
        }
    } catch (error) {
        console.warn('[prompt-viewer] rotate failed:', error);
    }
}

router.get('/status', (_request, response) => {
    return response.json({ enabled: state.enabled, maxFiles: state.maxFiles });
});

router.post('/toggle', (request, response) => {
    const requested = request.body?.enabled;
    state.enabled = typeof requested === 'boolean' ? requested : !state.enabled;
    return response.json({ enabled: state.enabled });
});

router.get('/list', (request, response) => {
    try {
        const dir = dumpsDir(request);
        const files = fs.readdirSync(dir)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const stat = fs.statSync(path.join(dir, f));
                return { name: f, size: stat.size, mtime: stat.mtimeMs };
            })
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, 100);
        return response.json({ enabled: state.enabled, files });
    } catch (error) {
        console.error('[prompt-viewer] list failed:', error);
        return response.status(500).json({ error: String(error?.message ?? error) });
    }
});

router.get('/file', (request, response) => {
    try {
        const requested = String(request.query.name ?? '');
        const safe = sanitize(requested);
        if (!safe || !safe.endsWith('.json')) {
            return response.status(400).json({ error: 'invalid filename' });
        }
        const filePath = path.join(dumpsDir(request), safe);
        if (!fs.existsSync(filePath)) {
            return response.status(404).json({ error: 'not found' });
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        response.type('application/json').send(raw);
    } catch (error) {
        console.error('[prompt-viewer] read failed:', error);
        return response.status(500).json({ error: String(error?.message ?? error) });
    }
});

router.post('/clear', (request, response) => {
    try {
        const dir = dumpsDir(request);
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const f of files) fs.unlinkSync(path.join(dir, f));
        return response.json({ deleted: files.length });
    } catch (error) {
        console.error('[prompt-viewer] clear failed:', error);
        return response.status(500).json({ error: String(error?.message ?? error) });
    }
});
