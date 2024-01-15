const fs = require('fs');
const path = require('path');
const express = require('express');
const sanitize = require('sanitize-filename');
const writeFileAtomicSync = require('write-file-atomic').sync;

const { jsonParser, urlencodedParser } = require('../express-common');
const { DIRECTORIES, UPLOADS_PATH } = require('../constants');

/**
 * Reads a World Info file and returns its contents
 * @param {string} worldInfoName Name of the World Info file
 * @param {boolean} allowDummy If true, returns an empty object if the file doesn't exist
 * @returns {object} World Info file contents
 */
function readWorldInfoFile(worldInfoName, allowDummy) {
    const dummyObject = allowDummy ? { entries: {} } : null;

    if (!worldInfoName) {
        return dummyObject;
    }

    const filename = `${worldInfoName}.json`;
    const pathToWorldInfo = path.join(DIRECTORIES.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        console.log(`World info file ${filename} doesn't exist.`);
        return dummyObject;
    }

    const worldInfoText = fs.readFileSync(pathToWorldInfo, 'utf8');
    const worldInfo = JSON.parse(worldInfoText);
    return worldInfo;
}

const router = express.Router();

router.post('/get', jsonParser, (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const file = readWorldInfoFile(request.body.name, true);

    return response.send(file);
});

router.post('/delete', jsonParser, (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const worldInfoName = request.body.name;
    const filename = sanitize(`${worldInfoName}.json`);
    const pathToWorldInfo = path.join(DIRECTORIES.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        throw new Error(`World info file ${filename} doesn't exist.`);
    }

    fs.rmSync(pathToWorldInfo);

    return response.sendStatus(200);
});

router.post('/import', urlencodedParser, (request, response) => {
    if (!request.file) return response.sendStatus(400);

    const filename = `${path.parse(sanitize(request.file.originalname)).name}.json`;

    let fileContents = null;

    if (request.body.convertedData) {
        fileContents = request.body.convertedData;
    } else {
        const pathToUpload = path.join(UPLOADS_PATH, request.file.filename);
        fileContents = fs.readFileSync(pathToUpload, 'utf8');
        fs.unlinkSync(pathToUpload);
    }

    try {
        const worldContent = JSON.parse(fileContents);
        if (!('entries' in worldContent)) {
            throw new Error('File must contain a world info entries list');
        }
    } catch (err) {
        return response.status(400).send('Is not a valid world info file');
    }

    const pathToNewFile = path.join(DIRECTORIES.worlds, filename);
    const worldName = path.parse(pathToNewFile).name;

    if (!worldName) {
        return response.status(400).send('World file must have a name');
    }

    writeFileAtomicSync(pathToNewFile, fileContents);
    return response.send({ name: worldName });
});

router.post('/edit', jsonParser, (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    if (!request.body.name) {
        return response.status(400).send('World file must have a name');
    }

    try {
        if (!('entries' in request.body.data)) {
            throw new Error('World info must contain an entries list');
        }
    } catch (err) {
        return response.status(400).send('Is not a valid world info file');
    }

    const filename = `${sanitize(request.body.name)}.json`;
    const pathToFile = path.join(DIRECTORIES.worlds, filename);

    writeFileAtomicSync(pathToFile, JSON.stringify(request.body.data, null, 4));

    return response.send({ ok: true });
});

module.exports = { router, readWorldInfoFile };
