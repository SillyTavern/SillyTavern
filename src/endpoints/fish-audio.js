import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import express from 'express';
import fetch from 'node-fetch';
import { readSecret, SECRET_KEYS } from './secrets.js';

export const router = express.Router();

const IDENTIFIER = /^[A-Za-z0-9._-]{1,128}$/;
const DEFAULT_MODEL = 'drama-3';
const LATENCY_VALUES = ['normal', 'balanced', 'low'];
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_VOICE_PAGES = 50;
const VOICE_PAGE_SIZE = 100;

/**
 * Throws an Error with an HTTP status code attached.
 * @param {number} status HTTP status code
 * @param {string} message Safe error message
 */
function fail(status, message) {
    throw Object.assign(new Error(message), { status });
}

/**
 * Wraps a Fish Audio route with auth lookup, timeout/disconnect abort, and sanitized error handling.
 * @param {number} timeoutMs Total deadline in milliseconds
 * @param {(request: express.Request, response: express.Response, upstream: Function) => Promise<void>} action Route handler
 * @returns {express.RequestHandler} Express middleware
 */
function handleRequest(timeoutMs, action) {
    return async (request, response) => {
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);
        const disconnect = () => controller.abort();
        response.once('close', disconnect);

        try {
            const key = readSecret(request.user.directories, SECRET_KEYS.FISH_AUDIO);
            if (!key) fail(400, 'Set a Fish Audio API key first.');

            const upstream = async (path, options = {}) => {
                const result = await fetch(`https://api.fish.audio${path}`, {
                    ...options,
                    headers: { ...options.headers, Authorization: `Bearer ${key}` },
                    signal: controller.signal,
                    size: MAX_RESPONSE_BYTES,
                });

                if (!result.ok) {
                    result.body?.destroy();
                    const retryAfter = result.headers.get('retry-after');
                    const validRetryAfter = retryAfter && /^[\x20-\x7e]{1,64}$/.test(retryAfter)
                        && (/^\d+$/.test(retryAfter) || !Number.isNaN(Date.parse(retryAfter)));
                    if ([429, 503].includes(result.status) && validRetryAfter) {
                        response.set('Retry-After', retryAfter);
                    }
                    // Fixed messages never expose upstream HTML, credentials, or request text.
                    const messages = {
                        401: 'Fish Audio rejected the API key.',
                        402: 'Fish Audio credits are exhausted.',
                        403: 'Fish Audio denied access to this resource.',
                        404: 'Fish Audio voice or resource was not found.',
                        422: 'Fish Audio rejected the synthesis parameters.',
                        429: 'Fish Audio rate limit reached. Try again later.',
                    };
                    // An upstream 401 must not reset SillyTavern browser authentication.
                    const status = result.status === 401 ? 400 : result.status < 500 || result.status === 503 ? result.status : 502;
                    fail(status, messages[result.status] ?? `Fish Audio request failed (HTTP ${result.status}).`);
                }

                return result;
            };

            await action(request, response, upstream);
        } catch (error) {
            if (response.destroyed) return;
            if (response.headersSent) {
                response.destroy();
            } else {
                response.status(timedOut ? 504 : error.status ?? 502).json({
                    error: timedOut ? 'Fish Audio request timed out.' : error.status ? error.message : 'Could not complete the Fish Audio request.',
                });
            }
        } finally {
            clearTimeout(timer);
            response.off('close', disconnect);
            controller.abort();
        }
    };
}

router.post('/voices', handleRequest(30_000, async (_request, response, upstream) => {
    const voices = new Map();
    const seen = new Set();
    let count = 0;
    let complete = false;
    let windowLimited = false;

    for (let pageNumber = 1; pageNumber <= MAX_VOICE_PAGES; pageNumber++) {
        const result = await upstream(`/model?self=true&page_size=${VOICE_PAGE_SIZE}&page_number=${pageNumber}&sort_by=created_at`);
        const page = await result.json();
        if (!Array.isArray(page?.items)) fail(502, 'Fish Audio returned an invalid voice list.');

        const previousCount = seen.size;
        count += page.items.length;
        windowLimited ||= page.window_limited === true;

        for (const item of page.items) {
            if (typeof item?._id !== 'string' || !IDENTIFIER.test(item._id)) continue;
            seen.add(item._id);
            if (item.type !== 'tts' || item.state !== 'trained' || item.dmca_taken_down || item.takedown_category) continue;
            voices.set(item._id, { id: item._id, name: String(item.title ?? '').slice(0, 100) });
        }

        const hasMore = typeof page.has_more === 'boolean'
            ? page.has_more
            : page.total_is_exact !== false && Number.isSafeInteger(page.total)
                ? count < page.total
                : page.items.length === VOICE_PAGE_SIZE;

        if (!hasMore) {
            complete = !windowLimited;
            break;
        }
        if (seen.size === previousCount) break;
    }

    response.json({ voices: [...voices.values()], complete });
}));

router.post('/synthesize', handleRequest(300_000, async (request, response, upstream) => {
    const {
        text,
        reference_id,
        model = DEFAULT_MODEL,
        latency = 'balanced',
        speed = 1,
        temperature = 0.7,
        top_p = 0.7,
    } = request.body ?? {};

    if (typeof text !== 'string' || !text.trim()) fail(400, 'Text is required.');
    if (typeof reference_id !== 'string' || !IDENTIFIER.test(reference_id)) fail(400, 'A valid Fish Audio reference ID is required.');
    if (typeof model !== 'string' || !IDENTIFIER.test(model)) fail(400, 'A valid Fish Audio model is required.');
    if (!LATENCY_VALUES.includes(latency)) fail(400, 'Latency must be normal, balanced, or low.');

    for (const [name, value, min, max] of [['Speed', speed, 0.5, 2], ['Temperature', temperature, 0, 1], ['Top P', top_p, 0, 1]]) {
        if (!Number.isFinite(value) || value < min || value > max) {
            fail(400, `${name} must be a number from ${min} to ${max}.`);
        }
    }

    const result = await upstream('/v1/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', model },
        body: JSON.stringify({ text, reference_id, format: 'mp3', latency, temperature, top_p, prosody: { speed } }),
    });

    const contentType = result.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!['audio/mpeg', 'audio/mp3'].includes(contentType)) {
        result.body?.destroy();
        fail(502, 'Fish Audio returned a non-audio response.');
    }
    if (!result.body) fail(502, 'Fish Audio returned empty audio.');

    const iterator = result.body[Symbol.asyncIterator]();
    let first;
    do {
        first = await iterator.next();
        if (first.done) fail(502, 'Fish Audio returned empty audio.');
    } while (!first.value.length);

    response.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
    await pipeline(Readable.from((async function* () {
        try {
            yield first.value;
            while (true) {
                const chunk = await iterator.next();
                if (chunk.done) return;
                yield chunk.value;
            }
        } finally {
            await iterator.return?.();
        }
    })()), response);
}));
