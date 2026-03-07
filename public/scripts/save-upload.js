import { Bowser, fflate } from '../lib.js';

const SAVE_UPLOAD_COMPRESSION_THRESHOLD_BYTES = 256 * 1024;
const SAVE_UPLOAD_COMPRESSION_RETRY_STATUSES = new Set([400, 408, 413, 415, 422, 425, 429, 500, 502, 503, 504]);
const SAVE_UPLOAD_COMPRESSION_TIMEOUT_MS = 4000;

let saveUploadCompressionEnabled = true;

/**
 * Enables or disables save upload compression from server config.
 * @param {boolean|undefined} enabled
 */
export function setSaveUploadCompressionEnabled(enabled) {
    saveUploadCompressionEnabled = enabled !== false;
}

function isLikelyWebKitBrowserForCompression() {
    try {
        const parser = Bowser.getParser(navigator?.userAgent ?? '');
        const osName = parser.getOSName()?.toLowerCase();
        const engineName = parser.getEngineName()?.toLowerCase();
        const browserName = parser.getBrowserName()?.toLowerCase();
        return osName === 'ios' || (engineName === 'webkit' && browserName === 'safari');
    } catch {
        return false;
    }
}

async function gzipJsonBodyWithFflate(jsonBody) {
    if (typeof fflate?.gzipSync !== 'function') {
        return null;
    }

    const input = new TextEncoder().encode(jsonBody);
    const compressed = fflate.gzipSync(input, { level: 6 });
    return compressed instanceof Uint8Array ? compressed : new Uint8Array(compressed);
}

async function gzipJsonBodyWithNative(jsonBody) {
    if (typeof CompressionStream !== 'function') {
        return null;
    }

    const compressionStream = new CompressionStream('gzip');
    const writer = compressionStream.writable.getWriter();
    const input = new TextEncoder().encode(jsonBody);
    await writer.write(input);
    await writer.close();
    const compressed = await new Response(compressionStream.readable).arrayBuffer();
    return new Uint8Array(compressed);
}

async function withCompressionTimeout(promise, timeoutMs, label) {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
    }
}

/**
 * Sends large JSON save payloads with gzip compression when beneficial.
 * @param {string} url
 * @param {object} payload
 * @param {HeadersInit} headers
 * @returns {Promise<Response>}
 */
export async function postSaveJson(url, payload, headers) {
    const jsonBody = JSON.stringify(payload);
    const requestHeaders = headers ?? {};
    const plainRequest = {
        method: 'POST',
        headers: requestHeaders,
        body: jsonBody,
        cache: 'no-cache',
    };

    const bodySize = new TextEncoder().encode(jsonBody).byteLength;
    const canCompress = saveUploadCompressionEnabled && bodySize >= SAVE_UPLOAD_COMPRESSION_THRESHOLD_BYTES;

    if (!canCompress) {
        return fetch(url, plainRequest);
    }

    const compressionEngines = isLikelyWebKitBrowserForCompression()
        ? ['fflate']
        : ['fflate', 'native'];

    for (const engine of compressionEngines) {
        try {
            const compressionPromise = engine === 'fflate'
                ? gzipJsonBodyWithFflate(jsonBody)
                : gzipJsonBodyWithNative(jsonBody);

            const compressedBody = await withCompressionTimeout(
                compressionPromise,
                SAVE_UPLOAD_COMPRESSION_TIMEOUT_MS,
                `compress_${engine}_gzip`,
            );

            if (!compressedBody || compressedBody.byteLength >= bodySize) {
                continue;
            }

            const compressedResponse = await fetch(url, {
                ...plainRequest,
                headers: {
                    ...requestHeaders,
                    'Content-Encoding': 'gzip',
                },
                body: compressedBody,
            });

            if (compressedResponse.ok || !SAVE_UPLOAD_COMPRESSION_RETRY_STATUSES.has(compressedResponse.status)) {
                return compressedResponse;
            }

            console.warn(`Compressed save request failed (${compressedResponse.status}, ${engine}), retrying without compression.`);
        } catch (error) {
            console.warn(`Compressed save request failed before upload (${engine}), retrying without compression.`, error);
        }
    }

    return fetch(url, plainRequest);
}
