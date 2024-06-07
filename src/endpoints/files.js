const path = require('path');
const fs = require('fs');
const writeFileSyncAtomic = require('write-file-atomic').sync;
const express = require('express');
const sanitize = require('sanitize-filename');
const router = express.Router();
const { validateAssetFileName } = require('./assets');
const { jsonParser } = require('../express-common');
const { clientRelativePath } = require('../util');

router.post('/sanitize-filename', jsonParser, async (request, response) => {
    try {
        const fileName = String(request.body.fileName);
        if (!fileName) {
            return response.status(400).send('No fileName specified');
        }

        const sanitizedFilename = sanitize(fileName);
        return response.send({ fileName: sanitizedFilename });
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/upload', jsonParser, async (request, response) => {
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
        console.log(`Uploaded file: ${url} from ${request.user.profile.handle}`);
        return response.send({ path: url });
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/delete', jsonParser, async (request, response) => {
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

        fs.rmSync(pathToDelete);
        console.log(`Deleted file: ${request.body.path} from ${request.user.profile.handle}`);
        return response.sendStatus(200);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/verify', jsonParser, async (request, response) => {
    try {
        if (!Array.isArray(request.body.urls)) {
            return response.status(400).send('No URLs specified');
        }

        const verified = {};

        for (const url of request.body.urls) {
            const pathToVerify = path.join(request.user.directories.root, url);
            if (!pathToVerify.startsWith(request.user.directories.files)) {
                console.debug(`File verification: Invalid path: ${pathToVerify}`);
                continue;
            }
            const fileExists = fs.existsSync(pathToVerify);
            verified[url] = fileExists;
        }

        return response.send(verified);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

module.exports = { router };
