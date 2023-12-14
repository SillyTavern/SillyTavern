const fs = require('fs');
const path = require('path');
const express = require('express');
const writeFileAtomicSync = require('write-file-atomic').sync;
const { DIRECTORIES } = require('../constants');
const { getConfigValue, generateTimestamp, removeOldBackups } = require('../util');
const { jsonParser } = require('../express-common');
const { migrateSecrets } = require('./secrets');

const enableExtensions = getConfigValue('enableExtensions', true);
const SETTINGS_FILE = './public/settings.json';

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

function backupSettings() {
    try {
        if (!fs.existsSync(DIRECTORIES.backups)) {
            fs.mkdirSync(DIRECTORIES.backups);
        }

        const backupFile = path.join(DIRECTORIES.backups, `settings_${generateTimestamp()}.json`);
        fs.copyFileSync(SETTINGS_FILE, backupFile);

        removeOldBackups('settings_');
    } catch (err) {
        console.log('Could not backup settings file', err);
    }
}

const router = express.Router();

router.post('/save', jsonParser, function (request, response) {
    try {
        writeFileAtomicSync('public/settings.json', JSON.stringify(request.body, null, 4), 'utf8');
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
        settings = fs.readFileSync('public/settings.json', 'utf8');
    } catch (e) {
        return response.sendStatus(500);
    }

    // NovelAI Settings
    const { fileContents: novelai_settings, fileNames: novelai_setting_names }
        = readPresetsFromDirectory(DIRECTORIES.novelAI_Settings, {
            sortFunction: sortByName(DIRECTORIES.novelAI_Settings),
            removeFileExtension: true,
        });

    // OpenAI Settings
    const { fileContents: openai_settings, fileNames: openai_setting_names }
        = readPresetsFromDirectory(DIRECTORIES.openAI_Settings, {
            sortFunction: sortByName(DIRECTORIES.openAI_Settings), removeFileExtension: true,
        });

    // TextGenerationWebUI Settings
    const { fileContents: textgenerationwebui_presets, fileNames: textgenerationwebui_preset_names }
        = readPresetsFromDirectory(DIRECTORIES.textGen_Settings, {
            sortFunction: sortByName(DIRECTORIES.textGen_Settings), removeFileExtension: true,
        });

    //Kobold
    const { fileContents: koboldai_settings, fileNames: koboldai_setting_names }
        = readPresetsFromDirectory(DIRECTORIES.koboldAI_Settings, {
            sortFunction: sortByName(DIRECTORIES.koboldAI_Settings), removeFileExtension: true,
        });

    const worldFiles = fs
        .readdirSync(DIRECTORIES.worlds)
        .filter(file => path.extname(file).toLowerCase() === '.json')
        .sort((a, b) => a.localeCompare(b));
    const world_names = worldFiles.map(item => path.parse(item).name);

    const themes = readAndParseFromDirectory(DIRECTORIES.themes);
    const movingUIPresets = readAndParseFromDirectory(DIRECTORIES.movingUI);
    const quickReplyPresets = readAndParseFromDirectory(DIRECTORIES.quickreplies);

    const instruct = readAndParseFromDirectory(DIRECTORIES.instruct);
    const context = readAndParseFromDirectory(DIRECTORIES.context);

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

// Sync for now, but should probably be migrated to async file APIs
async function init() {
    backupSettings();
    migrateSecrets(SETTINGS_FILE);
}

module.exports = { router, init };
