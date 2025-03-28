import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mime from 'mime-types';

const originalFetch = globalThis.fetch;

// Patched fetch function that handles file URLs
const fetchPatch = async (/** @type {string | URL | Request} */ request, /** @type {RequestInit | undefined} */ options) => {
    if ((request instanceof URL && request.protocol === 'file:') || (typeof request === 'string' && request.startsWith('file://'))) {
        const filePath = fileURLToPath(request);
        const isUnderCwd = filePath.startsWith(path.resolve(process.cwd()));
        if (!isUnderCwd) {
            throw new Error(`File path ${filePath} is outside of the current working directory.`);
        }
        const fileName = path.parse(filePath).base;
        const buffer = fs.readFileSync(filePath);
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
