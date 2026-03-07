const SAVE_UPLOAD_COMPRESSION_THRESHOLD_BYTES = 256 * 1024;
const SAVE_UPLOAD_COMPRESSION_TIMEOUT_MS = 4000;

let saveUploadCompressionEnabled = true;

/**
 * Enables or disables save upload compression from server config.
 * @param {boolean|undefined} enabled
 */
export function setSaveUploadCompressionEnabled(enabled) {
    saveUploadCompressionEnabled = enabled !== false;
}

async function gzipRequestBody(requestBody) {
    if (typeof CompressionStream !== 'function') {
        return null;
    }

    const compressionStream = new CompressionStream('gzip');
    const writer = compressionStream.writable.getWriter();
    const input = new TextEncoder().encode(requestBody);
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
 * Compresses a fetch request using gzip when supported and worthwhile.
 * Compression is skipped when feature-toggle is disabled, body is too small,
 * body is not a string, CompressionStream is unavailable, or compression fails/timeouts.
 *
 * @param {RequestInit} request fetch request parameters
 * @returns {Promise<RequestInit>} A request init object that may include gzip-compressed body
 */
export async function compressRequest(request) {
    const plainRequest = { ...request };
    const requestBody = plainRequest?.body;

    if (!saveUploadCompressionEnabled || typeof CompressionStream !== 'function') {
        return plainRequest;
    }

    if (!requestBody || typeof requestBody !== 'string') {
        return plainRequest;
    }

    const bodySize = new TextEncoder().encode(requestBody).byteLength;
    if (bodySize < SAVE_UPLOAD_COMPRESSION_THRESHOLD_BYTES) {
        return plainRequest;
    }

    try {
        const compressedBody = await withCompressionTimeout(
            gzipRequestBody(requestBody),
            SAVE_UPLOAD_COMPRESSION_TIMEOUT_MS,
            'compress_native_gzip',
        );

        if (!compressedBody || compressedBody.byteLength >= bodySize) {
            return plainRequest;
        }

        const headers = new Headers(plainRequest.headers ?? undefined);
        headers.set('Content-Encoding', 'gzip');

        return {
            ...plainRequest,
            headers,
            body: compressedBody,
        };
    } catch (error) {
        console.warn('Failed to compress request body, using plain request.', error);
        return plainRequest;
    }
}
