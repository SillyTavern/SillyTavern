
const fs = require('fs');
const path = require('path');
const writeFileAtomicSync = require('write-file-atomic').sync;
const { DIRECTORIES, UPLOADS_PATH } = require('./constants');
const { getImageBuffers } = require('./util');

/**
 * Imports base64 encoded sprites from RisuAI character data.
 * @param {object} data RisuAI character data
 * @returns {void}
 */
function importRisuSprites(data) {
    try {
        const name = data?.data?.name;
        const risuData = data?.data?.extensions?.risuai;

        // Not a Risu AI character
        if (!risuData || !name) {
            return;
        }

        let images = [];

        if (Array.isArray(risuData.additionalAssets)) {
            images = images.concat(risuData.additionalAssets);
        }

        if (Array.isArray(risuData.emotions)) {
            images = images.concat(risuData.emotions);
        }

        // No sprites to import
        if (images.length === 0) {
            return;
        }

        // Create sprites folder if it doesn't exist
        const spritesPath = path.join(DIRECTORIES.characters, name);
        if (!fs.existsSync(spritesPath)) {
            fs.mkdirSync(spritesPath);
        }

        // Path to sprites is not a directory. This should never happen.
        if (!fs.statSync(spritesPath).isDirectory()) {
            return;
        }

        console.log(`RisuAI: Found ${images.length} sprites for ${name}. Writing to disk.`);
        const files = fs.readdirSync(spritesPath);

        outer: for (const [label, fileBase64] of images) {
            // Remove existing sprite with the same label
            for (const file of files) {
                if (path.parse(file).name === label) {
                    console.log(`RisuAI: The sprite ${label} for ${name} already exists. Skipping.`);
                    continue outer;
                }
            }

            const filename = label + '.png';
            const pathToFile = path.join(spritesPath, filename);
            writeFileAtomicSync(pathToFile, fileBase64, { encoding: 'base64' });
        }

        // Remove additionalAssets and emotions from data (they are now in the sprites folder)
        delete data.data.extensions.risuai.additionalAssets;
        delete data.data.extensions.risuai.emotions;
    } catch (error) {
        console.error(error);
    }
}

/**
 * Registers the endpoints for the sprite management.
 * @param {import('express').Express} app Express app
 * @param {any} jsonParser JSON parser middleware
 * @param {any} urlencodedParser URL encoded parser middleware
 */
function registerEndpoints(app, jsonParser, urlencodedParser) {
    app.post('/api/sprites/delete', jsonParser, async (request, response) => {
        const label = request.body.label;
        const name = request.body.name;

        if (!label || !name) {
            return response.sendStatus(400);
        }

        try {
            const spritesPath = path.join(DIRECTORIES.characters, name);

            // No sprites folder exists, or not a directory
            if (!fs.existsSync(spritesPath) || !fs.statSync(spritesPath).isDirectory()) {
                return response.sendStatus(404);
            }

            const files = fs.readdirSync(spritesPath);

            // Remove existing sprite with the same label
            for (const file of files) {
                if (path.parse(file).name === label) {
                    fs.rmSync(path.join(spritesPath, file));
                }
            }

            return response.sendStatus(200);
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    app.post('/api/sprites/upload-zip', urlencodedParser, async (request, response) => {
        const file = request.file;
        const name = request.body.name;

        if (!file || !name) {
            return response.sendStatus(400);
        }

        try {
            const spritesPath = path.join(DIRECTORIES.characters, name);

            // Create sprites folder if it doesn't exist
            if (!fs.existsSync(spritesPath)) {
                fs.mkdirSync(spritesPath);
            }

            // Path to sprites is not a directory. This should never happen.
            if (!fs.statSync(spritesPath).isDirectory()) {
                return response.sendStatus(404);
            }

            const spritePackPath = path.join(UPLOADS_PATH, file.filename);
            const sprites = await getImageBuffers(spritePackPath);
            const files = fs.readdirSync(spritesPath);

            for (const [filename, buffer] of sprites) {
                // Remove existing sprite with the same label
                const existingFile = files.find(file => path.parse(file).name === path.parse(filename).name);

                if (existingFile) {
                    fs.rmSync(path.join(spritesPath, existingFile));
                }

                // Write sprite buffer to disk
                const pathToSprite = path.join(spritesPath, filename);
                writeFileAtomicSync(pathToSprite, buffer);
            }

            // Remove uploaded ZIP file
            fs.rmSync(spritePackPath);
            return response.send({ count: sprites.length });
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });

    app.post('/api/sprites/upload', urlencodedParser, async (request, response) => {
        const file = request.file;
        const label = request.body.label;
        const name = request.body.name;

        if (!file || !label || !name) {
            return response.sendStatus(400);
        }

        try {
            const spritesPath = path.join(DIRECTORIES.characters, name);

            // Create sprites folder if it doesn't exist
            if (!fs.existsSync(spritesPath)) {
                fs.mkdirSync(spritesPath);
            }

            // Path to sprites is not a directory. This should never happen.
            if (!fs.statSync(spritesPath).isDirectory()) {
                return response.sendStatus(404);
            }

            const files = fs.readdirSync(spritesPath);

            // Remove existing sprite with the same label
            for (const file of files) {
                if (path.parse(file).name === label) {
                    fs.rmSync(path.join(spritesPath, file));
                }
            }

            const filename = label + path.parse(file.originalname).ext;
            const spritePath = path.join(UPLOADS_PATH, file.filename);
            const pathToFile = path.join(spritesPath, filename);
            // Copy uploaded file to sprites folder
            fs.cpSync(spritePath, pathToFile);
            // Remove uploaded file
            fs.rmSync(spritePath);
            return response.sendStatus(200);
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });
}

module.exports = {
    registerEndpoints,
    importRisuSprites,
}
