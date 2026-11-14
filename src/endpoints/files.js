import path from 'node:path';
import fs from 'node:fs';

import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileSyncAtomic } from 'write-file-atomic';

import { validateAssetFileName } from './assets.js';
import { clientRelativePath, isPathUnderParent } from '../util.js';
import { resolveUploadPath, UploadDirectoryError } from '../upload-directories.js';

/**
 * Resolves the raw path returned by the upload endpoint.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {string} inputPath Path returned by the upload endpoint
 * @returns {string} Absolute file path
 */
function getFilePath(directories, inputPath) {
    if (typeof inputPath !== 'string') throw new UploadDirectoryError('Invalid path');
    const fullPath = path.join(directories.root, inputPath);
    if (!isPathUnderParent(directories.files, fullPath)) throw new UploadDirectoryError('Invalid path');
    const relativeDirectory = path.relative(directories.files, path.dirname(fullPath)).split(path.sep).join('/');
    return resolveUploadPath(directories.files, relativeDirectory, path.basename(fullPath));
}

export const router = express.Router();

router.post('/sanitize-filename', async (request, response) => {
    try {
        const fileName = String(request.body.fileName);
        if (!fileName) {
            return response.status(400).send('No fileName specified');
        }

        const sanitizedFilename = sanitize(fileName);
        return response.send({ fileName: sanitizedFilename });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

/**
 * Uploads file content while retaining the existing filename validation.
 * @param {string} [request.body.directory] Unencoded relative directory under user files.
 * @returns {Object} Raw path for verify/delete, plus an encoded browser URL when directory is provided.
 */
router.post('/upload', async (request, response) => {
    try {
        if (!request.body.name) {
            return response.status(400).send('No upload name specified');
        }

        if (!request.body.data) {
            return response.status(400).send('No upload data specified');
        }

        // Validate filename
        const validation = validateAssetFileName(request.body.name);
        if (validation.error)
            return response.status(400).send(validation.message);

        const hasDirectory = request.body.directory !== undefined;
        const pathToUpload = hasDirectory
            ? resolveUploadPath(request.user.directories.files, request.body.directory, request.body.name)
            : path.join(request.user.directories.files, request.body.name);
        if (hasDirectory) fs.mkdirSync(path.dirname(pathToUpload), { recursive: true });
        writeFileSyncAtomic(pathToUpload, request.body.data, 'base64');
        const relativePath = clientRelativePath(request.user.directories.root, pathToUpload);
        console.info(`Uploaded file: ${relativePath} from ${request.user.profile.handle}`);
        return response.send(hasDirectory
            ? { path: relativePath, url: relativePath.split('/').map(encodeURIComponent).join('/') }
            : { path: relativePath });
    } catch (error) {
        if (error instanceof UploadDirectoryError) return response.status(400).send(error.message);
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/delete', async (request, response) => {
    try {
        if (!request.body.path) {
            return response.status(400).send('No path specified');
        }

        const pathToDelete = getFilePath(request.user.directories, request.body.path);

        if (!fs.existsSync(pathToDelete)) {
            return response.status(404).send('File not found');
        }

        fs.unlinkSync(pathToDelete);
        console.info(`Deleted file: ${request.body.path} from ${request.user.profile.handle}`);
        return response.sendStatus(200);
    } catch (error) {
        if (error instanceof UploadDirectoryError) return response.status(400).send(error.message);
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/verify', async (request, response) => {
    try {
        if (!Array.isArray(request.body.urls)) {
            return response.status(400).send('No URLs specified');
        }

        const verified = {};

        for (const url of request.body.urls) {
            let pathToVerify;
            try {
                pathToVerify = getFilePath(request.user.directories, url);
            } catch (error) {
                if (!(error instanceof UploadDirectoryError)) throw error;
                console.warn('File verification: Invalid path:', url);
                continue;
            }
            const fileExists = fs.existsSync(pathToVerify);
            verified[url] = fileExists;
        }

        return response.send(verified);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});
