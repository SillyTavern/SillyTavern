import path from 'node:path';
import fs from 'node:fs';

import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileSyncAtomic } from 'write-file-atomic';

import { validateAssetFileName } from './assets.js';
import { moveUploadedFile } from './images.js';
import { clientRelativePath } from '../util.js';

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

        const pathToUpload = path.join(request.user.directories.files, request.body.name);
        writeFileSyncAtomic(pathToUpload, request.body.data, 'base64');
        const url = clientRelativePath(request.user.directories.root, pathToUpload);
        console.info(`Uploaded file: ${url} from ${request.user.profile.handle}`);
        return response.send({ path: url });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

/**
 * Endpoint to handle raw multipart file uploads.
 * The file should be provided as a multipart form field named 'avatar'.
 * Avoids buffering the file contents in memory by moving the uploaded temp file into place.
 *
 * @route POST /api/files/upload-form
 * @param {Object} request.body - The multipart form fields.
 * @param {string} request.body.name - The name to save the file as.
 * @returns {Object} response - The response object containing the path where the file was saved.
 */
router.post('/upload-form', async (request, response) => {
    try {
        if (!request.file) {
            return response.status(400).send('No file uploaded');
        }

        if (!request.body.name) {
            await fs.promises.unlink(request.file.path).catch(() => { });
            return response.status(400).send('No upload name specified');
        }

        // Validate filename
        const validation = validateAssetFileName(request.body.name);
        if (validation.error) {
            await fs.promises.unlink(request.file.path).catch(() => { });
            return response.status(400).send(validation.message);
        }

        const pathToUpload = path.join(request.user.directories.files, request.body.name);
        await moveUploadedFile(request.file.path, pathToUpload);
        const url = clientRelativePath(request.user.directories.root, pathToUpload);
        console.info(`Uploaded file: ${url} from ${request.user.profile.handle}`);
        return response.send({ path: url });
    } catch (error) {
        console.error(error);
        if (request.file?.path) {
            await fs.promises.unlink(request.file.path).catch(() => { });
        }
        return response.sendStatus(500);
    }
});

router.post('/delete', async (request, response) => {
    try {
        if (!request.body.path) {
            return response.status(400).send('No path specified');
        }

        const pathToDelete = path.join(request.user.directories.root, request.body.path);
        if (!pathToDelete.startsWith(request.user.directories.files)) {
            return response.status(400).send('Invalid path');
        }

        if (!fs.existsSync(pathToDelete)) {
            return response.status(404).send('File not found');
        }

        fs.unlinkSync(pathToDelete);
        console.info(`Deleted file: ${request.body.path} from ${request.user.profile.handle}`);
        return response.sendStatus(200);
    } catch (error) {
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
            const pathToVerify = path.join(request.user.directories.root, url);
            if (!pathToVerify.startsWith(request.user.directories.files)) {
                console.warn(`File verification: Invalid path: ${pathToVerify}`);
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
