const path = require('path');
const fs = require('fs');
const express = require('express');
const sanitize = require('sanitize-filename');
const fetch = require('node-fetch').default;
const { finished } = require('stream/promises');
const { DIRECTORIES, UNSAFE_EXTENSIONS } = require('../constants');
const { jsonParser } = require('../express-common');
const { clientRelativePath } = require('../util');

const VALID_CATEGORIES = ['bgm', 'ambient', 'blip', 'live2d', 'vrm'];

/**
 * Validates the input filename for the asset.
 * @param {string} inputFilename Input filename
 * @returns {{error: boolean, message?: string}} Whether validation failed, and why if so
 */
function validateAssetFileName(inputFilename) {
    if (!/^[a-zA-Z0-9_\-.]+$/.test(inputFilename)) {
        return {
            error: true,
            message: 'Illegal character in filename; only alphanumeric, \'_\', \'-\' are accepted.',
        };
    }

    const inputExtension = path.extname(inputFilename).toLowerCase();
    if (UNSAFE_EXTENSIONS.some(ext => ext === inputExtension)) {
        return {
            error: true,
            message: 'Forbidden file extension.',
        };
    }

    if (inputFilename.startsWith('.')) {
        return {
            error: true,
            message: 'Filename cannot start with \'.\'',
        };
    }

    if (sanitize(inputFilename) !== inputFilename) {
        return {
            error: true,
            message: 'Reserved or long filename.',
        };
    }

    return { error: false };
}

// Recursive function to get files
function getFiles(dir, files = []) {
    // Get an array of all files and directories in the passed directory using fs.readdirSync
    const fileList = fs.readdirSync(dir, { withFileTypes: true });
    // Create the full path of the file/directory by concatenating the passed directory and file/directory name
    for (const file of fileList) {
        const name = path.join(dir, file.name);
        // Check if the current file/directory is a directory using fs.statSync
        if (file.isDirectory()) {
            // If it is a directory, recursively call the getFiles function with the directory path and the files array
            getFiles(name, files);
        } else {
            // If it is a file, push the full path to the files array
            files.push(name);
        }
    }
    return files;
}

const router = express.Router();

/**
 * HTTP POST handler function to retrieve name of all files of a given folder path.
 *
 * @param {Object} request - HTTP Request object. Require folder path in query
 * @param {Object} response - HTTP Response object will contain a list of file path.
 *
 * @returns {void}
 */
router.post('/get', jsonParser, async (_, response) => {
    const folderPath = path.join(DIRECTORIES.assets);
    let output = {};
    //console.info("Checking files into",folderPath);

    try {
        if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
            const folders = fs.readdirSync(folderPath, { withFileTypes: true })
                .filter(file => file.isDirectory());

            for (const { name: folder } of folders) {
                if (folder == 'temp')
                    continue;

                // Live2d assets
                if (folder == 'live2d') {
                    output[folder] = [];
                    const live2d_folder = path.normalize(path.join(folderPath, folder));
                    const files = getFiles(live2d_folder);
                    //console.debug("FILE FOUND:",files)
                    for (let file of files) {
                        if (file.includes('model') && file.endsWith('.json')) {
                            //console.debug("Asset live2d model found:",file)
                            output[folder].push(clientRelativePath(file));
                        }
                    }
                    continue;
                }

                // VRM assets
                if (folder == 'vrm') {
                    output[folder] = { 'model': [], 'animation': [] };
                    // Extract models
                    const vrm_model_folder = path.normalize(path.join(folderPath, 'vrm', 'model'));
                    let files = getFiles(vrm_model_folder);
                    //console.debug("FILE FOUND:",files)
                    for (let file of files) {
                        if (!file.endsWith('.placeholder')) {
                            //console.debug("Asset VRM model found:",file)
                            output['vrm']['model'].push(clientRelativePath(file));
                        }
                    }

                    // Extract models
                    const vrm_animation_folder = path.normalize(path.join(folderPath, 'vrm', 'animation'));
                    files = getFiles(vrm_animation_folder);
                    //console.debug("FILE FOUND:",files)
                    for (let file of files) {
                        if (!file.endsWith('.placeholder')) {
                            //console.debug("Asset VRM animation found:",file)
                            output['vrm']['animation'].push(clientRelativePath(file));
                        }
                    }
                    continue;
                }

                // Other assets (bgm/ambient/blip)
                const files = fs.readdirSync(path.join(folderPath, folder))
                    .filter(filename => {
                        return filename != '.placeholder';
                    });
                output[folder] = [];
                for (const file of files) {
                    output[folder].push(`assets/${folder}/${file}`);
                }
            }
        }
    }
    catch (err) {
        console.log(err);
    }
    return response.send(output);
});

/**
 * HTTP POST handler function to download the requested asset.
 *
 * @param {Object} request - HTTP Request object, expects a url, a category and a filename.
 * @param {Object} response - HTTP Response only gives status.
 *
 * @returns {void}
 */
router.post('/download', jsonParser, async (request, response) => {
    const url = request.body.url;
    const inputCategory = request.body.category;

    // Check category
    let category = null;
    for (let i of VALID_CATEGORIES)
        if (i == inputCategory)
            category = i;

    if (category === null) {
        console.debug('Bad request: unsuported asset category.');
        return response.sendStatus(400);
    }

    // Validate filename
    const validation = validateAssetFileName(request.body.filename);
    if (validation.error)
        return response.status(400).send(validation.message);

    const temp_path = path.join(DIRECTORIES.assets, 'temp', request.body.filename);
    const file_path = path.join(DIRECTORIES.assets, category, request.body.filename);
    console.debug('Request received to download', url, 'to', file_path);

    try {
        // Download to temp
        const res = await fetch(url);
        if (!res.ok || res.body === null) {
            throw new Error(`Unexpected response ${res.statusText}`);
        }
        const destination = path.resolve(temp_path);
        // Delete if previous download failed
        if (fs.existsSync(temp_path)) {
            fs.unlink(temp_path, (err) => {
                if (err) throw err;
            });
        }
        const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
        await finished(res.body.pipe(fileStream));

        // Move into asset place
        console.debug('Download finished, moving file from', temp_path, 'to', file_path);
        fs.renameSync(temp_path, file_path);
        response.sendStatus(200);
    }
    catch (error) {
        console.log(error);
        response.sendStatus(500);
    }
});

/**
 * HTTP POST handler function to delete the requested asset.
 *
 * @param {Object} request - HTTP Request object, expects a category and a filename
 * @param {Object} response - HTTP Response only gives stats.
 *
 * @returns {void}
 */
router.post('/delete', jsonParser, async (request, response) => {
    const inputCategory = request.body.category;

    // Check category
    let category = null;
    for (let i of VALID_CATEGORIES)
        if (i == inputCategory)
            category = i;

    if (category === null) {
        console.debug('Bad request: unsuported asset category.');
        return response.sendStatus(400);
    }

    // Validate filename
    const validation = validateAssetFileName(request.body.filename);
    if (validation.error)
        return response.status(400).send(validation.message);

    const file_path = path.join(DIRECTORIES.assets, category, request.body.filename);
    console.debug('Request received to delete', category, file_path);

    try {
        // Delete if previous download failed
        if (fs.existsSync(file_path)) {
            fs.unlink(file_path, (err) => {
                if (err) throw err;
            });
            console.debug('Asset deleted.');
        }
        else {
            console.debug('Asset not found.');
            response.sendStatus(400);
        }
        // Move into asset place
        response.sendStatus(200);
    }
    catch (error) {
        console.log(error);
        response.sendStatus(500);
    }
});

///////////////////////////////
/**
 * HTTP POST handler function to retrieve a character background music list.
 *
 * @param {Object} request - HTTP Request object, expects a character name in the query.
 * @param {Object} response - HTTP Response object will contain a list of audio file path.
 *
 * @returns {void}
 */
router.post('/character', jsonParser, async (request, response) => {
    if (request.query.name === undefined) return response.sendStatus(400);
    // For backwards compatibility, don't reject invalid character names, just sanitize them
    const name = sanitize(request.query.name.toString());
    const inputCategory = request.query.category;

    // Check category
    let category = null;
    for (let i of VALID_CATEGORIES)
        if (i == inputCategory)
            category = i;

    if (category === null) {
        console.debug('Bad request: unsuported asset category.');
        return response.sendStatus(400);
    }

    const folderPath = path.join(DIRECTORIES.characters, name, category);

    let output = [];
    try {
        if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {

            // Live2d assets
            if (category == 'live2d') {
                const folders = fs.readdirSync(folderPath, { withFileTypes: true });
                for (const folderInfo of folders) {
                    if (!folderInfo.isDirectory()) continue;

                    const modelFolder = folderInfo.name;
                    const live2dModelPath = path.join(folderPath, modelFolder);
                    for (let file of fs.readdirSync(live2dModelPath)) {
                        //console.debug("Character live2d model found:", file)
                        if (file.includes('model') && file.endsWith('.json'))
                            output.push(path.join('characters', name, category, modelFolder, file));
                    }
                }
                return response.send(output);
            }

            // Other assets
            const files = fs.readdirSync(folderPath)
                .filter(filename => {
                    return filename != '.placeholder';
                });

            for (let i of files)
                output.push(`/characters/${name}/${category}/${i}`);
        }
        return response.send(output);
    }
    catch (err) {
        console.log(err);
        return response.sendStatus(500);
    }
});

module.exports = { router, validateAssetFileName };
