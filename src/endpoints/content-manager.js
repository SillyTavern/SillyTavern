const fs = require('fs');
const path = require('path');
const express = require('express');
const fetch = require('node-fetch').default;
const sanitize = require('sanitize-filename');
const { getConfigValue, color } = require('../util');
const { jsonParser } = require('../express-common');
const writeFileAtomicSync = require('write-file-atomic').sync;
const contentDirectory = path.join(process.cwd(), 'default/content');
const scaffoldDirectory = path.join(process.cwd(), 'default/scaffold');
const contentIndexPath = path.join(contentDirectory, 'index.json');
const scaffoldIndexPath = path.join(scaffoldDirectory, 'index.json');
const characterCardParser = require('../character-card-parser.js');

const WHITELIST_GENERIC_URL_DOWNLOAD_SOURCES = getConfigValue('whitelistImportDomains', []);

/**
 * @typedef {Object} ContentItem
 * @property {string} filename
 * @property {string} type
 * @property {string} [name]
 * @property {string|null} [folder]
 */

/**
 * @typedef {string} ContentType
 * @enum {string}
 */
const CONTENT_TYPES = {
    SETTINGS: 'settings',
    CHARACTER: 'character',
    SPRITES: 'sprites',
    BACKGROUND: 'background',
    WORLD: 'world',
    AVATAR: 'avatar',
    THEME: 'theme',
    WORKFLOW: 'workflow',
    KOBOLD_PRESET: 'kobold_preset',
    OPENAI_PRESET: 'openai_preset',
    NOVEL_PRESET: 'novel_preset',
    TEXTGEN_PRESET: 'textgen_preset',
    INSTRUCT: 'instruct',
    CONTEXT: 'context',
    MOVING_UI: 'moving_ui',
    QUICK_REPLIES: 'quick_replies',
    SYSPROMPT: 'sysprompt',
};

/**
 * Gets the default presets from the content directory.
 * @param {import('../users').UserDirectoryList} directories User directories
 * @returns {object[]} Array of default presets
 */
function getDefaultPresets(directories) {
    try {
        const contentIndex = getContentIndex();
        const presets = [];

        for (const contentItem of contentIndex) {
            if (contentItem.type.endsWith('_preset') || contentItem.type === 'instruct' || contentItem.type === 'context' || contentItem.type === 'sysprompt') {
                contentItem.name = path.parse(contentItem.filename).name;
                contentItem.folder = getTargetByType(contentItem.type, directories);
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

/**
 * Seeds content for a user.
 * @param {ContentItem[]} contentIndex Content index
 * @param {import('../users').UserDirectoryList} directories User directories
 * @param {string[]} forceCategories List of categories to force check (even if content check is skipped)
 * @returns {Promise<boolean>} Whether any content was added
 */
async function seedContentForUser(contentIndex, directories, forceCategories) {
    let anyContentAdded = false;

    if (!fs.existsSync(directories.root)) {
        fs.mkdirSync(directories.root, { recursive: true });
    }

    const contentLogPath = path.join(directories.root, 'content.log');
    const contentLog = getContentLog(contentLogPath);

    for (const contentItem of contentIndex) {
        // If the content item is already in the log, skip it
        if (contentLog.includes(contentItem.filename) && !forceCategories?.includes(contentItem.type)) {
            continue;
        }

        if (!contentItem.folder) {
            console.log(`Content file ${contentItem.filename} has no parent folder`);
            continue;
        }

        const contentPath = path.join(contentItem.folder, contentItem.filename);

        if (!fs.existsSync(contentPath)) {
            console.log(`Content file ${contentItem.filename} is missing`);
            continue;
        }

        const contentTarget = getTargetByType(contentItem.type, directories);

        if (!contentTarget) {
            console.log(`Content file ${contentItem.filename} has unknown type ${contentItem.type}`);
            continue;
        }

        const basePath = path.parse(contentItem.filename).base;
        const targetPath = path.join(contentTarget, basePath);
        contentLog.push(contentItem.filename);

        if (fs.existsSync(targetPath)) {
            console.log(`Content file ${contentItem.filename} already exists in ${contentTarget}`);
            continue;
        }

        fs.cpSync(contentPath, targetPath, { recursive: true, force: false });
        console.log(`Content file ${contentItem.filename} copied to ${contentTarget}`);
        anyContentAdded = true;
    }

    writeFileAtomicSync(contentLogPath, contentLog.join('\n'));
    return anyContentAdded;
}

/**
 * Checks for new content and seeds it for all users.
 * @param {import('../users').UserDirectoryList[]} directoriesList List of user directories
 * @param {string[]} forceCategories List of categories to force check (even if content check is skipped)
 * @returns {Promise<void>}
 */
async function checkForNewContent(directoriesList, forceCategories = []) {
    try {
        const contentCheckSkip = getConfigValue('skipContentCheck', false);
        if (contentCheckSkip && forceCategories?.length === 0) {
            return;
        }

        const contentIndex = getContentIndex();
        let anyContentAdded = false;

        for (const directories of directoriesList) {
            const seedResult = await seedContentForUser(contentIndex, directories, forceCategories);

            if (seedResult) {
                anyContentAdded = true;
            }
        }

        if (anyContentAdded && !contentCheckSkip && forceCategories?.length === 0) {
            console.log();
            console.log(`${color.blue('If you don\'t want to receive content updates in the future, set')} ${color.yellow('skipContentCheck')} ${color.blue('to true in the config.yaml file.')}`);
            console.log();
        }
    } catch (err) {
        console.log('Content check failed', err);
    }
}

/**
 * Gets combined content index from the content and scaffold directories.
 * @returns {ContentItem[]} Array of content index
 */
function getContentIndex() {
    const result = [];

    if (fs.existsSync(scaffoldIndexPath)) {
        const scaffoldIndexText = fs.readFileSync(scaffoldIndexPath, 'utf8');
        const scaffoldIndex = JSON.parse(scaffoldIndexText);
        if (Array.isArray(scaffoldIndex)) {
            scaffoldIndex.forEach((item) => {
                item.folder = scaffoldDirectory;
            });
            result.push(...scaffoldIndex);
        }
    }

    if (fs.existsSync(contentIndexPath)) {
        const contentIndexText = fs.readFileSync(contentIndexPath, 'utf8');
        const contentIndex = JSON.parse(contentIndexText);
        if (Array.isArray(contentIndex)) {
            contentIndex.forEach((item) => {
                item.folder = contentDirectory;
            });
            result.push(...contentIndex);
        }
    }

    return result;
}

/**
 * Gets content by type and format.
 * @param {string} type Type of content
 * @param {'json'|'string'|'raw'} format Format of content
 * @returns {string[]|Buffer[]} Array of content
 */
function getContentOfType(type, format) {
    const contentIndex = getContentIndex();
    const indexItems = contentIndex.filter((item) => item.type === type && item.folder);
    const files = [];
    for (const item of indexItems) {
        if (!item.folder) {
            continue;
        }
        try {
            const filePath = path.join(item.folder, item.filename);
            const fileContent = fs.readFileSync(filePath);
            switch (format) {
                case 'json':
                    files.push(JSON.parse(fileContent.toString()));
                    break;
                case 'string':
                    files.push(fileContent.toString());
                    break;
                case 'raw':
                    files.push(fileContent);
                    break;
            }
        } catch {
            // Ignore errors
        }
    }
    return files;
}

/**
 * Gets the target directory for the specified asset type.
 * @param {ContentType} type Asset type
 * @param {import('../users').UserDirectoryList} directories User directories
 * @returns {string | null} Target directory
 */
function getTargetByType(type, directories) {
    switch (type) {
        case CONTENT_TYPES.SETTINGS:
            return directories.root;
        case CONTENT_TYPES.CHARACTER:
            return directories.characters;
        case CONTENT_TYPES.SPRITES:
            return directories.characters;
        case CONTENT_TYPES.BACKGROUND:
            return directories.backgrounds;
        case CONTENT_TYPES.WORLD:
            return directories.worlds;
        case CONTENT_TYPES.AVATAR:
            return directories.avatars;
        case CONTENT_TYPES.THEME:
            return directories.themes;
        case CONTENT_TYPES.WORKFLOW:
            return directories.comfyWorkflows;
        case CONTENT_TYPES.KOBOLD_PRESET:
            return directories.koboldAI_Settings;
        case CONTENT_TYPES.OPENAI_PRESET:
            return directories.openAI_Settings;
        case CONTENT_TYPES.NOVEL_PRESET:
            return directories.novelAI_Settings;
        case CONTENT_TYPES.TEXTGEN_PRESET:
            return directories.textGen_Settings;
        case CONTENT_TYPES.INSTRUCT:
            return directories.instruct;
        case CONTENT_TYPES.CONTEXT:
            return directories.context;
        case CONTENT_TYPES.MOVING_UI:
            return directories.movingUI;
        case CONTENT_TYPES.QUICK_REPLIES:
            return directories.quickreplies;
        case CONTENT_TYPES.SYSPROMPT:
            return directories.sysprompt;
        default:
            return null;
    }
}

/**
 * Gets the content log from the content log file.
 * @param {string} contentLogPath Path to the content log file
 * @returns {string[]} Array of content log lines
 */
function getContentLog(contentLogPath) {
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
        if (part === 'www.chub.ai' || part === 'chub.ai' || part === 'www.characterhub.org' || part === 'characterhub.org') {
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
    const result = await fetch('https://api.jannyai.com/api/v1/download', {
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
            const fileType = imageResult.headers.get('content-type');

            return { buffer, fileName, fileType };
        }
    }

    console.log('Janny returned error', result.statusText, await result.text());
    throw new Error('Failed to download character');
}

//Download Character Cards from AICharactersCards.com (AICC) API.
async function downloadAICCCharacter(id) {
    const apiURL = `https://aicharactercards.com/wp-json/pngapi/v1/image/${id}`;
    try {
        const response = await fetch(apiURL);
        if (!response.ok) {
            throw new Error(`Failed to download character: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'image/png'; // Default to 'image/png' if header is missing
        const buffer = await response.buffer();
        const fileName = `${sanitize(id)}.png`; // Assuming PNG, but adjust based on actual content or headers

        return {
            buffer: buffer,
            fileName: fileName,
            fileType: contentType,
        };
    } catch (error) {
        console.error('Error downloading character:', error);
        throw error;
    }
}

/**
 * Parses an aicharactercards URL to extract the path.
 * @param {string} url URL to parse
 * @returns {string | null} AICC path
 */
function parseAICC(url) {
    const pattern = /^https?:\/\/aicharactercards\.com\/character-cards\/([^/]+)\/([^/]+)\/?$|([^/]+)\/([^/]+)$/;
    const match = url.match(pattern);
    if (match) {
        // Match group 1 & 2 for full URL, 3 & 4 for relative path
        return match[1] && match[2] ? `${match[1]}/${match[2]}` : `${match[3]}/${match[4]}`;
    }
    return null;
}

/**
 * Download character card from generic url.
 * @param {String} url
 */
async function downloadGenericPng(url) {
    try {
        const result = await fetch(url);

        if (result.ok) {
            const buffer = await result.buffer();
            const fileName = sanitize(result.url.split('?')[0].split('/').reverse()[0]);
            const contentType = result.headers.get('content-type') || 'image/png'; //yoink it from AICC function lol

            return {
                buffer: buffer,
                fileName: fileName,
                fileType: contentType,
            };
        }
    } catch (error) {
        console.error('Error downloading file: ', error);
        throw error;
    }
    return null;
}

/**
 * Parse Risu Realm URL to extract the UUID.
 * @param {string} url Risu Realm URL
 * @returns {string | null} UUID of the character
 */
function parseRisuUrl(url) {
    // Example: https://realm.risuai.net/character/7adb0ed8d81855c820b3506980fb40f054ceef010ff0c4bab73730c0ebe92279
    // or https://realm.risuai.net/character/7adb0ed8-d818-55c8-20b3-506980fb40f0
    const pattern = /^https?:\/\/realm\.risuai\.net\/character\/([a-f0-9-]+)\/?$/i;
    const match = url.match(pattern);
    return match ? match[1] : null;
}

/**
 * Download RisuAI character card
 * @param {string} uuid UUID of the character
 * @returns {Promise<{buffer: Buffer, fileName: string, fileType: string}>}
 */
async function downloadRisuCharacter(uuid) {
    const result = await fetch(`https://realm.risuai.net/api/v1/download/png-v3/${uuid}?non_commercial=true`);

    if (!result.ok) {
        const text = await result.text();
        console.log('RisuAI returned error', result.statusText, text);
        throw new Error('Failed to download character');
    }

    const buffer = await result.buffer();
    const fileName = `${sanitize(uuid)}.png`;
    const fileType = 'image/png';

    return { buffer, fileName, fileType };
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

/**
 * Filter to get the domain host of a url instead of a blanket string search.
 * @param {String} url URL to strip
 * @returns {String} Domain name
 */
function getHostFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return '';
    }
}

/**
 * Checks if host is part of generic download source whitelist.
 * @param {String} host Host to check
 * @returns {boolean} If the host is on the whitelist.
 */
function isHostWhitelisted(host) {
    return WHITELIST_GENERIC_URL_DOWNLOAD_SOURCES.includes(host);
}

const router = express.Router();

router.post('/importURL', jsonParser, async (request, response) => {
    if (!request.body.url) {
        return response.sendStatus(400);
    }

    try {
        const url = request.body.url;
        const host = getHostFromUrl(url);
        let result;
        let type;

        const isChub = host.includes('chub.ai') || host.includes('characterhub.org');
        const isJannnyContent = host.includes('janitorai');
        const isPygmalionContent = host.includes('pygmalion.chat');
        const isAICharacterCardsContent = host.includes('aicharactercards.com');
        const isRisu = host.includes('realm.risuai.net');
        const isGeneric = isHostWhitelisted(host);

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
        } else if (isAICharacterCardsContent) {
            const AICCParsed = parseAICC(url);
            if (!AICCParsed) {
                return response.sendStatus(404);
            }
            type = 'character';
            result = await downloadAICCCharacter(AICCParsed);
        } else if (isChub) {
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
        } else if (isRisu) {
            const uuid = parseRisuUrl(url);
            if (!uuid) {
                return response.sendStatus(404);
            }

            type = 'character';
            result = await downloadRisuCharacter(uuid);
        } else if (isGeneric) {
            console.log('Downloading from generic url.');
            type = 'character';
            result = await downloadGenericPng(url);
        } else {
            return response.sendStatus(404);
        }

        if (!result) {
            return response.sendStatus(404);
        }

        if (result.fileType) response.set('Content-Type', result.fileType);
        response.set('Content-Disposition', `attachment; filename="${encodeURI(result.fileName)}"`);
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
        const isAICC = uuid.startsWith('AICC/');
        const uuidType = uuid.includes('lorebook') ? 'lorebook' : 'character';

        if (isPygmalion) {
            console.log('Downloading Pygmalion character:', uuid);
            result = await downloadPygmalionCharacter(uuid);
        } else if (isJannny) {
            console.log('Downloading Janitor character:', uuid.split('_')[0]);
            result = await downloadJannyCharacter(uuid.split('_')[0]);
        } else if (isAICC) {
            const [, author, card] = uuid.split('/');
            console.log('Downloading AICC character:', `${author}/${card}`);
            result = await downloadAICCCharacter(`${author}/${card}`);
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
    CONTENT_TYPES,
    checkForNewContent,
    getDefaultPresets,
    getDefaultPresetFile,
    getContentOfType,
    router,
};
