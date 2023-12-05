const path = require('path');
const writeFileSyncAtomic = require('write-file-atomic').sync;
const express = require('express');
const router = express.Router();
const { validateAssetFileName } = require('./assets');
const { jsonParser } = require('../express-common');
const { DIRECTORIES } = require('../constants');

router.post('/upload', jsonParser, async (request, response) => {
    try {
        if (!request.body.name) {
            return response.status(400).send('No upload name specified');
        }

        if (!request.body.data) {
            return response.status(400).send('No upload data specified');
        }

        const safeInput = validateAssetFileName(request.body.name);

        if (!safeInput) {
            return response.status(400).send('Invalid upload name');
        }

        const pathToUpload = path.join(DIRECTORIES.files, safeInput);
        writeFileSyncAtomic(pathToUpload, request.body.data, 'base64');
        const url = path.normalize(pathToUpload.replace('public' + path.sep, ''));
        return response.send({ path: url });
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

module.exports = { router };
