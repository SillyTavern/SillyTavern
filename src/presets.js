const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');
const writeFileAtomicSync = require('write-file-atomic').sync;
const { DIRECTORIES } = require('./constants');

/**
 * Gets the folder and extension for the preset settings based on the API source ID.
 * @param {string} apiId API source ID
 * @returns {object} Object containing the folder and extension for the preset settings
 */
function getPresetSettingsByAPI(apiId) {
    switch (apiId) {
        case 'kobold':
        case 'koboldhorde':
            return { folder: DIRECTORIES.koboldAI_Settings, extension: '.settings' };
        case 'novel':
            return { folder: DIRECTORIES.novelAI_Settings, extension: '.settings' };
        case 'textgenerationwebui':
            return { folder: DIRECTORIES.textGen_Settings, extension: '.settings' };
        case 'openai':
            return { folder: DIRECTORIES.openAI_Settings, extension: '.settings' };
        case 'instruct':
            return { folder: DIRECTORIES.instruct, extension: '.json' };
        case 'context':
            return { folder: DIRECTORIES.context, extension: '.json' };
        default:
            return { folder: null, extension: null };
    }
}

/**
 * Registers the preset management endpoints.
 * @param {import('express').Express} app Express app
 * @param {any} jsonParser JSON parser middleware
 */
function registerEndpoints(app, jsonParser) {
    app.post("/api/presets/save", jsonParser, function (request, response) {
        const name = sanitize(request.body.name);
        if (!request.body.preset || !name) {
            return response.sendStatus(400);
        }

        const settings = getPresetSettingsByAPI(request.body.apiId);
        const filename = name + settings.extension;

        if (!settings.folder) {
            return response.sendStatus(400);
        }

        const fullpath = path.join(settings.folder, filename);
        writeFileAtomicSync(fullpath, JSON.stringify(request.body.preset, null, 4), 'utf-8');
        return response.send({ name });
    });

    app.post("/api/presets/delete", jsonParser, function (request, response) {
        const name = sanitize(request.body.name);
        if (!name) {
            return response.sendStatus(400);
        }

        const settings = getPresetSettingsByAPI(request.body.apiId);
        const filename = name + settings.extension;

        if (!settings.folder) {
            return response.sendStatus(400);
        }

        const fullpath = path.join(settings.folder, filename);

        if (fs.existsSync(fullpath)) {
            fs.unlinkSync(fullpath);
            return response.sendStatus(200);
        } else {
            return response.sendStatus(404);
        }
    });

    // TODO: Merge with /api/presets/save
    app.post("/api/presets/save-openai", jsonParser, function (request, response) {
        if (!request.body || typeof request.query.name !== 'string') return response.sendStatus(400);
        const name = sanitize(request.query.name);
        if (!name) return response.sendStatus(400);

        const filename = `${name}.settings`;
        const fullpath = path.join(DIRECTORIES.openAI_Settings, filename);
        writeFileAtomicSync(fullpath, JSON.stringify(request.body, null, 4), 'utf-8');
        return response.send({ name });
    });

    // TODO: Merge with /api/presets/delete
    app.post("/api/presets/delete-openai", jsonParser, function (request, response) {
        if (!request.body || !request.body.name) {
            return response.sendStatus(400);
        }

        const name = request.body.name;
        const pathToFile = path.join(DIRECTORIES.openAI_Settings, `${name}.settings`);

        if (fs.existsSync(pathToFile)) {
            fs.rmSync(pathToFile);
            return response.send({ ok: true });
        }

        return response.send({ error: true });
    });
}

module.exports = {
    registerEndpoints,
}
