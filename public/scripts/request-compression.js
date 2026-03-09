/**
 * @type {RequestCompressionConfig}
 *
 * @typedef {Object} RequestCompressionConfig
 * @property {boolean} enabled Whether request compression is enabled.
 * @property {number} threshold Minimum payload size in bytes to trigger compression.
 * @property {number} timeout Timeout for request compression in milliseconds.
 */
const requestCompressionConfig = {
    enabled: false,
    threshold: 0,
    timeout: 0,
};

/**
 * Sets the configuration for request compression from the server.
 * @param {RequestCompressionConfig} config Configuration object for request compression
 */
export function setRequestCompressionConfig(config) {
    Object.assign(requestCompressionConfig, (config ?? {}));
}

/**
 * Compresses a Uint8Array using gzip if supported by the browser.
 * @param {Uint8Array<ArrayBuffer>} input Uint8Array to compress
 * @returns {Promise<Uint8Array<ArrayBuffer>|null>} Gzip-compressed Uint8Array, or null if compression is not supported/failed.
 */
async function gzipBuffer(input) {
    if (typeof CompressionStream !== 'function') {
        return null;
    }

    const compressionStream = new CompressionStream('gzip');
    const writer = compressionStream.writable.getWriter();
    await writer.write(input);
    await writer.close();
    const compressed = await new Response(compressionStream.readable).arrayBuffer();
    return new Uint8Array(compressed);
}

/**
 * Wraps a promise with a timeout, rejecting if the promise does not settle within the specified time.
 * @param {Promise<T>} promise Promise to wrap with a timeout
 * @param {number} timeoutMs Timeout in milliseconds
 * @param {string} label Used for error message if timeout occurs
 * @returns {Promise<T>} Resolves with the original promise's value if it settles in time, otherwise rejects with a timeout error
 * @template T Type of the promise's resolved value
 */
async function withTimeout(promise, timeoutMs, label) {
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

    if (!requestCompressionConfig.enabled || typeof CompressionStream !== 'function') {
        return plainRequest;
    }

    if (!requestBody || typeof requestBody !== 'string') {
        return plainRequest;
    }

    const textEncoder = new TextEncoder();
    const encodedBody = textEncoder.encode(requestBody);
    const bodySize = encodedBody.byteLength;
    if (bodySize < requestCompressionConfig.threshold) {
        return plainRequest;
    }

    try {
        const compressedBody = await withTimeout(
            gzipBuffer(encodedBody),
            requestCompressionConfig.timeout,
            'compress_native_gzip',
        );

        if (!compressedBody || compressedBody.byteLength >= bodySize) {
            return plainRequest;
        }

        const headers = new Headers(plainRequest.headers ?? {});
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
