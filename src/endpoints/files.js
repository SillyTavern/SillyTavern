const path = require('path');
const writeFileSyncAtomic = require('write-file-atomic').sync;
const express = require('express');
const router = express.Router();
const { validateAssetFileName } = require('./assets');
const { jsonParser } = require('../express-common');
const { DIRECTORIES } = require('../constants');
const { clientRelativePath } = require('../util');

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

        const pathToUpload = path.join(DIRECTORIES.files, request.body.name);
        writeFileSyncAtomic(pathToUpload, request.body.data, 'base64');
        const url = clientRelativePath(pathToUpload);
        return response.send({ path: url });
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

module.exports = { router };
