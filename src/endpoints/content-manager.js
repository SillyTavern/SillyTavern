const fs = require('fs');
const path = require('path');
const express = require('express');
const fetch = require('node-fetch').default;
const sanitize = require('sanitize-filename');
const { getConfigValue } = require('../util');
const { jsonParser } = require('../express-common');
const contentDirectory = path.join(process.cwd(), 'default/content');
const contentLogPath = path.join(contentDirectory, 'content.log');
const contentIndexPath = path.join(contentDirectory, 'index.json');
const { DIRECTORIES } = require('../constants');
const presetFolders = [DIRECTORIES.koboldAI_Settings, DIRECTORIES.openAI_Settings, DIRECTORIES.novelAI_Settings, DIRECTORIES.textGen_Settings];
const characterCardParser = require('../character-card-parser.js');

/**
 * Gets the default presets from the content directory.
 * @returns {object[]} Array of default presets
 */
function getDefaultPresets() {
    try {
        const contentIndexText = fs.readFileSync(contentIndexPath, 'utf8');
        const contentIndex = JSON.parse(contentIndexText);

        const presets = [];

        for (const contentItem of contentIndex) {
            if (contentItem.type.endsWith('_preset')) {
                contentItem.name = path.parse(contentItem.filename).name;
                contentItem.folder = getTargetByType(contentItem.type);
                presets.push(contentItem);
            }
        }

        return presets;
    } catch (err) {
        console.log('Failed to get default presets', err);
        return [];
    }
}

/**
 * Gets a default JSON file from the content directory.
 * @param {string} filename Name of the file to get
 * @returns {object | null} JSON object or null if the file doesn't exist
 */
function getDefaultPresetFile(filename) {
    try {
        const contentPath = path.join(contentDirectory, filename);

        if (!fs.existsSync(contentPath)) {
            return null;
        }

        const fileContent = fs.readFileSync(contentPath, 'utf8');
        return JSON.parse(fileContent);
    } catch (err) {
        console.log(`Failed to get default file ${filename}`, err);
        return null;
    }
}

function migratePresets() {
    for (const presetFolder of presetFolders) {
        const presetPath = path.join(process.cwd(), presetFolder);
        const presetFiles = fs.readdirSync(presetPath);

        for (const presetFile of presetFiles) {
            const presetFilePath = path.join(presetPath, presetFile);
            const newFileName = presetFile.replace('.settings', '.json');
            const newFilePath = path.join(presetPath, newFileName);
            const backupFileName = presetFolder.replace('/', '_') + '_' + presetFile;
            const backupFilePath = path.join(DIRECTORIES.backups, backupFileName);

            if (presetFilePath.endsWith('.settings')) {
                if (!fs.existsSync(newFilePath)) {
                    fs.cpSync(presetFilePath, backupFilePath);
                    fs.cpSync(presetFilePath, newFilePath);
                    console.log(`Migrated ${presetFilePath} to ${newFilePath}`);
                }
            }
        }
    }
}

function checkForNewContent() {
    try {
        migratePresets();

        if (getConfigValue('skipContentCheck', false)) {
            return;
        }

        const contentLog = getContentLog();
        const contentIndexText = fs.readFileSync(contentIndexPath, 'utf8');
        const contentIndex = JSON.parse(contentIndexText);

        for (const contentItem of contentIndex) {
            // If the content item is already in the log, skip it
            if (contentLog.includes(contentItem.filename)) {
                continue;
            }

            contentLog.push(contentItem.filename);
            const contentPath = path.join(contentDirectory, contentItem.filename);

            if (!fs.existsSync(contentPath)) {
                console.log(`Content file ${contentItem.filename} is missing`);
                continue;
            }

            const contentTarget = getTargetByType(contentItem.type);

            if (!contentTarget) {
                console.log(`Content file ${contentItem.filename} has unknown type ${contentItem.type}`);
                continue;
            }

            const basePath = path.parse(contentItem.filename).base;
            const targetPath = path.join(process.cwd(), contentTarget, basePath);

            if (fs.existsSync(targetPath)) {
                console.log(`Content file ${contentItem.filename} already exists in ${contentTarget}`);
                continue;
            }

            fs.cpSync(contentPath, targetPath, { recursive: true, force: false });
            console.log(`Content file ${contentItem.filename} copied to ${contentTarget}`);
        }

        fs.writeFileSync(contentLogPath, contentLog.join('\n'));
    } catch (err) {
        console.log('Content check failed', err);
    }
}

function getTargetByType(type) {
    switch (type) {
        case 'character':
            return DIRECTORIES.characters;
        case 'sprites':
            return DIRECTORIES.characters;
        case 'background':
            return DIRECTORIES.backgrounds;
        case 'world':
            return DIRECTORIES.worlds;
        case 'sound':
            return DIRECTORIES.sounds;
        case 'avatar':
            return DIRECTORIES.avatars;
        case 'theme':
            return DIRECTORIES.themes;
        case 'workflow':
            return DIRECTORIES.comfyWorkflows;
        case 'kobold_preset':
            return DIRECTORIES.koboldAI_Settings;
        case 'openai_preset':
            return DIRECTORIES.openAI_Settings;
        case 'novel_preset':
            return DIRECTORIES.novelAI_Settings;
        case 'textgen_preset':
            return DIRECTORIES.textGen_Settings;
        default:
            return null;
    }
}

function getContentLog() {
    if (!fs.existsSync(contentLogPath)) {
        return [];
    }

    const contentLogText = fs.readFileSync(contentLogPath, 'utf8');
    return contentLogText.split('\n');
}

async function downloadChubLorebook(id) {
    const result = await fetch('https://api.chub.ai/api/lorebooks/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            'fullPath': id,
            'format': 'SILLYTAVERN',
        }),
    });

    if (!result.ok) {
        const text = await result.text();
        console.log('Chub returned error', result.statusText, text);
        throw new Error('Failed to download lorebook');
    }

    const name = id.split('/').pop();
    const buffer = await result.buffer();
    const fileName = `${sanitize(name)}.json`;
    const fileType = result.headers.get('content-type');

    return { buffer, fileName, fileType };
}

async function downloadChubCharacter(id) {
    const result = await fetch('https://api.chub.ai/api/characters/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            'format': 'tavern',
            'fullPath': id,
        }),
    });

    if (!result.ok) {
        const text = await result.text();
        console.log('Chub returned error', result.statusText, text);
        throw new Error('Failed to download character');
    }

    const buffer = await result.buffer();
    const fileName = result.headers.get('content-disposition')?.split('filename=')[1] || `${sanitize(id)}.png`;
    const fileType = result.headers.get('content-type');

    return { buffer, fileName, fileType };
}

/**
 * Downloads a character card from the Pygsite.
 * @param {string} id UUID of the character
 * @returns {Promise<{buffer: Buffer, fileName: string, fileType: string}>}
 */
async function downloadPygmalionCharacter(id) {
    const result = await fetch(`https://server.pygmalion.chat/api/export/character/${id}/v2`);

    if (!result.ok) {
        const text = await result.text();
        console.log('Pygsite returned error', result.status, text);
        throw new Error('Failed to download character');
    }

    const jsonData = await result.json();
    const characterData = jsonData?.character;

    if (!characterData || typeof characterData !== 'object') {
        console.error('Pygsite returned invalid character data', jsonData);
        throw new Error('Failed to download character');
    }

    try {
        const avatarUrl = characterData?.data?.avatar;

        if (!avatarUrl) {
            console.error('Pygsite character does not have an avatar', characterData);
            throw new Error('Failed to download avatar');
        }

        const avatarResult = await fetch(avatarUrl);
        const avatarBuffer = await avatarResult.buffer();

        const cardBuffer = characterCardParser.write(avatarBuffer, JSON.stringify(characterData));

        return {
            buffer: cardBuffer,
            fileName: `${sanitize(id)}.png`,
            fileType: 'image/png',
        };
    } catch (e) {
        console.error('Failed to download avatar, using JSON instead', e);
        return {
            buffer: Buffer.from(JSON.stringify(jsonData)),
            fileName: `${sanitize(id)}.json`,
            fileType: 'application/json',
        };
    }
}

/**
 *
 * @param {String} str
 * @returns { { id: string, type: "character" | "lorebook" } | null }
 */
function parseChubUrl(str) {
    const splitStr = str.split('/');
    const length = splitStr.length;

    if (length < 2) {
        return null;
    }

    let domainIndex = -1;

    splitStr.forEach((part, index) => {
        if (part === 'www.chub.ai' || part === 'chub.ai') {
            domainIndex = index;
        }
    });

    const lastTwo = domainIndex !== -1 ? splitStr.slice(domainIndex + 1) : splitStr;

    const firstPart = lastTwo[0].toLowerCase();

    if (firstPart === 'characters' || firstPart === 'lorebooks') {
        const type = firstPart === 'characters' ? 'character' : 'lorebook';
        const id = type === 'character' ? lastTwo.slice(1).join('/') : lastTwo.join('/');
        return {
            id: id,
            type: type,
        };
    } else if (length === 2) {
        return {
            id: lastTwo.join('/'),
            type: 'character',
        };
    }

    return null;
}

// Warning: Some characters might not exist in JannyAI.me
async function downloadJannyCharacter(uuid) {
    // This endpoint is being guarded behind Bot Fight Mode of Cloudflare
    // So hosted ST on Azure/AWS/GCP/Collab might get blocked by IP
    // Should work normally on self-host PC/Android
    const result = await fetch('https://api.janitorai.me/api/v1/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            'characterId': uuid,
        }),
    });

    if (result.ok) {
        const downloadResult = await result.json();
        if (downloadResult.status === 'ok') {
            const imageResult = await fetch(downloadResult.downloadUrl);
            const buffer = await imageResult.buffer();
            const fileName = `${sanitize(uuid)}.png`;
            const fileType = result.headers.get('content-type');

            return { buffer, fileName, fileType };
        }
    }

    console.log('Janny returned error', result.statusText, await result.text());
    throw new Error('Failed to download character');
}

/**
* @param {String} url
* @returns {String | null } UUID of the character
*/
function getUuidFromUrl(url) {
    // Extract UUID from URL
    const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;
    const matches = url.match(uuidRegex);

    // Check if UUID is found
    const uuid = matches ? matches[0] : null;
    return uuid;
}

const router = express.Router();

router.post('/importURL', jsonParser, async (request, response) => {
    if (!request.body.url) {
        return response.sendStatus(400);
    }

    try {
        const url = request.body.url;
        let result;
        let type;

        const isJannnyContent = url.includes('janitorai');
        const isPygmalionContent = url.includes('pygmalion.chat');

        if (isPygmalionContent) {
            const uuid = getUuidFromUrl(url);
            if (!uuid) {
                return response.sendStatus(404);
            }

            type = 'character';
            result = await downloadPygmalionCharacter(uuid);
        } else if (isJannnyContent) {
            const uuid = getUuidFromUrl(url);
            if (!uuid) {
                return response.sendStatus(404);
            }

            type = 'character';
            result = await downloadJannyCharacter(uuid);
        } else {
            const chubParsed = parseChubUrl(url);
            type = chubParsed?.type;

            if (chubParsed?.type === 'character') {
                console.log('Downloading chub character:', chubParsed.id);
                result = await downloadChubCharacter(chubParsed.id);
            }
            else if (chubParsed?.type === 'lorebook') {
                console.log('Downloading chub lorebook:', chubParsed.id);
                result = await downloadChubLorebook(chubParsed.id);
            }
            else {
                return response.sendStatus(404);
            }
        }

        if (result.fileType) response.set('Content-Type', result.fileType);
        response.set('Content-Disposition', `attachment; filename="${result.fileName}"`);
        response.set('X-Custom-Content-Type', type);
        return response.send(result.buffer);
    } catch (error) {
        console.log('Importing custom content failed', error);
        return response.sendStatus(500);
    }
});

router.post('/importUUID', jsonParser, async (request, response) => {
    if (!request.body.url) {
        return response.sendStatus(400);
    }

    try {
        const uuid = request.body.url;
        let result;

        const isJannny = uuid.includes('_character');
        const isPygmalion = (!isJannny && uuid.length == 36);
        const uuidType = uuid.includes('lorebook') ? 'lorebook' : 'character';

        if (isPygmalion) {
            console.log('Downloading Pygmalion character:', uuid);
            result = await downloadPygmalionCharacter(uuid);
        } else if (isJannny) {
            console.log('Downloading Janitor character:', uuid.split('_')[0]);
            result = await downloadJannyCharacter(uuid.split('_')[0]);
        } else {
            if (uuidType === 'character') {
                console.log('Downloading chub character:', uuid);
                result = await downloadChubCharacter(uuid);
            }
            else if (uuidType === 'lorebook') {
                console.log('Downloading chub lorebook:', uuid);
                result = await downloadChubLorebook(uuid);
            }
            else {
                return response.sendStatus(404);
            }
        }

        if (result.fileType) response.set('Content-Type', result.fileType);
        response.set('Content-Disposition', `attachment; filename="${result.fileName}"`);
        response.set('X-Custom-Content-Type', uuidType);
        return response.send(result.buffer);
    } catch (error) {
        console.log('Importing custom content failed', error);
        return response.sendStatus(500);
    }
});

module.exports = {
    checkForNewContent,
    getDefaultPresets,
    getDefaultPresetFile,
    router,
};
