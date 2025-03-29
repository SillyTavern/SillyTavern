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

// Patched fetch function that handles file URLs
const fetchPatch = async (/** @type {string | URL | Request} */ request, /** @type {RequestInit | undefined} */ options) => {
    if ((request instanceof URL && request.protocol === 'file:') || (typeof request === 'string' && request.startsWith('file://'))) {
        const filePath = path.resolve(fileURLToPath(request));
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
        const blob = new Blob([buffer]);
        const response = new Response(blob, {
            status: 200,
            statusText: 'OK',
            headers: {
                'Content-Type': mime.lookup(fileName) || 'application/octet-stream',
                'Content-Length': buffer.length.toString(),
            },
        });
        return response;
    }

    return originalFetch(request, options);
};

globalThis.fetch = fetchPatch;
