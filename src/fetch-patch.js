import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mime from 'mime-types';

const originalFetch = globalThis.fetch;

const ALLOWED_EXTENSIONS = [
    '.wasm',
];

/**
 * Checks if a child path is under a parent path.
 * @param {string} parentPath Parent path
 * @param {string} childPath Child path
 * @returns {boolean} Returns true if the child path is under the parent path, false otherwise
 */
function isPathUnderParent(parentPath, childPath) {
    const normalizedParent = path.normalize(parentPath);
    const normalizedChild = path.normalize(childPath);

    const relativePath = path.relative(normalizedParent, normalizedChild);

    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

/**
 * Checks if the given request is a file URL.
 * @param {string | URL | Request} request The request to check
 * @return {boolean} Returns true if the request is a file URL, false otherwise
 */
function isFileURL(request) {
    if (typeof request === 'string') {
        return request.startsWith('file://');
    }
    if (request instanceof URL) {
        return request.protocol === 'file:';
    }
    if (request instanceof Request) {
        return request.url.startsWith('file://');
    }
    return false;
}

/**
 * Gets the URL from the request.
 * @param {string | URL | Request} request The request to get the URL from
 * @return {string} The URL of the request
 */
function getRequestURL(request) {
    if (typeof request === 'string') {
        return request;
    }
    if (request instanceof URL) {
        return request.href;
    }
    if (request instanceof Request) {
        return request.url;
    }
    throw new TypeError('Invalid request type');
}

// Patched fetch function that handles file URLs
globalThis.fetch = async (/** @type {string | URL | Request} */ request, /** @type {RequestInit | undefined} */ options) => {
    if (!isFileURL(request)) {
        return originalFetch(request, options);
    }
    const url = getRequestURL(request);
    const filePath = path.resolve(fileURLToPath(url));
    const cwd = path.resolve(process.cwd()) + path.sep;
    const isUnderCwd = isPathUnderParent(cwd, filePath);
    if (!isUnderCwd) {
        throw new Error('Requested file path is outside of the current working directory.');
    }
    const parsedPath = path.parse(filePath);
    if (!ALLOWED_EXTENSIONS.includes(parsedPath.ext)) {
        throw new Error('Unsupported file extension.');
    }
    const fileName = parsedPath.base;
    const buffer = await fs.promises.readFile(filePath);
    const response = new Response(buffer, {
        status: 200,
        statusText: 'OK',
        headers: {
            'Content-Type': mime.lookup(fileName) || 'application/octet-stream',
            'Content-Length': buffer.length.toString(),
        },
    });
    return response;
};
