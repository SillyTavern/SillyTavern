const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const readline = require('readline');
const express = require('express');
const sanitize = require('sanitize-filename');
const writeFileAtomicSync = require('write-file-atomic').sync;
const yaml = require('yaml');
const _ = require('lodash');
const mime = require('mime-types');

const jimp = require('jimp');

const { AVATAR_WIDTH, AVATAR_HEIGHT } = require('../constants');
const { jsonParser, urlencodedParser } = require('../express-common');
const { deepMerge, humanizedISO8601DateTime, tryParse, extractFileFromZipBuffer } = require('../util');
const { TavernCardValidator } = require('../validator/TavernCardValidator');
const characterCardParser = require('../character-card-parser.js');
const { readWorldInfoFile } = require('./worldinfo');
const { invalidateThumbnail } = require('./thumbnails');
const { importRisuSprites } = require('./sprites');
const defaultAvatarPath = './public/img/ai4.png';

// KV-store for parsed character data
const characterDataCache = new Map();

/**
 * Reads the character card from the specified image file.
 * @param {string} inputFile - Path to the image file
 * @param {string} inputFormat - 'png'
 * @returns {Promise<string | undefined>} - Character card data
 */
async function readCharacterData(inputFile, inputFormat = 'png') {
    const stat = fs.statSync(inputFile);
    const cacheKey = `${inputFile}-${stat.mtimeMs}`;
    if (characterDataCache.has(cacheKey)) {
        return characterDataCache.get(cacheKey);
    }

    const result = characterCardParser.parse(inputFile, inputFormat);
    characterDataCache.set(cacheKey, result);
    return result;
}

/**
 * Writes the character card to the specified image file.
 * @param {string|Buffer} inputFile - Path to the image file or image buffer
 * @param {string} data - Character card data
 * @param {string} outputFile - Target image file name
 * @param {import('express').Request} request - Express request obejct
 * @param {Crop|undefined} crop - Crop parameters
 * @returns {Promise<boolean>} - True if the operation was successful
 */
async function writeCharacterData(inputFile, data, outputFile, request, crop = undefined) {
    try {
        // Reset the cache
        for (const key of characterDataCache.keys()) {
            if (key.startsWith(inputFile)) {
                characterDataCache.delete(key);
                break;
            }
        }

        /**
         * Read the image, resize, and save it as a PNG into the buffer.
         * @returns {Promise<Buffer>} Image buffer
         */
        function getInputImage() {
            if (Buffer.isBuffer(inputFile)) {
                return parseImageBuffer(inputFile, crop);
            }

            return tryReadImage(inputFile, crop);
        }

        const inputImage = await getInputImage();

        // Get the chunks
        const outputImage = characterCardParser.write(inputImage, data);
        const outputImagePath = path.join(request.user.directories.characters, `${outputFile}.png`);

        writeFileAtomicSync(outputImagePath, outputImage);
        return true;
    } catch (err) {
        console.log(err);
        return false;
    }
}

/**
 * @typedef {Object} Crop
 * @property {number} x X-coordinate
 * @property {number} y Y-coordinate
 * @property {number} width Width
 * @property {number} height Height
 * @property {boolean} want_resize Resize the image to the standard avatar size
 */

/**
 * Parses an image buffer and applies crop if defined.
 * @param {Buffer} buffer Buffer of the image
 * @param {Crop|undefined} [crop] Crop parameters
 * @returns {Promise<Buffer>} Image buffer
 */
async function parseImageBuffer(buffer, crop) {
    const image = await jimp.read(buffer);
    let finalWidth = image.bitmap.width, finalHeight = image.bitmap.height;

    // Apply crop if defined
    if (typeof crop == 'object' && [crop.x, crop.y, crop.width, crop.height].every(x => typeof x === 'number')) {
        image.crop(crop.x, crop.y, crop.width, crop.height);
        // Apply standard resize if requested
        if (crop.want_resize) {
            finalWidth = AVATAR_WIDTH;
            finalHeight = AVATAR_HEIGHT;
        } else {
            finalWidth = crop.width;
            finalHeight = crop.height;
        }
    }

    return image.cover(finalWidth, finalHeight).getBufferAsync(jimp.MIME_PNG);
}

/**
 * Reads an image file and applies crop if defined.
 * @param {string} imgPath Path to the image file
 * @param {Crop|undefined} crop Crop parameters
 * @returns {Promise<Buffer>} Image buffer
 */
async function tryReadImage(imgPath, crop) {
    try {
        let rawImg = await jimp.read(imgPath);
        let finalWidth = rawImg.bitmap.width, finalHeight = rawImg.bitmap.height;

        // Apply crop if defined
        if (typeof crop == 'object' && [crop.x, crop.y, crop.width, crop.height].every(x => typeof x === 'number')) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
            // Apply standard resize if requested
            if (crop.want_resize) {
                finalWidth = AVATAR_WIDTH;
                finalHeight = AVATAR_HEIGHT;
            } else {
                finalWidth = crop.width;
                finalHeight = crop.height;
            }
        }

        const image = await rawImg.cover(finalWidth, finalHeight).getBufferAsync(jimp.MIME_PNG);
        return image;
    }
    // If it's an unsupported type of image (APNG) - just read the file as buffer
    catch {
        return fs.readFileSync(imgPath);
    }
}

/**
 * calculateChatSize - Calculates the total chat size for a given character.
 *
 * @param  {string} charDir The directory where the chats are stored.
 * @return { {chatSize: number, dateLastChat: number} }         The total chat size.
 */
const calculateChatSize = (charDir) => {
    let chatSize = 0;
    let dateLastChat = 0;

    if (fs.existsSync(charDir)) {
        const chats = fs.readdirSync(charDir);
        if (Array.isArray(chats) && chats.length) {
            for (const chat of chats) {
                const chatStat = fs.statSync(path.join(charDir, chat));
                chatSize += chatStat.size;
                dateLastChat = Math.max(dateLastChat, chatStat.mtimeMs);
            }
        }
    }

    return { chatSize, dateLastChat };
};

// Calculate the total string length of the data object
const calculateDataSize = (data) => {
    return typeof data === 'object' ? Object.values(data).reduce((acc, val) => acc + new String(val).length, 0) : 0;
};

/**
 * processCharacter - Process a given character, read its data and calculate its statistics.
 *
 * @param  {string} item The name of the character.
 * @param  {import('../users').UserDirectoryList} directories User directories
 * @return {Promise<object>}     A Promise that resolves when the character processing is done.
 */
const processCharacter = async (item, directories) => {
    try {
        const imgFile = path.join(directories.characters, item);
        const imgData = await readCharacterData(imgFile);
        if (imgData === undefined) throw new Error('Failed to read character file');

        let jsonObject = getCharaCardV2(JSON.parse(imgData), directories, false);
        jsonObject.avatar = item;
        const character = jsonObject;
        character['json_data'] = imgData;
        const charStat = fs.statSync(path.join(directories.characters, item));
        character['date_added'] = charStat.ctimeMs;
        character['create_date'] = jsonObject['create_date'] || humanizedISO8601DateTime(charStat.ctimeMs);
        const chatsDirectory = path.join(directories.chats, item.replace('.png', ''));

        const { chatSize, dateLastChat } = calculateChatSize(chatsDirectory);
        character['chat_size'] = chatSize;
        character['date_last_chat'] = dateLastChat;
        character['data_size'] = calculateDataSize(jsonObject?.data);
        return character;
    }
    catch (err) {
        console.log(`Could not process character: ${item}`);

        if (err instanceof SyntaxError) {
            console.log(`${item} does not contain a valid JSON object.`);
        } else {
            console.log('An unexpected error occurred: ', err);
        }

        return {
            date_added: 0,
            date_last_chat: 0,
            chat_size: 0,
        };
    }
};

/**
 * Convert a character object to Spec V2 format.
 * @param {object} jsonObject Character object
 * @param {import('../users').UserDirectoryList} directories User directories
 * @param {boolean} hoistDate Will set the chat and create_date fields to the current date if they are missing
 * @returns {object} Character object in Spec V2 format
 */
function getCharaCardV2(jsonObject, directories, hoistDate = true) {
    if (jsonObject.spec === undefined) {
        jsonObject = convertToV2(jsonObject, directories);

        if (hoistDate && !jsonObject.create_date) {
            jsonObject.create_date = humanizedISO8601DateTime();
        }
    } else {
        jsonObject = readFromV2(jsonObject);
    }
    return jsonObject;
}

/**
 * Convert a character object to Spec V2 format.
 * @param {object} char Character object
 * @param {import('../users').UserDirectoryList} directories User directories
 * @returns {object} Character object in Spec V2 format
 */
function convertToV2(char, directories) {
    // Simulate incoming data from frontend form
    const result = charaFormatData({
        json_data: JSON.stringify(char),
        ch_name: char.name,
        description: char.description,
        personality: char.personality,
        scenario: char.scenario,
        first_mes: char.first_mes,
        mes_example: char.mes_example,
        creator_notes: char.creatorcomment,
        talkativeness: char.talkativeness,
        fav: char.fav,
        creator: char.creator,
        tags: char.tags,
        depth_prompt_prompt: char.depth_prompt_prompt,
        depth_prompt_depth: char.depth_prompt_depth,
        depth_prompt_role: char.depth_prompt_role,
    }, directories);

    result.chat = char.chat ?? humanizedISO8601DateTime();
    result.create_date = char.create_date;

    return result;
}


function unsetFavFlag(char) {
    _.set(char, 'fav', false);
    _.set(char, 'data.extensions.fav', false);
}

function readFromV2(char) {
    if (_.isUndefined(char.data)) {
        console.warn(`Char ${char['name']} has Spec v2 data missing`);
        return char;
    }

    const fieldMappings = {
        name: 'name',
        description: 'description',
        personality: 'personality',
        scenario: 'scenario',
        first_mes: 'first_mes',
        mes_example: 'mes_example',
        talkativeness: 'extensions.talkativeness',
        fav: 'extensions.fav',
        tags: 'tags',
    };

    _.forEach(fieldMappings, (v2Path, charField) => {
        //console.log(`Migrating field: ${charField} from ${v2Path}`);
        const v2Value = _.get(char.data, v2Path);
        if (_.isUndefined(v2Value)) {
            let defaultValue = undefined;

            // Backfill default values for missing ST extension fields
            if (v2Path === 'extensions.talkativeness') {
                defaultValue = 0.5;
            }

            if (v2Path === 'extensions.fav') {
                defaultValue = false;
            }

            if (!_.isUndefined(defaultValue)) {
                //console.debug(`Spec v2 extension data missing for field: ${charField}, using default value: ${defaultValue}`);
                char[charField] = defaultValue;
            } else {
                console.debug(`Char ${char['name']} has Spec v2 data missing for unknown field: ${charField}`);
                return;
            }
        }
        if (!_.isUndefined(char[charField]) && !_.isUndefined(v2Value) && String(char[charField]) !== String(v2Value)) {
            console.debug(`Char ${char['name']} has Spec v2 data mismatch with Spec v1 for field: ${charField}`, char[charField], v2Value);
        }
        char[charField] = v2Value;
    });

    char['chat'] = char['chat'] ?? humanizedISO8601DateTime();

    return char;
}

/**
 * Format character data to Spec V2 format.
 * @param {object} data Character data
 * @param {import('../users').UserDirectoryList} directories User directories
 * @returns
 */
function charaFormatData(data, directories) {
    // This is supposed to save all the foreign keys that ST doesn't care about
    const char = tryParse(data.json_data) || {};

    // Checks if data.alternate_greetings is an array, a string, or neither, and acts accordingly. (expected to be an array of strings)
    const getAlternateGreetings = data => {
        if (Array.isArray(data.alternate_greetings)) return data.alternate_greetings;
        if (typeof data.alternate_greetings === 'string') return [data.alternate_greetings];
        return [];
    };

    // Spec V1 fields
    _.set(char, 'name', data.ch_name);
    _.set(char, 'description', data.description || '');
    _.set(char, 'personality', data.personality || '');
    _.set(char, 'scenario', data.scenario || '');
    _.set(char, 'first_mes', data.first_mes || '');
    _.set(char, 'mes_example', data.mes_example || '');

    // Old ST extension fields (for backward compatibility, will be deprecated)
    _.set(char, 'creatorcomment', data.creator_notes);
    _.set(char, 'avatar', 'none');
    _.set(char, 'chat', data.ch_name + ' - ' + humanizedISO8601DateTime());
    _.set(char, 'talkativeness', data.talkativeness);
    _.set(char, 'fav', data.fav == 'true');
    _.set(char, 'tags', typeof data.tags == 'string' ? (data.tags.split(',').map(x => x.trim()).filter(x => x)) : data.tags || []);

    // Spec V2 fields
    _.set(char, 'spec', 'chara_card_v2');
    _.set(char, 'spec_version', '2.0');
    _.set(char, 'data.name', data.ch_name);
    _.set(char, 'data.description', data.description || '');
    _.set(char, 'data.personality', data.personality || '');
    _.set(char, 'data.scenario', data.scenario || '');
    _.set(char, 'data.first_mes', data.first_mes || '');
    _.set(char, 'data.mes_example', data.mes_example || '');

    // New V2 fields
    _.set(char, 'data.creator_notes', data.creator_notes || '');
    _.set(char, 'data.system_prompt', data.system_prompt || '');
    _.set(char, 'data.post_history_instructions', data.post_history_instructions || '');
    _.set(char, 'data.tags', typeof data.tags == 'string' ? (data.tags.split(',').map(x => x.trim()).filter(x => x)) : data.tags || []);
    _.set(char, 'data.creator', data.creator || '');
    _.set(char, 'data.character_version', data.character_version || '');
    _.set(char, 'data.alternate_greetings', getAlternateGreetings(data));

    // ST extension fields to V2 object
    _.set(char, 'data.extensions.talkativeness', data.talkativeness);
    _.set(char, 'data.extensions.fav', data.fav == 'true');
    _.set(char, 'data.extensions.world', data.world || '');

    // Spec extension: depth prompt
    const depth_default = 4;
    const role_default = 'system';
    const depth_value = !isNaN(Number(data.depth_prompt_depth)) ? Number(data.depth_prompt_depth) : depth_default;
    const role_value = data.depth_prompt_role ?? role_default;
    _.set(char, 'data.extensions.depth_prompt.prompt', data.depth_prompt_prompt ?? '');
    _.set(char, 'data.extensions.depth_prompt.depth', depth_value);
    _.set(char, 'data.extensions.depth_prompt.role', role_value);
    //_.set(char, 'data.extensions.create_date', humanizedISO8601DateTime());
    //_.set(char, 'data.extensions.avatar', 'none');
    //_.set(char, 'data.extensions.chat', data.ch_name + ' - ' + humanizedISO8601DateTime());

    // V3 fields
    _.set(char, 'data.group_only_greetings', data.group_only_greetings ?? []);

    if (data.world) {
        try {
            const file = readWorldInfoFile(directories, data.world, false);

            // File was imported - save it to the character book
            if (file && file.originalData) {
                _.set(char, 'data.character_book', file.originalData);
            }

            // File was not imported - convert the world info to the character book
            if (file && file.entries) {
                _.set(char, 'data.character_book', convertWorldInfoToCharacterBook(data.world, file.entries));
            }

        } catch {
            console.debug(`Failed to read world info file: ${data.world}. Character book will not be available.`);
        }
    }

    if (data.extensions) {
        try {
            const extensions = JSON.parse(data.extensions);
            // Deep merge the extensions object
            _.set(char, 'data.extensions', deepMerge(char.data.extensions, extensions));
        } catch {
            console.debug(`Failed to parse extensions JSON: ${data.extensions}`);
        }
    }

    return char;
}

/**
 * @param {string} name Name of World Info file
 * @param {object} entries Entries object
 */
function convertWorldInfoToCharacterBook(name, entries) {
    /** @type {{ entries: object[]; name: string }} */
    const result = { entries: [], name };

    for (const index in entries) {
        const entry = entries[index];

        const originalEntry = {
            id: entry.uid,
            keys: entry.key,
            secondary_keys: entry.keysecondary,
            comment: entry.comment,
            content: entry.content,
            constant: entry.constant,
            selective: entry.selective,
            insertion_order: entry.order,
            enabled: !entry.disable,
            position: entry.position == 0 ? 'before_char' : 'after_char',
            use_regex: true, // ST keys are always regex
            extensions: {
                position: entry.position,
                exclude_recursion: entry.excludeRecursion,
                display_index: entry.displayIndex,
                probability: entry.probability ?? null,
                useProbability: entry.useProbability ?? false,
                depth: entry.depth ?? 4,
                selectiveLogic: entry.selectiveLogic ?? 0,
                group: entry.group ?? '',
                group_override: entry.groupOverride ?? false,
                group_weight: entry.groupWeight ?? null,
                prevent_recursion: entry.preventRecursion ?? false,
                delay_until_recursion: entry.delayUntilRecursion ?? false,
                scan_depth: entry.scanDepth ?? null,
                match_whole_words: entry.matchWholeWords ?? null,
                use_group_scoring: entry.useGroupScoring ?? false,
                case_sensitive: entry.caseSensitive ?? null,
                automation_id: entry.automationId ?? '',
                role: entry.role ?? 0,
                vectorized: entry.vectorized ?? false,
                sticky: entry.sticky ?? null,
                cooldown: entry.cooldown ?? null,
                delay: entry.delay ?? null,
            },
        };

        result.entries.push(originalEntry);
    }

    return result;
}

/**
 * Import a character from a YAML file.
 * @param {string} uploadPath Path to the uploaded file
 * @param {{ request: import('express').Request, response: import('express').Response }} context Express request and response objects
 * @param {string|undefined} preservedFileName Preserved file name
 * @returns {Promise<string>} Internal name of the character
 */
async function importFromYaml(uploadPath, context, preservedFileName) {
    const fileText = fs.readFileSync(uploadPath, 'utf8');
    fs.rmSync(uploadPath);
    const yamlData = yaml.parse(fileText);
    console.log('Importing from YAML');
    yamlData.name = sanitize(yamlData.name);
    const fileName = preservedFileName || getPngName(yamlData.name, context.request.user.directories);
    let char = convertToV2({
        'name': yamlData.name,
        'description': yamlData.context ?? '',
        'first_mes': yamlData.greeting ?? '',
        'create_date': humanizedISO8601DateTime(),
        'chat': `${yamlData.name} - ${humanizedISO8601DateTime()}`,
        'personality': '',
        'creatorcomment': '',
        'avatar': 'none',
        'mes_example': '',
        'scenario': '',
        'talkativeness': 0.5,
        'creator': '',
        'tags': '',
    }, context.request.user.directories);
    const result = await writeCharacterData(defaultAvatarPath, JSON.stringify(char), fileName, context.request);
    return result ? fileName : '';
}

/**
 * Imports a character card from CharX (ZIP) file.
 * @param {string} uploadPath
 * @param {object} params
 * @param {import('express').Request} params.request
 * @param {string|undefined} preservedFileName Preserved file name
 * @returns {Promise<string>} Internal name of the character
 */
async function importFromCharX(uploadPath, { request }, preservedFileName) {
    const data = fs.readFileSync(uploadPath);
    fs.rmSync(uploadPath);
    console.log('Importing from CharX');
    const cardBuffer = await extractFileFromZipBuffer(data, 'card.json');

    if (!cardBuffer) {
        throw new Error('Failed to extract card.json from CharX file');
    }

    const card = readFromV2(JSON.parse(cardBuffer.toString()));

    if (card.spec === undefined) {
        throw new Error('Invalid CharX card file: missing spec field');
    }

    /** @type {string|Buffer} */
    let avatar = defaultAvatarPath;
    const assets = _.get(card, 'data.assets');
    if (Array.isArray(assets) && assets.length) {
        for (const asset of assets.filter(x => x.type === 'icon' && typeof x.uri === 'string')) {
            const pathNoProtocol = String(asset.uri.replace(/^(?:\/\/|[^/]+)*\//, ''));
            const buffer = await extractFileFromZipBuffer(data, pathNoProtocol);
            if (buffer) {
                avatar = buffer;
                break;
            }
        }
    }

    unsetFavFlag(card);
    card['create_date'] = humanizedISO8601DateTime();
    card.name = sanitize(card.name);
    const fileName = preservedFileName || getPngName(card.name, request.user.directories);
    const result = await writeCharacterData(avatar, JSON.stringify(card), fileName, request);
    return result ? fileName : '';
}

/**
 * Import a character from a JSON file.
 * @param {string} uploadPath Path to the uploaded file
 * @param {{ request: import('express').Request, response: import('express').Response }} context Express request and response objects
 * @param {string|undefined} preservedFileName Preserved file name
 * @returns {Promise<string>} Internal name of the character
 */
async function importFromJson(uploadPath, { request }, preservedFileName) {
    const data = fs.readFileSync(uploadPath, 'utf8');
    fs.unlinkSync(uploadPath);

    let jsonData = JSON.parse(data);

    if (jsonData.spec !== undefined) {
        console.log(`Importing from ${jsonData.spec} json`);
        importRisuSprites(request.user.directories, jsonData);
        unsetFavFlag(jsonData);
        jsonData = readFromV2(jsonData);
        jsonData['create_date'] = humanizedISO8601DateTime();
        const pngName = preservedFileName || getPngName(jsonData.data?.name || jsonData.name, request.user.directories);
        const char = JSON.stringify(jsonData);
        const result = await writeCharacterData(defaultAvatarPath, char, pngName, request);
        return result ? pngName : '';
    } else if (jsonData.name !== undefined) {
        console.log('Importing from v1 json');
        jsonData.name = sanitize(jsonData.name);
        if (jsonData.creator_notes) {
            jsonData.creator_notes = jsonData.creator_notes.replace('Creator\'s notes go here.', '');
        }
        const pngName = preservedFileName || getPngName(jsonData.name, request.user.directories);
        let char = {
            'name': jsonData.name,
            'description': jsonData.description ?? '',
            'creatorcomment': jsonData.creatorcomment ?? jsonData.creator_notes ?? '',
            'personality': jsonData.personality ?? '',
            'first_mes': jsonData.first_mes ?? '',
            'avatar': 'none',
            'chat': jsonData.name + ' - ' + humanizedISO8601DateTime(),
            'mes_example': jsonData.mes_example ?? '',
            'scenario': jsonData.scenario ?? '',
            'create_date': humanizedISO8601DateTime(),
            'talkativeness': jsonData.talkativeness ?? 0.5,
            'creator': jsonData.creator ?? '',
            'tags': jsonData.tags ?? '',
        };
        char = convertToV2(char, request.user.directories);
        let charJSON = JSON.stringify(char);
        const result = await writeCharacterData(defaultAvatarPath, charJSON, pngName, request);
        return result ? pngName : '';
    } else if (jsonData.char_name !== undefined) {//json Pygmalion notepad
        console.log('Importing from gradio json');
        jsonData.char_name = sanitize(jsonData.char_name);
        if (jsonData.creator_notes) {
            jsonData.creator_notes = jsonData.creator_notes.replace('Creator\'s notes go here.', '');
        }
        const pngName = preservedFileName || getPngName(jsonData.char_name, request.user.directories);
        let char = {
            'name': jsonData.char_name,
            'description': jsonData.char_persona ?? '',
            'creatorcomment': jsonData.creatorcomment ?? jsonData.creator_notes ?? '',
            'personality': '',
            'first_mes': jsonData.char_greeting ?? '',
            'avatar': 'none',
            'chat': jsonData.name + ' - ' + humanizedISO8601DateTime(),
            'mes_example': jsonData.example_dialogue ?? '',
            'scenario': jsonData.world_scenario ?? '',
            'create_date': humanizedISO8601DateTime(),
            'talkativeness': jsonData.talkativeness ?? 0.5,
            'creator': jsonData.creator ?? '',
            'tags': jsonData.tags ?? '',
        };
        char = convertToV2(char, request.user.directories);
        const charJSON = JSON.stringify(char);
        const result = await writeCharacterData(defaultAvatarPath, charJSON, pngName, request);
        return result ? pngName : '';
    }

    return '';
}

/**
 * Import a character from a PNG file.
 * @param {string} uploadPath Path to the uploaded file
 * @param {{ request: import('express').Request, response: import('express').Response }} context Express request and response objects
 * @param {string|undefined} preservedFileName Preserved file name
 * @returns {Promise<string>} Internal name of the character
 */
async function importFromPng(uploadPath, { request }, preservedFileName) {
    const imgData = await readCharacterData(uploadPath);
    if (imgData === undefined) throw new Error('Failed to read character data');

    let jsonData = JSON.parse(imgData);

    jsonData.name = sanitize(jsonData.data?.name || jsonData.name);
    const pngName = preservedFileName || getPngName(jsonData.name, request.user.directories);

    if (jsonData.spec !== undefined) {
        console.log(`Found a ${jsonData.spec} character file.`);
        importRisuSprites(request.user.directories, jsonData);
        unsetFavFlag(jsonData);
        jsonData = readFromV2(jsonData);
        jsonData['create_date'] = humanizedISO8601DateTime();
        const char = JSON.stringify(jsonData);
        const result = await writeCharacterData(uploadPath, char, pngName, request);
        fs.unlinkSync(uploadPath);
        return result ? pngName : '';
    } else if (jsonData.name !== undefined) {
        console.log('Found a v1 character file.');

        if (jsonData.creator_notes) {
            jsonData.creator_notes = jsonData.creator_notes.replace('Creator\'s notes go here.', '');
        }

        let char = {
            'name': jsonData.name,
            'description': jsonData.description ?? '',
            'creatorcomment': jsonData.creatorcomment ?? jsonData.creator_notes ?? '',
            'personality': jsonData.personality ?? '',
            'first_mes': jsonData.first_mes ?? '',
            'avatar': 'none',
            'chat': jsonData.name + ' - ' + humanizedISO8601DateTime(),
            'mes_example': jsonData.mes_example ?? '',
            'scenario': jsonData.scenario ?? '',
            'create_date': humanizedISO8601DateTime(),
            'talkativeness': jsonData.talkativeness ?? 0.5,
            'creator': jsonData.creator ?? '',
            'tags': jsonData.tags ?? '',
        };
        char = convertToV2(char, request.user.directories);
        const charJSON = JSON.stringify(char);
        const result = await writeCharacterData(uploadPath, charJSON, pngName, request);
        fs.unlinkSync(uploadPath);
        return result ? pngName : '';
    }

    return '';
}

const router = express.Router();

router.post('/create', urlencodedParser, async function (request, response) {
    try {
        if (!request.body) return response.sendStatus(400);

        request.body.ch_name = sanitize(request.body.ch_name);

        const char = JSON.stringify(charaFormatData(request.body, request.user.directories));
        const internalName = getPngName(request.body.ch_name, request.user.directories);
        const avatarName = `${internalName}.png`;
        const chatsPath = path.join(request.user.directories.chats, internalName);

        if (!fs.existsSync(chatsPath)) fs.mkdirSync(chatsPath);

        if (!request.file) {
            await writeCharacterData(defaultAvatarPath, char, internalName, request);
            return response.send(avatarName);
        } else {
            const crop = tryParse(request.query.crop);
            const uploadPath = path.join(request.file.destination, request.file.filename);
            await writeCharacterData(uploadPath, char, internalName, request, crop);
            fs.unlinkSync(uploadPath);
            return response.send(avatarName);
        }
    } catch (err) {
        console.error(err);
        response.sendStatus(500);
    }
});

router.post('/rename', jsonParser, async function (request, response) {
    if (!request.body.avatar_url || !request.body.new_name) {
        return response.sendStatus(400);
    }

    const oldAvatarName = request.body.avatar_url;
    const newName = sanitize(request.body.new_name);
    const oldInternalName = path.parse(request.body.avatar_url).name;
    const newInternalName = getPngName(newName, request.user.directories);
    const newAvatarName = `${newInternalName}.png`;

    const oldAvatarPath = path.join(request.user.directories.characters, oldAvatarName);

    const oldChatsPath = path.join(request.user.directories.chats, oldInternalName);
    const newChatsPath = path.join(request.user.directories.chats, newInternalName);

    try {
        // Read old file, replace name int it
        const rawOldData = await readCharacterData(oldAvatarPath);
        if (rawOldData === undefined) throw new Error('Failed to read character file');

        const oldData = getCharaCardV2(JSON.parse(rawOldData), request.user.directories);
        _.set(oldData, 'data.name', newName);
        _.set(oldData, 'name', newName);
        const newData = JSON.stringify(oldData);

        // Write data to new location
        await writeCharacterData(oldAvatarPath, newData, newInternalName, request);

        // Rename chats folder
        if (fs.existsSync(oldChatsPath) && !fs.existsSync(newChatsPath)) {
            fs.cpSync(oldChatsPath, newChatsPath, { recursive: true });
            fs.rmSync(oldChatsPath, { recursive: true, force: true });
        }

        // Remove the old character file
        fs.rmSync(oldAvatarPath);

        // Return new avatar name to ST
        return response.send({ avatar: newAvatarName });
    }
    catch (err) {
        console.error(err);
        return response.sendStatus(500);
    }
});

router.post('/edit', urlencodedParser, async function (request, response) {
    if (!request.body) {
        console.error('Error: no response body detected');
        response.status(400).send('Error: no response body detected');
        return;
    }

    if (request.body.ch_name === '' || request.body.ch_name === undefined || request.body.ch_name === '.') {
        console.error('Error: invalid name.');
        response.status(400).send('Error: invalid name.');
        return;
    }

    let char = charaFormatData(request.body, request.user.directories);
    char.chat = request.body.chat;
    char.create_date = request.body.create_date;
    char = JSON.stringify(char);
    let targetFile = (request.body.avatar_url).replace('.png', '');

    try {
        if (!request.file) {
            const avatarPath = path.join(request.user.directories.characters, request.body.avatar_url);
            await writeCharacterData(avatarPath, char, targetFile, request);
        } else {
            const crop = tryParse(request.query.crop);
            const newAvatarPath = path.join(request.file.destination, request.file.filename);
            invalidateThumbnail(request.user.directories, 'avatar', request.body.avatar_url);
            await writeCharacterData(newAvatarPath, char, targetFile, request, crop);
            fs.unlinkSync(newAvatarPath);
        }

        return response.sendStatus(200);
    }
    catch {
        console.error('An error occured, character edit invalidated.');
    }
});


/**
 * Handle a POST request to edit a character attribute.
 *
 * This function reads the character data from a file, updates the specified attribute,
 * and writes the updated data back to the file.
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 * @returns {void}
 */
router.post('/edit-attribute', jsonParser, async function (request, response) {
    console.log(request.body);
    if (!request.body) {
        console.error('Error: no response body detected');
        return response.status(400).send('Error: no response body detected');
    }

    if (request.body.ch_name === '' || request.body.ch_name === undefined || request.body.ch_name === '.') {
        console.error('Error: invalid name.');
        return response.status(400).send('Error: invalid name.');
    }

    try {
        const avatarPath = path.join(request.user.directories.characters, request.body.avatar_url);
        const charJSON = await readCharacterData(avatarPath);
        if (typeof charJSON !== 'string') throw new Error('Failed to read character file');

        const char = JSON.parse(charJSON);
        //check if the field exists
        if (char[request.body.field] === undefined && char.data[request.body.field] === undefined) {
            console.error('Error: invalid field.');
            response.status(400).send('Error: invalid field.');
            return;
        }
        char[request.body.field] = request.body.value;
        char.data[request.body.field] = request.body.value;
        let newCharJSON = JSON.stringify(char);
        const targetFile = (request.body.avatar_url).replace('.png', '');
        await writeCharacterData(avatarPath, newCharJSON, targetFile, request);
        return response.sendStatus(200);
    } catch (err) {
        console.error('An error occured, character edit invalidated.', err);
    }
});

/**
 * Handle a POST request to edit character properties.
 *
 * Merges the request body with the selected character and
 * validates the result against TavernCard V2 specification.
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 *
 * @returns {void}
 * */
router.post('/merge-attributes', jsonParser, async function (request, response) {
    try {
        const update = request.body;
        const avatarPath = path.join(request.user.directories.characters, update.avatar);

        const pngStringData = await readCharacterData(avatarPath);

        if (!pngStringData) {
            console.error('Error: invalid character file.');
            return response.status(400).send('Error: invalid character file.');
        }

        let character = JSON.parse(pngStringData);
        character = deepMerge(character, update);

        const validator = new TavernCardValidator(character);
        const targetImg = (update.avatar).replace('.png', '');

        //Accept either V1 or V2.
        if (validator.validate()) {
            await writeCharacterData(avatarPath, JSON.stringify(character), targetImg, request);
            response.sendStatus(200);
        } else {
            console.log(validator.lastValidationError);
            response.status(400).send({ message: `Validation failed for ${character.name}`, error: validator.lastValidationError });
        }
    } catch (exception) {
        response.status(500).send({ message: 'Unexpected error while saving character.', error: exception.toString() });
    }
});

router.post('/delete', jsonParser, async function (request, response) {
    if (!request.body || !request.body.avatar_url) {
        return response.sendStatus(400);
    }

    if (request.body.avatar_url !== sanitize(request.body.avatar_url)) {
        console.error('Malicious filename prevented');
        return response.sendStatus(403);
    }

    const avatarPath = path.join(request.user.directories.characters, request.body.avatar_url);
    if (!fs.existsSync(avatarPath)) {
        return response.sendStatus(400);
    }

    fs.rmSync(avatarPath);
    invalidateThumbnail(request.user.directories, 'avatar', request.body.avatar_url);
    let dir_name = (request.body.avatar_url.replace('.png', ''));

    if (!dir_name.length) {
        console.error('Malicious dirname prevented');
        return response.sendStatus(403);
    }

    if (request.body.delete_chats == true) {
        try {
            await fs.promises.rm(path.join(request.user.directories.chats, sanitize(dir_name)), { recursive: true, force: true });
        } catch (err) {
            console.error(err);
            return response.sendStatus(500);
        }
    }

    return response.sendStatus(200);
});

/**
 * HTTP POST endpoint for the "/api/characters/all" route.
 *
 * This endpoint is responsible for reading character files from the `charactersPath` directory,
 * parsing character data, calculating stats for each character and responding with the data.
 * Stats are calculated only on the first run, on subsequent runs the stats are fetched from
 * the `charStats` variable.
 * The stats are calculated by the `calculateStats` function.
 * The characters are processed by the `processCharacter` function.
 *
 * @param  {import("express").Request} request The HTTP request object.
 * @param  {import("express").Response} response The HTTP response object.
 * @return {void}
 */
router.post('/all', jsonParser, async function (request, response) {
    try {
        const files = fs.readdirSync(request.user.directories.characters);
        const pngFiles = files.filter(file => file.endsWith('.png'));
        const processingPromises = pngFiles.map(file => processCharacter(file, request.user.directories));
        const data = (await Promise.all(processingPromises)).filter(c => c.name);
        return response.send(data);
    } catch (err) {
        console.error(err);
        response.sendStatus(500);
    }
});

router.post('/get', jsonParser, async function (request, response) {
    try {
        if (!request.body) return response.sendStatus(400);
        const item = request.body.avatar_url;
        const filePath = path.join(request.user.directories.characters, item);

        if (!fs.existsSync(filePath)) {
            return response.sendStatus(404);
        }

        const data = await processCharacter(item, request.user.directories);

        return response.send(data);
    } catch (err) {
        console.error(err);
        response.sendStatus(500);
    }
});

router.post('/chats', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const characterDirectory = (request.body.avatar_url).replace('.png', '');

    try {
        const chatsDirectory = path.join(request.user.directories.chats, characterDirectory);
        const files = fs.readdirSync(chatsDirectory);
        const jsonFiles = files.filter(file => path.extname(file) === '.jsonl');

        if (jsonFiles.length === 0) {
            response.send({ error: true });
            return;
        }

        if (request.body.simple) {
            return response.send(jsonFiles.map(file => ({ file_name: file })));
        }

        const jsonFilesPromise = jsonFiles.map((file) => {
            return new Promise(async (res) => {
                const pathToFile = path.join(request.user.directories.chats, characterDirectory, file);
                const fileStream = fs.createReadStream(pathToFile);
                const stats = fs.statSync(pathToFile);
                const fileSizeInKB = `${(stats.size / 1024).toFixed(2)}kb`;

                if (stats.size === 0) {
                    console.log(`Found an empty chat file: ${pathToFile}`);
                    res({});
                    return;
                }

                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity,
                });

                let lastLine;
                let itemCounter = 0;
                rl.on('line', (line) => {
                    itemCounter++;
                    lastLine = line;
                });
                rl.on('close', () => {
                    rl.close();

                    if (lastLine) {
                        const jsonData = tryParse(lastLine);
                        if (jsonData && (jsonData.name || jsonData.character_name)) {
                            const chatData = {};

                            chatData['file_name'] = file;
                            chatData['file_size'] = fileSizeInKB;
                            chatData['chat_items'] = itemCounter - 1;
                            chatData['mes'] = jsonData['mes'] || '[The chat is empty]';
                            chatData['last_mes'] = jsonData['send_date'] || Date.now();

                            res(chatData);
                        } else {
                            console.log('Found an invalid or corrupted chat file:', pathToFile);
                            res({});
                        }
                    }
                });
            });
        });

        const chatData = await Promise.all(jsonFilesPromise);
        const validFiles = chatData.filter(i => i.file_name);

        return response.send(validFiles);
    } catch (error) {
        console.log(error);
        return response.send({ error: true });
    }
});

/**
 * Gets the name for the uploaded PNG file.
 * @param {string} file File name
 * @param {import('../users').UserDirectoryList} directories User directories
 * @returns {string} - The name for the uploaded PNG file
 */
function getPngName(file, directories) {
    let i = 1;
    const baseName = file;
    while (fs.existsSync(path.join(directories.characters, `${file}.png`))) {
        file = baseName + i;
        i++;
    }
    return file;
}

/**
 * Gets the preserved name for the uploaded file if the request is valid.
 * @param {import("express").Request} request - Express request object
 * @returns {string | undefined} - The preserved name if the request is valid, otherwise undefined
 */
function getPreservedName(request) {
    return typeof request.body.preserved_name === 'string' && request.body.preserved_name.length > 0
        ? path.parse(request.body.preserved_name).name
        : undefined;
}

router.post('/import', urlencodedParser, async function (request, response) {
    if (!request.body || !request.file) return response.sendStatus(400);

    const uploadPath = path.join(request.file.destination, request.file.filename);
    const format = request.body.file_type;
    const preservedFileName = getPreservedName(request);

    const formatImportFunctions = {
        'yaml': importFromYaml,
        'yml': importFromYaml,
        'json': importFromJson,
        'png': importFromPng,
        'charx': importFromCharX,
    };

    try {
        const importFunction = formatImportFunctions[format];

        if (!importFunction) {
            throw new Error(`Unsupported format: ${format}`);
        }

        const fileName = await importFunction(uploadPath, { request, response }, preservedFileName);

        if (!fileName) {
            console.error('Failed to import character');
            return response.sendStatus(400);
        }

        if (preservedFileName) {
            invalidateThumbnail(request.user.directories, 'avatar', `${preservedFileName}.png`);
        }

        response.send({ file_name: fileName });
    } catch (err) {
        console.log(err);
        response.send({ error: true });
    }
});

router.post('/duplicate', jsonParser, async function (request, response) {
    try {
        if (!request.body.avatar_url) {
            console.log('avatar URL not found in request body');
            console.log(request.body);
            return response.sendStatus(400);
        }
        let filename = path.join(request.user.directories.characters, sanitize(request.body.avatar_url));
        if (!fs.existsSync(filename)) {
            console.log('file for dupe not found');
            console.log(filename);
            return response.sendStatus(404);
        }
        let suffix = 1;
        let newFilename = filename;

        // If filename ends with a _number, increment the number
        const nameParts = path.basename(filename, path.extname(filename)).split('_');
        const lastPart = nameParts[nameParts.length - 1];

        let baseName;

        if (!isNaN(Number(lastPart)) && nameParts.length > 1) {
            suffix = parseInt(lastPart) + 1;
            baseName = nameParts.slice(0, -1).join('_'); // construct baseName without suffix
        } else {
            baseName = nameParts.join('_'); // original filename is completely the baseName
        }

        newFilename = path.join(request.user.directories.characters, `${baseName}_${suffix}${path.extname(filename)}`);

        while (fs.existsSync(newFilename)) {
            let suffixStr = '_' + suffix;
            newFilename = path.join(request.user.directories.characters, `${baseName}${suffixStr}${path.extname(filename)}`);
            suffix++;
        }

        fs.copyFileSync(filename, newFilename);
        console.log(`${filename} was copied to ${newFilename}`);
        response.send({ path: path.parse(newFilename).base });
    }
    catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

router.post('/export', jsonParser, async function (request, response) {
    try {
        if (!request.body.format || !request.body.avatar_url) {
            return response.sendStatus(400);
        }

        let filename = path.join(request.user.directories.characters, sanitize(request.body.avatar_url));

        if (!fs.existsSync(filename)) {
            return response.sendStatus(404);
        }

        switch (request.body.format) {
            case 'png': {
                const fileContent = await fsPromises.readFile(filename);
                const contentType = mime.lookup(filename) || 'image/png';
                response.setHeader('Content-Type', contentType);
                response.setHeader('Content-Disposition', `attachment; filename="${encodeURI(path.basename(filename))}"`);
                return response.send(fileContent);
            }
            case 'json': {
                try {
                    let json = await readCharacterData(filename);
                    if (json === undefined) return response.sendStatus(400);
                    let jsonObject = getCharaCardV2(JSON.parse(json), request.user.directories);
                    return response.type('json').send(JSON.stringify(jsonObject, null, 4));
                }
                catch {
                    return response.sendStatus(400);
                }
            }
        }

        return response.sendStatus(400);
    } catch (err) {
        console.error('Character export failed', err);
        response.sendStatus(500);
    }
});

module.exports = { router };
