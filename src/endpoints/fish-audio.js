import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import express from 'express';
import fetch from 'node-fetch';

import { getConfigValue, getVersion, trimV1 } from '../util.js';
import { readSecret, SECRET_KEYS } from './secrets.js';

const router = express.Router();
const FISH_API_BASE_URL = 'https://api.fish.audio';
const VOICE_LIST_TIMEOUT_MS = 30_000;
const SYNTHESIS_TIMEOUT_MS = 300_000;
const VOICE_PAGE_SIZE = 100;
const MAX_VOICE_PAGES = 100;
const MAX_ERROR_BYTES = 2_000;
const MAX_CLIENT_ERROR_LENGTH = 500;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]+$/;
const ALLOWED_LATENCY_VALUES = new Set(['low', 'normal', 'balanced']);
const AUDIO_CONTENT_TYPES = new Set(['audio/mpeg', 'audio/mp3']);

async function getUserAgent() {
    const version = await getVersion();
    return `${version.agent} (SillyTavern Fish Audio TTS)`;
}

function getFishApiBaseUrl() {
    return trimV1(getConfigValue('fishAudio.apiBaseUrl', FISH_API_BASE_URL));
}

function createRequestAbortContext(request, response, timeoutMs) {
    const controller = new AbortController();
    let timedOut = false;
    let disconnected = false;

    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    const onDisconnect = () => {
        if (!response.writableEnded) {
            disconnected = true;
            controller.abort();
        }
    };

    request.once('aborted', onDisconnect);
    response.once('close', onDisconnect);

    return {
        signal: controller.signal,
        didTimeOut: () => timedOut,
        didDisconnect: () => disconnected,
        cleanup: () => {
            clearTimeout(timeout);
            request.removeListener('aborted', onDisconnect);
            response.removeListener('close', onDisconnect);
        },
    };
}

function isAbortError(error) {
    return error?.name === 'AbortError';
}

function isResponseUnavailable(response) {
    return response.destroyed || response.writableEnded;
}

function closeResponseBody(response) {
    const body = response.body;
    if (body && 'destroy' in body && typeof body.destroy === 'function') {
        body.destroy();
    }
}

function sanitizeErrorMessage(message) {
    return String(message ?? '')
        .replace(/Authorization\s*:\s*Bearer\s+\S+/gi, 'Authorization: [redacted]')
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .replace(/((?:api[_ -]?key|authorization|token)\s*[:=]?\s*)\S+/gi, '$1[redacted]')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_CLIENT_ERROR_LENGTH);
}

async function readBoundedResponseText(response) {
    const chunks = [];
    let totalBytes = 0;

    for await (const chunk of response.body ?? []) {
        const buffer = Buffer.from(chunk);
        const remainingBytes = MAX_ERROR_BYTES - totalBytes;
        if (remainingBytes <= 0) {
            break;
        }

        chunks.push(buffer.subarray(0, remainingBytes));
        totalBytes += Math.min(buffer.length, remainingBytes);
        if (totalBytes >= MAX_ERROR_BYTES) {
            closeResponseBody(response);
            break;
        }
    }

    return Buffer.concat(chunks).toString('utf8');
}

async function getUpstreamErrorMessage(response) {
    const fallback = `Fish Audio request failed with HTTP ${response.status}.`;

    try {
        const rawText = await readBoundedResponseText(response);
        const parsed = JSON.parse(rawText);
        const detail = Array.isArray(parsed?.detail)
            ? parsed.detail.map(item => item?.msg).filter(Boolean).join('; ')
            : parsed?.detail;
        const candidate = parsed?.message ?? parsed?.error ?? detail;
        return sanitizeErrorMessage(candidate) || fallback;
    } catch (error) {
        if (isAbortError(error)) {
            throw error;
        }
        // Raw text and HTML responses are intentionally not reflected to clients or logs.
        return fallback;
    }
}

function throwIfAborted(signal) {
    if (signal.aborted) {
        const error = new Error('Request aborted');
        error.name = 'AbortError';
        throw error;
    }
}

function getForwardedErrorStatus(status) {
    if (status === 401 || status === 403) {
        return 400;
    }

    if (status >= 400 && status < 500) {
        return status;
    }

    return 502;
}

function normalizeOwnedVoice(model) {
    if (model?.type !== 'tts' || model?.state !== 'trained' || model?.dmca_taken_down === true) {
        return null;
    }

    const id = typeof model._id === 'string' ? model._id.trim() : '';
    const title = typeof model.title === 'string' ? model.title.trim() : '';
    if (!id || !IDENTIFIER_PATTERN.test(id) || !title) {
        return null;
    }

    return {
        _id: id,
        title: title.slice(0, 256),
        languages: Array.isArray(model.languages)
            ? model.languages.filter(language => typeof language === 'string').map(language => language.slice(0, 32))
            : [],
    };
}

function getAudioContentType(response) {
    return String(response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
}

async function getFirstNonEmptyChunk(body) {
    const iterator = body[Symbol.asyncIterator]();

    while (true) {
        const result = await iterator.next();
        if (result.done) {
            return null;
        }

        const chunk = Buffer.from(result.value);
        if (chunk.length > 0) {
            return { chunk, iterator };
        }
    }
}

function createAudioStream(firstChunk, iterator) {
    return Readable.from((async function* () {
        yield firstChunk;
        while (true) {
            const result = await iterator.next();
            if (result.done) {
                return;
            }

            const chunk = Buffer.from(result.value);
            if (chunk.length > 0) {
                yield chunk;
            }
        }
    })());
}

router.post('/voices', async (request, response) => {
    const apiKey = readSecret(request.user.directories, SECRET_KEYS.FISH_AUDIO);
    if (!apiKey) {
        return response.status(400).json({ error: 'Fish Audio API key is not configured.' });
    }

    const voices = [];
    let abortContext;

    try {
        abortContext = createRequestAbortContext(request, response, VOICE_LIST_TIMEOUT_MS);
        const userAgent = await getUserAgent();
        let pageNumber = 1;
        let itemsSeen = 0;

        while (pageNumber <= MAX_VOICE_PAGES) {
            const url = new URL('/model', getFishApiBaseUrl());
            url.searchParams.set('self', 'true');
            url.searchParams.set('page_size', String(VOICE_PAGE_SIZE));
            url.searchParams.set('page_number', String(pageNumber));

            const upstreamResponse = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'User-Agent': userAgent,
                },
                signal: abortContext.signal,
            });

            if (!upstreamResponse.ok) {
                const errorMessage = await getUpstreamErrorMessage(upstreamResponse);
                throwIfAborted(abortContext.signal);
                console.warn(`Fish Audio voice listing failed (${upstreamResponse.status}): ${errorMessage}`);
                return response.status(getForwardedErrorStatus(upstreamResponse.status)).json({ error: errorMessage });
            }

            const page = await upstreamResponse.json();
            if (!Array.isArray(page?.items)) {
                throw new Error('Fish Audio returned an invalid voice list.');
            }

            itemsSeen += page.items.length;
            for (const item of page.items) {
                const voice = normalizeOwnedVoice(item);
                if (voice) {
                    voices.push(voice);
                }
            }

            const total = Number(page.total);
            const hasMore = typeof page.has_more === 'boolean'
                ? page.has_more
                : Number.isFinite(total) && itemsSeen < total;

            if (!hasMore || page.items.length === 0) {
                break;
            }

            pageNumber += 1;
        }

        if (pageNumber > MAX_VOICE_PAGES) {
            throw new Error(`Fish Audio voice listing exceeded ${MAX_VOICE_PAGES} pages.`);
        }

        return response.json({ voices });
    } catch (error) {
        if (abortContext?.didDisconnect() || isResponseUnavailable(response)) {
            return;
        }
        if (abortContext?.didTimeOut() || isAbortError(error)) {
            return response.status(504).json({ error: 'Fish Audio voice listing timed out.' });
        }

        const errorMessage = sanitizeErrorMessage(error?.message) || 'Unknown error';
        console.error(`Fish Audio voice listing failed: ${errorMessage}`);
        return response.status(502).json({ error: 'Could not retrieve Fish Audio voices.' });
    } finally {
        abortContext?.cleanup();
    }
});

router.post('/synthesize', async (request, response) => {
    const apiKey = readSecret(request.user.directories, SECRET_KEYS.FISH_AUDIO);
    if (!apiKey) {
        return response.status(400).json({ error: 'Fish Audio API key is not configured.' });
    }

    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const referenceId = typeof body.reference_id === 'string' ? body.reference_id.trim() : '';
    const model = typeof body.model === 'string' ? body.model.trim() : '';
    const latency = typeof body.latency === 'string' ? body.latency : '';
    const speed = Number(body.speed);
    const temperature = Number(body.temperature);
    const topP = Number(body.top_p);

    if (!text) {
        return response.status(400).json({ error: 'Text is required.' });
    }
    if (!referenceId || !IDENTIFIER_PATTERN.test(referenceId)) {
        return response.status(400).json({ error: 'A valid Fish Audio reference ID is required.' });
    }
    if (!model || !IDENTIFIER_PATTERN.test(model)) {
        return response.status(400).json({ error: 'A valid Fish Audio model is required.' });
    }
    if (!ALLOWED_LATENCY_VALUES.has(latency)) {
        return response.status(400).json({ error: 'A valid Fish Audio latency setting is required.' });
    }
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) {
        return response.status(400).json({ error: 'Fish Audio speed must be between 0.5 and 2.' });
    }
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
        return response.status(400).json({ error: 'Fish Audio temperature must be between 0 and 1.' });
    }
    if (!Number.isFinite(topP) || topP < 0 || topP > 1) {
        return response.status(400).json({ error: 'Fish Audio top_p must be between 0 and 1.' });
    }

    let abortContext;

    try {
        abortContext = createRequestAbortContext(request, response, SYNTHESIS_TIMEOUT_MS);
        const userAgent = await getUserAgent();
        const upstreamResponse = await fetch(new URL('/v1/tts', getFishApiBaseUrl()), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                model,
                'User-Agent': userAgent,
            },
            body: JSON.stringify({
                text,
                reference_id: referenceId,
                format: 'mp3',
                latency,
                temperature,
                top_p: topP,
                prosody: { speed },
            }),
            signal: abortContext.signal,
        });

        if (!upstreamResponse.ok) {
            const errorMessage = await getUpstreamErrorMessage(upstreamResponse);
            throwIfAborted(abortContext.signal);
            console.warn(`Fish Audio synthesis failed (${upstreamResponse.status}): ${errorMessage}`);
            return response.status(getForwardedErrorStatus(upstreamResponse.status)).json({ error: errorMessage });
        }

        if (!upstreamResponse.body) {
            return response.status(502).json({ error: 'Fish Audio returned an empty audio response.' });
        }

        const contentType = getAudioContentType(upstreamResponse);
        if (!AUDIO_CONTENT_TYPES.has(contentType)) {
            closeResponseBody(upstreamResponse);
            console.warn(`Fish Audio synthesis returned an unexpected content type: ${sanitizeErrorMessage(contentType) || 'missing'}`);
            return response.status(502).json({ error: 'Fish Audio returned a non-audio response.' });
        }

        const first = await getFirstNonEmptyChunk(upstreamResponse.body);
        if (!first) {
            return response.status(502).json({ error: 'Fish Audio returned an empty audio response.' });
        }

        response.status(200);
        response.setHeader('Content-Type', 'audio/mpeg');
        response.setHeader('Cache-Control', 'no-store');
        await pipeline(createAudioStream(first.chunk, first.iterator), response);
    } catch (error) {
        if (abortContext?.didDisconnect() || isResponseUnavailable(response)) {
            return;
        }
        if (abortContext?.didTimeOut() || isAbortError(error)) {
            return response.status(504).json({ error: 'Fish Audio synthesis timed out.' });
        }

        const errorMessage = sanitizeErrorMessage(error?.message) || 'Unknown error';
        console.error(`Fish Audio synthesis failed: ${errorMessage}`);
        if (!response.headersSent) {
            return response.status(502).json({ error: 'Could not synthesize Fish Audio speech.' });
        }
        response.destroy(error);
    } finally {
        abortContext?.cleanup();
    }
});

export { router };
