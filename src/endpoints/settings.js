const fs = require('fs');
const path = require('path');
const express = require('express');
const writeFileAtomicSync = require('write-file-atomic').sync;
const { PUBLIC_DIRECTORIES } = require('../constants');
const { getConfigValue, generateTimestamp, removeOldBackups } = require('../util');
const { jsonParser } = require('../express-common');
const { getAllUserHandles, getUserDirectories } = require('../users');

const SETTINGS_FILE = 'settings.json';
const enableExtensions = getConfigValue('enableExtensions', true);

function readAndParseFromDirectory(directoryPath, fileExtension = '.json') {
    const files = fs
        .readdirSync(directoryPath)
        .filter(x => path.parse(x).ext == fileExtension)
        .sort();

    const parsedFiles = [];

    files.forEach(item => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), 'utf-8');
            parsedFiles.push(fileExtension == '.json' ? JSON.parse(file) : file);
        }
        catch {
            // skip
        }
    });

    return parsedFiles;
}

function sortByName(_) {
    return (a, b) => a.localeCompare(b);
}

function readPresetsFromDirectory(directoryPath, options = {}) {
    const {
        sortFunction,
        removeFileExtension = false,
        fileExtension = '.json',
    } = options;

    const files = fs.readdirSync(directoryPath).sort(sortFunction).filter(x => path.parse(x).ext == fileExtension);
    const fileContents = [];
    const fileNames = [];

    files.forEach(item => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), 'utf8');
            JSON.parse(file);
            fileContents.push(file);
            fileNames.push(removeFileExtension ? item.replace(/\.[^/.]+$/, '') : item);
        } catch {
            // skip
            console.log(`${item} is not a valid JSON`);
        }
    });

    return { fileContents, fileNames };
}

async function backupSettings() {
    try {
        if (!fs.existsSync(PUBLIC_DIRECTORIES.backups)) {
            fs.mkdirSync(PUBLIC_DIRECTORIES.backups);
        }

        const userHandles = await getAllUserHandles();

        for (const handle of userHandles) {
            const userDirectories = getUserDirectories(handle);
            const backupFile = path.join(PUBLIC_DIRECTORIES.backups, `settings_${handle}_${generateTimestamp()}.json`);
            const sourceFile = path.join(userDirectories.root, SETTINGS_FILE);
            fs.copyFileSync(sourceFile, backupFile);

            removeOldBackups(`settings_${handle}`);
        }
    } catch (err) {
        console.log('Could not backup settings file', err);
    }
}

const router = express.Router();

router.post('/save', jsonParser, function (request, response) {
    try {
        const pathToSettings = path.join(request.user.directories.root, SETTINGS_FILE);
        writeFileAtomicSync(pathToSettings, JSON.stringify(request.body, null, 4), 'utf8');
        response.send({ result: 'ok' });
    } catch (err) {
        console.log(err);
        response.send(err);
    }
});

// Wintermute's code
router.post('/get', jsonParser, (request, response) => {
    let settings;
    try {
        const pathToSettings = path.join(request.user.directories.root, SETTINGS_FILE);
        settings = fs.readFileSync(pathToSettings, 'utf8');
    } catch (e) {
        return response.sendStatus(500);
    }

    // NovelAI Settings
    const { fileContents: novelai_settings, fileNames: novelai_setting_names }
        = readPresetsFromDirectory(request.user.directories.novelAI_Settings, {
            sortFunction: sortByName(request.user.directories.novelAI_Settings),
            removeFileExtension: true,
        });

    // OpenAI Settings
    const { fileContents: openai_settings, fileNames: openai_setting_names }
        = readPresetsFromDirectory(request.user.directories.openAI_Settings, {
            sortFunction: sortByName(request.user.directories.openAI_Settings), removeFileExtension: true,
        });

    // TextGenerationWebUI Settings
    const { fileContents: textgenerationwebui_presets, fileNames: textgenerationwebui_preset_names }
        = readPresetsFromDirectory(request.user.directories.textGen_Settings, {
            sortFunction: sortByName(request.user.directories.textGen_Settings), removeFileExtension: true,
        });

    //Kobold
    const { fileContents: koboldai_settings, fileNames: koboldai_setting_names }
        = readPresetsFromDirectory(request.user.directories.koboldAI_Settings, {
            sortFunction: sortByName(request.user.directories.koboldAI_Settings), removeFileExtension: true,
        });

    const worldFiles = fs
        .readdirSync(request.user.directories.worlds)
        .filter(file => path.extname(file).toLowerCase() === '.json')
        .sort((a, b) => a.localeCompare(b));
    const world_names = worldFiles.map(item => path.parse(item).name);

    const themes = readAndParseFromDirectory(request.user.directories.themes);
    const movingUIPresets = readAndParseFromDirectory(request.user.directories.movingUI);
    const quickReplyPresets = readAndParseFromDirectory(request.user.directories.quickreplies);

    const instruct = readAndParseFromDirectory(request.user.directories.instruct);
    const context = readAndParseFromDirectory(request.user.directories.context);

    response.send({
        settings,
        koboldai_settings,
        koboldai_setting_names,
        world_names,
        novelai_settings,
        novelai_setting_names,
        openai_settings,
        openai_setting_names,
        textgenerationwebui_presets,
        textgenerationwebui_preset_names,
        themes,
        movingUIPresets,
        quickReplyPresets,
        instruct,
        context,
        enable_extensions: enableExtensions,
    });
});

/**
 * Initializes the settings endpoint
 */
async function init() {
    await backupSettings();
}

module.exports = { router, init };
